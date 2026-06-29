import { debug } from '@shared/debug';
import { readStorage } from '@shared/extension/read-storage';
import { writeStorage } from '@shared/extension/write-storage';

interface FontData {
  family: string;
}

type QueryLocalFonts = () => Promise<FontData[]>;

// Common Japanese font families across Windows / macOS / Linux / web installs. Used as a
// permission-free fallback so the picker shows real installed fonts even when the Local Font
// Access API has not been used yet.
const COMMON_JP_FONTS = [
  'Yu Gothic',
  'Yu Gothic UI',
  'YuGothic',
  'Yu Mincho',
  'YuMincho',
  'Meiryo',
  'Meiryo UI',
  'MS Gothic',
  'MS PGothic',
  'MS UI Gothic',
  'MS Mincho',
  'MS PMincho',
  'BIZ UDGothic',
  'BIZ UDPGothic',
  'BIZ UDMincho',
  'UD Digi Kyokasho N-R',
  'Hiragino Sans',
  'Hiragino Kaku Gothic ProN',
  'Hiragino Kaku Gothic Pro',
  'Hiragino Maru Gothic ProN',
  'Hiragino Mincho ProN',
  'Osaka',
  'Noto Sans JP',
  'Noto Serif JP',
  'Noto Sans CJK JP',
  'Noto Serif CJK JP',
  'Source Han Sans',
  'Source Han Sans JP',
  'Source Han Serif',
  'IPAGothic',
  'IPAMincho',
  'IPAexGothic',
  'IPAexMincho',
  'TakaoGothic',
  'Kosugi',
  'Kosugi Maru',
  'M PLUS 1p',
  'M PLUS Rounded 1c',
  'Sawarabi Gothic',
  'Sawarabi Mincho',
];

// A short Japanese sample spanning hiragana + kanji. A font lacking these glyphs falls back to the
// system default, producing the same advance width as a deliberately-missing font; one that has
// them renders its own glyphs at a different width.
const SAMPLE = '日本語のあ亜';

// Hiragana, katakana (incl. half-width), CJK ideographs + extensions. A font whose family name
// contains any of these almost certainly ships Japanese glyphs (catches device/printer fonts such
// as the EPSON families that the width test can miss).
const CJK_NAME = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;

const STORAGE_KEY = 'readerInstalledFonts';

let installed: string[] | null = null;
let commonCache: string[] | null = null;
let detector: ((family: string) => boolean) | null | undefined;

const getDetector = (): ((family: string) => boolean) | null => {
  if (detector !== undefined) {
    return detector;
  }

  const ctx = document.createElement('canvas').getContext('2d');

  if (!ctx) {
    detector = null;

    return null;
  }

  const measure = (family: string): number => {
    ctx.font = `40px ${family}`;

    return ctx.measureText(SAMPLE).width;
  };

  const fallbackWidth = measure('"__jiten_missing_font__"');

  detector = (family: string): boolean =>
    Math.abs(measure(`"${family.replace(/["\\]/g, '')}"`) - fallbackWidth) > 0.5;

  return detector;
};

const sortUnique = (families: string[]): string[] =>
  Array.from(new Set(families)).sort((a, b) => a.localeCompare(b));

export const isJapaneseFont = (family: string): boolean => {
  if (CJK_NAME.test(family)) {
    return true;
  }

  const detect = getDetector();

  return detect ? detect(family) : false;
};

// Synchronous, permission-free: which of the well-known Japanese fonts are actually installed.
export const getCommonJapaneseFonts = (): string[] => {
  if (commonCache) {
    return commonCache;
  }

  const detect = getDetector();

  commonCache = detect ? sortUnique(COMMON_JP_FONTS.filter(detect)) : [];

  return commonCache;
};

// All installed font families currently known (from a prior enumeration or restored from storage).
export const getInstalledFonts = (): string[] | null => installed;

export const supportsFontEnumeration = (): boolean =>
  typeof (window as unknown as { queryLocalFonts?: unknown }).queryLocalFonts === 'function';

// Restores the persisted installed-font list so it survives content-script reloads without
// re-running the (permission-prompting) enumeration.
export const loadPersistedFonts = async (): Promise<void> => {
  if (installed) {
    return;
  }

  try {
    const raw = await readStorage(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as unknown;

      if (Array.isArray(parsed) && parsed.length) {
        installed = parsed as string[];
      }
    }
  } catch (error) {
    debug('loadPersistedFonts failed', error);
  }
};

// Enumerates every installed font family via the Local Font Access API (prompts on first use) and
// persists the result.
export const enumerateAllFonts = async (): Promise<string[]> => {
  const query = (window as unknown as { queryLocalFonts?: QueryLocalFonts }).queryLocalFonts;

  if (typeof query !== 'function') {
    return installed ?? [];
  }

  try {
    const fonts = await query();

    installed = sortUnique(fonts.map((font) => font.family));

    void writeStorage(STORAGE_KEY, JSON.stringify(installed));
    debug('enumerateAllFonts', { total: installed.length });
  } catch (error) {
    debug('enumerateAllFonts failed', error);
  }

  return installed ?? [];
};
