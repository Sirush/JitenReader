import { JitenRequestOptions } from './api.types';
import { request } from './request';
import { JitenCardState } from './types';

export const getCardState = async (
  wordId: number,
  readingIndex: number,
  options?: JitenRequestOptions,
): Promise<JitenCardState[]> => {
  const result = await request(
    'reader/lookup-vocabulary',
    {
      words: [[wordId, readingIndex]],
    },
    options,
  );
  const [firstWord] = result.result;
  const [firstField] = firstWord;

  return firstField?.length ? [firstField] : [JitenCardState.NEW];
};
