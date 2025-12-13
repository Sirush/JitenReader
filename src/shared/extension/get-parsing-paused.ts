export const getParsingPaused = async (): Promise<boolean> => {
  const result = await chrome.storage.local.get('parsingPaused');

  return result.parsingPaused ?? false;
};
