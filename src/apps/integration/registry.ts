import { StudyDeckListItem } from '@shared/jiten/api.types';
import {
  DECK_MEMBERSHIP_CLASSES,
  IN_ANY_DECK_CLASS,
  JitenCard,
  JitenCardState,
  STUDY_DECK_CLASS,
} from '@shared/jiten/types';
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
    furiganaOnlyOnNew: false,
    generatePitch: false,
    markFrequency: false,
    markAll: false,
    markIPlus1: false,
    minSentenceLength: 3,
    iPlusOneMaxFrequency: false,
    newStates: [],
    markWordsInDeck: false,
  };

  public static skipTouchEvents = false;
  public static popupManager?: PopupManager;
  public static statusBar?: StatusBar;

  private static readonly cards = new Map<string, JitenCard>();
  private static readonly conjugations = new WeakMap<HTMLElement, string[]>();
  private static readonly studyDecks = new Map<number, StudyDeckListItem>();
  // Words the user manually graded or auto-failed this session — excluded from mass review.
  private static readonly sessionTouchedCards = new Set<string>();

  public static markSessionTouched(wordId: number, readingIndex: number): void {
    this.sessionTouchedCards.add(`${wordId}/${readingIndex}`);
  }

  public static isSessionTouched(wordId: number, readingIndex: number): boolean {
    return this.sessionTouchedCards.has(`${wordId}/${readingIndex}`);
  }

  public static setStudyDecks(decks: StudyDeckListItem[]): void {
    this.studyDecks.clear();

    for (const deck of decks) {
      this.studyDecks.set(deck.userStudyDeckId, deck);
    }
  }

  public static getStudyDecks(): StudyDeckListItem[] {
    return Array.from(this.studyDecks.values());
  }

  public static getStudyDeck(deckId: number): StudyDeckListItem | undefined {
    return this.studyDecks.get(deckId);
  }

  // Resolves the membership CSS classes for the decks a word belongs to: one per deck type
  // present, plus a generic `in-any-deck` whenever the word is in at least one deck.
  public static getDeckMembershipClasses(deckIds: number[]): string[] {
    const classes = new Set<string>();

    for (const id of deckIds) {
      const deck = this.studyDecks.get(id);

      if (deck) {
        classes.add(STUDY_DECK_CLASS[deck.deckType]);
      }
    }

    if (classes.size > 0) {
      classes.add(IN_ANY_DECK_CLASS);
    }

    return Array.from(classes);
  }

  // Re-applies deck-membership classes to every already-parsed word. Words are tagged at parse
  // time, but the study-deck list loads asynchronously and can arrive after highlighting — this
  // reconciles them. Also re-runs when the toggle flips live.
  public static refreshDeckMembership(): void {
    const { markWordsInDeck } = this.textHighlighterOptions;

    document
      .querySelectorAll<HTMLElement>('.jiten-word[wordId][readingIndex]')
      .forEach((element) => {
        element.classList.remove(...DECK_MEMBERSHIP_CLASSES);

        if (!markWordsInDeck) {
          return;
        }

        const card = this.getCardFromElement(element);
        const deckClasses = card ? this.getDeckMembershipClasses(card.deckIds) : [];

        if (deckClasses.length > 0) {
          element.classList.add(...deckClasses);
        }
      });
  }

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

  public static updateCard(
    wordId: number,
    readingIndex: number,
    state: JitenCardState[],
    deckIds?: number[],
  ): void {
    const card = this.getCard(wordId, readingIndex);
    const managedStates = Object.values(JitenCardState);
    const { markFrequency, markAll, newStates, markWordsInDeck } = this.textHighlighterOptions;

    if (!card) {
      return;
    }

    card.cardState = state;

    if (deckIds) {
      card.deckIds = deckIds;
    }

    const deckClasses = markWordsInDeck ? this.getDeckMembershipClasses(card.deckIds) : [];

    const isNew = state.some((s) => newStates.includes(s));
    const isFrequent =
      markFrequency !== false && card.frequencyRank <= markFrequency && (markAll || isNew);

    document
      .querySelectorAll(`[wordId="${wordId}"][readingIndex="${readingIndex}"]`)
      .forEach((element) => {
        const classes = Array.from(element.classList).filter(
          (x) =>
            x !== 'frequent' &&
            !managedStates.includes(x as JitenCardState) &&
            !DECK_MEMBERSHIP_CLASSES.includes(x),
        );

        classes.push(...state, ...deckClasses);

        if (isFrequent) {
          classes.push('frequent');
        }

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
    this.sessionTouchedCards.clear();
  }
}
