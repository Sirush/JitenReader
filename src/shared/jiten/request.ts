import { JPDBEndpoints, JitenRequestOptions } from './api.types';
import { requestByUrl } from './request-by-url';

export const request = async <Key extends keyof JPDBEndpoints>(
  action: Key,
  params: JPDBEndpoints[Key][0] | undefined,
  options?: JitenRequestOptions,
): Promise<JPDBEndpoints[Key][1]> => {
  return await requestByUrl('https://localhost:7299/api', action, params, options);
};
