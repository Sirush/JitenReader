import { JitenRequestOptions } from './api.types';
import { request } from './request';
import { JitenCardState } from './types';

const CARD_STATE_MAP: Record<number, JitenCardState> = {
  0: JitenCardState.NEW,
  1: JitenCardState.YOUNG,
  2: JitenCardState.MATURE,
  3: JitenCardState.BLACKLISTED,
  4: JitenCardState.DUE,
  5: JitenCardState.MASTERED,
};

export type CardStateResult = {
  states: JitenCardState[];
  deckIds: number[];
};

export const getCardState = async (
  wordId: number,
  readingIndex: number,
  options?: JitenRequestOptions,
): Promise<CardStateResult> => {
  const result = await request(
    'reader/lookup-vocabulary',
    {
      words: [[wordId, readingIndex]],
    },
    options,
  );
  const [firstWord] = result.result;
  const deckIds = result.decks?.[0] ?? [];

  if (!Array.isArray(firstWord) || firstWord.length === 0) {
    return { states: [JitenCardState.NEW], deckIds };
  }

  const states = firstWord
    .map((state: number) => CARD_STATE_MAP[state])
    .filter((s): s is JitenCardState => s !== undefined);

  return { states: states.length > 0 ? states : [JitenCardState.NEW], deckIds };
};
