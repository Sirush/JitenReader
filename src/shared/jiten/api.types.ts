import { Empty } from '../types';
import { JitenParseResult, StudyDeckType } from './types';

// type JPDBVidSidTuple = [vid: number, sid: number][];

type JitenParseRequest = {
  text: string[];
};

type JitenLookupVocabularyRequest = {
  words: [number, number][];
};

type JitenLookupVocabularyResult = {
  result: number[][];
  decks: number[][];
};

type JitenReviewRequest = {
  wordId: number;
  readingIndex: number;
  rating: number;
};

type JitenBatchReviewRequest = {
  reviews: { wordId: number; readingIndex: number; rating: number }[];
};

export type JitenBatchReviewResult = {
  success: boolean;
  processed: number;
  leechSuspended: number[];
  results: { wordId: number; readingIndex: number; newState: number }[];
};

type JitenSetVocabularyStateRequest = {
  wordId: number;
  readingIndex: number;
  state: string;
};

// type JPDBSetSentenceRequest = {
//   wordId: number;
//   readingIndex: number;
//   sentence: string;
// };

// export type JPDBAddVocabularyRequest = {
//   id: number | JPDBSpecialDeckNames;
//   vocabulary: JPDBVidSidTuple;
//   occurences?: number[];
//   replace_existing_occurences?: boolean;
//   ignore_unknown?: boolean;
// };
// export type JPDBRemoveVocabularyRequest = Pick<JPDBAddVocabularyRequest, 'id' | 'vocabulary'>;

export type StudyDeckListItem = {
  userStudyDeckId: number;
  name: string;
  deckType: StudyDeckType;
};

export type JitenRequestOptions = {
  apiToken?: string;
};

export type JitenErrorResponse = {
  error_message: string;
};

export type JitenEndpoints = {
  'reader/ping': [Empty, void];
  'reader/parse': [JitenParseRequest, JitenParseResult];
  'srs/review': [JitenReviewRequest, void];
  'srs/batch-review': [JitenBatchReviewRequest, JitenBatchReviewResult];
  'srs/set-vocabulary-state': [JitenSetVocabularyStateRequest, void];
  'srs/reader-study-decks': [Empty, StudyDeckListItem[]];
  'reader/lookup-vocabulary': [JitenLookupVocabularyRequest, JitenLookupVocabularyResult];
  // 'deck/add-vocabulary': [JPDBAddVocabularyRequest, void];
  // 'deck/remove-vocabulary': [JPDBRemoveVocabularyRequest, void];
  // 'set-card-sentence': [JPDBSetSentenceRequest, void];
  prioritize: [{ v: number; s: number; origin: string }, void];
  deprioritize: [{ v: number; s: number; origin: string }, void];
};
