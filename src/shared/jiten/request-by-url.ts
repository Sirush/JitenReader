import { getConfiguration } from '../configuration/get-configuration';
import { displayToast } from '../dom/display-toast';
import { JitenEndpoints, JitenErrorResponse, JitenRequestOptions } from './api.types';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

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

    if (!response.ok && isRetryable(null, response) && attempt < MAX_RETRIES - 1) {
      const backoff = INITIAL_BACKOFF_MS * 2 ** attempt;

      await wait(backoff + Math.random() * backoff * 0.5);

      continue;
    }

    const responseObject = (await response.json()) as JitenErrorResponse | JitenEndpoints[Key][1];

    if ('error_message' in (responseObject as JitenErrorResponse)) {
      throw new Error((responseObject as JitenErrorResponse).error_message);
    }

    return responseObject as JitenEndpoints[Key][1];
  }

  throw lastError;
};
