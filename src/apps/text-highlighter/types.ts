import { JitenCardState } from '@shared/jiten/types';

export type TextHighlighterOptions = {
  skipFurigana: boolean;
  generatePitch: boolean;
  markFrequency: false | number;
  markAll: boolean;
  markIPlus1: boolean;
  minSentenceLength: number;
  iPlusOneMaxFrequency: false | number;
  newStates: JitenCardState[];
  markWordsInDeck: boolean;
};
