export const setParsingPaused = async (paused: boolean): Promise<void> => {
  await chrome.storage.local.set({ parsingPaused: paused });
};
