import { WordStyleConfig } from './types';

export interface SavedTheme {
  id: string;
  label: string;
  config: WordStyleConfig;
}

export type SavedThemesList = SavedTheme[];
