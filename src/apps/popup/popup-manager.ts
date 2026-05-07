import { getConfiguration } from '@shared/configuration/get-configuration';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { KeybindManager } from '../integration/keybind-manager';
import { Registry } from '../integration/registry';
import { GradingActions } from './actions/grading-actions';
import { GradingController } from './actions/grading-controller';
import { MiningActions } from './actions/mining-actions';
import { MiningController } from './actions/mining-controller';
import { RotationActions } from './actions/rotation-actions';
import { RotationController } from './actions/rotation-controller';
import { Popup } from './popup';

export class PopupManager {
  private _keyManager = new KeybindManager(['showPopupKey', 'showAdvancedDialogKey']);

  private _miningController = new MiningController();
  private _rotationController = new RotationController();
  private _gradingController = new GradingController();

  private _miningActions = new MiningActions(this._miningController);
  private _rotationActions = new RotationActions(this._rotationController);
  private _gradingActions = new GradingActions(this._gradingController);

  private _popup = new Popup(
    this._miningController,
    this._rotationController,
    this._gradingController,
  );

  private _showPopupOnHover: boolean;
  private _touchscreenSupport: boolean;
  private _touchscreenDoubleTap: boolean;
  private _lastTapTime = 0;
  private _lastTapTarget: HTMLElement | null = null;
  private _currentHover?: HTMLElement;
  private _currentSentence?: string;

  private _observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.removedNodes) {
        if (node === this._currentHover || node.contains(this._currentHover!)) {
          this._observer.disconnect();
          this._popup.hide();

          return;
        }
      }
    }
  });

  constructor() {
    onBroadcastMessage(
      'configurationUpdated',
      async () => {
        this._showPopupOnHover = await getConfiguration('showPopupOnHover');
        this._touchscreenSupport = await getConfiguration('touchscreenSupport');
        this._touchscreenDoubleTap = await getConfiguration('touchscreenDoubleTap');
      },
      true,
    );

    Registry.events.on('showPopupKey', () => this.handlePopup());
    Registry.events.on('showAdvancedDialogKey', () => this.handleAdvancedDialog());
  }

  /**
   * Register a node for keybinds and the popup itself. Shows the popup if configured to do so.
   *
   * @param {HTMLElement} element The jiten-word element being hovered
   * @param {string} [sentence] The sentence containing this word
   * @returns {void}
   */
  public enter(element: HTMLElement, sentence?: string): void {
    this._currentHover = element;
    this._currentSentence = sentence;

    this._keyManager.activate();
    this._miningActions.activate(this._currentHover, sentence);
    this._rotationActions.activate(this._currentHover);
    this._gradingActions.activate(this._currentHover);

    if (this._showPopupOnHover) {
      this.handlePopup();
    }
  }

  public touch(element: HTMLElement, event: MouseEvent, sentence?: string): void {
    if (!this._touchscreenSupport || !element || Registry.skipTouchEvents) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (this._touchscreenDoubleTap) {
      const now = Date.now();
      const isDoubleTap = this._lastTapTarget === element && now - this._lastTapTime < 300;

      this._lastTapTime = now;
      this._lastTapTarget = element;

      if (!isDoubleTap) {
        return;
      }
    }

    this.activateAndShow(element, sentence);
  }

  public longPress(element: HTMLElement, sentence?: string): void {
    if (!this._touchscreenSupport || !element || Registry.skipTouchEvents) {
      return;
    }

    this.activateAndShow(element, sentence);
  }

  /**
   * Leave the current context. Deactivates keybinds. If the popup currently open, it will be hidden after a short delay
   *
   * @returns {void}
   */
  public leave(): void {
    this._currentHover = undefined;
    this._currentSentence = undefined;

    this._observer.disconnect();
    this._keyManager.deactivate();
    this._miningActions.deactivate();
    this._rotationActions.deactivate();
    this._gradingActions.deactivate();

    this._popup.initHide();
  }

  private activateAndShow(element: HTMLElement, sentence?: string): void {
    this._currentHover = element;
    this._currentSentence = sentence;

    this._keyManager.activate();
    this._miningActions.activate(this._currentHover, sentence);
    this._rotationActions.activate(this._currentHover);
    this._gradingActions.activate(this._currentHover);

    this.handlePopup();
  }

  /**
   * Event handler is reached if an element is hovered and the keybind for popup is pressed.
   * Also called if the popup is configured to show on hover and the mouse is moved over an element.
   *
   * @returns
   */
  private handlePopup(): void {
    if (!this._currentHover) {
      return;
    }

    this._popup.show(this._currentHover, this._currentSentence);

    this._observer.disconnect();

    if (this._currentHover.parentElement) {
      this._observer.observe(this._currentHover.parentElement, { childList: true });
    }
  }

  private handleAdvancedDialog(): void {
    // TODO: Show the advanced dialog
  }
}
