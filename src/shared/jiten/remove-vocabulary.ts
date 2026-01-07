import { JitenRequestOptions } from './api.types';
import { request } from './request';

export const removeVocabulary = async (
  deckName: string,
  wordId: number,
  readingIndex: number,
  options?: JitenRequestOptions,
): Promise<void> => {
  await request(
    'srs/set-vocabulary-state',
    {
      wordId,
      readingIndex,
      state: `${deckName}-remove`,
    },
    options,
  );
};
