import { WordStyleConfig } from './types';
import { validateWordStyleConfig } from './validate';

export interface DecodedTheme {
  config: WordStyleConfig;
  name: string | null;
}

export function encodeThemeCode(config: WordStyleConfig, name?: string): string {
  const payload: Record<string, unknown> = { v: 1, states: config.states };

  if (name) {
    payload.name = name;
  }

  const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

  return `jtr:1${base64}`;
}

export function decodeThemeCode(code: string): DecodedTheme | null {
  if (!code.startsWith('jtr:')) {
    return null;
  }

  const version = code.charAt(4);

  if (parseInt(version, 10) > 1) {
    return null;
  }

  const base64 = code.substring(5);

  try {
    const json = decodeURIComponent(escape(atob(base64)));
    const parsed = JSON.parse(json) as Record<string, unknown>;

    const config = validateWordStyleConfig(
      typeof parsed === 'object' && parsed !== null ? { ...parsed, theme: 'custom' } : null,
    );

    if (!config) {
      return null;
    }

    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null;

    return { config, name };
  } catch {
    return null;
  }
}
