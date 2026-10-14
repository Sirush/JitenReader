import { getConfiguration } from '../configuration/get-configuration';
import { displayToast } from '../dom/display-toast';
import { JitenEndpoints, JitenErrorResponse, JitenRequestOptions } from './api.types';
import { JITEN_TIMEOUT_MESSAGE, toConnectionError } from './connection-errors';
import { RateLimitedError } from './rate-limited-error';

const CONNECT_TIMEOUT_MS = 10_000;
const DOWNLOAD_STALL_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;
const DEFAULT_RETRY_AFTER_MS = 5_000;

const API_KEY_REJECTED_MESSAGE =
  'Jiten API key was rejected by the server. Please update it in the extension settings.';

// Latches the token that was rejected with 401/403 so subsequent requests fail
// fast without hitting the API until the key is changed or revalidated.
let rejectedApiToken: string | undefined;

export const clearRejectedApiToken = (): void => {
  rejectedApiToken = undefined;
};

export const isApiTokenRejected = async (): Promise<boolean> => {
  if (!rejectedApiToken) {
    return false;
  }

  return (await getConfiguration('jitenApiKey')) === rejectedApiToken;
};

const DOWNLOAD_STALLED = Symbol('download stalled');

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitBeforeRetry = (attempt: number): Promise<void> => {
  const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;

  return wait(backoff + Math.random() * backoff * 0.5);
};

const abortOnTimeout = (controller: AbortController): void =>
  controller.abort(new DOMException('Request timed out', 'TimeoutError'));

// Large parse responses can take minutes on slow connections, so only a download that stops progressing fails.
const readBody = async (
  response: Response,
  controller: AbortController,
): Promise<string | typeof DOWNLOAD_STALLED> => {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let stalled = false;
  const onStall = (): void => {
    stalled = true;
    abortOnTimeout(controller);
  };
  const deadline = setTimeout(() => abortOnTimeout(controller), DOWNLOAD_TIMEOUT_MS);
  let stall = setTimeout(onStall, DOWNLOAD_STALL_TIMEOUT_MS);

  try {
    let chunk = await reader.read();

    while (!chunk.done) {
      chunks.push(chunk.value);
      clearTimeout(stall);
      stall = setTimeout(onStall, DOWNLOAD_STALL_TIMEOUT_MS);
      chunk = await reader.read();
    }
  } catch (error) {
    if (stalled) {
      return DOWNLOAD_STALLED;
    }

    throw error;
  } finally {
    clearTimeout(deadline);
    clearTimeout(stall);
  }

  return new Blob(chunks).text();
};

const parseRetryAfter = (header: string | null): number => {
  const seconds = Number(header);

  return header?.trim() && Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1000
    : DEFAULT_RETRY_AFTER_MS;
};

const isRetryable = (error: unknown, response?: Response): boolean => {
  if (!response) {
    return true;
  }

  const status = response.status;

  return status === 429 || status >= 500;
};

export const requestByUrl = async <Key extends keyof JitenEndpoints>(
  baseUrl = 'https://api.jiten.moe',
  action: Key,
  params: JitenEndpoints[Key][0] | undefined,
  options?: JitenRequestOptions,
): Promise<JitenEndpoints[Key][1]> => {
  const apiToken = options?.apiToken || (await getConfiguration('jitenApiKey'));

  if (!apiToken?.length) {
    displayToast('error', 'API Token is not set');

    throw new Error('API Token is not set');
  }

  // Requests with an explicitly provided token (e.g. key validation in the
  // settings) bypass the latch so the server is actually consulted again.
  if (!options?.apiToken && apiToken === rejectedApiToken) {
    throw new Error(API_KEY_REJECTED_MESSAGE);
  }

  const usedUrl = new URL(`${baseUrl}/${action}`);
  let lastError: unknown;
  let downloadRetried = false;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let response: Response | undefined;
    const controller = new AbortController();
    const connectTimeout = setTimeout(() => abortOnTimeout(controller), CONNECT_TIMEOUT_MS);

    try {
      response = await fetch(usedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `ApiKey ${apiToken}`,
          Accept: 'application/json',
        },
        body: params ? JSON.stringify(params) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES - 1) {
        await waitBeforeRetry(attempt);

        continue;
      }

      throw toConnectionError(error);
    } finally {
      clearTimeout(connectTimeout);
    }

    if (response.status === 401 || response.status === 403) {
      rejectedApiToken = apiToken;

      throw new Error(API_KEY_REJECTED_MESSAGE);
    }

    if (response.status === 429 && (options?.failFastOnRateLimit || attempt === MAX_RETRIES - 1)) {
      throw new RateLimitedError(parseRetryAfter(response.headers.get('Retry-After')));
    }

    if (!response.ok && isRetryable(null, response) && attempt < MAX_RETRIES - 1) {
      await waitBeforeRetry(attempt);

      continue;
    }

    let body: string | typeof DOWNLOAD_STALLED;

    try {
      body = await readBody(response, controller);
    } catch (error) {
      throw toConnectionError(error);
    }

    if (body === DOWNLOAD_STALLED) {
      lastError = new Error(JITEN_TIMEOUT_MESSAGE);

      // Retried once: a stall usually means a dropped connection, whereas hitting the overall cap means a slow one.
      if (!downloadRetried && attempt < MAX_RETRIES - 1) {
        downloadRetried = true;
        await waitBeforeRetry(attempt);

        continue;
      }

      throw lastError;
    }

    const responseObject = JSON.parse(body) as JitenErrorResponse | JitenEndpoints[Key][1];

    if ('error_message' in (responseObject as JitenErrorResponse)) {
      throw new Error((responseObject as JitenErrorResponse).error_message);
    }

    if (apiToken === rejectedApiToken) {
      rejectedApiToken = undefined;
    }

    return responseObject as JitenEndpoints[Key][1];
  }

  throw lastError;
};
