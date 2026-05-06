let currentAudio: HTMLAudioElement | undefined;

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
