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

export type JitenRating = 'unknown' | 'again' | 'hard' | 'good' | 'easy';
export const JitenRatingMap: Record<JitenRating, number> = {
  unknown: 0,
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

export type BatchReviewItem = {
  wordId: number;
  readingIndex: number;
  rating: JitenRating;
};

export enum JitenCardState {
  NEW = 'new',
  YOUNG = 'young',
  MATURE = 'mature',
  MASTERED = 'mastered',
  BLACKLISTED = 'blacklisted',
  DUE = 'due',
  // A kana form whose kanji sibling the user already knows. Always accompanies a tier
  // state (e.g. [YOUNG, REDUNDANT]); marks the word as known-via-kanji and not reviewable.
  REDUNDANT = 'redundant',
}

// Mirrors the backend StudyDeckType enum.
export enum StudyDeckType {
  MEDIA_DECK = 0,
  GLOBAL_DYNAMIC = 1,
  STATIC_WORD_LIST = 2,
}

// CSS class applied to a word for each type of study deck it belongs to.
export const STUDY_DECK_CLASS: Record<StudyDeckType, string> = {
  [StudyDeckType.MEDIA_DECK]: 'in-media-deck',
  [StudyDeckType.GLOBAL_DYNAMIC]: 'in-frequency-deck',
  [StudyDeckType.STATIC_WORD_LIST]: 'in-word-list',
};

// Generic class applied to any word in at least one study deck, regardless of type.
export const IN_ANY_DECK_CLASS = 'in-any-deck';

export const DECK_MEMBERSHIP_CLASSES = [...Object.values(STUDY_DECK_CLASS), IN_ANY_DECK_CLASS];

export type JitenRawVocabulary = {
  wordId: number;
  readingIndex: number;
  spelling: string;
  reading: string;
  frequencyRank: number;
  partsOfSpeech: string[];
  meaningsChunks: string[][];
  meaningsPartOfSpeech: string[][];
  knownState: number[];
  pitchAccents: number[] | null;
  studyDeckIds: number[];
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
  pitchAccents: number[];
  wordWithReading: string | null;
  deckIds: number[];
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
