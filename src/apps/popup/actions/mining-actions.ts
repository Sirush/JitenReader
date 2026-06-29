import { formatSentenceWithMarkers } from '@shared/format-sentence';
import { JitenCard, JitenCardState } from '@shared/jiten/types';
import { RunDeckActionCommand } from '@shared/messages/background/run-deck-action.command';
import { KeybindManager } from '../../integration/keybind-manager';
import { Registry } from '../../integration/registry';
import { MiningController } from './mining-controller';

export class MiningActions {
  private static readonly STATE_MAP: Record<string, JitenCardState> = {
    neverForget: JitenCardState.MASTERED,
    blacklist: JitenCardState.BLACKLISTED,
    suspend: JitenCardState.SUSPENDED,
  };

  private _keyManager = new KeybindManager([
    'addToStudyDeckKey',
    'addToMiningKey',
    'addToBlacklistKey',
    'addToNeverForgetKey',
    'addToSuspendedKey',
    'cycleMasterBlacklistKey',
  ]);

  private _card?: JitenCard;
  private _sentence?: string;
  private _surfaceForm?: string;

  private _pendingCard?: JitenCard;
  private _originalCardState?: JitenCardState[];
  private _cycleTimer?: ReturnType<typeof setTimeout>;

  constructor(private _controller: MiningController) {
    const { events } = Registry;

    events.on('addToStudyDeckKey', () => this.mineToStudyDeck());
    events.on('addToMiningKey', () => this.addToDeck('mining'));
    events.on('addToBlacklistKey', () => this.addToDeck('blacklist'));
    events.on('addToNeverForgetKey', () => this.addToDeck('neverForget'));
    events.on('addToSuspendedKey', () => this.addToDeck('suspend'));
    events.on('cycleMasterBlacklistKey', () => this.cycleMasterBlacklist());
  }

  public activate(context: HTMLElement, sentence?: string): void {
    this._card = Registry.getCardFromElement(context);
    this._sentence = sentence;
    this._surfaceForm = MiningActions.getTextWithoutFurigana(context) || undefined;
    this._keyManager.activate();
  }

  public deactivate(): void {
    this._card = undefined;
    this._sentence = undefined;
    this._surfaceForm = undefined;

    this._keyManager.deactivate();
  }

  private mineToStudyDeck(): void {
    if (!this._card) {
      return;
    }

    const deckId = Number(this._controller.studyDeckId);

    if (!deckId || !this._controller.autoMineToStudyDeck) {
      return;
    }

    const sentence =
      this._sentence && this._surfaceForm
        ? formatSentenceWithMarkers(this._sentence, this._surfaceForm)
        : undefined;

    this._controller.addToStudyDeck(deckId, this._card, sentence, document.title);
  }

  private addToDeck(key: 'mining' | 'blacklist' | 'neverForget' | 'suspend'): void {
    if (!this._card) {
      return;
    }

    const state = MiningActions.STATE_MAP[key];
    const action = state && this._card.cardState.includes(state) ? 'remove' : 'add';

    this._controller.addOrRemove(action, key, this._card, this._sentence);
  }

  private cycleMasterBlacklist(): void {
    if (!this._card) {
      return;
    }

    const card = this._card;
    const { wordId, readingIndex } = card;

    if (this._pendingCard?.wordId !== wordId || this._pendingCard?.readingIndex !== readingIndex) {
      this._originalCardState = [...card.cardState];
      this._pendingCard = card;
    }

    const nextState = this.getNextCycleState(card.cardState);

    Registry.updateCard(wordId, readingIndex, nextState);

    if (this._cycleTimer) {
      clearTimeout(this._cycleTimer);
    }

    this._cycleTimer = setTimeout(() => this.flushCycle(), 400);
  }

  private getNextCycleState(cardState: JitenCardState[]): JitenCardState[] {
    const next = cardState.filter(
      (s) => s !== JitenCardState.MASTERED && s !== JitenCardState.BLACKLISTED,
    );

    if (cardState.includes(JitenCardState.MASTERED)) {
      next.push(JitenCardState.BLACKLISTED);
    } else if (!cardState.includes(JitenCardState.BLACKLISTED)) {
      next.push(JitenCardState.MASTERED);
    }

    return next;
  }

  private flushCycle(): void {
    this._cycleTimer = undefined;

    const card = this._pendingCard;
    const original = this._originalCardState;

    if (!card || !original) {
      return;
    }

    this._pendingCard = undefined;
    this._originalCardState = undefined;

    const hadMastered = original.includes(JitenCardState.MASTERED);
    const hadBlacklisted = original.includes(JitenCardState.BLACKLISTED);
    const hasMastered = card.cardState.includes(JitenCardState.MASTERED);
    const hasBlacklisted = card.cardState.includes(JitenCardState.BLACKLISTED);

    const instructions: RunDeckActionCommand[] = [];

    if (hadMastered !== hasMastered) {
      instructions.push(
        new RunDeckActionCommand(
          card.wordId,
          card.readingIndex,
          'neverForget',
          hasMastered ? 'add' : 'remove',
        ),
      );
    }

    if (hadBlacklisted !== hasBlacklisted) {
      instructions.push(
        new RunDeckActionCommand(
          card.wordId,
          card.readingIndex,
          'blacklist',
          hasBlacklisted ? 'add' : 'remove',
        ),
      );
    }

    if (instructions.length === 0) {
      return;
    }

    this._controller.suspendUpdateWordStates();

    const executeInstructions = (index: number): void => {
      if (index < instructions.length) {
        instructions[index].send(() => executeInstructions(index + 1));
      } else {
        this._controller.resumeUpdateWordStates(card);
      }
    };

    executeInstructions(0);
  }

  private static getTextWithoutFurigana(element: HTMLElement): string {
    let text = '';

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node instanceof HTMLElement && node.tagName !== 'RT') {
        text += MiningActions.getTextWithoutFurigana(node);
      }
    }

    return text;
  }
}
