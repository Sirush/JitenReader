import { Effect, WordStyleConfig } from './types';

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length >= 6) {
    r = parseInt(cleaned.substring(0, 2), 16);
    g = parseInt(cleaned.substring(2, 4), 16);
    b = parseInt(cleaned.substring(4, 6), 16);
  } else {
    return null;
  }

  return { r, g, b };
}

function generateEffectCSS(effects: Effect[]): { normal: string[]; hover: string[] } {
  const normal: string[] = [];
  const hover: string[] = [];
  const shadows: string[] = [];
  let hasHoverTransitions = false;

  for (const effect of effects) {
    switch (effect.type) {
      case 'text-colour':
        normal.push(`color: ${effect.colour} !important;`);

        break;

      case 'background': {
        const rgb = hexToRgb(effect.colour);

        if (rgb) {
          normal.push(
            `background-color: rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${effect.opacity}) !important;`,
          );
        }

        break;
      }

      case 'underline':
        normal.push(`text-decoration: underline ${effect.style} ${effect.colour} !important;`);
        normal.push(`text-decoration-thickness: ${effect.thickness}px !important;`);
        normal.push('text-underline-position: under left !important;');

        break;

      case 'border':
        normal.push(`border: ${effect.width}px ${effect.style} ${effect.colour} !important;`);
        normal.push(`border-radius: ${effect.radius}px !important;`);

        break;

      case 'shadow':
        shadows.push(`${effect.offsetX}px ${effect.offsetY}px ${effect.blur}px ${effect.colour}`);

        break;

      case 'blur':
        normal.push(`filter: blur(${effect.radius}px) !important;`);

        if (effect.hoverOnly) {
          hover.push('filter: none !important;');
          hasHoverTransitions = true;
        }

        break;

      case 'opacity':
        normal.push(`opacity: ${effect.value} !important;`);

        if (effect.hoverOnly) {
          hover.push('opacity: 1 !important;');
          hasHoverTransitions = true;
        }

        break;

      case 'font-weight':
        normal.push(`font-weight: ${effect.value} !important;`);

        break;

      case 'font-style':
        normal.push(`font-style: ${effect.value} !important;`);

        break;
    }
  }

  if (shadows.length) {
    normal.push(`text-shadow: ${shadows.join(', ')} !important;`);
  }

  if (hasHoverTransitions) {
    const transitions: string[] = [];

    if (effects.some((e) => e.type === 'blur' && e.hoverOnly)) {
      transitions.push('filter 0.3s ease-in-out');
    }

    if (effects.some((e) => e.type === 'opacity' && e.hoverOnly)) {
      transitions.push('opacity 0.3s ease-in-out');
    }

    normal.push(`transition: ${transitions.join(', ')} !important;`);
  }

  return { normal, hover };
}

export function generateWordStyleCSS(config: WordStyleConfig): string {
  const lines: string[] = [];

  let iPlusOneStyle: { effects: Effect[] } | undefined;

  for (const [state, stateStyle] of Object.entries(config.states)) {
    if (!stateStyle?.effects?.length) {
      continue;
    }

    if (state === 'i-plus-one') {
      iPlusOneStyle = stateStyle;

      continue;
    }

    const { normal, hover } = generateEffectCSS(stateStyle.effects);

    if (normal.length) {
      lines.push(`.jiten-word.${state} {`);

      for (const decl of normal) {
        lines.push(`  ${decl}`);
      }

      lines.push('}');
    }

    if (hover.length) {
      lines.push(`.jiten-word.${state}:hover {`);

      for (const decl of hover) {
        lines.push(`  ${decl}`);
      }

      lines.push('}');
    }
  }

  if (iPlusOneStyle?.effects?.length) {
    const { normal, hover } = generateEffectCSS(iPlusOneStyle.effects);

    if (normal.length) {
      lines.push('.jiten-word.i-plus-one {');

      for (const decl of normal) {
        lines.push(`  ${decl}`);
      }

      lines.push('}');
    }

    if (hover.length) {
      lines.push('.jiten-word.i-plus-one:hover {');

      for (const decl of hover) {
        lines.push(`  ${decl}`);
      }

      lines.push('}');
    }
  }

  return lines.join('\n');
}

export function generateInlineStyles(effects: Effect[]): string {
  if (!effects?.length) {
    return '';
  }

  const { normal } = generateEffectCSS(effects);

  return normal.map((decl) => decl.replace(/ !important/g, '')).join(' ');
}
