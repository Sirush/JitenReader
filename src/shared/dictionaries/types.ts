export const DICTIONARY_ORIGIN = 'https://jiten.moe';
export const DICTIONARY_FRAME_URL = `${DICTIONARY_ORIGIN}/#jiten-reader-dictionaries`;
export const JMDICT_DICTIONARY_ID = '__jmdict__';
export const DICTIONARY_TIMEOUT = 10_000;

export type DictionaryLookup = {
  word: string;
  reading: string;
  hasJmDictDefinitions: boolean;
};

export type DictionaryGroup = {
  dictionaryId: string;
  dictionaryName: string;
  isJmDict: boolean;
  customDefinitions?: unknown[];
};

export type DictionaryLookupResult =
  | { status: 'ok'; groups: DictionaryGroup[] }
  | { status: 'unavailable' };

export function isDictionaryBridgeFrame(): boolean {
  return window !== window.top && location.href === DICTIONARY_FRAME_URL;
}

export function isDictionaryLookup(value: unknown): value is DictionaryLookup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const lookup = value as DictionaryLookup;

  return (
    typeof lookup.word === 'string' &&
    lookup.word.length > 0 &&
    typeof lookup.reading === 'string' &&
    typeof lookup.hasJmDictDefinitions === 'boolean'
  );
}

export function isDictionaryLookupResult(value: unknown): value is DictionaryLookupResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as DictionaryLookupResult;

  return (
    result.status === 'unavailable' ||
    (result.status === 'ok' &&
      Array.isArray(result.groups) &&
      result.groups.every(
        (group) =>
          group &&
          typeof group.dictionaryId === 'string' &&
          typeof group.dictionaryName === 'string' &&
          typeof group.isJmDict === 'boolean' &&
          (group.isJmDict || Array.isArray(group.customDefinitions)),
      ))
  );
}
