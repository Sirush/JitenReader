import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCard } from '@shared/jiten/types';
import { RunDeckActionCommand } from '@shared/messages/background/run-deck-action.command';
import { BaseController } from './base-controller';

export class MiningController extends BaseController {
  private _showActions: boolean;


  public get showActions(): boolean {
    return this._showActions;
  }

  public addOrRemove(
    action: 'add' | 'remove',
    key: 'mining' | 'blacklist' | 'neverForget' | 'suspend',
    card: JitenCard,
    sentence?: string,
  ): void {
    const { wordId, readingIndex } = card;

    new RunDeckActionCommand(wordId, readingIndex, key, action, sentence).send(() =>
      this.updateCardState(card),
    );
  }

  protected async applyConfiguration(): Promise<void> {
    this._showActions = await getConfiguration('showMiningActions');
  }
}
