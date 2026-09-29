import { MessageSender } from '@shared/extension/types';
import { RateLimitedError } from '@shared/jiten/rate-limited-error';
import { JitenToken } from '@shared/jiten/types';
import { SequenceAbortedCommand } from '@shared/messages/foreground/sequence-aborted.command';
import { SequenceErrorCommand } from '@shared/messages/foreground/sequence-error.command';
import { SequenceSuccessCommand } from '@shared/messages/foreground/sequence-success.command';
import { ToastCommand } from '@shared/messages/foreground/toast.command';
import { ForegroundCommand } from '@shared/messages/lib/foreground-command';
import { Parser } from './parser';
import { Batch, Handle } from './parser.types';

// UTF-8 bytes: a deliberate ~3x overestimate for Japanese against the server's 81,000 character cap.
const BATCH_SIZE = 80000;
// Measured from request start, so batches slower than this to parse are not delayed further.
const MIN_DISPATCH_INTERVAL_MS = 1000;
// A longer pause risks the service worker being suspended while paragraphs are still queued.
const MAX_PAUSE_MS = 25_000;

export class ParseController {
  private _pending = new Map<string, Handle>();
  private _inFlight = false;
  private _timer?: ReturnType<typeof setTimeout>;
  private _nextDispatchAt = 0;
  private _notifiedFrames = new Set<string>();

  public abortSequence(sender: MessageSender, sequenceId: number): void {
    this._pending.delete(this.getKey(sender, sequenceId));
  }

  public parseSequences(sender: MessageSender, data: [sequenceId: number, text: string][]): void {
    const handles = data.map(([sequenceId, text]) => this.createHandle(sender, sequenceId, text));

    if (this.getPauseRemaining() > MAX_PAUSE_MS) {
      this.cancel(handles);

      return;
    }

    handles.forEach((handle) => this._pending.set(this.getKey(sender, handle.sequenceId), handle));
    this.scheduleDispatch();
  }

  private createHandle(sender: MessageSender, sequenceId: number, text: string): Handle {
    return {
      sequenceId,
      sender,
      text,
      length: new TextEncoder().encode(text).length + 7,
      resolve: (tokens: JitenToken[]): void =>
        this.reply(sender, new SequenceSuccessCommand(sequenceId, tokens)),
      reject: (error: Error): void =>
        this.reply(sender, new SequenceErrorCommand(sequenceId, error.message)),
    };
  }

  private scheduleDispatch(): void {
    if (this._inFlight || this._timer || !this._pending.size) {
      return;
    }

    const delay = this._nextDispatchAt - Date.now();

    if (delay > 0) {
      this._timer = setTimeout(() => {
        this._timer = undefined;
        this.scheduleDispatch();
      }, delay);

      return;
    }

    void this.dispatch();
  }

  private async dispatch(): Promise<void> {
    const batch = this.takeBatch();

    this._inFlight = true;
    this._nextDispatchAt = Date.now() + MIN_DISPATCH_INTERVAL_MS;

    try {
      await new Parser(batch).parse();
    } catch (error) {
      if (error instanceof RateLimitedError) {
        this.pause(batch, error.retryAfterMs);
      } else {
        batch.handles.forEach((handle) => handle.reject(error as Error));
      }
    } finally {
      this._inFlight = false;
      this.scheduleDispatch();
    }
  }

  private takeBatch(): Batch {
    const batch: Batch = { strings: [], handles: [] };
    let length = 0;

    for (const [key, handle] of this._pending) {
      if (batch.handles.length && length + handle.length > BATCH_SIZE) {
        break;
      }

      length += handle.length;
      batch.strings.push(handle.text);
      batch.handles.push(handle);
      this._pending.delete(key);
    }

    return batch;
  }

  private pause(batch: Batch, retryAfterMs: number): void {
    this._nextDispatchAt = Date.now() + retryAfterMs;
    this._notifiedFrames.clear();

    if (retryAfterMs > MAX_PAUSE_MS) {
      const handles = [...batch.handles, ...this._pending.values()];

      this._pending.clear();
      this.cancel(handles);

      return;
    }

    const requeued = batch.handles.map((h) => [this.getKey(h.sender, h.sequenceId), h] as const);

    this._pending = new Map([...requeued, ...this._pending]);
    this.notify(
      batch.handles,
      `jiten.moe rate limit reached, parsing resumes in ${Math.ceil(retryAfterMs / 1000)}s`,
    );
  }

  private cancel(handles: Handle[]): void {
    handles.forEach((h) => this.reply(h.sender, new SequenceAbortedCommand(h.sequenceId)));
    this.notify(
      handles,
      `jiten.moe rate limit reached, try again in ${Math.ceil(this.getPauseRemaining() / 1000)}s`,
    );
  }

  private notify(handles: Handle[], message: string): void {
    for (const { sender } of handles) {
      const frameKey = this.getFrameKey(sender);

      if (this._notifiedFrames.has(frameKey)) {
        continue;
      }

      this._notifiedFrames.add(frameKey);
      this.reply(sender, new ToastCommand('error', message));
    }
  }

  private getPauseRemaining(): number {
    return this._nextDispatchAt - Date.now();
  }

  private reply(sender: MessageSender, command: ForegroundCommand<unknown[]>): void {
    command.sendToFrame(sender.tab!.id!, sender.frameId ?? 0);
  }

  // Sequence ids restart at 1 in every content script, so they only identify a paragraph per frame.
  private getKey(sender: MessageSender, sequenceId: number): string {
    return `${this.getFrameKey(sender)}:${sequenceId}`;
  }

  private getFrameKey(sender: MessageSender): string {
    return `${sender.tab?.id}:${sender.frameId ?? 0}`;
  }
}
