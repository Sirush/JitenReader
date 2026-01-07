import { JitenCard } from '@shared/jiten/types';
import { UpdateCardStateCommand } from '@shared/messages/background/update-card-state.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';

export abstract class BaseController {
  public abstract showActions: boolean;

  protected static _suspendUpdateWordStates = false;

  constructor() {
    onBroadcastMessage('configurationUpdated', () => this.applyConfiguration(), true);
  }

  public suspendUpdateWordStates(): void {
    BaseController._suspendUpdateWordStates = true;
  }

  public resumeUpdateWordStates(card: JitenCard): void {
    BaseController._suspendUpdateWordStates = false;

    this.updateCardState(card);
  }

  public updateCardState(card: JitenCard): void {
    const { wordId, readingIndex } = card;

    if (BaseController._suspendUpdateWordStates) {
      return;
    }

    new UpdateCardStateCommand(wordId, readingIndex).send();
  }

  protected abstract applyConfiguration(): Promise<void>;
}
