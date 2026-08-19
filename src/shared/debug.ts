import { getProfileKey, PROFILES_STATE_KEY } from './configuration/profile.constants';
import { getActiveProfileId } from './configuration/profiles-state';

const DEBUG_SETTING_KEY = 'enableDebugMode';

let debugEnabled: boolean | undefined = undefined;
let debugStorageKey: string | undefined = undefined;
const bufferedDebugMessages: [string, ...unknown[]][] = [];

// Persisted configuration values are strings, but storage may hold a raw boolean from older builds.
const toFlag = (value: unknown): boolean => value === true || value === 'true';

const resolveDebugState = async (): Promise<void> => {
  debugStorageKey = getProfileKey(await getActiveProfileId(), DEBUG_SETTING_KEY);

  const result = await chrome.storage.local.get(debugStorageKey);

  debugEnabled = toFlag(result[debugStorageKey]);

  drainBufferedDebugMessages();
};

chrome.storage.local.onChanged.addListener(
  (changes: Record<string, chrome.storage.StorageChange>): void => {
    if (changes[PROFILES_STATE_KEY]) {
      void resolveDebugState();

      return;
    }

    const change = debugStorageKey ? changes[debugStorageKey] : undefined;

    if (change) {
      debugEnabled = toFlag(change.newValue);

      drainBufferedDebugMessages();
    }
  },
);

void resolveDebugState();

export const debug = (message: string, ...optionalParams: unknown[]): void => {
  if (debugEnabled === undefined) {
    // Buffer messages until we know the debug state
    bufferedDebugMessages.push([message, ...optionalParams]);

    return;
  }

  if (!debugEnabled) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[DEBUG] ${message}`, ...optionalParams);
};

const drainBufferedDebugMessages = (): void => {
  if (debugEnabled === undefined || debugEnabled === false) {
    return;
  }

  for (const [message, ...optionalParams] of bufferedDebugMessages) {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ${message}`, ...optionalParams);
  }

  bufferedDebugMessages.length = 0; // Clear the buffer
};
