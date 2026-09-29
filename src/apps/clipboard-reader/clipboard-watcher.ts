import { createElement } from '@shared/dom/create-element';

const POLL_INTERVAL_MS = 500;
const OWN_COPY_GRACE_MS = 1500;

export class ClipboardWatcher {
  private _timer?: number;
  private _lastSeen?: string;
  private _ignoreUntil = 0;
  private _reading = false;
  private _pasteTarget: HTMLTextAreaElement;

  constructor(private readonly _onChange: (text: string) => void) {
    this._pasteTarget = createElement('textarea', {
      class: ['clipboard-paste-target'],
      attributes: { 'aria-hidden': 'true', tabindex: '-1' },
    });
  }

  public get running(): boolean {
    return this._timer !== undefined;
  }

  public isPasteTarget(target: EventTarget | null): boolean {
    return target === this._pasteTarget;
  }

  public start(): void {
    if (this.running) {
      return;
    }

    if (!this._pasteTarget.isConnected) {
      document.body.appendChild(this._pasteTarget);
    }

    this._timer = window.setInterval(() => void this.check(), POLL_INTERVAL_MS);
    void this.check();
  }

  public stop(): void {
    window.clearInterval(this._timer);
    this._timer = undefined;
  }

  /** Records text the page already added itself, so the next poll doesn't add it again. */
  public markSeen(text: string): void {
    this._lastSeen = text;
  }

  /** Text copied from the reader's own lines would otherwise come straight back as a new line. */
  public ignoreOwnCopy(): void {
    this._ignoreUntil = Date.now() + OWN_COPY_GRACE_MS;
  }

  private async check(): Promise<void> {
    if (this._reading) {
      return;
    }

    this._reading = true;

    try {
      const text = await this.read();

      if (text === undefined || text === this._lastSeen) {
        return;
      }

      this._lastSeen = text;

      if (Date.now() > this._ignoreUntil) {
        this._onChange(text);
      }
    } finally {
      this._reading = false;
    }
  }

  // Chrome's async clipboard API refuses to read in an unfocused document, and this page usually sits
  // behind the app being copied from. The paste command only needs the clipboardRead permission.
  private async read(): Promise<string | undefined> {
    if (!document.hasFocus()) {
      return this.readWithPasteCommand();
    }

    try {
      return await navigator.clipboard.readText();
    } catch {
      return undefined;
    }
  }

  private readWithPasteCommand(): string | undefined {
    const previous = document.activeElement;

    this._pasteTarget.value = '';
    this._pasteTarget.focus();

    const pasted = document.execCommand('paste');
    const text = this._pasteTarget.value;

    if (previous instanceof HTMLElement && previous !== document.body) {
      previous.focus();
    } else {
      this._pasteTarget.blur();
    }

    return pasted ? text : undefined;
  }
}
