import { JitenCard, JitenCardState } from '@shared/jiten/types';
import { KeybindManager } from '../../integration/keybind-manager';
import { Registry } from '../../integration/registry';
import { MiningController } from './mining-controller';

/**
 * Handles keybinds for mining cards.
 */
export class MiningActions {
  private _keyManager = new KeybindManager([
    'addToMiningKey',
    'addToBlacklistKey',
    'addToNeverForgetKey',
    'addToSuspendedKey',
  ]);

  private _card?: JitenCard;
  private _sentence?: string;

  constructor(private _controller: MiningController) {
    const { events } = Registry;

    events.on('addToMiningKey', () => this.addToDeck('mining'));
    events.on('addToBlacklistKey', () => this.addToDeck('blacklist'));
    events.on('addToNeverForgetKey', () => this.addToDeck('neverForget'));
    events.on('addToSuspendedKey', () => this.addToDeck('suspend'));
  }

  public activate(context: HTMLElement, sentence?: string): void {
    this._card = Registry.getCardFromElement(context);
    this._sentence = sentence;
    this._keyManager.activate();
  }

  public deactivate(): void {
    this._card = undefined;
    this._sentence = undefined;

    this._keyManager.deactivate();
  }

  private static readonly STATE_MAP: Record<string, JitenCardState> = {
    neverForget: JitenCardState.MASTERED,
    blacklist: JitenCardState.BLACKLISTED,
    suspend: JitenCardState.BLACKLISTED,
  };

  private addToDeck(key: 'mining' | 'blacklist' | 'neverForget' | 'suspend'): void {
    if (!this._card) {
      return;
    }

    const state = MiningActions.STATE_MAP[key];
    const action = state && this._card.cardState.includes(state) ? 'remove' : 'add';

    this._controller.addOrRemove(action, key, this._card, this._sentence);
  }
}
