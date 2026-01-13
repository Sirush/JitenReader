import { PROFILES_STATE_KEY } from './profile.constants';
import { DEFAULT_PROFILE_ID, ProfilesState } from './profile.types';

const createDefaultProfilesState = (): ProfilesState => ({
  activeProfileId: DEFAULT_PROFILE_ID,
  profiles: [
    {
      id: DEFAULT_PROFILE_ID,
      name: 'Default',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
});

export const getProfilesState = async (): Promise<ProfilesState> => {
  const result = await chrome.storage.local.get(PROFILES_STATE_KEY);
  const stored = result[PROFILES_STATE_KEY];

  if (!stored) {
    const defaultState = createDefaultProfilesState();

    await setProfilesState(defaultState);

    return defaultState;
  }

  try {
    const parsed = JSON.parse(stored) as ProfilesState;

    if (!parsed.profiles || parsed.profiles.length === 0) {
      const defaultState = createDefaultProfilesState();

      await setProfilesState(defaultState);

      return defaultState;
    }

    return parsed;
  } catch {
    const defaultState = createDefaultProfilesState();

    await setProfilesState(defaultState);

    return defaultState;
  }
};

export const setProfilesState = async (state: ProfilesState): Promise<void> => {
  await chrome.storage.local.set({
    [PROFILES_STATE_KEY]: JSON.stringify(state),
  });
};

export const getActiveProfileId = async (): Promise<string> => {
  const state = await getProfilesState();

  return state.activeProfileId;
};
