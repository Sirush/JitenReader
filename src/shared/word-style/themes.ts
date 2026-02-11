import { WordStyleConfig } from './types';

export type PresetTheme = { label: string; config: WordStyleConfig };

const PRESETS: [string, PresetTheme][] = [
  [
    'default',
    {
      label: 'Default',
      config: {
        v: 1,
        theme: 'default',
        states: {
          new: { effects: [{ type: 'text-colour', colour: '#a566ef' }] },
          young: {
            effects: [{ type: 'underline', colour: '#d08700', style: 'solid', thickness: 2 }],
          },
          mature: { effects: [] },
          mastered: { effects: [] },
          due: { effects: [{ type: 'text-colour', colour: '#ff4500' }] },
          blacklisted: { effects: [{ type: 'opacity', value: 0.5, hoverOnly: false }] },
          suspended: { effects: [{ type: 'opacity', value: 0.5, hoverOnly: false }] },
          frequent: {
            effects: [{ type: 'underline', colour: '#4b8d7f', style: 'dotted', thickness: 2 }],
          },
          'i-plus-one': {
            effects: [
              { type: 'shadow', colour: '#359eff', blur: 6, offsetX: 0, offsetY: 2 },
              { type: 'shadow', colour: '#359eff', blur: 12, offsetX: 0, offsetY: 4 },
            ],
          },
          unparsed: { effects: [] },
        },
      },
    },
  ],
  [
    'toyBox',
    {
      label: 'Toy Box',
      config: {
        v: 1,
        theme: 'toyBox',
        states: {
          new: { effects: [{ type: 'text-colour', colour: '#4b8dff' }] },
          young: { effects: [{ type: 'text-colour', colour: '#4ac34a' }] },
          mature: { effects: [] },
          mastered: { effects: [] },
          due: { effects: [{ type: 'text-colour', colour: '#e8a735' }] },
          blacklisted: { effects: [{ type: 'text-colour', colour: '#777777' }] },
          suspended: { effects: [{ type: 'text-colour', colour: '#777777' }] },
          frequent: {
            effects: [{ type: 'underline', colour: '#4b8dff', style: 'solid', thickness: 2 }],
          },
          'i-plus-one': {
            effects: [{ type: 'shadow', colour: '#4b8dff', blur: 6, offsetX: 0, offsetY: 2 }],
          },
          unparsed: { effects: [] },
        },
      },
    },
  ],
  [
    'monochrome',
    {
      label: 'Monochrome',
      config: {
        v: 1,
        theme: 'monochrome',
        states: {
          new: { effects: [{ type: 'text-colour', colour: '#cccccc' }] },
          young: { effects: [{ type: 'text-colour', colour: '#999999' }] },
          mature: { effects: [{ type: 'text-colour', colour: '#666666' }] },
          mastered: { effects: [] },
          due: {
            effects: [
              { type: 'text-colour', colour: '#ffffff' },
              { type: 'underline', colour: '#ffffff', style: 'solid', thickness: 1 },
            ],
          },
          blacklisted: { effects: [{ type: 'opacity', value: 0.4, hoverOnly: false }] },
          suspended: { effects: [{ type: 'opacity', value: 0.4, hoverOnly: false }] },
          frequent: {
            effects: [{ type: 'underline', colour: '#999999', style: 'dotted', thickness: 1 }],
          },
          'i-plus-one': { effects: [{ type: 'background', colour: '#cccccc', opacity: 0.1 }] },
          unparsed: { effects: [] },
        },
      },
    },
  ],
  [
    'high-contrast',
    {
      label: 'High Contrast',
      config: {
        v: 1,
        theme: 'high-contrast',
        states: {
          new: {
            effects: [
              { type: 'text-colour', colour: '#ff00ff' },
              { type: 'background', colour: '#ff00ff', opacity: 0.1 },
            ],
          },
          young: {
            effects: [
              { type: 'text-colour', colour: '#ffaa00' },
              { type: 'background', colour: '#ffaa00', opacity: 0.1 },
            ],
          },
          mature: { effects: [{ type: 'text-colour', colour: '#00ff00' }] },
          mastered: { effects: [] },
          due: {
            effects: [
              { type: 'text-colour', colour: '#ff0000' },
              { type: 'underline', colour: '#ff0000', style: 'wavy', thickness: 2 },
            ],
          },
          blacklisted: { effects: [{ type: 'text-colour', colour: '#555555' }] },
          suspended: { effects: [] },
          frequent: {
            effects: [{ type: 'underline', colour: '#00ffff', style: 'solid', thickness: 2 }],
          },
          'i-plus-one': { effects: [{ type: 'background', colour: '#4444ff', opacity: 0.5 }] },
          unparsed: { effects: [] },
        },
      },
    },
  ],
  [
    'subtle',
    {
      label: 'Subtle',
      config: {
        v: 1,
        theme: 'subtle',
        states: {
          new: { effects: [{ type: 'background', colour: '#a566ef', opacity: 0.15 }] },
          young: { effects: [{ type: 'background', colour: '#d08700', opacity: 0.12 }] },
          mature: { effects: [] },
          mastered: { effects: [] },
          due: { effects: [{ type: 'background', colour: '#ff4500', opacity: 0.15 }] },
          blacklisted: { effects: [{ type: 'opacity', value: 0.5, hoverOnly: false }] },
          suspended: { effects: [] },
          frequent: { effects: [{ type: 'background', colour: '#4b8d7f', opacity: 0.1 }] },
          'i-plus-one': { effects: [{ type: 'background', colour: '#359eff', opacity: 0.1 }] },
          unparsed: { effects: [] },
        },
      },
    },
  ],
  [
    'underline',
    {
      label: 'Underline',
      config: {
        v: 1,
        theme: 'underline',
        states: {
          new: {
            effects: [{ type: 'underline', colour: '#a566ef', style: 'solid', thickness: 3 }],
          },
          young: {
            effects: [{ type: 'underline', colour: '#e8a020', style: 'solid', thickness: 3 }],
          },
          mature: { effects: [] },
          mastered: { effects: [] },
          due: {
            effects: [{ type: 'underline', colour: '#e03030', style: 'solid', thickness: 3 }],
          },
          blacklisted: { effects: [] },
          suspended: { effects: [] },
          frequent: {
            effects: [{ type: 'underline', colour: '#40a840', style: 'dashed', thickness: 3 }],
          },
          'i-plus-one': {
            effects: [{ type: 'underline', colour: '#40a840', style: 'solid', thickness: 3 }],
          },
          unparsed: { effects: [] },
        },
      },
    },
  ],
];

export const PRESET_THEMES = new Map<string, PresetTheme>(PRESETS);

export const DEFAULT_WORD_STYLE_CONFIG: WordStyleConfig = structuredClone(PRESETS[0][1].config);
