import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCard } from '@shared/jiten/types';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { KeybindManager } from '../../integration/keybind-manager';
import { Registry } from '../../integration/registry';
import { RotationController } from './rotation-controller';

/**
 * Handles keybinds for rotating flags on cards.
 */
export class RotationActions {
  private _keyManager = new KeybindManager(['jitenRotateForward', 'jitenRotateBackward']);
  private _card?: JitenCard;

  private _rotateCycle = false;
  private _cycleNeverForget = false;
  private _cycleBlacklist = false;
  private _cycleSuspended = false;

  constructor(private _controller: RotationController) {
    const { events } = Registry;

    onBroadcastMessage(
      'configurationUpdated',
      async (): Promise<void> => {
        this._rotateCycle = await getConfiguration('jitenRotateCycle');
        this._cycleNeverForget = await getConfiguration('jitenCycleNeverForget');
        this._cycleBlacklist = await getConfiguration('jitenCycleBlacklist');
        this._cycleSuspended = await getConfiguration('jitenCycleSuspended');
      },
      true,
    );

    events.on('jitenRotateForward', () => this.rotateFlags(true));
    events.on('jitenRotateBackward', () => this.rotateFlags(false));
  }

  public activate(context: HTMLElement): void {
    this._card = Registry.getCardFromElement(context);
    this._keyManager.activate();
  }

  public deactivate(): void {
    this._card = undefined;
    this._keyManager.deactivate();
  }

  private rotateFlags(forward: boolean): void {
    if (!this._card) {
      return;
    }

    this._controller.rotate(this._card, forward ? 1 : -1);
  }
}
