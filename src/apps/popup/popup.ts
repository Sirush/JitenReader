import { getConfiguration } from '@shared/configuration/get-configuration';
import { setConfiguration } from '@shared/configuration/set-configuration';
import { createElement } from '@shared/dom/create-element';
import { displayToast } from '@shared/dom/display-toast';
import { findElements } from '@shared/dom/find-elements';
import { withElement } from '@shared/dom/with-element';
import { getStyleUrl } from '@shared/extension/get-style-url';
import { formatSentenceWithMarkers } from '@shared/format-sentence';
import { StudyDeckListItem } from '@shared/jiten/api.types';
import { JitenCard, JitenCardState } from '@shared/jiten/types';
import { FetchStudyDecksCommand } from '@shared/messages/background/fetch-study-decks.command';
import { ForgetCardCommand } from '@shared/messages/background/forget-card.command';
import { UpdateCardStateCommand } from '@shared/messages/background/update-card-state.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { cleanReading, getPitchDiagramData } from '@shared/pitch-accent-utils';
import { getThemeCssVars } from '@shared/theme/get-theme-css-vars';
import { playTts, stopTts } from '@shared/tts/play-tts';
import { KeybindManager } from '../integration/keybind-manager';
import { Registry } from '../integration/registry';
import { GradingController } from './actions/grading-controller';
import { MiningController } from './actions/mining-controller';
import { RotationController } from './actions/rotation-controller';
import { ConfirmDialog } from './confirm-dialog';
import { PARTS_OF_SPEECH } from './part-of-speech';

export class Popup {
  private _keyManager = new KeybindManager([], {
    keydown: (e: MouseEvent | KeyboardEvent): void => this.handleKeydown(e),
  });

  /**
   * This is the root element of the popup, which is attached to the host page or iframe.
   * It manages the shadow root isolating the actual popup content.
   */
  private _root: HTMLDivElement = createElement('div', {
    id: 'ajb-popup',
    events: {
      onmousedown: (ev: MouseEvent) => ev.stopPropagation(),
      onclick: (ev: MouseEvent) => ev.stopPropagation(),
      onwheel: (ev: WheelEvent) => ev.stopPropagation(),
    },
    style: {
      all: 'initial',
      zIndex: '2147483647',
      position: 'absolute',
      top: '0',
      left: '0',
      opacity: '0',
      visibility: 'hidden',
    },
  });

  //#region Utility Accessors

  /** Theme CSS variables - syncronised with extension storage */
  private _themeStyles: HTMLStyleElement = createElement('style');
  /** The user declared styles - syncronised with extension storage */
  private _customStyles: HTMLStyleElement = createElement('style');

  private _closeButton = createElement('section', {
    id: 'close',
    class: ['controls'],
    style: {
      display: 'none', // Hidden by default
    },
    children: [
      createElement('a', {
        id: 'close-btn',
        class: ['outline', 'close'],
        handler: () => this.hide(),
      }),
    ],
  });
  /** Contains the buttons to manage the card and its decks */
  private _mineButtons = createElement('section', { id: 'mining', class: ['controls'] });
  /** Contains the buttons to manage the card rotation */
  private _rotateButtons = createElement('section', { id: 'rotation', class: ['controls'] });
  /** Contains the buttons to manage card states */
  private _gradeButtons = createElement('section', { id: 'grading', class: ['controls'] });
  /** Contains the header data - all information about a word except its meaning */
  private _context = createElement('section', { id: 'context' });
  /** Contains the various meanings of a word */
  private _details = createElement('section', { id: 'details' });
  private _resizeHandle = createElement('div', { class: ['resize-handle'] });

  //#endregion

  /**
   * The rendered popup content itself
   */
  private _popup: HTMLDivElement = createElement('div', {
    class: ['popup'],
    events: {
      onmouseenter: () => this.startHover(),
      onmouseleave: () => this.stopHover(),
    },
    children: [],
  });

  private _touchscreenSupport: boolean;
  private _renderCloseButton: boolean;
  private _hidePopupAutomatically: boolean;
  private _hidePopupDelay: number;
  private _hideAfterAction: boolean;
  private _disableFadeAnimation: boolean;
  private _leftAlignPopupToWord: boolean;
  private _moveMiningActions: boolean;
  private _moveRotationActions: boolean;
  private _moveGradingActions: boolean;
  private _showConjugations: boolean;
  private _showPitchDiagrams: boolean;
  private _disableHeadWordLink: boolean;
  private _ttsVoice: string;
  private _ttsAutoPlay: boolean;
  private _lastAutoPlayKey: string;

  private _popupWidth = 350;
  private _popupHeight = 250;

  private static readonly MIN_WIDTH = 250;
  private static readonly MIN_HEIGHT = 200;

  private _hideTimer?: NodeJS.Timeout;
  private _isHover?: boolean;
  private _isResizing = false;
  private _shadowRoot?: ShadowRoot;
  private _confirmDialog?: ConfirmDialog;
  private _popupLeft = 0;
  private _popupTop = 0;

  private _cardContext?: HTMLElement;
  private _conjugations?: string[];
  private _card?: JitenCard;
  private _sentence?: string;

  constructor(
    private _mining: MiningController,
    private _rotation: RotationController,
    private _grading: GradingController,
  ) {
    this.renderNodes();

    onBroadcastMessage('cardStateUpdated', (wordId, readingIndex) => {
      setTimeout(() => {
        this._card = Registry.getCard(wordId, readingIndex);

        if (this._hideAfterAction) {
          return this.hide();
        }

        this.rerender();
      }, 1);
    });
    onBroadcastMessage('configurationUpdated', () => this.applyConfiguration(), true);
  }

  public show(context: HTMLElement, sentence?: string): void {
    this._cardContext = context;
    this._card = Registry.getCardFromElement(context);
    this._sentence = sentence;
    this._conjugations = Registry.getConjugations(context);

    this.clearTimer();
    this.updateParentElement();
    this.rerender();
    this.setPosition();

    Object.assign<CSSStyleDeclaration, Partial<CSSStyleDeclaration>>(this._root.style, {
      transition: this._disableFadeAnimation ? 'none' : 'opacity 60ms ease-in, visibility 60ms',
      opacity: '1',
      visibility: 'visible',
    });

    this._keyManager.activate();

    if (this._ttsAutoPlay && this._card) {
      const key = `${this._card.wordId}/${this._card.readingIndex}`;

      if (this._lastAutoPlayKey !== key) {
        this._lastAutoPlayKey = key;
        void this.playCardTts(this._card);
      }
    }
  }

  public hide(): void {
    stopTts();

    Object.assign<CSSStyleDeclaration, Partial<CSSStyleDeclaration>>(this._root.style, {
      transition: this._disableFadeAnimation ? 'none' : 'opacity 200ms ease-in, visibility 20ms',
      opacity: '0',
      visibility: 'hidden',
    });

    this._keyManager.deactivate();
  }

  public initHide(): void {
    if (!this._hidePopupAutomatically) {
      return;
    }

    if (!this._hidePopupDelay) {
      this.hide();

      return;
    }

    this.startTimer();
  }

  public disablePointerEvents(): void {
    this._root.style.pointerEvents = 'none';
    this._root.style.userSelect = 'none';
  }

  public enablePointerEvents(): void {
    this._root.style.pointerEvents = '';
    this._root.style.userSelect = '';
  }

  //#region Configuration

  private async applyConfiguration(): Promise<void> {
    this._hidePopupAutomatically = await getConfiguration('hidePopupAutomatically');
    this._hidePopupDelay = await getConfiguration('hidePopupDelay');
    this._hideAfterAction = await getConfiguration('hideAfterAction');
    this._disableFadeAnimation = await getConfiguration('disableFadeAnimation');
    this._leftAlignPopupToWord = await getConfiguration('leftAlignPopupToWord');

    this._renderCloseButton = await getConfiguration('renderCloseButton');
    this._touchscreenSupport = await getConfiguration('touchscreenSupport');
    this._moveMiningActions = await getConfiguration('moveMiningActions');
    this._moveRotationActions = await getConfiguration('moveRotateActions');
    this._moveGradingActions = await getConfiguration('moveGradingActions');
    this._showConjugations = await getConfiguration('showConjugations');
    this._showPitchDiagrams = await getConfiguration('showPitchDiagrams');
    this._disableHeadWordLink = await getConfiguration('disableHeadWordLink');
    this._ttsVoice = await getConfiguration('ttsVoice');
    this._ttsAutoPlay = await getConfiguration('ttsAutoPlay');

    this._popupWidth = await getConfiguration('popupWidth');
    this._popupHeight = await getConfiguration('popupHeight');
    this.applyDimensions();

    this._themeStyles.textContent = await getThemeCssVars();
    this._customStyles.textContent = await getConfiguration('customPopupCSS');

    this._closeButton.style.display =
      this._touchscreenSupport && this._renderCloseButton ? 'flex' : 'none';

    this.updateMiningButtons();
    this.updateRotationButtons();
    this.updateGradingButtons();
    this.applyPositions();
  }

  //#endregion
  //#region Install the popup

  /**
   * Installs all components and initializes the shadow root
   */
  private renderNodes(): void {
    this._shadowRoot = this._root.attachShadow({ mode: 'closed' });

    this._shadowRoot.append(
      createElement('link', { attributes: { rel: 'stylesheet', href: getStyleUrl('popup') } }),
      this._themeStyles,
      this._customStyles,
      this._popup,
    );

    this._popup.appendChild(this._resizeHandle);
    this.initResize();

    this._confirmDialog = new ConfirmDialog(this._shadowRoot, () => ({
      x: this._popupLeft,
      y: this._popupTop,
    }));
  }

  private updateParentElement(): void {
    const parentElement = this.getParentElement();

    if (!this._root.parentElement?.isSameNode(parentElement)) {
      parentElement.appendChild(this._root);
    }
  }

  private getParentElement(): HTMLElement {
    const fullscreenVideoElement = this.getFullscreenVideoElement();

    if (fullscreenVideoElement?.parentElement) {
      return this.findElementForFullscreenVideoDisplay(fullscreenVideoElement);
    }

    return document.body;
  }

  private getFullscreenVideoElement(): HTMLElement | undefined {
    if (!document.fullscreenElement) {
      return;
    }

    return findElements('video').find((videoElement) =>
      document.fullscreenElement!.contains(videoElement),
    );
  }

  private findElementForFullscreenVideoDisplay(videoElement: HTMLElement): HTMLElement {
    let currentNode: HTMLElement | null = videoElement.parentElement;
    let chosenNode: HTMLElement | undefined;

    const testNode = document.createElement('div');

    testNode.style.position = 'absolute';
    testNode.style.zIndex = '2147483647';
    testNode.innerText = '&nbsp;'; // The node needs to take up some space to perform test clicks

    while (currentNode && !currentNode.isSameNode(document.body.parentElement)) {
      const rect = currentNode.getBoundingClientRect();

      if (
        rect.height > 0 &&
        (chosenNode === undefined || rect.height >= chosenNode.getBoundingClientRect().height) &&
        this.elementIsClickableInsideContainer(currentNode, testNode)
      ) {
        chosenNode = currentNode;

        break;
      }

      currentNode = currentNode.parentElement;
    }

    return chosenNode ?? document.body;
  }

  private elementIsClickableInsideContainer(container: HTMLElement, element: HTMLElement): boolean {
    container.appendChild(element);

    const rect = element.getBoundingClientRect();
    const clickedElement = document.elementFromPoint(rect.x, rect.y);
    const clickable = element.isSameNode(clickedElement) || element.contains(clickedElement);

    element.remove();

    return clickable;
  }

  //#endregion
  //#region Position the popup

  private setPosition(): void {
    const clamp = (value: number, min: number, max: number): number =>
      Math.min(Math.max(value, min), max);

    const { writingMode } = getComputedStyle(this._cardContext!);
    const { x, y } = this._cardContext!.getBoundingClientRect();
    const { offsetWidth: popupWidth, offsetHeight: popupHeight } = this._popup;
    const { innerWidth, innerHeight, scrollX, scrollY } = window;
    const { top, right, bottom, left } = this.getClosestClientRect(this._cardContext!, x, y);

    const wordLeft = scrollX + left;
    const wordTop = scrollY + top;
    const wordRight = scrollX + right;
    const wordBottom = scrollY + bottom;

    const leftSpace = left;
    const topSpace = top;
    const rightSpace = innerWidth - right;
    const bottomSpace = innerHeight - bottom;

    const minLeft = scrollX;
    const maxLeft = scrollX + innerWidth - popupWidth;
    const minTop = scrollY;
    const maxTop = scrollY + innerHeight - popupHeight;

    let popupLeft: number;
    let popupTop: number;

    if (writingMode.startsWith('horizontal')) {
      popupTop = clamp(bottomSpace > topSpace ? wordBottom : wordTop - popupHeight, minTop, maxTop);
      popupLeft = clamp(
        rightSpace > leftSpace ? wordLeft : wordRight - popupWidth,
        minLeft,
        maxLeft,
      );
    } else {
      popupTop = clamp(bottomSpace > topSpace ? wordTop : wordBottom - popupHeight, minTop, maxTop);
      popupLeft = clamp(
        rightSpace > leftSpace ? wordRight : wordLeft - popupWidth,
        minLeft,
        maxLeft,
      );
    }

    if (this._leftAlignPopupToWord) {
      // Align the popup to the left of the word
      // Ensure the popup does not overflow the right edge of the screen, also add a bit of padding
      popupLeft = Math.min(wordLeft, innerWidth - popupWidth - 8);
    }

    if (innerWidth < 450) {
      popupLeft = 8;

      this._root.style.width = `${innerWidth - 32}px`;
      this._popup.style.width = `${innerWidth - 32}px`;
    } else {
      this._root.style.width = '';
      this._popup.style.width = '';
    }

    this._popupLeft = popupLeft;
    this._popupTop = popupTop;
    this._root.style.transform = `translate(${popupLeft}px, ${popupTop}px)`;
  }

  private getClosestClientRect(elem: HTMLElement, x: number, y: number): DOMRect {
    const rects = elem.getClientRects();

    if (rects.length === 1) {
      return rects[0];
    }

    // Merge client rects that are adjacent
    // This works around a Chrome issue, where sometimes, non-deterministically,
    // inline child elements will get separate client rects, even if they are on the same line.
    const { writingMode } = getComputedStyle(elem);
    const horizontal = writingMode.startsWith('horizontal');
    const mergedRects = [];

    for (const rect of rects) {
      if (mergedRects.length === 0) {
        mergedRects.push(rect);

        continue;
      }

      const prevRect: DOMRect = mergedRects[mergedRects.length - 1];

      if (horizontal) {
        if (rect.bottom === prevRect.bottom && rect.left === prevRect.right) {
          mergedRects[mergedRects.length - 1] = new DOMRect(
            prevRect.x,
            prevRect.y,
            rect.right - prevRect.left,
            prevRect.height,
          );
        } else {
          mergedRects.push(rect);
        }
      } else {
        if (rect.right === prevRect.right && rect.top === prevRect.bottom) {
          mergedRects[mergedRects.length - 1] = new DOMRect(
            prevRect.x,
            prevRect.y,
            prevRect.width,
            rect.bottom - prevRect.top,
          );
        } else {
          mergedRects.push(rect);
        }
      }
    }

    return mergedRects
      .map((rect) => ({
        rect,
        distance:
          Math.max(rect.left - x, 0, x - rect.right) ** 2 +
          Math.max(rect.top - y, 0, y - rect.bottom) ** 2,
      }))
      .reduce((a, b) => (a.distance <= b.distance ? a : b)).rect;
  }

  //#endregion
  //#region Button Renderer

  private updateMiningButtons(): void {
    const performDeckAction = (
      action: 'add' | 'remove',
      key: 'mining' | 'neverForget' | 'blacklist' | 'suspend',
      sentence?: string,
    ): void => this._mining.addOrRemove(action, key, this._card!, sentence);
    const performFlaggedDeckAction = (key: 'neverForget' | 'blacklist' | 'suspend'): void => {
      const action = this.cardHasState(key, this._card!) ? 'remove' : 'add';

      performDeckAction(action, key);
    };

    this._mineButtons.replaceChildren();
    this._mineButtons.style.display = this._mining.showActions ? '' : 'none';

    // this.addMiningButton("mining", 'mining', 'Add', () =>
    //   performDeckAction('add', 'mining', this._sentence),
    // );

    this.addMiningButton('neverForget', 'never-forget', undefined, () =>
      performFlaggedDeckAction('neverForget'),
    );
    this.addMiningButton('blacklist', 'blacklist', undefined, () =>
      performFlaggedDeckAction('blacklist'),
    );
    // this.addMiningButton(this._mining.suspendDeck, 'suspend', undefined, () =>
    //   performFlaggedDeckAction('suspend'),
    // );

    this._mineButtons.appendChild(
      createElement('a', {
        id: 'forget-deck',
        class: ['outline', 'forget'],
        innerText: 'Forget',
        handler: () => void this.handleForgetClick(),
      }),
    );

    const deckId = Number(this._mining.studyDeckId);

    if (deckId || !this._mining.autoMineToStudyDeck) {
      this._mineButtons.appendChild(
        createElement('a', {
          id: 'add-to-deck',
          class: ['outline', 'mining'],
          innerText: 'Deck +',
          handler: () => void this.handleAddToDeck(),
        }),
      );
    }
  }

  private async handleForgetClick(): Promise<void> {
    if (!this._card || !this._confirmDialog) {
      return;
    }

    const confirmed = await this._confirmDialog.show({
      message: 'Forget this card? The card state and all reviews will be permanently deleted.',
      confirmText: 'Forget',
      cancelText: 'Cancel',
      confirmClass: 'forget',
    });

    if (!confirmed) {
      return;
    }

    const { wordId, readingIndex } = this._card;

    new ForgetCardCommand(wordId, readingIndex).send(() => {
      new UpdateCardStateCommand(wordId, readingIndex).send();
    });
  }

  private getFormattedSentence(): string | undefined {
    if (!this._cardContext || !this._sentence) {
      return undefined;
    }

    const surfaceForm = this.getTextWithoutFurigana(this._cardContext);

    if (!surfaceForm) {
      return undefined;
    }

    return formatSentenceWithMarkers(this._sentence, surfaceForm);
  }

  private getTextWithoutFurigana(element: HTMLElement): string {
    let text = '';

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node instanceof HTMLElement) {
        if (node.tagName !== 'RT') {
          text += this.getTextWithoutFurigana(node);
        }
      }
    }

    return text;
  }

  private async handleAddToDeck(): Promise<void> {
    if (!this._card) {
      return;
    }

    const deckId = Number(this._mining.studyDeckId);

    if (this._mining.autoMineToStudyDeck && deckId) {
      this._mining.addToStudyDeck(deckId, this._card, this.getFormattedSentence(), document.title);
      this.toastDeckAction(undefined);

      if (this._hideAfterAction) {
        this.hide();
      }

      return;
    }

    try {
      const decks = await new FetchStudyDecksCommand().call();

      if (!decks?.length) {
        return;
      }

      this.showDeckPicker(decks);
    } catch {
      // API unreachable
    }
  }

  private showDeckPicker(decks: StudyDeckListItem[]): void {
    if (!this._shadowRoot) {
      return;
    }

    const existing = this._shadowRoot.getElementById('deck-picker-overlay');

    if (existing) {
      existing.remove();

      return;
    }

    const formattedSentence = this.getFormattedSentence();
    const source = document.title;
    const openedAt = Date.now();

    const close = (): void => overlay.remove();
    const dismissIfReady = (): void => {
      if (Date.now() - openedAt > 300) {
        close();
      }
    };

    const overlay = createElement('div', {
      id: 'deck-picker-overlay',
      events: {
        onclick: dismissIfReady,
        ontouchstart: (e: Event) => {
          e.stopPropagation();
          e.preventDefault();
          dismissIfReady();
        },
      },
    });

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const tx = scrollX - this._popupLeft;
    const ty = scrollY - this._popupTop;

    overlay.style.transform = `translate(${tx}px, ${ty}px)`;

    const buttons = decks.map((deck) =>
      createElement('a', {
        class: ['outline', 'mining'],
        innerText: deck.name,
        handler: () => {
          if (this._card) {
            this._mining.addToStudyDeck(
              deck.userStudyDeckId,
              this._card,
              formattedSentence,
              source,
            );
            this.toastDeckAction(deck.name);

            if (this._hideAfterAction) {
              this.hide();
            }
          }

          close();
        },
      }),
    );

    const dialog = createElement('div', {
      id: 'deck-picker-dialog',
      events: {
        onclick: (e: Event) => e.stopPropagation(),
        ontouchstart: (e: Event) => e.stopPropagation(),
      },
      children: [
        createElement('p', { id: 'deck-picker-title', innerText: 'Add to deck' }),
        createElement('div', { id: 'deck-picker-list', children: buttons }),
      ],
    });

    overlay.appendChild(dialog);
    this._shadowRoot.appendChild(overlay);
  }

  private addMiningButton(
    deck: string | undefined,
    id: string,
    text?: string,
    handler?: () => void,
  ): void {
    if (!deck?.length) {
      return;
    }

    this._mineButtons.appendChild(
      createElement('a', {
        id: `${id}-deck`,
        class: ['outline', id],
        innerText: text,
        handler,
      }),
    );
  }

  private updateRotationButtons(): void {
    const previous = createElement('a', {
      id: 'previous',
      class: ['outline', 'previous'],
      innerText: 'Previous',
      handler: () => this._rotation.rotate(this._card!, -1),
    });
    const next = createElement('a', {
      id: 'next',
      class: ['outline', 'next'],
      innerText: 'Next',
      handler: () => this._rotation.rotate(this._card!, 1),
    });

    this._rotateButtons.replaceChildren(previous, next);
    this._rotateButtons.style.display = this._rotation.showActions ? '' : 'none';
  }

  private updateGradingButtons(): void {
    const gradeButtons = this._grading.getGradingActions().map((grade) =>
      createElement('a', {
        id: grade,
        class: ['outline', grade],
        innerText: grade,
        handler: () => this._grading.gradeCard(this._card!, grade),
      }),
    );

    this._gradeButtons.replaceChildren(...gradeButtons);
    this._gradeButtons.style.display = this._grading.showActions ? '' : 'none';
  }

  private applyPositions(): void {
    const sections = [this._closeButton, this._context, this._details];
    const before: HTMLElement[] = [];
    const after: HTMLElement[] = [];

    const miningTarget = this._moveMiningActions ? after : before;
    const rotationTarget = this._moveRotationActions ? after : before;
    const gradingTarget = this._moveGradingActions ? after : before;

    miningTarget.push(this._mineButtons);
    rotationTarget.push(this._rotateButtons);
    gradingTarget.push(this._gradeButtons);

    sections.unshift(...before);
    sections.push(...after);

    this._popup.replaceChildren(...sections, this._resizeHandle);
  }

  //#endregion
  //#region Resize

  private applyDimensions(): void {
    this._popup.style.setProperty('--popup-width', `${this._popupWidth}px`);
    this._popup.style.setProperty('--popup-height', `${this._popupHeight}px`);
  }

  private initResize(): void {
    let startX: number;
    let startY: number;
    let startWidth: number;
    let startHeight: number;

    const onMouseMove = (e: MouseEvent): void => {
      const newWidth = Math.max(Popup.MIN_WIDTH, startWidth + (e.clientX - startX));
      const newHeight = Math.max(Popup.MIN_HEIGHT, startHeight + (e.clientY - startY));

      this._popupWidth = newWidth;
      this._popupHeight = newHeight;
      this.applyDimensions();
    };

    const onMouseUp = (): void => {
      this._isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      void setConfiguration('popupWidth', this._popupWidth);
      void setConfiguration('popupHeight', this._popupHeight);
    };

    this._resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      this._isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = this._popupWidth;
      startHeight = this._popupHeight;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  //#endregion
  //#region Card Utils

  private cardHasState(state: 'neverForget' | 'blacklist' | 'suspend', card: JitenCard): boolean {
    const stateMap: Record<'neverForget' | 'blacklist' | 'suspend', JitenCardState> = {
      neverForget: JitenCardState.MASTERED,
      blacklist: JitenCardState.BLACKLISTED,
      suspend: JitenCardState.BLACKLISTED,
    };

    return card.cardState.includes(stateMap[state]);
  }

  //#endregion
  //#region On showing a popup

  private rerender(): void {
    if (!this._card) {
      return;
    }

    this.adjustMiningButtons(this._card);
    this.adjustRotateButtons(this._card);
    this.adjustContext(this._card);
    this.adjustDetails(this._card);

    this._popup.setAttribute('class', `popup ${this._card.cardState.join(' ')}`);
  }

  private adjustMiningButtons(card: JitenCard): void {
    const isNF = this.cardHasState('neverForget', card);
    const isBL = this.cardHasState('blacklist', card);
    const isSP = this.cardHasState('suspend', card);

    withElement(this._mineButtons, '#never-forget-deck', (el) => {
      el.innerText = isNF ? 'Remove Never Forget' : 'Never forget';
    });
    withElement(this._mineButtons, '#blacklist-deck', (el) => {
      el.innerText = isBL ? 'Remove Blacklist' : 'Blacklist';
    });
    withElement(this._mineButtons, '#suspend-deck', (el) => {
      el.innerText = isSP ? 'Unsuspend' : 'Suspend';
    });
  }

  private adjustRotateButtons(card: JitenCard): void {
    const previous = this._rotation.getNextCardState(card, -1);
    const next = this._rotation.getNextCardState(card, 1);
    const same = previous === next;

    const getText = (state: string | undefined, arrow?: 'left' | 'right'): string => {
      const text = !state
        ? 'Unflag'
        : state
            .replace(/^\w/, (c) => c.toUpperCase())
            .replace(/([a-z])([A-Z])/g, (c) => `${c[0]} ${c[1].toLowerCase()}`);

      if (arrow === 'left') {
        return `← ${text}`;
      }

      if (arrow === 'right') {
        return `${text} →`;
      }

      return text;
    };
    const getCls = (state: string | undefined): string => {
      if (!state) {
        return '';
      }

      return state.replace(/([a-z])([A-Z])/g, (c) => `${c[0]}-${c[1].toLowerCase()}`);
    };

    withElement(this._rotateButtons, '#previous', (el) => {
      el.style.display = same ? 'none' : '';
      el.innerText = getText(previous, 'left');

      el.setAttribute('class', `outline previous ${getCls(previous)}`);
    });

    withElement(this._rotateButtons, '#next', (el) => {
      el.innerText = getText(next, same ? undefined : 'right');

      el.setAttribute('class', `outline next ${getCls(next)}`);
    });
  }

  private adjustContext(card: JitenCard): void {
    this._context.replaceChildren(
      createElement('div', {
        id: 'header',
        class: 'subsection',
        children: [
          createElement('div', {
            id: 'headword',
            children: [this.getReadingBlock(card), this.getTtsButton(card)],
          }),
          this.getCardStateBlock(card),
        ],
      }),
      createElement('div', {
        id: 'meta',
        class: 'subsection',
        children: [this.getPitchAccentBlock(card), this.getFrequencyBlock(card)],
      }),
    );
  }

  private getReadingBlock(card: JitenCard): HTMLElement {
    const { wordId, spelling, readingIndex, wordWithReading } = card;
    const nodes = this.convertToRubyNodes(wordWithReading ?? spelling);

    if (this._disableHeadWordLink) {
      const span = createElement('span', {
        id: 'link',
        attributes: { lang: 'ja' },
      });

      span.append(...nodes);

      return span;
    }

    const url = `https://jiten.moe/vocabulary/${wordId}/${readingIndex}`;

    const a = createElement('a', {
      id: 'link',
      attributes: { href: url, target: '_blank', lang: 'ja' },
    });

    a.append(...nodes);

    return a;
  }

  private getTtsButton(card: JitenCard): HTMLElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');

    svg.setAttribute('viewBox', '0 0 24 24');

    const path = document.createElementNS(ns, 'path');

    path.setAttribute(
      'd',
      'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.47 4.47 0 002.5-3.5zM14 3.23v2.06a7.007 7.007 0 010 13.42v2.06A9.005 9.005 0 0014 3.23z',
    );

    svg.appendChild(path);

    const btn = createElement('a', {
      id: 'tts-btn',
      handler: (): void => void this.playCardTts(card, btn),
    });

    btn.appendChild(svg);

    return btn;
  }

  private async playCardTts(card: JitenCard, btn?: HTMLElement): Promise<void> {
    btn?.classList.add('playing');

    try {
      await playTts(card.wordId, card.readingIndex, this._ttsVoice);
    } catch {
      /* TTS errors are non-critical */
    } finally {
      btn?.classList.remove('playing');
    }
  }

  private convertToRubyNodes(wordWithReading: string): Node[] {
    // If no brackets, return as a single text node
    if (!wordWithReading.includes('[')) {
      return [document.createTextNode(wordWithReading)];
    }

    // Regex to match kanji[reading] patterns
    const regex = /([^\u3040-\u309F\u30A0-\u30FF]+)\[(.+?)\]/g;
    const nodes: Node[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(wordWithReading)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        nodes.push(document.createTextNode(wordWithReading.slice(lastIndex, match.index)));
      }

      // Create ruby element
      const ruby = document.createElement('ruby');

      const rt = document.createElement('rt');

      rt.textContent = match[2];

      ruby.append(document.createTextNode(match[1]));
      ruby.append(rt);

      nodes.push(ruby);

      lastIndex = regex.lastIndex;
    }

    // Add any remaining text after the last match
    if (lastIndex < wordWithReading.length) {
      nodes.push(document.createTextNode(wordWithReading.slice(lastIndex)));
    }

    return nodes;
  }

  private getCardStateBlock(card: JitenCard): HTMLDivElement {
    const { cardState } = card;

    return createElement('div', {
      id: 'state',
      children: cardState.map((s) => createElement('span', { class: [s], innerText: s })),
    });
  }

  private getPitchAccentBlock(card: JitenCard): HTMLDivElement {
    const container = createElement('div', { id: 'pitch-accent' });

    if (!this._showPitchDiagrams) {
      return container;
    }

    const kana = cleanReading(card.reading);

    for (const pitch of card.pitchAccents) {
      const svg = this.renderPitchDiagram(kana, pitch);

      if (svg) {
        container.appendChild(svg);
      }
    }

    return container;
  }

  private renderPitchDiagram(reading: string, pitchNum: number): SVGSVGElement | null {
    const data = getPitchDiagramData(reading, pitchNum);

    if (!data) {
      return null;
    }

    const { morae, pattern, color } = data;
    const ns = 'http://www.w3.org/2000/svg';
    const pointCount = pattern.length;
    const stepX = 18;
    const padX = 9;
    const width = pointCount * stepX;
    const height = 38;
    const highY = 5;
    const lowY = 17;
    const radius = 3;
    const textOffset = 8;

    const svg = document.createElementNS(ns, 'svg');

    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const points = pattern.map((v, i) => ({
      x: padX + i * stepX,
      y: v === 1 ? highY : lowY,
    }));

    const polyline = document.createElementNS(ns, 'polyline');

    polyline.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '1.5');
    svg.appendChild(polyline);

    for (let i = 0; i < pointCount; i++) {
      const isParticle = i === pointCount - 1;
      const circle = document.createElementNS(ns, 'circle');

      circle.setAttribute('cx', String(points[i].x));
      circle.setAttribute('cy', String(points[i].y));
      circle.setAttribute('r', String(radius));
      circle.setAttribute('fill', isParticle ? '#fff' : color);
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '1.5');
      svg.appendChild(circle);

      if (!isParticle && morae[i]) {
        const text = document.createElementNS(ns, 'text');

        text.setAttribute('x', String(points[i].x));
        text.setAttribute('y', String(points[i].y + textOffset));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'hanging');
        text.setAttribute('fill', color);
        text.setAttribute('font-size', '9');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', "'Noto Sans JP', sans-serif");
        text.textContent = morae[i];
        svg.appendChild(text);
      }
    }

    return svg;
  }

  private getFrequencyBlock(card: JitenCard): HTMLDivElement {
    const { frequencyRank } = card;

    return createElement('div', {
      id: 'frequency',
      innerText: `#${frequencyRank}`,
    });
  }

  private getConjugationsBlock(conjugations: string[]): HTMLDivElement | null {
    if (!conjugations || conjugations.length === 0) {
      return null;
    }

    return createElement('div', {
      id: 'conjugations',
      children: [
        createElement('span', {
          class: 'label',
          innerText: 'Conjugations: ',
        }),
        createElement('span', {
          innerText: conjugations.join(' ; '),
        }),
      ],
    });
  }

  private adjustDetails(card: JitenCard): void {
    const groupedMeanings = this.getGroupedMeanings(card);
    const conjugationsBlock =
      this._conjugations && this._showConjugations
        ? this.getConjugationsBlock(this._conjugations)
        : null;

    const children = [];

    if (conjugationsBlock) {
      children.push(conjugationsBlock);
    }

    children.push(
      ...groupedMeanings.flatMap(({ partsOfSpeech, glosses, startIndex }) => [
        createElement('div', {
          class: 'pos',
          children: partsOfSpeech
            .map((pos) => PARTS_OF_SPEECH[pos] ?? 'Unknown')
            .filter(Boolean)
            .map((pos) => createElement('span', { innerText: pos })),
        }),
        createElement('ol', {
          attributes: {
            start: (startIndex + 1).toString(),
          },
          children: glosses.map((g) =>
            createElement('li', {
              innerText: g.join('; '),
            }),
          ),
        }),
      ]),
    );

    this._details.replaceChildren(...children);
  }

  private getGroupedMeanings(card: JitenCard): {
    partsOfSpeech: string[];
    glosses: string[][];
    startIndex: number;
  }[] {
    const { meanings } = card;
    const groupedMeanings: {
      partsOfSpeech: string[];
      glosses: string[][];
      startIndex: number;
    }[] = [];

    let lastPos: string[] = [];

    for (const [index, meaning] of meanings.entries()) {
      const currentPartsOfSpeech = Array.isArray(meaning.partsOfSpeech)
        ? meaning.partsOfSpeech
        : [meaning.partsOfSpeech];

      if (
        currentPartsOfSpeech.length == lastPos.length &&
        currentPartsOfSpeech.every((p, i) => p === lastPos[i])
      ) {
        groupedMeanings[groupedMeanings.length - 1].glosses.push(meaning.glosses);

        continue;
      }
      groupedMeanings.push({
        partsOfSpeech: currentPartsOfSpeech,
        glosses: [meaning.glosses],
        startIndex: index,
      });

      lastPos = meaning.partsOfSpeech;
    }

    return groupedMeanings;
  }

  //#endregion
  //#region Others

  private isVisibile(): boolean {
    return this._root.style.visibility === 'visible';
  }

  private isDeckPickerOpen(): boolean {
    return this._shadowRoot?.getElementById('deck-picker-overlay') !== null;
  }

  private toastDeckAction(deckName?: string): void {
    const word = this._cardContext ? this.getTextWithoutFurigana(this._cardContext) : '';
    const target = deckName ?? 'deck';

    displayToast('success', `${word} added to ${target}`);
  }

  private startHover(): void {
    if (!this.isVisibile()) {
      return;
    }

    this._isHover = true;
    this.clearTimer();
  }

  private stopHover(): void {
    this._isHover = false;

    if (!this.isVisibile()) {
      return;
    }

    if (this._isResizing || this._confirmDialog?.isOpen || this.isDeckPickerOpen()) {
      return;
    }

    if (!this._hidePopupAutomatically) {
      return;
    }

    if (!this._hidePopupDelay) {
      this.hide();

      return;
    }

    this.startTimer();
  }

  private handleKeydown(e: MouseEvent | KeyboardEvent): void {
    if (!document.hasFocus()) {
      return;
    }

    if (e && 'key' in e && e.key === 'Escape' && this.isVisibile()) {
      e.stopPropagation();

      this.hide();
    }

    if (
      'button' in e &&
      e.button === 0 &&
      this.isVisibile() &&
      !this._isHover &&
      !this._isResizing
    ) {
      e.stopPropagation();

      this.hide();
    }
  }

  private clearTimer(): void {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
    }
  }

  private startTimer(): void {
    this.clearTimer();

    this._hideTimer = setTimeout(() => this.hide(), this._hidePopupDelay);
  }

  //#endregion
}
