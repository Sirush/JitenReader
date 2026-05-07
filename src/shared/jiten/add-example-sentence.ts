import { getConfiguration } from '../configuration/get-configuration';
import { requestByUrl } from './request-by-url';

export const addExampleSentence = async (
  wordId: number,
  readingIndex: number,
  text: string,
  source?: string,
): Promise<void> => {
  const baseUrl = await getConfiguration('jitenApiEndpoint');

  await requestByUrl(baseUrl, `user/example-sentences/${wordId}/${readingIndex}` as never, {
    text,
    source,
  });
};
