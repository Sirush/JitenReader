import { SavedTheme, SavedThemesList } from './saved-themes.types';
import { PresetTheme, PRESET_THEMES } from './themes';

export type ResolvedTheme =
  | { type: 'preset'; key: string; preset: PresetTheme }
  | { type: 'saved'; saved: SavedTheme }
  | { type: 'custom' };

export const resolveThemeSync = (themeKey: string, savedThemes: SavedThemesList): ResolvedTheme => {
  const preset = PRESET_THEMES.get(themeKey);

  if (preset) {
    return { type: 'preset', key: themeKey, preset };
  }

  const saved = savedThemes.find((t) => t.id === themeKey);

  if (saved) {
    return { type: 'saved', saved };
  }

  return { type: 'custom' };
};
