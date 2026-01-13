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
    if (this._initialised) {
      return;
    }

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

  private findAdjacentWordElements(element: Element): Element[] {
    const wordId = element.getAttribute('wordId');
    const readingIndex = element.getAttribute('readingIndex');

    if (!wordId) {
      return [element];
    }

    const elements: Element[] = [element];

    let prev = element.previousElementSibling;

    while (
      prev?.getAttribute('wordId') === wordId &&
      prev?.getAttribute('readingIndex') === readingIndex
    ) {
      elements.unshift(prev);
      prev = prev.previousElementSibling;
    }

    let next = element.nextElementSibling;

    while (
      next?.getAttribute('wordId') === wordId &&
      next?.getAttribute('readingIndex') === readingIndex
    ) {
      elements.push(next);
      next = next.nextElementSibling;
    }

    return elements;
  }

  private handleMouseEnter = (event: Event): void => {
    const target = this.findWordElement(event);

    if (target) {
      const sentence = this._sentenceMap.get(target);

      Registry.popupManager?.enter(target as HTMLElement, sentence);

      this.findAdjacentWordElements(target).forEach((el) => el.classList.add('hovered'));
    }
  };

  private handleMouseLeave = (event: Event): void => {
    const target = this.findWordElement(event);

    if (target) {
      Registry.popupManager?.leave();

      this.findAdjacentWordElements(target).forEach((el) => el.classList.remove('hovered'));
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
