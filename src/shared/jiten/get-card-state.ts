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
  6: JitenCardState.REDUNDANT,
  7: JitenCardState.SUSPENDED,
};

export type CardStateResult = {
  states: JitenCardState[];
  deckIds: number[];
};

const toCardStateResult = (states: number[] | undefined, deckIds: number[]): CardStateResult => {
  if (!Array.isArray(states) || states.length === 0) {
    return { states: [JitenCardState.NEW], deckIds };
  }

  const mapped = states
    .map((state: number) => CARD_STATE_MAP[state])
    .filter((s): s is JitenCardState => s !== undefined);

  return { states: mapped.length > 0 ? mapped : [JitenCardState.NEW], deckIds };
};

export const getCardState = async (
  wordId: number,
  readingIndex: number,
  options?: JitenRequestOptions,
): Promise<CardStateResult> => {
  const [state] = await getCardStates([[wordId, readingIndex]], options);

  return state;
};

export const getCardStates = async (
  words: [number, number][],
  options?: JitenRequestOptions,
): Promise<CardStateResult[]> => {
  if (words.length === 0) {
    return [];
  }

  const result = await request('reader/lookup-vocabulary', { words }, options);

  return words.map((_, index) =>
    toCardStateResult(result.result?.[index], result.decks?.[index] ?? []),
  );
};
