import { JitenCardState, JPDBDeck } from '../../jiten/types';
import { PotentialPromise } from '../../types';

/**
 * Defines events emitted from any part of the extension to all parts of the extension
 */
export interface BroadcastEvents {
  configurationUpdated: [];
  cardStateUpdated: [wordId: number, readingIndex: number, cardstate: JitenCardState[]];
  deckListUpdated: [decks: JPDBDeck[]];
}
export type BroadcastEventArgs<T extends keyof BroadcastEvents> = BroadcastEvents[T];
export type BroadcastEventFunction<T extends keyof BroadcastEvents = keyof BroadcastEvents> = (
  ...args: BroadcastEventArgs<T>
) => PotentialPromise<void>;
