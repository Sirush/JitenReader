import { Empty } from '../types';
import { JPDBDeck, JitenParseResult, JitenCardState } from './types';

// type JPDBVidSidTuple = [vid: number, sid: number][];

type JitenParseRequest = {
  text: string[];
};

type JitenLookupVocabularyRequest = {
  words: [number, number][];
};

type JitenLookupVocabularyResult = {
  result: [JitenCardState[]];
};

type JitenReviewRequest = {
  wordId: number;
  readingIndex: number;
  rating: number;
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

type JPDBListUserDecksRequest = {
  fields: JPDBDeckFields[];
};
type JPDBListUserDecksResult = {
  decks: Exclude<JPDBDeck[keyof JPDBDeck], undefined>[][];
};

// export type JPDBAddVocabularyRequest = {
//   id: number | JPDBSpecialDeckNames;
//   vocabulary: JPDBVidSidTuple;
//   occurences?: number[];
//   replace_existing_occurences?: boolean;
//   ignore_unknown?: boolean;
// };
// export type JPDBRemoveVocabularyRequest = Pick<JPDBAddVocabularyRequest, 'id' | 'vocabulary'>;

export type JPDBDeckFields = keyof JPDBDeck;

export type JitenRequestOptions = {
  apiToken?: string;
};

export type JitenErrorResponse = {
  error_message: string;
};

export type JPDBEndpoints = {
  'reader/ping': [Empty, void];
  'reader/parse': [JitenParseRequest, JitenParseResult];
  'srs/review': [JitenReviewRequest, void];
  'srs/set-vocabulary-state': [JitenSetVocabularyStateRequest, void];
  'reader/lookup-vocabulary': [JitenLookupVocabularyRequest, JitenLookupVocabularyResult];
  'list-user-decks': [JPDBListUserDecksRequest, JPDBListUserDecksResult];
  // 'deck/add-vocabulary': [JPDBAddVocabularyRequest, void];
  // 'deck/remove-vocabulary': [JPDBRemoveVocabularyRequest, void];
  // 'set-card-sentence': [JPDBSetSentenceRequest, void];
  prioritize: [{ v: number; s: number; origin: string }, void];
  deprioritize: [{ v: number; s: number; origin: string }, void];
};
