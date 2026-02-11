import {
  BORDER_STYLES,
  BOUNDS,
  COLOUR_REGEX,
  FONT_STYLES,
  FONT_WEIGHTS,
  STYLEABLE_STATE_KEYS,
  UNDERLINE_STYLES,
} from './constants';
import { DEFAULT_WORD_STYLE_CONFIG } from './themes';
import { Effect, WordStyleConfig } from './types';

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function isValidColour(val: unknown): val is string {
  return typeof val === 'string' && COLOUR_REGEX.test(val);
}

function validateEffect(raw: unknown): Effect | null {
  if (!isObject(raw) || typeof raw.type !== 'string') {
    return null;
  }

  switch (raw.type) {
    case 'text-colour':
      if (!isValidColour(raw.colour)) {
        return null;
      }

      return { type: 'text-colour', colour: raw.colour };

    case 'background':
      if (!isValidColour(raw.colour) || typeof raw.opacity !== 'number') {
        return null;
      }

      return {
        type: 'background',
        colour: raw.colour,
        opacity: clamp(raw.opacity, BOUNDS.backgroundOpacity.min, BOUNDS.backgroundOpacity.max),
      };

    case 'underline':
      if (
        !isValidColour(raw.colour) ||
        typeof raw.thickness !== 'number' ||
        !UNDERLINE_STYLES.includes(raw.style as (typeof UNDERLINE_STYLES)[number])
      ) {
        return null;
      }

      return {
        type: 'underline',
        colour: raw.colour,
        style: raw.style as Effect & { type: 'underline' } extends { style: infer S } ? S : never,
        thickness: clamp(
          raw.thickness,
          BOUNDS.underlineThickness.min,
          BOUNDS.underlineThickness.max,
        ),
      };

    case 'border':
      if (
        !isValidColour(raw.colour) ||
        typeof raw.width !== 'number' ||
        typeof raw.radius !== 'number' ||
        !BORDER_STYLES.includes(raw.style as (typeof BORDER_STYLES)[number])
      ) {
        return null;
      }

      return {
        type: 'border',
        colour: raw.colour,
        width: clamp(raw.width, BOUNDS.borderWidth.min, BOUNDS.borderWidth.max),
        style: raw.style as Effect & { type: 'border' } extends { style: infer S } ? S : never,
        radius: clamp(raw.radius, BOUNDS.borderRadius.min, BOUNDS.borderRadius.max),
      };

    case 'shadow':
      if (
        !isValidColour(raw.colour) ||
        typeof raw.blur !== 'number' ||
        typeof raw.offsetX !== 'number' ||
        typeof raw.offsetY !== 'number'
      ) {
        return null;
      }

      return {
        type: 'shadow',
        colour: raw.colour,
        blur: clamp(raw.blur, BOUNDS.shadowBlur.min, BOUNDS.shadowBlur.max),
        offsetX: clamp(raw.offsetX, BOUNDS.shadowOffset.min, BOUNDS.shadowOffset.max),
        offsetY: clamp(raw.offsetY, BOUNDS.shadowOffset.min, BOUNDS.shadowOffset.max),
      };

    case 'blur':
      if (typeof raw.radius !== 'number') {
        return null;
      }

      return {
        type: 'blur',
        radius: clamp(raw.radius, BOUNDS.blurRadius.min, BOUNDS.blurRadius.max),
        hoverOnly: raw.hoverOnly === true,
      };

    case 'opacity':
      if (typeof raw.value !== 'number') {
        return null;
      }

      return {
        type: 'opacity',
        value: clamp(raw.value, BOUNDS.opacity.min, BOUNDS.opacity.max),
        hoverOnly: raw.hoverOnly === true,
      };

    case 'font-weight':
      if (!FONT_WEIGHTS.includes(raw.value as (typeof FONT_WEIGHTS)[number])) {
        return null;
      }

      return { type: 'font-weight', value: raw.value as 'normal' | 'bold' };

    case 'font-style':
      if (!FONT_STYLES.includes(raw.value as (typeof FONT_STYLES)[number])) {
        return null;
      }

      return { type: 'font-style', value: raw.value as 'normal' | 'italic' };

    default:
      return null;
  }
}

export function validateWordStyleConfig(input: unknown): WordStyleConfig | null {
  if (!isObject(input)) {
    return null;
  }

  if (typeof input.v !== 'number' || input.v > 1) {
    return null;
  }

  if (!isObject(input.states)) {
    return null;
  }

  const theme = typeof input.theme === 'string' ? input.theme : 'custom';
  const states: Record<string, { effects: Effect[] }> = {};

  for (const stateKey of STYLEABLE_STATE_KEYS) {
    const rawState = input.states[stateKey];

    if (!isObject(rawState) || !Array.isArray(rawState.effects)) {
      states[stateKey] = DEFAULT_WORD_STYLE_CONFIG.states[stateKey]
        ? structuredClone(DEFAULT_WORD_STYLE_CONFIG.states[stateKey])
        : { effects: [] };

      continue;
    }

    const validEffects: Effect[] = [];

    for (const rawEffect of rawState.effects) {
      const validated = validateEffect(rawEffect);

      if (validated) {
        validEffects.push(validated);
      }
    }

    states[stateKey] = { effects: validEffects };
  }

  return { v: 1, theme, states };
}
