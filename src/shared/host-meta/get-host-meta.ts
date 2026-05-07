import { getConfiguration } from '../configuration/get-configuration';
import { displayToast } from '../dom/display-toast';
import { matchUrl } from '../match-url';
import { DEFAULT_HOSTS } from './default-hosts';
import { AdditionalHostMeta, HostMeta, PredefinedHostMeta } from './types';

const isPredefined = (meta: HostMeta): meta is PredefinedHostMeta => 'id' in meta;

export async function resolveMatchingHosts(host: string): Promise<HostMeta[]> {
  if (!host?.length) {
    return [];
  }

  const [disabledHosts, additionalHosts, additionalMeta] = await Promise.all([
    getConfiguration('disabledParsers'),
    getConfiguration('additionalHosts'),
    getConfiguration('additionalMeta'),
  ]);

  const hostsMeta: HostMeta[] = [...DEFAULT_HOSTS];

  try {
    const meta = JSON.parse(additionalMeta?.length ? additionalMeta : '[]') as HostMeta[];

    hostsMeta.push(
      ...meta.map(
        ({
          host,
          auto = true,
          allFrames = false,
          disabled,
          parse,
          filter,
          css,
          parseVisibleObserver,
          addedObserver,
          parserClass,
          collapseWhitespace,
        }) => ({
          host,
          auto,
          allFrames,
          disabled,
          parse,
          filter,
          css,
          parseVisibleObserver,
          addedObserver,
          parserClass,
          collapseWhitespace,
        }),
      ),
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to parse additional meta:', e);

    displayToast(
      'error',
      'Failed to parse additional meta. Please check your configuration.',
      (e as Error).message,
    );
  }

  additionalHosts
    .trim()
    .replace(/\r\n?/g, ' ')
    .split(/[\s;,]/)
    .filter(Boolean)
    .forEach((h) => {
      hostsMeta.push({
        host: h,
        auto: true,
        allFrames: true,
        parse: 'body',
        parserClass: 'custom-parser',
      } satisfies AdditionalHostMeta);
    });

  const hostFilter = (meta: HostMeta): boolean => {
    const isMatch = (matchPattern: string): boolean => {
      if (isPredefined(meta) && meta.optOut && disabledHosts.includes(meta.id)) {
        return false;
      }

      return matchUrl(matchPattern, host);
    };

    return Array.isArray(meta.host) ? meta.host.some(isMatch) : isMatch(meta.host);
  };

  return hostsMeta.filter(hostFilter);
}

export function filterHostMeta(
  enabledHosts: HostMeta[],
  filter: (meta: HostMeta) => boolean,
  multiple?: false,
): HostMeta | undefined;
export function filterHostMeta(
  enabledHosts: HostMeta[],
  filter: (meta: HostMeta) => boolean,
  multiple: true,
): HostMeta[];
export function filterHostMeta(
  enabledHosts: HostMeta[],
  filter: (meta: HostMeta) => boolean,
  multiple?: boolean,
): HostMeta[] | HostMeta | undefined {
  return multiple ? enabledHosts.filter(filter) : enabledHosts.find(filter);
}
