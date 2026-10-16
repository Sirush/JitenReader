import {
  DICTIONARY_FRAME_URL,
  DICTIONARY_ORIGIN,
  DICTIONARY_TIMEOUT,
  DictionaryLookup,
  DictionaryLookupResult,
  isDictionaryLookup,
  isDictionaryLookupResult,
} from '@shared/dictionaries/types';

let currentAudio: HTMLAudioElement | undefined;

let dictionaryFrame: HTMLIFrameElement | undefined;
let frameReady: Promise<boolean> | undefined;
let resolveFrameReady: ((ready: boolean) => void) | undefined;
const pendingLookups = new Map<string, { finish: (result: DictionaryLookupResult) => void }>();

function resetDictionaryFrame(): void {
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
  dictionaryFrame = document.createElement('iframe');
  // The isolated content script can read storage without running any of the site's scripts.
  dictionaryFrame.sandbox.add('allow-same-origin');
  dictionaryFrame.src = DICTIONARY_FRAME_URL;
  dictionaryFrame.onerror = resetDictionaryFrame;
  document.body.appendChild(dictionaryFrame);

  return frameReady;
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
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
});

function lookupFromFrame(
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

chrome.runtime.onMessage.addListener(
  (
    message: { target?: string; lookup?: unknown; timeout?: number },
    sender,
    sendResponse: (result: DictionaryLookupResult) => void,
  ) => {
    if (message.target !== 'dictionary-offscreen') {
      return false;
    }

    if (
      sender.id !== chrome.runtime.id ||
      sender.url !== chrome.runtime.getURL('js/background-worker.js') ||
      !isDictionaryLookup(message.lookup)
    ) {
      return false;
    }

    const timeout = Math.max(
      1,
      Math.min(message.timeout ?? DICTIONARY_TIMEOUT, DICTIONARY_TIMEOUT),
    );

    void lookupFromFrame(message.lookup, timeout).then(sendResponse);

    return true;
  },
);

chrome.runtime.onMessage.addListener(
  (message: { type?: string; data?: number[] }, _sender, sendResponse) => {
    if (message.type !== 'playTtsAudio') {
      return false;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio = undefined;
    }

    if (!message.data?.length) {
      sendResponse({ ok: false, error: 'No audio data' });

      return false;
    }

    const blob = new Blob([new Uint8Array(message.data)]);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    currentAudio = audio;

    audio.addEventListener(
      'ended',
      () => {
        URL.revokeObjectURL(url);
        currentAudio = undefined;
      },
      { once: true },
    );

    audio
      .play()
      .then(() => sendResponse({ ok: true }))
      .catch((e: Error) => sendResponse({ ok: false, error: e.message }));

    return true;
  },
);

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message.type === 'stopTtsAudio' && currentAudio) {
    currentAudio.pause();
    currentAudio = undefined;
  }
});
