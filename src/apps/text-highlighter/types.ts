import { JitenCardState } from '@shared/jiten/types';

export type TextHighlighterOptions = {
  skipFurigana: boolean;
  generatePitch: boolean;
  markFrequency: false | number;
  markAll: boolean;
  markIPlus1: boolean;
  minSentenceLength: number;
  markOnlyFrequent: boolean;
  newStates: JitenCardState[];
};
