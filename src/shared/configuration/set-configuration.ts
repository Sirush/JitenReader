import { writeStorage } from '../extension/write-storage';
import { getProfileKey } from './profile.constants';
import { getActiveProfileId } from './profiles-state';
import { ConfigurationSchema } from './types';

let cachedProfileId: string | null = null;

export const invalidateSetConfigurationCache = (): void => {
  cachedProfileId = null;
};

export const setConfiguration = async <K extends keyof ConfigurationSchema>(
  key: K,
  value: ConfigurationSchema[K],
): Promise<void> => {
  if (!cachedProfileId) {
    cachedProfileId = await getActiveProfileId();
  }

  const profileKey = getProfileKey(cachedProfileId, key);

  await writeStorage(
    profileKey,
    typeof value === 'object' || Array.isArray(value) ? JSON.stringify(value) : value.toString(),
  );
};
