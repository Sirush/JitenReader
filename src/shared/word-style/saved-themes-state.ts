import { SavedTheme, SavedThemesList } from './saved-themes.types';
import { WordStyleConfig } from './types';

const SAVED_THEMES_KEY = '__savedWordStyleThemes__';

export const getSavedThemes = async (): Promise<SavedThemesList> => {
  const result = await chrome.storage.local.get(SAVED_THEMES_KEY);
  const stored = result[SAVED_THEMES_KEY];

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as SavedThemesList;
  } catch {
    return [];
  }
};

export const setSavedThemes = async (themes: SavedThemesList): Promise<void> => {
  await chrome.storage.local.set({
    [SAVED_THEMES_KEY]: JSON.stringify(themes),
  });
};

export const getSavedThemeById = async (id: string): Promise<SavedTheme | undefined> => {
  const themes = await getSavedThemes();

  return themes.find((t) => t.id === id);
};

export const createSavedTheme = async (
  label: string,
  config: WordStyleConfig,
): Promise<SavedTheme> => {
  const themes = await getSavedThemes();
  const entry: SavedTheme = { id: crypto.randomUUID(), label, config: structuredClone(config) };

  themes.push(entry);
  await setSavedThemes(themes);

  return entry;
};

export const updateSavedTheme = async (
  id: string,
  updates: Partial<Pick<SavedTheme, 'label' | 'config'>>,
): Promise<void> => {
  const themes = await getSavedThemes();
  const theme = themes.find((t) => t.id === id);

  if (!theme) {
    return;
  }

  if (updates.label !== undefined) {
    theme.label = updates.label;
  }

  if (updates.config !== undefined) {
    theme.config = structuredClone(updates.config);
  }

  await setSavedThemes(themes);
};

export const deleteSavedTheme = async (id: string): Promise<void> => {
  const themes = await getSavedThemes();

  await setSavedThemes(themes.filter((t) => t.id !== id));
};
