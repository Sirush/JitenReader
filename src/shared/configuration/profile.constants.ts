export const PROFILES_STATE_KEY = '__profiles__';
export const PROFILE_PREFIX = 'profile:';

export const getProfileKey = (profileId: string, settingKey: string): string =>
  `${PROFILE_PREFIX}${profileId}:${settingKey}`;

export const parseProfileKey = (key: string): { profileId: string; settingKey: string } | null => {
  if (!key.startsWith(PROFILE_PREFIX)) {
    return null;
  }

  const withoutPrefix = key.slice(PROFILE_PREFIX.length);
  const colonIndex = withoutPrefix.indexOf(':');

  if (colonIndex === -1) {
    return null;
  }

  return {
    profileId: withoutPrefix.slice(0, colonIndex),
    settingKey: withoutPrefix.slice(colonIndex + 1),
  };
};

export const generateProfileId = (): string => {
  return crypto.randomUUID();
};
