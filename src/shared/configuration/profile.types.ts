export interface ProfileMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfilesState {
  activeProfileId: string;
  profiles: ProfileMetadata[];
}

export const DEFAULT_PROFILE_ID = 'default';
export const MAX_PROFILES = 10;

export const DEFAULT_PROFILES_STATE: ProfilesState = {
  activeProfileId: DEFAULT_PROFILE_ID,
  profiles: [
    {
      id: DEFAULT_PROFILE_ID,
      name: 'Default',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
};
