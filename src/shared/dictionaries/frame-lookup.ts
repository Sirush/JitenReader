import {
  DICTIONARY_FRAME_URL,
  DICTIONARY_ORIGIN,
  DictionaryLookup,
  DictionaryLookupResult,
  isDictionaryLookupResult,
} from './types';

let dictionaryFrame: HTMLIFrameElement | undefined;
let frameReady: Promise<boolean> | undefined;
let resolveFrameReady: ((ready: boolean) => void) | undefined;
const pendingLookups = new Map<string, { finish: (result: DictionaryLookupResult) => void }>();

function resetDictionaryFrame(): void {
  window.removeEventListener('message', handleDictionaryMessage);
  dictionaryFrame?.remove();
  dictionaryFrame = undefined;
  frameReady = undefined;
  resolveFrameReady?.(false);
  resolveFrameReady = undefined;

  for (const pending of pendingLookups.values()) {
    pending.finish({ status: 'unavailable' });
  }
}

function ensureDictionaryFrame(): Promise<boolean> {
  if (frameReady) {
    return frameReady;
  }

  frameReady = new Promise((resolve) => {
    resolveFrameReady = resolve;
  });
  window.addEventListener('message', handleDictionaryMessage);
  dictionaryFrame = document.createElement('iframe');
  // The isolated content script can read storage without running any of the site's scripts.
  dictionaryFrame.sandbox.add('allow-same-origin');
  dictionaryFrame.src = DICTIONARY_FRAME_URL;
  dictionaryFrame.onerror = resetDictionaryFrame;
  document.body.appendChild(dictionaryFrame);

  return frameReady;
}

function handleDictionaryMessage(event: MessageEvent<unknown>): void {
  if (event.origin !== DICTIONARY_ORIGIN || event.source !== dictionaryFrame?.contentWindow) {
    return;
  }

  const message = event.data as { type?: string; id?: string; result?: unknown } | null;

  if (message?.type === 'jiten-dictionary-ready') {
    resolveFrameReady?.(true);
    resolveFrameReady = undefined;
  } else if (
    message?.type === 'jiten-dictionary-result' &&
    typeof message.id === 'string' &&
    isDictionaryLookupResult(message.result)
  ) {
    pendingLookups.get(message.id)?.finish(message.result);
  }
}

export function lookupFromFrame(
  lookup: DictionaryLookup,
  timeout: number,
): Promise<DictionaryLookupResult> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(resetDictionaryFrame, timeout);

    pendingLookups.set(id, {
      finish: (result) => {
        clearTimeout(timer);
        pendingLookups.delete(id);
        resolve(result);
      },
    });

    void ensureDictionaryFrame().then((ready) => {
      if (ready && pendingLookups.has(id)) {
        dictionaryFrame?.contentWindow?.postMessage(
          { type: 'jiten-dictionary-lookup', id, lookup },
          DICTIONARY_ORIGIN,
        );
      }
    });
  });
}
