import {
  DictionaryGroup,
  DictionaryLookup,
  DictionaryLookupResult,
  JMDICT_DICTIONARY_ID,
} from './types';

type DictionaryMeta = {
  id: string;
  name: string;
  priority: number;
  mode: 'always' | 'fallback' | 'never';
};

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result);
    request.onerror = (): void => reject(request.error ?? new Error('Dictionary read failed'));
  });
}

function openExistingDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);

    // Never create or migrate the site's databases, including during an import or removal.
    request.onupgradeneeded = (): void => request.transaction?.abort();
    request.onsuccess = (): void => {
      const db = request.result;

      db.onversionchange = (): void => db.close();
      resolve(db);
    };
    request.onerror = (): void =>
      reject(request.error ?? new Error('Dictionary database unavailable'));
  });
}

async function readDictionaries(): Promise<DictionaryMeta[]> {
  const db = await openExistingDatabase('jiten-dictionaries');

  try {
    const dictionaries: unknown = await requestResult(
      db.transaction('dictionaries', 'readonly').objectStore('dictionaries').getAll(),
    );

    if (
      !Array.isArray(dictionaries) ||
      !dictionaries.every(
        (dict: DictionaryMeta) =>
          dict &&
          typeof dict.id === 'string' &&
          typeof dict.name === 'string' &&
          Number.isFinite(dict.priority) &&
          ['always', 'fallback', 'never'].includes(dict.mode),
      )
    ) {
      throw new Error('Unknown dictionary metadata');
    }

    return dictionaries as DictionaryMeta[];
  } finally {
    db.close();
  }
}

function readJmDictSettings(): DictionaryMeta {
  let settings: Partial<DictionaryMeta> = {};

  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('jiten-jmdict-settings') ?? '{}');

    if (parsed && typeof parsed === 'object') {
      settings = parsed as Partial<DictionaryMeta>;
    }
  } catch {
    // The site uses these defaults when settings are absent or unreadable.
  }

  return {
    id: JMDICT_DICTIONARY_ID,
    name: 'Default',
    priority: Number.isFinite(settings.priority) ? settings.priority! : 999,
    mode: ['always', 'fallback', 'never'].includes(settings.mode ?? '')
      ? settings.mode!
      : 'fallback',
  };
}

async function lookupDictionary(
  id: string,
  lookup: DictionaryLookup,
): Promise<unknown[] | undefined> {
  const db = await openExistingDatabase(`jiten-dict-${id}`);

  try {
    const store = db.transaction('entries', 'readonly').objectStore('entries');
    let entry: unknown;

    if (lookup.reading) {
      entry = await requestResult<unknown>(
        store.index('word-reading').get([lookup.word, lookup.reading]),
      );
    }

    entry ??= await requestResult<unknown>(store.index('word').get(lookup.word));
    const definitions = (entry as { definitions?: unknown } | undefined)?.definitions;

    return Array.isArray(definitions) ? definitions : undefined;
  } finally {
    db.close();
  }
}

export async function lookupDictionaries(
  lookup: DictionaryLookup,
): Promise<DictionaryLookupResult> {
  // Firefox wraps IndexedDB arrays; sort and append settings in the content script's own array.
  const dictionaries = [...(await readDictionaries())];
  const jmDict = readJmDictSettings();

  // The site's no-custom-dictionaries path always retains the built-in definitions.
  if (dictionaries.length === 0) {
    return {
      status: 'ok',
      groups: lookup.hasJmDictDefinitions
        ? [{ dictionaryId: jmDict.id, dictionaryName: jmDict.name, isJmDict: true }]
        : [],
    };
  }

  dictionaries.push(jmDict);
  dictionaries.sort((a, b) => a.priority - b.priority);

  const matches: { group: DictionaryGroup; mode: DictionaryMeta['mode'] }[] = [];

  for (const dict of dictionaries) {
    if (dict.mode === 'never') {
      continue;
    }

    const isJmDict = dict.id === JMDICT_DICTIONARY_ID;
    const definitions = isJmDict ? undefined : await lookupDictionary(dict.id, lookup);

    if (isJmDict ? !lookup.hasJmDictDefinitions : !definitions) {
      continue;
    }

    const group: DictionaryGroup = {
      dictionaryId: dict.id,
      dictionaryName: dict.name,
      isJmDict,
      ...(isJmDict ? {} : { customDefinitions: definitions }),
    };

    matches.push({ group, mode: dict.mode });
  }

  const hasAlwaysMatch = matches.some(({ mode }) => mode === 'always');

  return {
    status: 'ok',
    groups: matches
      .filter(({ group, mode }) => !hasAlwaysMatch || mode === 'always' || group.isJmDict)
      .map(({ group }) => group),
  };
}
