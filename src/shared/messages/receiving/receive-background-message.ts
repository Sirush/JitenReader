import { runtime } from '../../extension/runtime';
import { PotentialPromise } from '../../types';
import { ExtensionMessage } from '../types/extension-message';
import { TabEventArgs, TabEventFunction, TabEventResult, TabEvents } from '../types/tab';

/**
 * Message handler to receive messages from the background script.
 *
 * @param {keyof TabEvents} event The message type to handle
 * @param {TabEventFunction} handler The handler for the message
 */
export const receiveBackgroundMessage = <TEvent extends keyof TabEvents>(
  event: TEvent,
  handler: TabEventFunction<TEvent>,
): (() => void) => {
  const listener = (
    request: ExtensionMessage<TabEvents, TEvent>,
    _: unknown,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    const args = request.args as TabEventArgs<TEvent>;

    if (request.event !== event) {
      return false;
    }

    const handlerResult: PotentialPromise<TabEventResult<TEvent>> = handler(...args);
    const promise = Promise.resolve(handlerResult);

    promise
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error: Error) => {
        sendResponse({ success: false, error });
      });

    return true;
  };

  runtime.onMessage.addListener(listener);

  return () => runtime.onMessage.removeListener(listener);
};
