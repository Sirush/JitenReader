export type WordStyleTheme = string;

export type EffectType =
  | 'text-colour'
  | 'background'
  | 'underline'
  | 'border'
  | 'shadow'
  | 'blur'
  | 'opacity'
  | 'font-weight'
  | 'font-style';

export type UnderlineStyle = 'solid' | 'dashed' | 'dotted' | 'wavy';
export type BorderStyle = 'solid' | 'dashed';
export type FontWeight = 'normal' | 'bold';
export type FontStyle = 'normal' | 'italic';

export type Effect =
  | { type: 'text-colour'; colour: string }
  | { type: 'background'; colour: string; opacity: number }
  | { type: 'underline'; colour: string; style: UnderlineStyle; thickness: number }
  | { type: 'border'; colour: string; width: number; style: BorderStyle; radius: number }
  | { type: 'shadow'; colour: string; blur: number; offsetX: number; offsetY: number }
  | { type: 'blur'; radius: number; hoverOnly: boolean }
  | { type: 'opacity'; value: number; hoverOnly: boolean }
  | { type: 'font-weight'; value: FontWeight }
  | { type: 'font-style'; value: FontStyle };

export type StateStyle = {
  effects: Effect[];
};

export type WordStyleConfig = {
  v: 1;
  theme: WordStyleTheme;
  states: Record<string, StateStyle>;
};
