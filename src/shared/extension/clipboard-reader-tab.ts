/** Answered by an open clipboard reader page, so opening it again focuses that tab instead. */
export const FIND_CLIPBOARD_READER = 'findClipboardReader';

/** Holds pasted text, so it stays out of settings exports. */
export const CLIPBOARD_READER_STORAGE_KEY = 'clipboardReaderEntries';

/** Manifest command with no suggested key, so it claims no shortcut until the user binds one. */
export const CLIPBOARD_READER_COMMAND = 'open-clipboard-reader';

export type ClipboardReaderTab = { tabId: number; windowId: number };
