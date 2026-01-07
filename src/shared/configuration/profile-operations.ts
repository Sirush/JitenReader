import { ProfileSwitchedCommand } from '../messages/broadcast/profile-switched.command';
import { DEFAULT_CONFIGURATION } from './default-configuration';
import { invalidateProfileCache } from './get-configuration';
import { generateProfileId, getProfileKey, PROFILE_PREFIX } from './profile.constants';
import { MAX_PROFILES, ProfileMetadata } from './profile.types';
import { getActiveProfileId, getProfilesState, setProfilesState } from './profiles-state';
import { invalidateSetConfigurationCache } from './set-configuration';
import { ConfigurationSchema } from './types';

export const switchProfile = async (profileId: string): Promise<boolean> => {
  const state = await getProfilesState();

  if (!state.profiles.some((p) => p.id === profileId)) {
    return false;
  }

  state.activeProfileId = profileId;
  await setProfilesState(state);

  invalidateProfileCache();
  invalidateSetConfigurationCache();

  new ProfileSwitchedCommand(profileId).send();

  return true;
};

export interface CreateProfileOptions {
  copyFromCurrent?: boolean;
  forceCreate?: boolean;
}

export const createProfile = async (
  name: string,
  options: CreateProfileOptions = {},
): Promise<ProfileMetadata | null> => {
  const { copyFromCurrent = false, forceCreate = false } = options;
  const state = await getProfilesState();

  if (state.profiles.length >= MAX_PROFILES && !forceCreate) {
    return null;
  }

  const newProfile: ProfileMetadata = {
    id: generateProfileId(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (copyFromCurrent) {
    const currentProfileId = await getActiveProfileId();
    await copyProfileData(currentProfileId, newProfile.id);
  } else {
    await initProfileWithDefaults(newProfile.id);
  }

  state.profiles.push(newProfile);
  await setProfilesState(state);

  return newProfile;
};

export const deleteProfile = async (profileId: string): Promise<boolean> => {
  const state = await getProfilesState();

  if (state.profiles.length <= 1) {
    return false;
  }

  if (state.activeProfileId === profileId) {
    return false;
  }

  const profileIndex = state.profiles.findIndex((p) => p.id === profileId);

  if (profileIndex === -1) {
    return false;
  }

  await deleteProfileData(profileId);

  state.profiles.splice(profileIndex, 1);
  await setProfilesState(state);

  return true;
};

export const renameProfile = async (profileId: string, newName: string): Promise<boolean> => {
  const state = await getProfilesState();
  const profile = state.profiles.find((p) => p.id === profileId);

  if (!profile) {
    return false;
  }

  profile.name = newName;
  profile.updatedAt = Date.now();

  await setProfilesState(state);

  return true;
};

export const duplicateProfile = async (
  profileId: string,
  newName?: string,
): Promise<ProfileMetadata | null> => {
  const state = await getProfilesState();
  const sourceProfile = state.profiles.find((p) => p.id === profileId);

  if (!sourceProfile) {
    return null;
  }

  if (state.profiles.length >= MAX_PROFILES) {
    return null;
  }

  const newProfile: ProfileMetadata = {
    id: generateProfileId(),
    name: newName ?? `${sourceProfile.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await copyProfileData(profileId, newProfile.id);

  state.profiles.push(newProfile);
  await setProfilesState(state);

  return newProfile;
};

const copyProfileData = async (sourceProfileId: string, targetProfileId: string): Promise<void> => {
  const storage = await chrome.storage.local.get();
  const configKeys = Object.keys(DEFAULT_CONFIGURATION) as (keyof ConfigurationSchema)[];
  const newData: Record<string, string> = {};

  for (const key of configKeys) {
    const sourceKey = getProfileKey(sourceProfileId, key);
    if (sourceKey in storage) {
      const targetKey = getProfileKey(targetProfileId, key);
      newData[targetKey] = storage[sourceKey] as string;
    }
  }

  if (Object.keys(newData).length > 0) {
    await chrome.storage.local.set(newData);
  }
};

const initProfileWithDefaults = async (profileId: string): Promise<void> => {
  const configKeys = Object.keys(DEFAULT_CONFIGURATION) as (keyof ConfigurationSchema)[];
  const newData: Record<string, string> = {};

  for (const key of configKeys) {
    const profileKey = getProfileKey(profileId, key);
    const defaultValue = DEFAULT_CONFIGURATION[key];
    newData[profileKey] =
      typeof defaultValue === 'object' || Array.isArray(defaultValue)
        ? JSON.stringify(defaultValue)
        : defaultValue.toString();
  }

  await chrome.storage.local.set(newData);
};

const deleteProfileData = async (profileId: string): Promise<void> => {
  const storage = await chrome.storage.local.get();
  const prefix = `${PROFILE_PREFIX}${profileId}:`;
  const keysToRemove = Object.keys(storage).filter((key) => key.startsWith(prefix));

  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
};
