import { JitenRequestOptions, StudyDeckListItem } from './api.types';
import { request } from './request';

export const fetchStudyDecks = (options?: JitenRequestOptions): Promise<StudyDeckListItem[]> =>
  request('srs/reader-study-decks', undefined, options);
