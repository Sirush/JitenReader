import { JitenRequestOptions } from './api.types';
import { request } from './request';

export const ping = async (options?: JitenRequestOptions): Promise<boolean> => {
  await request('reader/ping', undefined, options);

  return true;
};
