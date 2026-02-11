import { EffectType } from './types';

export const STYLEABLE_STATES: Record<string, string> = {
  new: 'New',
  young: 'Young',
  mature: 'Mature',
  mastered: 'Mastered',
  due: 'Due',
  blacklisted: 'Blacklisted',
  suspended: 'Suspended',
  frequent: 'Frequent',
  'i-plus-one': 'I+1',
  unparsed: 'Unparsed',
};

export const STYLEABLE_STATE_KEYS = Object.keys(STYLEABLE_STATES);

export const EFFECT_LABELS: Record<EffectType, string> = {
  'text-colour': 'Text Colour',
  background: 'Background',
  underline: 'Underline',
  border: 'Border',
  shadow: 'Text Shadow',
  blur: 'Blur',
  opacity: 'Opacity',
  'font-weight': 'Font Weight',
  'font-style': 'Font Style',
};

export const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EffectType[];

export const COLOUR_REGEX = /^#[0-9a-fA-F]{3,8}$/;

export const BOUNDS = {
  blurRadius: { min: 0, max: 20 },
  borderWidth: { min: 0, max: 10 },
  borderRadius: { min: 0, max: 20 },
  underlineThickness: { min: 1, max: 10 },
  shadowBlur: { min: 0, max: 20 },
  shadowOffset: { min: -20, max: 20 },
  opacity: { min: 0, max: 1, step: 0.05 },
  backgroundOpacity: { min: 0, max: 1, step: 0.05 },
} as const;

export const UNDERLINE_STYLES = ['solid', 'dashed', 'dotted', 'wavy'] as const;
export const BORDER_STYLES = ['solid', 'dashed'] as const;
export const FONT_WEIGHTS = ['normal', 'bold'] as const;
export const FONT_STYLES = ['normal', 'italic'] as const;
