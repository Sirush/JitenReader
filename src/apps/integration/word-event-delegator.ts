import { Registry } from './registry';

export class WordEventDelegator {
  private static _instance: WordEventDelegator | null = null;
  private _initialised = false;
  private _sentenceMap = new WeakMap<Element, string | undefined>();

  public static getInstance(): WordEventDelegator {
    if (!this._instance) {
      this._instance = new WordEventDelegator();
    }
    return this._instance;
  }

  public initialise(): void {
    if (this._initialised) return;
    this._initialised = true;

    document.addEventListener('mouseenter', this.handleMouseEnter, true);
    document.addEventListener('mouseleave', this.handleMouseLeave, true);
    document.addEventListener('click', this.handleClick, true);
  }

  public setSentence(element: Element, sentence: string | undefined): void {
    this._sentenceMap.set(element, sentence);
  }

  public getSentence(element: Element): string | undefined {
    return this._sentenceMap.get(element);
  }

  private findWordElement(event: Event): Element | null {
    const target = event.target as Element;
    return target.closest?.('.jiten-word[wordId]');
  }

  private handleMouseEnter = (event: Event): void => {
    const target = this.findWordElement(event);
    if (target) {
      const sentence = this._sentenceMap.get(target);
      Registry.popupManager?.enter(target as HTMLElement, sentence);
    }
  };

  private handleMouseLeave = (event: Event): void => {
    const target = this.findWordElement(event);
    if (target) {
      Registry.popupManager?.leave();
    }
  };

  private handleClick = (event: Event): void => {
    const target = this.findWordElement(event);
    if (target) {
      const sentence = this._sentenceMap.get(target);
      Registry.popupManager?.touch(target as HTMLElement, event as MouseEvent, sentence);
    }
  };
}
