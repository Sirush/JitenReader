/** Fires in every extension context, including the one that wrote the flag, unlike the broadcast. */
export const onParsingPausedChanged = (listener: (paused: boolean) => void): void => {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !('parsingPaused' in changes)) {
      return;
    }

    listener((changes.parsingPaused.newValue as boolean | undefined) ?? false);
  });
};
