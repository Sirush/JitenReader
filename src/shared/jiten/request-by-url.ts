import { getConfiguration } from '../configuration/get-configuration';
import { displayToast } from '../dom/display-toast';
import { JPDBEndpoints, JitenErrorResponse, JitenRequestOptions } from './api.types';

export const requestByUrl = async <Key extends keyof JPDBEndpoints>(
  baseUrl = 'https://api.jiten.moe',
  action: Key,
  params: JPDBEndpoints[Key][0] | undefined,
  options?: JitenRequestOptions,
): Promise<JPDBEndpoints[Key][1]> => {
  const apiToken = options?.apiToken || (await getConfiguration('jitenApiKey'));

  if (!apiToken?.length) {
    displayToast('error', 'API Token is not set');

    throw new Error('API Token is not set');
  }

  const usedUrl = new URL(`${baseUrl}/${action}`);
  let response: Response;

  try {
    response = await fetch(usedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${apiToken}`,
        Accept: 'application/json',
      },
      body: params ? JSON.stringify(params) : undefined,
    });
  } catch (error) {
    displayToast('error', 'jiten.moe is unreachable', (error as Error).message);

    throw error;
  }

  const responseObject = (await response.json()) as JitenErrorResponse | JPDBEndpoints[Key][1];

  if ('error_message' in (responseObject as JitenErrorResponse)) {
    throw new Error((responseObject as JitenErrorResponse).error_message);
  }

  return responseObject as JPDBEndpoints[Key][1];
};
