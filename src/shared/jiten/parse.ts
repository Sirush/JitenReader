import { JitenRequestOptions } from './api.types';
import { request } from './request';
import { JitenParseResult } from './types';

export const parse = async (
  paragraphs: string[],
  options?: JitenRequestOptions,
): Promise<JitenParseResult> => {
  const result = await request(
    'reader/parse',
    {
      text: paragraphs,
    },
    options,
  );

  return result;
};
