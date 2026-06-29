import { getConfiguration } from '../configuration/get-configuration';
import { displayToast } from '../dom/display-toast';
import { JitenEndpoints, JitenErrorResponse, JitenRequestOptions } from './api.types';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

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

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

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

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let response: Response | undefined;

    try {
      response = await fetch(usedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `ApiKey ${apiToken}`,
          Accept: 'application/json',
        },
        body: params ? JSON.stringify(params) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;

      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;

        await wait(backoff + Math.random() * backoff * 0.5);

        continue;
      }

      displayToast('error', 'jiten.moe is unreachable', (error as Error).message);

      throw error;
    }

    if (response.status === 401 || response.status === 403) {
      rejectedApiToken = apiToken;

      throw new Error(API_KEY_REJECTED_MESSAGE);
    }

    if (!response.ok && isRetryable(null, response) && attempt < MAX_RETRIES - 1) {
      const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;

      await wait(backoff + Math.random() * backoff * 0.5);

      continue;
    }

    const responseObject = (await response.json()) as JitenErrorResponse | JitenEndpoints[Key][1];

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
