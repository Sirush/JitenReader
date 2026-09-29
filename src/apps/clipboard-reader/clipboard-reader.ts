import { getConfiguration } from '@shared/configuration/get-configuration';
import { setConfiguration } from '@shared/configuration/set-configuration';
import { createElement } from '@shared/dom/create-element';
import {
  hasClipboardReadPermission,
  onClipboardPermissionRemoved,
  requestClipboardReadPermission,
} from '@shared/extension/clipboard-permission';
import { ClipboardReaderTab, FIND_CLIPBOARD_READER } from '@shared/extension/clipboard-reader-tab';
import { ReaderView } from '../reader-mode/reader-view';
import { ClipboardEntry, loadEntries, saveEntries } from './clipboard-entries';
import { ClipboardWatcher } from './clipboard-watcher';
import { japaneseOnly, splitJapaneseLines } from './split-japanese-lines';

const DEFAULT_SOURCE = 'Clipboard';
const NO_PARSE_CLASS = 'reader-noparse';
const HIDE_TIMES_CLASS = 'clipboard-hide-times';
const CLEAR_CONFIRM_MS = 3000;
const PASTE_KEYS = navigator.userAgent.includes('Mac') ? '⌘V' : 'Ctrl+V';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

const isParsable = (node: Element | Node): boolean =>
  !(node instanceof Element && node.classList.contains(NO_PARSE_CLASS));

const normalise = (text: string): string =>
  splitJapaneseLines(text)
    .flat()
    .map((line) => line.text)
    .join('\n');

const CONTENT_CHARS = /[぀-ゟ゠-ヿ一-龯々Ａ-Ｚａ-ｚ０-９0-9]/g;

const countCharacters = (entries: ClipboardEntry[]): number =>
  entries.reduce(
    (total, entry) =>
      total +
      splitJapaneseLines(entry.text)
        .flat()
        .filter((line) => line.japanese)
        .reduce((sum, line) => sum + (line.text.match(CONTENT_CHARS)?.length ?? 0), 0),
    0,
  );

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export class ClipboardReader {
  private _view = new ReaderView(true);
  private _watcher = new ClipboardWatcher((text) => this.addText(text, true));
  private _entries: ClipboardEntry[] = [];
  private _elements = new Map<ClipboardEntry, HTMLElement>();
  private _clearTimer?: number;

  private _sourceInput: HTMLInputElement;
  private _autoPaste: HTMLInputElement;
  private _replaceLine: HTMLInputElement;
  private _timestamps: HTMLInputElement;
  private _stats: HTMLSpanElement;
  private _clearButton: HTMLButtonElement;
  private _hint: HTMLParagraphElement;
  private _status: HTMLParagraphElement;
  private _header: HTMLElement;

  constructor() {
    this._sourceInput = createElement('input', {
      class: ['clipboard-source-input'],
      attributes: {
        type: 'text',
        value: DEFAULT_SOURCE,
        placeholder: DEFAULT_SOURCE,
        'aria-label': 'Source name, saved with words you mine or review',
        spellcheck: 'false',
      },
    });

    this._autoPaste = this.checkbox();
    this._replaceLine = this.checkbox();
    this._timestamps = this.checkbox();
    this._stats = createElement('span', { class: ['clipboard-stats'] });

    this._clearButton = createElement('button', {
      class: ['reader-btn', 'clipboard-clear-btn'],
      innerText: 'Clear',
      attributes: { type: 'button' },
    });

    this._hint = createElement('p', {
      class: ['clipboard-hint'],
      innerText:
        `Copy Japanese text and press ${PASTE_KEYS} here. ` +
        'You can also turn auto-paste to parse every Japanese string you copy automatically.',
    });

    this._status = createElement('p', {
      class: ['clipboard-status'],
      attributes: { role: 'status' },
    });

    this._header = createElement('header', {
      class: ['reader-header', 'clipboard-header'],
      children: [
        this._sourceInput,
        createElement('div', {
          class: ['clipboard-toolbar'],
          children: [
            this.option(this._autoPaste, 'Auto-paste'),
            this.option(this._replaceLine, 'Replace last line'),
            this.option(this._timestamps, 'Timestamps'),
            createElement('span', { class: ['clipboard-toolbar-spacer'] }),
            this._stats,
            this._clearButton,
          ],
        }),
        this._hint,
        this._status,
      ],
    });

    this.setStatus('');
  }

  public async init(): Promise<void> {
    document.title = DEFAULT_SOURCE;
    this.listen();

    this._replaceLine.checked = await getConfiguration('clipboardReaderReplaceLine');
    this._timestamps.checked = await getConfiguration('clipboardReaderTimestamps');
    this.applyTimestamps();

    this._entries = await loadEntries();

    await this._view.show({ title: DEFAULT_SOURCE, header: this._header, content: '' });
    this._view.appendContent(
      this._entries.map((entry) => this.buildEntry(entry)),
      isParsable,
    );
    this.updateSummary();

    if (
      (await getConfiguration('clipboardReaderAutoPaste')) &&
      (await hasClipboardReadPermission())
    ) {
      this.startAutoPaste();
    }
  }

  private listen(): void {
    this._sourceInput.addEventListener('input', () => {
      document.title = this._sourceInput.value.trim() || DEFAULT_SOURCE;
    });

    this._autoPaste.addEventListener('change', () => this.onAutoPasteToggled());

    this._replaceLine.addEventListener('change', () => {
      void setConfiguration('clipboardReaderReplaceLine', this._replaceLine.checked);
    });

    this._timestamps.addEventListener('change', () => {
      this.applyTimestamps();
      void setConfiguration('clipboardReaderTimestamps', this._timestamps.checked);
    });

    this._clearButton.addEventListener('click', () => this.onClearClicked());

    document.addEventListener('paste', (e) => this.onPaste(e));
    document.addEventListener('copy', () => this._watcher.ignoreOwnCopy());

    onClipboardPermissionRemoved(() => {
      void hasClipboardReadPermission().then((granted) => {
        if (!granted) {
          this.stopAutoPaste();
        }
      });
    });

    chrome.runtime.onMessage.addListener(
      (message: { type?: string }, _sender, sendResponse: (tab?: ClipboardReaderTab) => void) => {
        if (message?.type !== FIND_CLIPBOARD_READER) {
          return false;
        }

        void chrome.tabs.getCurrent().then((tab) => {
          sendResponse(
            tab?.id !== undefined ? { tabId: tab.id, windowId: tab.windowId } : undefined,
          );
        });

        return true;
      },
    );
  }

  private onAutoPasteToggled(): void {
    if (!this._autoPaste.checked) {
      this.stopAutoPaste();

      return;
    }

    void requestClipboardReadPermission()
      .catch(() => false)
      .then((granted) => {
        if (granted) {
          this.startAutoPaste();
        } else {
          this._autoPaste.checked = false;
          this.setStatus("Clipboard access wasn't allowed, so auto-paste is off.");
        }
      });
  }

  private startAutoPaste(): void {
    this._autoPaste.checked = true;
    this._watcher.start();
    void setConfiguration('clipboardReaderAutoPaste', true);
  }

  private stopAutoPaste(): void {
    this._autoPaste.checked = false;
    this._watcher.stop();
    void setConfiguration('clipboardReaderAutoPaste', false);
  }

  private onPaste(e: ClipboardEvent): void {
    if (e.target === this._sourceInput || this._watcher.isPasteTarget(e.target)) {
      return;
    }

    e.preventDefault();

    const text = e.clipboardData?.getData('text/plain') ?? '';

    this._watcher.markSeen(text);
    this.addText(text, false);
  }

  private addText(text: string, automatic: boolean): void {
    const lines = splitJapaneseLines(text).flat();

    if (!lines.length) {
      return;
    }

    if (!lines.some((line) => line.japanese)) {
      this.setStatus('Skipped text with no Japanese in it. Nothing was sent.');

      return;
    }

    const normalised = normalise(text);
    const last = this._entries[this._entries.length - 1] as ClipboardEntry | undefined;

    // Reopening the page reads the clipboard again, which usually still holds the newest line.
    if (automatic && last && japaneseOnly(last.text) === japaneseOnly(text)) {
      return;
    }

    this.setStatus('');

    if (this._replaceLine.checked && last) {
      this.removeEntry(last, false);
    }

    const entry: ClipboardEntry = { text: normalised, time: Date.now() };

    this._entries.push(entry);
    this._view.appendContent([this.buildEntry(entry)], isParsable);
    this.persist();
  }

  private buildEntry(entry: ClipboardEntry): HTMLElement {
    const text = createElement('p', { class: ['clipboard-text'] });

    for (const line of splitJapaneseLines(entry.text).flat()) {
      text.appendChild(
        createElement('span', {
          class: line.japanese
            ? ['reader-line']
            : ['reader-line', 'reader-skipped', NO_PARSE_CLASS],
          innerText: line.text,
          attributes: line.japanese ? {} : { title: 'Not sent: no Japanese text' },
        }),
      );
    }

    const date = new Date(entry.time);
    const remove = createElement('button', {
      class: ['clipboard-delete-btn'],
      innerText: '✕',
      attributes: { type: 'button', title: 'Delete line', 'aria-label': 'Delete line' },
    });

    remove.addEventListener('click', () => this.removeEntry(entry));

    const element = createElement('div', {
      class: ['clipboard-entry'],
      children: [
        createElement('time', {
          class: ['clipboard-time', NO_PARSE_CLASS],
          innerText: timeFormat.format(date),
          attributes: { datetime: date.toISOString(), title: date.toLocaleString() },
        }),
        text,
        remove,
      ],
    });

    this._elements.set(entry, element);

    return element;
  }

  private removeEntry(entry: ClipboardEntry, persist = true): void {
    const element = this._elements.get(entry);

    this._entries = this._entries.filter((e) => e !== entry);
    this._elements.delete(entry);

    if (element) {
      this._view.removeContent(element);
    }

    if (persist) {
      this.persist();
    }
  }

  private onClearClicked(): void {
    if (this._clearTimer === undefined) {
      this._clearButton.innerText = 'Click again to clear';
      this._clearTimer = window.setTimeout(() => this.resetClearButton(), CLEAR_CONFIRM_MS);

      return;
    }

    this.resetClearButton();
    [...this._entries].forEach((entry) => this.removeEntry(entry, false));
    this.persist();
  }

  private resetClearButton(): void {
    window.clearTimeout(this._clearTimer);
    this._clearTimer = undefined;
    this._clearButton.innerText = 'Clear';
  }

  private persist(): void {
    this.updateSummary();
    void saveEntries(this._entries);
  }

  private updateSummary(): void {
    const count = this._entries.length;

    this._stats.textContent = count
      ? `${plural(count, 'line')}, ${plural(countCharacters(this._entries), 'character')}`
      : '';
    this._clearButton.hidden = !count;
    this._hint.hidden = count > 0;
  }

  private applyTimestamps(): void {
    document.documentElement.classList.toggle(HIDE_TIMES_CLASS, !this._timestamps.checked);
  }

  private setStatus(message: string): void {
    this._status.textContent = message;
    this._status.hidden = !message;
  }

  private checkbox(): HTMLInputElement {
    return createElement('input', { attributes: { type: 'checkbox' } });
  }

  private option(input: HTMLInputElement, label: string): HTMLLabelElement {
    const element = createElement('label', { class: ['clipboard-option'], children: [input] });

    element.append(label);

    return element;
  }
}
