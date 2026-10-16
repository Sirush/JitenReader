import { lookupFromFrame } from '@shared/dictionaries/frame-lookup';
import {
  DICTIONARY_TIMEOUT,
  DictionaryLookupResult,
  isDictionaryLookup,
} from '@shared/dictionaries/types';

let currentAudio: HTMLAudioElement | undefined;

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
