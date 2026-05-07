import { filterHostMeta, resolveMatchingHosts } from './get-host-meta';

export const isDisabled = async (host: string): Promise<boolean> => {
  const enabledHosts = await resolveMatchingHosts(host);
  const meta = filterHostMeta(enabledHosts, ({ host }) => host !== '<all_urls>');

  if (!meta) {
    return false;
  }

  if (meta.disabled) {
    return true;
  }

  return meta.auto;
};
