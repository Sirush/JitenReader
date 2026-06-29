export type ReaderTheme = 'light' | 'sepia' | 'gray' | 'dark' | 'black' | 'solarized';

export interface ReaderThemeDef {
  id: ReaderTheme;
  label: string;
  // Representative colours used to render the theme swatch.
  bg: string;
  fg: string;
}

export const READER_THEMES: ReaderThemeDef[] = [
  { id: 'light', label: 'Light', bg: '#ffffff', fg: '#1a1a1a' },
  { id: 'sepia', label: 'Sepia', bg: '#f4ecd8', fg: '#5b4636' },
  { id: 'gray', label: 'Gray', bg: '#5c5c5c', fg: '#e8e8e8' },
  { id: 'dark', label: 'Dark', bg: '#1a1a1a', fg: '#dcdcdc' },
  { id: 'black', label: 'Black', bg: '#000000', fg: '#c8c8c8' },
  { id: 'solarized', label: 'Solarized', bg: '#002b36', fg: '#93a1a1' },
];

export const DEFAULT_READER_THEME: ReaderTheme = 'dark';

export type ReaderFont = 'sans' | 'serif' | 'rounded';

export interface ReaderFontDef {
  id: ReaderFont;
  label: string;
}

export const READER_FONTS: ReaderFontDef[] = [
  { id: 'sans', label: 'Gothic' },
  { id: 'serif', label: 'Mincho' },
  { id: 'rounded', label: 'Rounded' },
];

export const READER_FONT_STACKS: Record<ReaderFont, string> = {
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, sans-serif",
  serif: "'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, 'MS PMincho', serif",
  rounded:
    "'Hiragino Maru Gothic ProN', 'Hiragino Maru Gothic Pro', 'Yu Gothic UI', 'Segoe UI Rounded', 'Quicksand', sans-serif",
};

export const DEFAULT_READER_FONT: ReaderFont = 'sans';

// Resolves a stored font value to a CSS font-family. Built-in ids map to a curated stack; any
// other value is treated as an installed font family name (from the Local Font Access API).
export const resolveReaderFont = (value: string): string => {
  if (value in READER_FONT_STACKS) {
    return READER_FONT_STACKS[value as ReaderFont];
  }

  return `"${value.replace(/["\\]/g, '')}", sans-serif`;
};

export const READER_FONT_SIZE = { min: 14, max: 32, step: 1, default: 18 };
export const READER_WIDTH = { min: 28, max: 64, step: 1, default: 42 };
export const READER_LINE_HEIGHT = { min: 1.4, max: 2.4, step: 0.1, default: 1.9 };
export const DEFAULT_READER_BOLD = false;
