const CLIPBOARD_READ: chrome.permissions.Permissions = { permissions: ['clipboardRead'] };

export const hasClipboardReadPermission = (): Promise<boolean> =>
  chrome.permissions.contains(CLIPBOARD_READ);

/** Firefox rejects the request unless it is the first call made in a user input handler. */
export const requestClipboardReadPermission = (): Promise<boolean> =>
  chrome.permissions.request(CLIPBOARD_READ);

export const onClipboardPermissionRemoved = (listener: () => void): void => {
  chrome.permissions.onRemoved.addListener(listener);
};
