import { getConfiguration } from '@shared/configuration/get-configuration';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { Registry } from './registry';

export class WordEventDelegator {
  private static _instance: WordEventDelegator | null = null;
  private _initialised = false;
  private _sentenceMap = new WeakMap<Element, string | undefined>();

  private _touchscreenLongPress = false;
  private _touchscreenLongPressDuration = 250;
  private _longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _longPressTarget: Element | null = null;
  private _touchStartX = 0;
  private _touchStartY = 0;

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

    onBroadcastMessage(
      'configurationUpdated',
      async () => {
        this._touchscreenLongPress = await getConfiguration('touchscreenLongPress');
        this._touchscreenLongPressDuration = await getConfiguration('touchscreenLongPressDuration');
      },
      true,
    );

    document.addEventListener('mouseenter', this.handleMouseEnter, true);
    document.addEventListener('mouseleave', this.handleMouseLeave, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('touchstart', this.handleTouchStart, true);
    document.addEventListener('touchend', this.handleTouchEnd, true);
    document.addEventListener('touchcancel', this.handleTouchEnd, true);
    document.addEventListener('touchmove', this.handleTouchMove, true);
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

    while (prev) {
      if (
        prev.getAttribute('wordId') === wordId &&
        prev.getAttribute('readingIndex') === readingIndex
      ) {
        elements.unshift(prev);
        prev = prev.previousElementSibling;
      } else if (!prev.hasAttribute('wordId')) {
        prev = prev.previousElementSibling;
      } else {
        break;
      }
    }

    let next = element.nextElementSibling;

    while (next) {
      if (
        next.getAttribute('wordId') === wordId &&
        next.getAttribute('readingIndex') === readingIndex
      ) {
        elements.push(next);
        next = next.nextElementSibling;
      } else if (!next.hasAttribute('wordId')) {
        next = next.nextElementSibling;
      } else {
        break;
      }
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

  private clearLongPress(): void {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }

    this._longPressTarget = null;
  }

  private handleTouchStart = (event: TouchEvent): void => {
    if (!this._touchscreenLongPress) {
      return;
    }

    const target = this.findWordElement(event);

    if (!target) {
      this.clearLongPress();

      return;
    }

    const touch = event.touches[0];

    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._longPressTarget = target;

    this._longPressTimer = setTimeout(() => {
      if (!this._longPressTarget) {
        return;
      }

      const sentence = this._sentenceMap.get(this._longPressTarget);

      Registry.popupManager?.longPress(this._longPressTarget as HTMLElement, sentence);
      this.clearLongPress();
    }, this._touchscreenLongPressDuration);
  };

  private handleTouchEnd = (): void => {
    this.clearLongPress();
  };

  private handleTouchMove = (event: TouchEvent): void => {
    if (!this._longPressTimer) {
      return;
    }

    const touch = event.touches[0];
    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;

    if (dx * dx + dy * dy > 100) {
      this.clearLongPress();
    }
  };
}
