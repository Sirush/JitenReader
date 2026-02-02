import { JitenCard, JitenCardState } from '@shared/jiten/types';
import { BatchController } from '../batches/batch-controller';
import { BaseParser } from '../parser/base.parser';
import { PopupManager } from '../popup/popup-manager';
import { SequenceManager } from '../sequence/sequence-manager';
import { StatusBar } from '../status-bar/status-bar';
import { TextHighlighterOptions } from '../text-highlighter/types';
import { EventCollection } from './event-collection';
import { HostEvaluator } from './host-evaluator';
import { SentenceManager } from './sentence-manager';
import { WordEventDelegator } from './word-event-delegator';

export class Registry {
  public static readonly isMainFrame = window === window.top;

  public static readonly events = new EventCollection();
  public static readonly hostEvaluator = new HostEvaluator();
  public static readonly wordEventDelegator = WordEventDelegator.getInstance();

  public static readonly parsers: BaseParser[] = [];
  public static readonly batchController = new BatchController();
  public static readonly sequenceManager = new SequenceManager();
  public static readonly sentenceManager = new SentenceManager();
  public static readonly textHighlighterOptions: TextHighlighterOptions = {
    skipFurigana: false,
    generatePitch: false,
    markFrequency: false,
    markAll: false,
    markIPlus1: false,
    minSentenceLength: 3,
    iPlusOneMaxFrequency: false,
    newStates: [],
  };

  public static skipTouchEvents = false;
  public static popupManager?: PopupManager;
  public static statusBar?: StatusBar;

  private static readonly cards = new Map<string, JitenCard>();
  private static readonly conjugations = new WeakMap<HTMLElement, string[]>();

  public static addCard(card: JitenCard, element: HTMLElement, conjugations?: string[]): void {
    const key = `${card.wordId}/${card.readingIndex}`;

    this.cards.set(key, card);

    if (conjugations && conjugations.length > 0) {
      conjugations = conjugations
        .filter((conj) => !conj.startsWith('('))
        .filter((conj) => conj != '');
      conjugations.reverse();
      this.conjugations.set(element, conjugations);
    }
  }

  public static updateCard(wordId: number, readingIndex: number, state: JitenCardState[]): void {
    const card = this.getCard(wordId, readingIndex);
    const managedStates = Object.values(JitenCardState);

    if (!card) {
      return;
    }

    card.cardState = state;

    document
      .querySelectorAll(`[wordId="${wordId}"][readingIndex="${readingIndex}"]`)
      .forEach((element) => {
        const classes = Array.from(element.classList).filter(
          (x) => !managedStates.includes(x as JitenCardState),
        );

        classes.push(...state);
        element.classList.value = classes.join(' ');
      });

    this.sentenceManager.updateCardState(wordId, readingIndex, state);
  }

  public static getCard(wordId: number, readingIndex: number): JitenCard | undefined {
    return this.cards.get(`${wordId}/${readingIndex}`);
  }

  public static getConjugations(element: HTMLElement): string[] | undefined {
    return this.conjugations.get(element);
  }

  public static getCardFromElement(element: Element): JitenCard | undefined {
    const wordId = element.getAttribute('wordId');
    const readingIndex = element.getAttribute('readingIndex');

    if (!wordId || !readingIndex) {
      return;
    }

    return this.getCard(parseInt(wordId, 10), parseInt(readingIndex, 10));
  }

  public static getAllCards(): Map<string, JitenCard> {
    return this.cards;
  }

  public static clearCards(): void {
    this.cards.clear();
  }
}
