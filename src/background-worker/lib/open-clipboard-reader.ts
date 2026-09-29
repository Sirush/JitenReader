import { ClipboardReaderTab, FIND_CLIPBOARD_READER } from '@shared/extension/clipboard-reader-tab';
import { openView } from '@shared/extension/open-view';

const findOpenReader = async (): Promise<ClipboardReaderTab | undefined> => {
  try {
    return await chrome.runtime.sendMessage<{ type: string }, ClipboardReaderTab | undefined>({
      type: FIND_CLIPBOARD_READER,
    });
  } catch {
    return undefined;
  }
};

export const openClipboardReader = async (): Promise<void> => {
  const existing = await findOpenReader();
  const tab = existing
    ? await chrome.tabs.update(existing.tabId, { active: true })
    : await openView('clipboard-reader');

  if (tab?.windowId !== undefined) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
};
