import { getConfiguration } from '../configuration/get-configuration';
import { JitenEndpoints, JitenRequestOptions } from './api.types';
import { requestByUrl } from './request-by-url';

export const request = async <Key extends keyof JitenEndpoints>(
  action: Key,
  params: JitenEndpoints[Key][0] | undefined,
  options?: JitenRequestOptions,
): Promise<JitenEndpoints[Key][1]> => {
  const baseUrl = await getConfiguration('jitenApiEndpoint');

  return await requestByUrl(baseUrl, action, params, options);
};
