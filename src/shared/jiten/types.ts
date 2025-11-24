type JitenMeaning = {
  glosses: string[];
  partsOfSpeech: string[];
};

export type JitenRuby = {
  text: string;
  start: number;
  end: number;
  length: number;
};

export type JitenParseResult = {
  tokens: JitenToken[][];
  vocabulary: JitenRawVocabulary[];
};

export type JPDBSpecialDeckNames = 'blacklist' | 'never-forget' | 'forq';
export type JPDBDeck = {
  id?: JPDBSpecialDeckNames | number;
  name?: string;
  vocabulary_count?: number;
  word_count?: number;
  vocabulary_known_coverage?: number;
  vocabulary_in_progress_coverage?: number;
  is_built_in?: boolean;
};

export type JitenRating = 'unknown' | 'again' | 'hard' | 'good' | 'easy';
export const JitenRatingMap: Record<JitenRating, number> = {
  unknown: 0,
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

export enum JitenCardState {
  NEW = 'new',
  YOUNG = 'young',
  MATURE = 'mature',
  DUE = 'due',
}

export type JitenRawVocabulary = {
  wordId: number;
  readingIndex: number;
  spelling: string;
  reading: string;
  frequencyRank: number;
  partsOfSpeech: string[];
  meaningsChunks: string[][];
  meaningsPartOfSpeech: string[][];
  knownState: JitenCardState;
  pitchAccent: number[] | null;
};

export type JitenCard = {
  wordId: number;
  readingIndex: number;
  spelling: string;
  reading: string;
  frequencyRank: number;
  partsOfSpeech: string[];
  meanings: JitenMeaning[];
  cardState: JitenCardState[];
  pitchAccent: number[];
  wordWithReading: string | null;
};

export type JitenToken = {
  card: JitenCard;
  wordId: number;
  readingIndex: number;
  start: number;
  end: number;
  length: number;
  sentence?: string;
  pitchClass: string;
  rubies: JitenRuby[];
  conjugations: string[];
};

export type LabeledCardState = {
  id: JitenCardState;
  name: string;
  description: string;
};
