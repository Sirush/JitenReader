import { getConfiguration } from '@shared/configuration/get-configuration';
import { debug } from '@shared/debug';
import { createElement } from '@shared/dom/create-element';
import { getParsingPaused } from '@shared/extension/get-parsing-paused';
import { getStyleUrl } from '@shared/extension/get-style-url';
import { isDisabled } from '@shared/host-meta/is-disabled';
import { HostMeta } from '@shared/host-meta/types';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { receiveBackgroundMessage } from '@shared/messages/receiving/receive-background-message';
import { KeybindManager } from '../integration/keybind-manager';
import { Registry } from '../integration/registry';
import { BaseParser } from './base.parser';

export class TriggerParser extends BaseParser {
  protected _parseKeyManager = new KeybindManager(['parseKey']);
  protected _buttonRoot = createElement('div', {
    id: 'ajb-parse-button',
  });

  constructor(meta: HostMeta) {
    super(meta);

    this._parseKeyManager.activate();

    Registry.events.on('parseKey', () => {
      this.initParse();
    });

    receiveBackgroundMessage('parsePage', () => this.parsePage());
    receiveBackgroundMessage('parseSelection', () => this.parseSelection());

    onBroadcastMessage(
      'configurationUpdated',
      async () => {
        const show = await getConfiguration('showParseButton');
        const paused = await getParsingPaused();

        this._buttonRoot.style.display = show && !paused ? 'block' : 'none';
      },
      true,
    );

    onBroadcastMessage(
      'parsingPaused',
      async (paused: boolean) => {
        if (paused) {
          this._buttonRoot.style.display = 'none';
          this._parseKeyManager.deactivate();
        } else {
          const show = await getConfiguration('showParseButton');

          this._buttonRoot.style.display = show ? 'block' : 'none';
          this._parseKeyManager.activate();
        }
      },
    );

    void Promise.all([isDisabled(window.location.href), getParsingPaused()]).then(
      ([disabled, paused]) => {
        if (!disabled && !paused) {
          this.installParseButton();
        }

        if (paused) {
          this._parseKeyManager.deactivate();
        }
      },
    );
  }

  private initParse(): void {
    this._buttonRoot.style.display = 'none';

    if (window.getSelection()?.toString()) {
      debug('TriggerParser: Parsing selection');

      return this.parseSelection();
    }

    debug('TriggerParser: Parsing page');

    return this.parsePage();
  }

  private installParseButton(): void {
    const shadowRoot = this._buttonRoot.attachShadow({ mode: 'open' });

    shadowRoot.append(
      createElement('link', {
        attributes: { rel: 'stylesheet', href: getStyleUrl('parse') },
      }),
      createElement('div', { innerText: 'Parse', handler: () => this.initParse() }),
    );

    document.body.appendChild(this._buttonRoot);
  }
}
