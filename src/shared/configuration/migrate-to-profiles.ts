import { DEFAULT_CONFIGURATION } from './default-configuration';
import { getProfileKey, PROFILES_STATE_KEY } from './profile.constants';
import { DEFAULT_PROFILE_ID, DEFAULT_PROFILES_STATE, ProfilesState } from './profile.types';
import { ConfigurationSchema } from './types';

export const migrateToProfiles = async (): Promise<void> => {
  const storage = await chrome.storage.local.get();

  if (storage[PROFILES_STATE_KEY]) {
    return;
  }

  const configKeys = Object.keys(DEFAULT_CONFIGURATION) as (keyof ConfigurationSchema)[];
  const newStorage: Record<string, string> = {};
  const keysToRemove: string[] = [];

  const profilesState: ProfilesState = {
    ...DEFAULT_PROFILES_STATE,
    profiles: [
      {
        id: DEFAULT_PROFILE_ID,
        name: 'Default',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  };

  newStorage[PROFILES_STATE_KEY] = JSON.stringify(profilesState);

  for (const key of configKeys) {
    if (key in storage) {
      const profileKey = getProfileKey(DEFAULT_PROFILE_ID, key);

      newStorage[profileKey] = storage[key] as string;
      keysToRemove.push(key);
    }
  }

  try {
    await chrome.storage.local.set(newStorage);
    await chrome.storage.local.remove(keysToRemove);
  } catch {}
};
