import { JitenRequestOptions } from './api.types';
import { request } from './request';

export const setCardSentence = (
  wordId: number,
  readingIndex: number,
  sentence: string,
  options?: JitenRequestOptions,
): Promise<void> =>
  request(
    'set-card-sentence',
    {
      wordId,
      readingIndex,
      sentence,
    },
    options,
  );
