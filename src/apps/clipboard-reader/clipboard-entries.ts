import { CLIPBOARD_READER_STORAGE_KEY } from '@shared/extension/clipboard-reader-tab';
import { japaneseOnly } from './split-japanese-lines';

export interface ClipboardEntry {
  text: string;
  /** Epoch milliseconds. */
  time: number;
}

export const loadEntries = async (): Promise<ClipboardEntry[]> => {
  const stored = await chrome.storage.local.get(CLIPBOARD_READER_STORAGE_KEY);

  return (stored[CLIPBOARD_READER_STORAGE_KEY] as ClipboardEntry[] | undefined) ?? [];
};

// Local storage reaches disk, so lines without Japanese (the ones never sent) are left out of it.
export const saveEntries = (entries: ClipboardEntry[]): Promise<void> =>
  chrome.storage.local.set({
    [CLIPBOARD_READER_STORAGE_KEY]: entries.map((entry) => ({
      ...entry,
      text: japaneseOnly(entry.text),
    })),
  });
