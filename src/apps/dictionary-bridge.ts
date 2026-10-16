import { lookupDictionaries } from '@shared/dictionaries/lookup';
import { isDictionaryBridgeFrame, isDictionaryLookup } from '@shared/dictionaries/types';

if (isDictionaryBridgeFrame()) {
  const extensionOrigin = new URL(chrome.runtime.getURL('')).origin;

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (event.source !== parent || event.origin !== extensionOrigin) {
      return;
    }

    const message = event.data as { type?: string; id?: string; lookup?: unknown } | null;

    if (
      message?.type !== 'jiten-dictionary-lookup' ||
      typeof message.id !== 'string' ||
      !isDictionaryLookup(message.lookup)
    ) {
      return;
    }

    void lookupDictionaries(message.lookup)
      .catch(() => ({ status: 'unavailable' as const }))
      .then((result) => {
        parent.postMessage(
          { type: 'jiten-dictionary-result', id: message.id, result },
          extensionOrigin,
        );
      });
  });

  parent.postMessage({ type: 'jiten-dictionary-ready' }, extensionOrigin);
}
