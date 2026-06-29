import { Effect, WordStyleConfig } from '@shared/word-style/types';

// In faithful mode the PDF canvas is the visible text and PDF.js' text layer sits transparently over
// it. Highlight each parsed word with a translucent box in its state colour, pulled from whatever the
// user's word-style config uses for that state (text colour, background, underline, border…). We emit
// our own translucent box (with !important) rather than relying on the config's raw effect so the
// opacity is consistent and every coloured state gets a box — even ones configured as text colour.
const stateColour = (effects: Effect[]): string | undefined => {
  for (const effect of effects) {
    if ('colour' in effect && effect.colour) {
      return effect.colour;
    }
  }

  return undefined;
};

export const generateFaithfulHighlightCss = (config: WordStyleConfig): string => {
  const blocks: string[] = [];

  for (const [state, style] of Object.entries(config.states)) {
    const colour = style?.effects?.length ? stateColour(style.effects) : undefined;

    if (!colour) {
      continue;
    }

    blocks.push(
      [
        `#jiten-pdf .textLayer .jiten-word.${state} {`,
        `  background: color-mix(in srgb, ${colour} 30%, transparent) !important;`,
        '}',
        `#jiten-pdf .textLayer .jiten-word.${state}:hover,`,
        `#jiten-pdf .textLayer .jiten-word.${state}.hovered {`,
        `  background: color-mix(in srgb, ${colour} 50%, transparent) !important;`,
        '}',
      ].join('\n'),
    );
  }

  return blocks.join('\n');
};
