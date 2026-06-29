import { FeatureImplementation } from '@shared/features/types';
import { receiveBackgroundMessage } from '@shared/messages/receiving/receive-background-message';
import { KeybindManager } from '../integration/keybind-manager';
import { Registry } from '../integration/registry';
import { ReaderView } from '../reader-mode/reader-view';

export class ReaderModeFeature implements FeatureImplementation {
  private _view = new ReaderView();
  private _keyManager = new KeybindManager(['readerModeKey']);

  public apply(): void {
    this._keyManager.activate();
    Registry.events.on('readerModeKey', (e?: KeyboardEvent | MouseEvent) => {
      // Ignore auto-repeat so holding the key doesn't toggle the reader open/closed repeatedly.
      if (e instanceof KeyboardEvent && e.repeat) {
        return;
      }

      this._view.toggle();
    });

    receiveBackgroundMessage('openReaderMode', (text?: string) => {
      if (text?.trim()) {
        void this._view.openText(text);
      } else {
        void this._view.open();
      }
    });

    Registry.statusBar?.addButton({
      id: 'ajb-reader-btn',
      icon: '📖',
      tooltip: 'Toggle reader mode',
      handler: () => this._view.toggle(),
    });
  }
}
