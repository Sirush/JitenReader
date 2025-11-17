import { JitenCardState } from '../../jiten/types';
import { BroadcastCommand } from '../lib/broadcast-command';

export class CardStateUpdatedCommand extends BroadcastCommand<
  [wordId: number, readingIndex: number, cardstate: JitenCardState[]]
> {
  public readonly key = 'cardStateUpdated';
}
