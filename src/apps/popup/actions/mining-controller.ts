import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCard } from '@shared/jiten/types';
import { AddToStudyDeckCommand } from '@shared/messages/background/add-to-study-deck.command';
import { RunDeckActionCommand } from '@shared/messages/background/run-deck-action.command';
import { BaseController } from './base-controller';

export class MiningController extends BaseController {
  private _showActions: boolean;
  private _autoMineToStudyDeck: boolean;
  private _studyDeckId: string;

  public get showActions(): boolean {
    return this._showActions;
  }

  public get autoMineToStudyDeck(): boolean {
    return this._autoMineToStudyDeck;
  }

  public get studyDeckId(): string {
    return this._studyDeckId;
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

  public addToStudyDeck(deckId: number, card: JitenCard, sentence?: string, source?: string): void {
    new AddToStudyDeckCommand(deckId, card.wordId, card.readingIndex, sentence, source).send();
  }

  protected async applyConfiguration(): Promise<void> {
    this._showActions = await getConfiguration('showDeckButton');
    this._autoMineToStudyDeck = await getConfiguration('jitenMineToStudyDeck');
    this._studyDeckId = await getConfiguration('jitenStudyDeckId');
  }
}
