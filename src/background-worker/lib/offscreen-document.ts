let creating: Promise<void> | undefined;

export function ensureOffscreenDocument(): Promise<void> {
  creating ??= (async (): Promise<void> => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [chrome.runtime.getURL('views/offscreen.html')],
    });

    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'views/offscreen.html',
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK, chrome.offscreen.Reason.IFRAME_SCRIPTING],
        justification: 'TTS audio playback and local Jiten dictionary lookups',
      });
    }
  })().finally(() => {
    creating = undefined;
  });

  return creating;
}
