import { getConfiguration } from '../configuration/get-configuration';
import { JPDBEndpoints, JitenRequestOptions } from './api.types';
import { requestByUrl } from './request-by-url';

export const request = async <Key extends keyof JPDBEndpoints>(
  action: Key,
  params: JPDBEndpoints[Key][0] | undefined,
  options?: JitenRequestOptions,
): Promise<JPDBEndpoints[Key][1]> => {
  const baseUrl = await getConfiguration('jitenApiEndpoint');

  return await requestByUrl(baseUrl, action, params, options);
};
