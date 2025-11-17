import { getLastError } from '../../extension/get-last-error';
import { runtime } from '../../extension/runtime';
import { Command } from '../lib/command';

export abstract class BackgroundCommand<
  TArguments extends unknown[] = [],
  TResult = void,
> extends Command<TArguments> {
  public send<T>(afterCall?: (r: TResult) => T | Promise<T>): void {
    this.call(afterCall).catch((error: Error) => {
      console.error(`[BackgroundCommand] ${this.constructor.name} failed:`, error);
    });
  }

  public call<T>(afterCall?: (r: TResult) => T | Promise<T>): Promise<TResult> {
    const promise = new Promise<TResult>((resolve, reject) => {
      runtime.sendMessage(
        {
          event: this.key,
          command: this.constructor.name,
          isBroadcast: false,
          args: this.arguments,
        },
        (response: { success: boolean; result: TResult } | undefined) => {
          const lastError = getLastError();

          if (lastError) {
            return reject(lastError as Error);
          }

          if (!response || !response.success) {
            return reject(new Error('Command failed or received invalid response'));
          }

          resolve(response.result);
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
