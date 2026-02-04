import { Registry } from './registry';

export class WordEventDelegator {
  private static _instance: WordEventDelegator | null = null;
  private _initialised = false;
  private _sentenceMap = new WeakMap<Element, string | undefined>();
  private _lastTouchEndTime = 0;
  private _tapState = new Map<
    number,
    {
      word: HTMLElement;
      wordKey: string;
      sentence?: string;
      pointerType?: string;
      startX: number;
      startY: number;
      startTime: number;
    }
  >();
  private _penPointerIds = new Set<number>();

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

    if (window.PointerEvent) {
      document.addEventListener('pointerover', this.handlePointerOver, true);
      document.addEventListener('pointerout', this.handlePointerOut, true);
      document.addEventListener('pointercancel', this.handlePointerCancel, true);
      document.addEventListener('pointerdown', this.handlePointerDown, true);
      document.addEventListener('pointerup', this.handlePointerUp, true);
    } else {
      // Fallback for environments without Pointer Events support
      document.addEventListener('touchend', this.handleTouchEnd, true);
      document.addEventListener('click', this.handleClick, true);
    }
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

  private getWordKey(element: Element): string | null {
    const wordId = element.getAttribute('wordId');
    const readingIndex = element.getAttribute('readingIndex');

    if (!wordId || !readingIndex) {
      return null;
    }

    return `${wordId}/${readingIndex}`;
  }

  private isLikelyStylus(event: PointerEvent): boolean {
    // Some browsers (notably Firefox on Android for certain styluses) can misreport the stylus as
    // 'touch'. When tilt/twist data exists, it's a strong signal that the input is a pen.
    const hasTilt = typeof event.tiltX === 'number' && typeof event.tiltY === 'number';

    if (hasTilt && (event.tiltX !== 0 || event.tiltY !== 0)) {
      return true;
    }

    if (typeof event.twist === 'number' && event.twist !== 0) {
      return true;
    }

    // Fallback heuristic: stylus contact is usually much smaller than a finger.
    // Keep thresholds conservative to avoid misclassifying small fingers on some devices.
    const width = typeof event.width === 'number' ? event.width : 0;
    const height = typeof event.height === 'number' ? event.height : 0;

    return width > 0 && height > 0 && width <= 8 && height <= 8;
  }

  private getEffectivePointerType(event: PointerEvent): string | undefined {
    if (this._penPointerIds.has(event.pointerId)) {
      return 'pen';
    }

    if (event.pointerType === 'touch' && this.isLikelyStylus(event)) {
      this._penPointerIds.add(event.pointerId);

      return 'pen';
    }

    return event.pointerType;
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
    // In environments without Pointer Events support, touch interactions often synthesize a click.
    // Ignore those clicks if a touchend was just handled.
    const dt = Math.abs(event.timeStamp - this._lastTouchEndTime);

    if (dt < 700) {
      return;
    }

    const target = this.findWordElement(event);

    if (target) {
      const sentence = this._sentenceMap.get(target);

      Registry.popupManager?.touch(target as HTMLElement, event as MouseEvent, sentence, 'touch');
    }
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    this._lastTouchEndTime = event.timeStamp;

    const target = this.findWordElement(event);

    if (target) {
      const sentence = this._sentenceMap.get(target);

      Registry.popupManager?.touch(target as HTMLElement, event, sentence, 'touch');
    }
  };

  private handlePointerOver = (event: PointerEvent): void => {
    if (!event.isPrimary) {
      return;
    }

    this.getEffectivePointerType(event);
  };

  private handlePointerOut = (event: PointerEvent): void => {
    this._penPointerIds.delete(event.pointerId);
  };

  private handlePointerCancel = (event: PointerEvent): void => {
    this._tapState.delete(event.pointerId);
    this._penPointerIds.delete(event.pointerId);
  };

  private handlePointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary) {
      return;
    }

    const target = this.findWordElement(event);

    if (!target) {
      return;
    }

    const wordKey = this.getWordKey(target);

    if (!wordKey) {
      return;
    }

    const pointerType = this.getEffectivePointerType(event);
    const sentence = this._sentenceMap.get(target);

    this._tapState.set(event.pointerId, {
      word: target as HTMLElement,
      wordKey,
      sentence,
      pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
    });
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!event.isPrimary) {
      return;
    }

    const state = this._tapState.get(event.pointerId);

    if (!state) {
      return;
    }

    // Keep pen pointer ids (for hover-based detection), but always clear tap state.
    this._tapState.delete(event.pointerId);

    const target = this.findWordElement(event);

    if (!target) {
      return;
    }

    const wordKey = this.getWordKey(target);

    if (!wordKey || wordKey !== state.wordKey) {
      return;
    }

    const dx = Math.abs(event.clientX - state.startX);
    const dy = Math.abs(event.clientY - state.startY);
    const dt = Math.abs(event.timeStamp - state.startTime);

    // Treat as a "tap" only when the pointer didn't move significantly and didn't last too long.
    // This avoids opening the popup during scroll/drag or long-press selection.
    const TAP_MOVE_PX = 10;
    const TAP_MAX_MS = 650;

    if (dx > TAP_MOVE_PX || dy > TAP_MOVE_PX || dt > TAP_MAX_MS) {
      return;
    }

    Registry.popupManager?.touch(state.word, event, state.sentence, state.pointerType);
  };
}
