import { getLastError } from '../../extension/get-last-error';
import { tabs } from '../../extension/tabs';
import { Command } from './command';

export abstract class ForegroundCommand<
  TArguments extends unknown[] = [],
  TResult = void,
> extends Command<TArguments> {
  public send<T>(tabId: number, afterCall?: (r: TResult) => T | Promise<T>): void {
    // Fire-and-forget: swallow rejections (e.g. "Receiving end does not exist" when the target tab
    // has no content script yet / was closed). Callers that need the result use call() and handle it.
    void this.call(tabId, afterCall).catch(() => undefined);
  }

  public call<T>(tabId: number, afterCall?: (r: TResult) => T | Promise<T>): Promise<TResult> {
    const promise = new Promise<TResult>((resolve, reject) => {
      tabs.sendMessage(
        tabId,
        {
          event: this.key,
          command: this.constructor.name,
          isBroadcast: false,
          args: this.arguments,
        },
        (response: TResult) => {
          const lastError = getLastError();

          if (lastError) {
            reject(lastError as Error);
          }

          resolve(response);
        },
      );
    });

    return afterCall
      ? promise.then(async (r) => {
          await afterCall(r);

          return r;
        })
      : promise;
  }
}
