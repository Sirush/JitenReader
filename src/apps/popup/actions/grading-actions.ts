import { formatSentenceWithMarkers } from '@shared/format-sentence';
import { JitenCard, JitenRating } from '@shared/jiten/types';
import { KeybindManager } from '../../integration/keybind-manager';
import { Registry } from '../../integration/registry';
import { GradingController } from './grading-controller';

/**
 * Handles keybinds for grading cards.
 */
export class GradingActions {
  private _keyManager = new KeybindManager([
    'jitenReviewNothing',
    'jitenReviewSomething',
    'jitenReviewHard',
    'jitenReviewOkay',
    'jitenReviewEasy',
    'jitenReviewFail',
    'jitenReviewPass',
  ]);
  private _card?: JitenCard;
  private _sentence?: string;
  private _surfaceForm?: string;

  constructor(private _controller: GradingController) {
    const { events } = Registry;

    events.on('jitenReviewNothing', () => this.reviewCard('again'));
    events.on('jitenReviewSomething', () => this.reviewCard('again'));
    events.on('jitenReviewHard', () => this.reviewCard('hard'));
    events.on('jitenReviewOkay', () => this.reviewCard('good'));
    events.on('jitenReviewEasy', () => this.reviewCard('easy'));
    events.on('jitenReviewFail', () => this.reviewCard('again'));
    events.on('jitenReviewPass', () => this.reviewCard('good'));
  }

  public activate(context: HTMLElement, sentence?: string): void {
    this._card = Registry.getCardFromElement(context);
    this._sentence = sentence;
    this._surfaceForm = GradingActions.getTextWithoutFurigana(context) || undefined;
    this._keyManager.activate();
  }

  public deactivate(): void {
    this._card = undefined;
    this._sentence = undefined;
    this._surfaceForm = undefined;
    this._keyManager.deactivate();
  }

  private reviewCard(rating: JitenRating): void {
    if (!this._card) {
      return;
    }

    const sentence =
      this._sentence && this._surfaceForm
        ? formatSentenceWithMarkers(this._sentence, this._surfaceForm)
        : undefined;

    this._controller.gradeCard(this._card, rating, sentence, document.title);
  }

  private static getTextWithoutFurigana(element: HTMLElement): string {
    let text = '';

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node instanceof HTMLElement && node.tagName !== 'RT') {
        text += GradingActions.getTextWithoutFurigana(node);
      }
    }

    return text;
  }
}
