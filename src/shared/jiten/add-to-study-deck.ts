import { getConfiguration } from '../configuration/get-configuration';
import { requestByUrl } from './request-by-url';

export const addToStudyDeck = async (
  deckId: number,
  wordId: number,
  readingIndex: number,
  sentence?: string,
  source?: string,
): Promise<void> => {
  const baseUrl = await getConfiguration('jitenApiEndpoint');

  await requestByUrl(baseUrl, `srs/study-decks/${deckId}/words` as never, {
    wordId,
    readingIndex,
    occurrences: 1,
    sentence,
    source,
  });
};
