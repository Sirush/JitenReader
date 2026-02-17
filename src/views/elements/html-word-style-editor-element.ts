import { displayToast } from '@shared/dom/display-toast';
import { getStyleUrl } from '@shared/extension/get-style-url';
import {
  BOUNDS,
  BORDER_STYLES,
  EFFECT_LABELS,
  EFFECT_TYPES,
  FONT_STYLES,
  FONT_WEIGHTS,
  STYLEABLE_STATES,
  STYLEABLE_STATE_KEYS,
  UNDERLINE_STYLES,
} from '@shared/word-style/constants';
import { generateInlineStyles, generateWordStyleCSS } from '@shared/word-style/generate-css';
import { resolveThemeSync } from '@shared/word-style/resolve-theme';
import {
  createSavedTheme,
  deleteSavedTheme,
  getSavedThemes,
  updateSavedTheme,
} from '@shared/word-style/saved-themes-state';
import { SavedThemesList } from '@shared/word-style/saved-themes.types';
import { decodeThemeCode, encodeThemeCode } from '@shared/word-style/theme-code';
import { PRESET_THEMES } from '@shared/word-style/themes';
import { Effect, EffectType, WordStyleConfig } from '@shared/word-style/types';

const PREVIEW_WORDS: { text: string; state: string }[] = [
  { text: '事典', state: 'new' },
  { text: 'を', state: 'unparsed' },
  { text: '読む', state: 'mature' },
  { text: '時', state: 'young' },
  { text: '、', state: 'unparsed' },
  { text: '新しい', state: 'i-plus-one' },
  { text: '言葉', state: 'due' },
  { text: 'が', state: 'mastered' },
  { text: '出て', state: 'frequent' },
  { text: 'くる', state: 'blacklisted' },
  { text: '。', state: 'unparsed' },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') {
        e.className = v;
      } else if (k === 'textContent') {
        e.textContent = v;
      } else {
        e.setAttribute(k, v);
      }
    }
  }

  for (const child of children) {
    e.append(child);
  }

  return e;
}

function defaultEffectForType(type: EffectType): Effect {
  switch (type) {
    case 'text-colour':
      return { type: 'text-colour', colour: '#ffffff' };
    case 'background':
      return { type: 'background', colour: '#ffffff', opacity: 0.15 };
    case 'underline':
      return { type: 'underline', colour: '#ffffff', style: 'solid', thickness: 2 };
    case 'border':
      return { type: 'border', colour: '#ffffff', width: 1, style: 'solid', radius: 4 };
    case 'shadow':
      return { type: 'shadow', colour: '#ffffff', blur: 6, offsetX: 0, offsetY: 2 };
    case 'blur':
      return { type: 'blur', radius: 3, hoverOnly: true };
    case 'opacity':
      return { type: 'opacity', value: 0.5, hoverOnly: true };
    case 'font-weight':
      return { type: 'font-weight', value: 'bold' };
    case 'font-style':
      return { type: 'font-style', value: 'italic' };
  }
}

export class HTMLWordStyleEditorElement extends HTMLElement {
  public static observedAttributes = ['value', 'name'];

  private _shadow!: ShadowRoot;
  private _input!: HTMLInputElement;
  private _config!: WordStyleConfig;
  private _themeSelect!: HTMLSelectElement;
  private _previewContainer!: HTMLDivElement;
  private _statesContainer!: HTMLDivElement;
  private _importRow!: HTMLDivElement;
  private _emitTimer: ReturnType<typeof setTimeout> | null = null;
  private _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _previewDark = true;
  private _previewStyle!: HTMLStyleElement;
  private _savedThemes: SavedThemesList = [];
  private _themeBar!: HTMLDivElement;
  private _saveAsBtn!: HTMLButtonElement;
  private _renameBtn!: HTMLButtonElement;
  private _deleteBtn!: HTMLButtonElement;
  private _unsavedWarning!: HTMLDivElement;

  public get value(): string {
    return JSON.stringify(this._config);
  }

  public set value(val: string | WordStyleConfig) {
    try {
      this._config = typeof val === 'object' ? val : (JSON.parse(val) as WordStyleConfig);
    } catch {
      return;
    }

    this._syncFromConfig();
  }

  public get name(): string {
    return this.getAttribute('name') ?? '';
  }

  public set name(val: string) {
    this.setAttribute('name', val);
  }

  public connectedCallback(): void {
    this._shadow = this.attachShadow({ mode: 'open' });

    this._shadow.appendChild(
      el('link', { rel: 'stylesheet', href: getStyleUrl('html-word-style-editor') }),
    );

    this._input = el('input', { type: 'hidden', name: this.name });
    this.appendChild(this._input);

    this._config = structuredClone(PRESET_THEMES.get('default')!.config);

    void getSavedThemes().then((themes) => {
      this._savedThemes = themes;
      this._buildDOM();
      this._syncFromConfig();
    });
  }

  public attributeChangedCallback(name: string, _old: string, val: string): void {
    if (name === 'value' && this._config) {
      try {
        const parsed = JSON.parse(val) as WordStyleConfig;

        if (JSON.stringify(parsed) !== JSON.stringify(this._config)) {
          this._config = parsed;
          this._syncFromConfig();
        }
      } catch {
        /* nop */
      }
    }

    if (name === 'name' && this._input) {
      this._input.name = val;
    }
  }

  private _buildDOM(): void {
    this._themeSelect = el('select', { class: 'theme-select' });
    this._populateThemeDropdown();

    this._themeSelect.addEventListener('change', () => {
      const theme = this._themeSelect.value;

      if (this._config.theme === 'custom' && theme !== 'custom') {
        if (!confirm('Your unsaved custom theme will be lost. Continue?')) {
          this._themeSelect.value = 'custom';

          return;
        }
      }

      const preset = PRESET_THEMES.get(theme);

      if (preset) {
        this._config = structuredClone(preset.config);
        this._syncFromConfig();
        this._emitChange();

        return;
      }

      const saved = this._savedThemes.find((t) => t.id === theme);

      if (saved) {
        this._config = structuredClone(saved.config);
        this._config.theme = saved.id;
        this._syncFromConfig();
        this._emitChange();
      }
    });

    const copyBtn = el('button', {
      class: 'btn btn-sm',
      type: 'button',
      textContent: 'Copy Theme',
    });

    copyBtn.addEventListener('click', () => {
      const resolved = resolveThemeSync(this._config.theme, this._savedThemes);
      let name: string | undefined;

      if (resolved.type === 'preset') {
        name = resolved.preset.label;
      } else if (resolved.type === 'saved') {
        name = resolved.saved.label;
      }

      const code = encodeThemeCode(this._config, name);

      void navigator.clipboard.writeText(code).then(() => {
        displayToast('success', 'Theme code copied to clipboard');
      });
    });

    const importBtn = el('button', {
      class: 'btn btn-sm',
      type: 'button',
      textContent: 'Import Theme',
    });

    importBtn.addEventListener('click', () => {
      this._importRow.style.display = this._importRow.style.display === 'none' ? 'flex' : 'none';
    });

    this._saveAsBtn = el('button', {
      class: 'btn btn-sm btn-save-as',
      type: 'button',
      textContent: 'Save As',
    });

    this._saveAsBtn.addEventListener('click', () => {
      const name = prompt('Theme name:');

      if (!name?.trim()) {
        return;
      }

      void createSavedTheme(name.trim(), this._config).then((entry) => {
        this._savedThemes.push(entry);
        this._config.theme = entry.id;
        this._populateThemeDropdown();
        this._themeSelect.value = entry.id;
        this._updateThemeActions();
        this._emitChange();
        displayToast('success', 'Theme saved');
      });
    });

    const duplicateBtn = el('button', {
      class: 'btn btn-sm',
      type: 'button',
      textContent: 'Duplicate',
    });

    duplicateBtn.addEventListener('click', () => {
      const resolved = resolveThemeSync(this._config.theme, this._savedThemes);
      let baseName = 'Custom';

      if (resolved.type === 'preset') {
        baseName = resolved.preset.label;
      } else if (resolved.type === 'saved') {
        baseName = resolved.saved.label;
      }

      const label = `Copy of ${baseName}`;

      void createSavedTheme(label, this._config).then((entry) => {
        this._savedThemes.push(entry);
        this._config = structuredClone(entry.config);
        this._config.theme = entry.id;
        this._syncFromConfig();
        this._emitChange();
        displayToast('success', `Theme duplicated as "${label}"`);
      });
    });

    const newBtn = el('button', {
      class: 'btn btn-sm',
      type: 'button',
      textContent: 'New',
    });

    newBtn.addEventListener('click', () => {
      const states: Record<string, { effects: Effect[] }> = {};

      for (const key of STYLEABLE_STATE_KEYS) {
        states[key] = { effects: [] };
      }

      this._config = { v: 1, theme: 'custom', states };
      this._syncFromConfig();
      this._emitChange();
    });

    this._renameBtn = el('button', {
      class: 'btn btn-sm btn-rename',
      type: 'button',
      textContent: 'Rename',
    });

    this._renameBtn.addEventListener('click', () => {
      const saved = this._savedThemes.find((t) => t.id === this._config.theme);

      if (!saved) {
        return;
      }

      const name = prompt('New name:', saved.label);

      if (!name?.trim() || name.trim() === saved.label) {
        return;
      }

      saved.label = name.trim();
      void updateSavedTheme(saved.id, { label: saved.label }).then(() => {
        this._populateThemeDropdown();
        this._themeSelect.value = saved.id;
        displayToast('success', 'Theme renamed');
      });
    });

    this._deleteBtn = el('button', {
      class: 'btn btn-sm btn-delete',
      type: 'button',
      textContent: 'Delete',
    });

    this._deleteBtn.addEventListener('click', () => {
      const saved = this._savedThemes.find((t) => t.id === this._config.theme);

      if (!saved) {
        return;
      }

      if (!confirm(`Delete theme "${saved.label}"?`)) {
        return;
      }

      const id = saved.id;

      this._savedThemes = this._savedThemes.filter((t) => t.id !== id);
      void deleteSavedTheme(id);

      this._config.theme = 'custom';
      this._populateThemeDropdown();
      this._themeSelect.value = 'custom';
      this._updateThemeActions();
      this._emitChange();
      displayToast('success', 'Theme deleted');
    });

    this._importRow = this._buildImportRow();

    this._themeBar = el(
      'div',
      { class: 'theme-bar' },
      this._themeSelect,
      newBtn,
      duplicateBtn,
      this._saveAsBtn,
      this._renameBtn,
      this._deleteBtn,
      copyBtn,
      importBtn,
    );

    this._unsavedWarning = el('div', {
      class: 'unsaved-warning',
      textContent: 'This theme is unsaved. Use "Save As" to keep your changes.',
    });

    this._previewContainer = el('div', { class: 'preview-panel' });
    this._statesContainer = el('div', { class: 'state-sections' });

    this._previewStyle = document.createElement('style');
    this._shadow.append(
      this._previewStyle,
      this._themeBar,
      this._unsavedWarning,
      this._importRow,
      this._previewContainer,
      this._statesContainer,
    );
  }

  private _populateThemeDropdown(): void {
    this._themeSelect.innerHTML = '';

    const presetsGroup = document.createElement('optgroup');

    presetsGroup.label = 'Presets';

    for (const [key, { label }] of PRESET_THEMES) {
      presetsGroup.appendChild(el('option', { value: key, textContent: label }));
    }

    this._themeSelect.appendChild(presetsGroup);

    if (this._savedThemes.length > 0) {
      const savedGroup = document.createElement('optgroup');

      savedGroup.label = 'Saved';

      for (const saved of this._savedThemes) {
        savedGroup.appendChild(el('option', { value: saved.id, textContent: saved.label }));
      }

      this._themeSelect.appendChild(savedGroup);
    }

    const resolved = resolveThemeSync(this._config.theme, this._savedThemes);

    if (resolved.type === 'custom') {
      this._themeSelect.appendChild(el('option', { value: 'custom', textContent: 'Custom' }));
    }
  }

  private _updateThemeActions(): void {
    const resolved = resolveThemeSync(this._config.theme, this._savedThemes);
    const isSaved = resolved.type === 'saved';
    const isCustom = resolved.type === 'custom';

    this._renameBtn.style.display = isSaved ? '' : 'none';
    this._deleteBtn.style.display = isSaved ? '' : 'none';
    this._unsavedWarning.style.display = isCustom ? '' : 'none';
  }

  private _buildImportRow(): HTMLDivElement {
    const input = el('input', {
      type: 'text',
      class: 'import-input',
      placeholder: 'Paste theme code...',
    });
    const applyBtn = el('button', { class: 'btn btn-sm', type: 'button', textContent: 'Apply' });

    applyBtn.addEventListener('click', () => {
      const decoded = decodeThemeCode(input.value.trim());

      if (!decoded) {
        displayToast('error', 'Invalid theme code');

        return;
      }

      this._importRow.style.display = 'none';
      input.value = '';

      if (decoded.name) {
        void createSavedTheme(decoded.name, decoded.config).then((entry) => {
          this._savedThemes.push(entry);
          this._config = structuredClone(entry.config);
          this._config.theme = entry.id;
          this._syncFromConfig();
          this._emitChange();
          displayToast('success', `Theme "${entry.label}" imported and saved`);
        });
      } else {
        this._config = decoded.config;
        this._syncFromConfig();
        this._emitChange();
        displayToast('success', 'Theme imported');
      }
    });

    const row = el('div', { class: 'import-row', style: 'display:none' }, input, applyBtn);

    return row;
  }

  private _buildPreview(): void {
    this._previewContainer.innerHTML = '';
    this._previewStyle.textContent =
      '.jiten-word { margin-inline: 0.5px; }\n' + generateWordStyleCSS(this._config);

    const previewH = el('div', { class: 'preview-horizontal' });

    for (const word of PREVIEW_WORDS) {
      const span = el('span', { class: `jiten-word preview-word ${word.state}` });

      span.textContent = word.text;
      previewH.appendChild(span);
    }

    const previewV = el('div', { class: 'preview-vertical' });

    for (const word of PREVIEW_WORDS) {
      const span = el('span', { class: `jiten-word preview-word ${word.state}` });

      span.textContent = word.text;
      previewV.appendChild(span);
    }

    const legend = el('div', { class: 'preview-legend' });
    const usedStates = [...new Set(PREVIEW_WORDS.map((w) => w.state))];

    for (const state of usedStates) {
      const swatch = el('span', { class: 'legend-swatch' });
      const inlineStyle = generateInlineStyles(this._config.states[state]?.effects ?? []);

      swatch.setAttribute('style', inlineStyle);
      swatch.textContent = STYLEABLE_STATES[state] ?? state;
      legend.appendChild(swatch);
    }

    const toggleBtn = el('button', {
      class: 'btn btn-sm preview-bg-toggle',
      type: 'button',
      textContent: this._previewDark ? '\u2600' : '\u263e',
    });

    toggleBtn.addEventListener('click', () => {
      this._previewDark = !this._previewDark;
      this._previewContainer.classList.toggle('light', !this._previewDark);
      toggleBtn.textContent = this._previewDark ? '\u2600' : '\u263e';
    });

    const header = el('div', { class: 'preview-header' }, toggleBtn);

    if (!this._previewDark) {
      this._previewContainer.classList.add('light');
    }

    this._previewContainer.append(header, previewH, previewV, legend);
  }

  private _buildStateSections(): void {
    this._statesContainer.innerHTML = '';

    for (const stateKey of STYLEABLE_STATE_KEYS) {
      const stateStyle = this._config.states[stateKey] ?? { effects: [] };
      const section = this._buildStateSection(stateKey, stateStyle.effects);

      this._statesContainer.appendChild(section);
    }
  }

  private _buildStateSection(stateKey: string, effects: Effect[]): HTMLDetailsElement {
    const details = document.createElement('details');

    details.className = 'state-section';

    const summary = document.createElement('summary');
    const chevron = el('span', { class: 'state-chevron', textContent: '\u25b6' });
    const label = el('span', { class: 'state-label', textContent: STYLEABLE_STATES[stateKey] });
    const previewWord = el('span', { class: 'state-preview-word' });
    const inlineStyle = generateInlineStyles(effects);

    previewWord.setAttribute('style', inlineStyle);
    previewWord.textContent = '例';

    const spacer = el('span', { class: 'summary-spacer' });
    const addSelect = el('select', { class: 'add-effect-select' });

    addSelect.appendChild(el('option', { value: '', textContent: '+ Add Effect' }));

    for (const effectType of EFFECT_TYPES) {
      addSelect.appendChild(
        el('option', { value: effectType, textContent: EFFECT_LABELS[effectType] }),
      );
    }

    addSelect.addEventListener('click', (e) => e.stopPropagation());
    addSelect.addEventListener('change', () => {
      if (!addSelect.value) {
        return;
      }

      const newEffect = defaultEffectForType(addSelect.value as EffectType);

      this._config.states[stateKey].effects.push(newEffect);
      this._handleUserEdit();
      this._refreshStateSection(details, stateKey, true);
      this._updatePreviews();
      this._emitChange();
      addSelect.value = '';
    });

    summary.append(chevron, label, previewWord, spacer, addSelect);
    details.appendChild(summary);

    const effectList = el('div', { class: 'effect-list' });

    for (let i = 0; i < effects.length; i++) {
      effectList.appendChild(this._buildEffectRow(stateKey, i));
    }

    details.appendChild(effectList);

    return details;
  }

  private _refreshStateSection(
    details: HTMLDetailsElement,
    stateKey: string,
    forceOpen?: boolean,
  ): void {
    const effects = this._config.states[stateKey]?.effects ?? [];
    const newSection = this._buildStateSection(stateKey, effects);

    newSection.open = forceOpen ?? details.open;
    details.replaceWith(newSection);
  }

  private _buildEffectRow(stateKey: string, index: number): HTMLDivElement {
    const effect = this._config.states[stateKey].effects[index];
    const row = el('div', { class: 'effect-row' });
    const labelEl = el('span', { class: 'effect-label', textContent: EFFECT_LABELS[effect.type] });

    row.appendChild(labelEl);

    const controls = el('div', { class: 'effect-controls' });

    this._buildEffectControls(controls, stateKey, index, effect);
    row.appendChild(controls);

    const removeBtn = el('button', {
      class: 'btn btn-remove',
      type: 'button',
      textContent: '\u00d7',
    });

    removeBtn.addEventListener('click', () => {
      this._config.states[stateKey].effects.splice(index, 1);
      this._handleUserEdit();
      this._rebuildState(stateKey);
      this._updatePreviews();
      this._emitChange();
    });

    row.appendChild(removeBtn);

    return row;
  }

  private _buildEffectControls(
    container: HTMLElement,
    stateKey: string,
    index: number,
    effect: Effect,
  ): void {
    const onUpdate = (): void => {
      this._handleUserEdit();
      this._updatePreviews();
      this._updateStatePreview(stateKey);
      this._emitChange();
    };

    switch (effect.type) {
      case 'text-colour':
        container.appendChild(
          this._colourInput(effect.colour, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).colour = v;
            onUpdate();
          }),
        );

        break;

      case 'background':
        container.appendChild(
          this._colourInput(effect.colour, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).colour = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._rangeInput('Opacity', effect.opacity, BOUNDS.backgroundOpacity, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).opacity = v;
            onUpdate();
          }),
        );

        break;

      case 'underline':
        container.appendChild(
          this._colourInput(effect.colour, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).colour = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._selectInput('Style', effect.style, UNDERLINE_STYLES as unknown as string[], (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).style =
              v as typeof effect.style;
            onUpdate();
          }),
        );
        container.appendChild(
          this._rangeInput('Thickness', effect.thickness, BOUNDS.underlineThickness, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).thickness = v;
            onUpdate();
          }),
        );

        break;

      case 'border':
        container.appendChild(
          this._colourInput(effect.colour, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).colour = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._rangeInput('Width', effect.width, BOUNDS.borderWidth, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).width = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._selectInput('Style', effect.style, BORDER_STYLES as unknown as string[], (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).style =
              v as typeof effect.style;
            onUpdate();
          }),
        );
        container.appendChild(
          this._rangeInput('Radius', effect.radius, BOUNDS.borderRadius, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).radius = v;
            onUpdate();
          }),
        );

        break;

      case 'shadow':
        container.appendChild(
          this._colourInput(effect.colour, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).colour = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._rangeInput('Blur', effect.blur, BOUNDS.shadowBlur, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).blur = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._rangeInput('X Offset', effect.offsetX, BOUNDS.shadowOffset, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).offsetX = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._rangeInput('Y Offset', effect.offsetY, BOUNDS.shadowOffset, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).offsetY = v;
            onUpdate();
          }),
        );

        break;

      case 'blur':
        container.appendChild(
          this._rangeInput('Radius', effect.radius, BOUNDS.blurRadius, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).radius = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._checkboxInput('Reveal on hover', effect.hoverOnly, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).hoverOnly = v;
            onUpdate();
          }),
        );

        break;

      case 'opacity':
        container.appendChild(
          this._rangeInput('Value', effect.value, BOUNDS.opacity, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).value = v;
            onUpdate();
          }),
        );
        container.appendChild(
          this._checkboxInput('Restore on hover', effect.hoverOnly, (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).hoverOnly = v;
            onUpdate();
          }),
        );

        break;

      case 'font-weight':
        container.appendChild(
          this._selectInput('Weight', effect.value, FONT_WEIGHTS as unknown as string[], (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).value =
              v as typeof effect.value;
            onUpdate();
          }),
        );

        break;

      case 'font-style':
        container.appendChild(
          this._selectInput('Style', effect.value, FONT_STYLES as unknown as string[], (v) => {
            (this._config.states[stateKey].effects[index] as typeof effect).value =
              v as typeof effect.value;
            onUpdate();
          }),
        );

        break;
    }
  }

  private _colourInput(value: string, onChange: (v: string) => void): HTMLDivElement {
    const wrapper = el('div', { class: 'control-group' });
    const colourPicker = el('input', { type: 'color', value: value.substring(0, 7) });
    const textInput = el('input', { type: 'text', class: 'colour-text', value });

    colourPicker.addEventListener('input', () => {
      textInput.value = colourPicker.value;
      onChange(colourPicker.value);
    });

    textInput.addEventListener('change', () => {
      const v = textInput.value.trim();

      if (/^#[0-9a-fA-F]{3,8}$/.test(v)) {
        colourPicker.value = v.substring(0, 7);
        onChange(v);
      }
    });

    wrapper.append(colourPicker, textInput);

    return wrapper;
  }

  private _rangeInput(
    label: string,
    value: number,
    bounds: { min: number; max: number; step?: number },
    onChange: (v: number) => void,
  ): HTMLDivElement {
    const wrapper = el('div', { class: 'control-group' });
    const labelEl = el('span', { class: 'control-label', textContent: label });
    const step = (bounds as { step?: number }).step ?? 1;
    const range = el('input', {
      type: 'range',
      min: String(bounds.min),
      max: String(bounds.max),
      step: String(step),
      value: String(value),
    });
    const display = el('span', { class: 'range-value', textContent: String(value) });

    range.addEventListener('input', () => {
      const num = parseFloat(range.value);

      display.textContent = String(num);
      onChange(num);
    });

    wrapper.append(labelEl, range, display);

    return wrapper;
  }

  private _selectInput(
    label: string,
    value: string,
    options: string[],
    onChange: (v: string) => void,
  ): HTMLDivElement {
    const wrapper = el('div', { class: 'control-group' });
    const labelEl = el('span', { class: 'control-label', textContent: label });
    const select = el('select', { class: 'effect-select' });

    for (const opt of options) {
      const option = el('option', { value: opt, textContent: opt });

      if (opt === value) {
        option.selected = true;
      }

      select.appendChild(option);
    }

    select.addEventListener('change', () => onChange(select.value));
    wrapper.append(labelEl, select);

    return wrapper;
  }

  private _checkboxInput(
    label: string,
    checked: boolean,
    onChange: (v: boolean) => void,
  ): HTMLDivElement {
    const wrapper = el('div', { class: 'control-group control-checkbox' });
    const cb = el('input', { type: 'checkbox' });

    cb.checked = checked;

    const labelEl = el('label', { textContent: label });

    cb.addEventListener('change', () => onChange(cb.checked));
    wrapper.append(cb, labelEl);

    return wrapper;
  }

  private _syncFromConfig(): void {
    if (!this._themeSelect || !this._config) {
      return;
    }

    this._populateThemeDropdown();
    this._themeSelect.value = this._config.theme;
    this._updateThemeActions();
    this._buildPreview();
    this._buildStateSections();
    this._syncHiddenInput();
  }

  private _updatePreviews(): void {
    this._buildPreview();
  }

  private _updateStatePreview(stateKey: string): void {
    const sections = this._statesContainer.querySelectorAll('.state-section');
    const index = STYLEABLE_STATE_KEYS.indexOf(stateKey);

    if (index >= 0 && sections[index]) {
      const previewWord = sections[index].querySelector('.state-preview-word')!;

      if (previewWord) {
        const inlineStyle = generateInlineStyles(this._config.states[stateKey]?.effects ?? []);

        previewWord.setAttribute('style', inlineStyle);
      }
    }
  }

  private _rebuildState(stateKey: string): void {
    const sections = this._statesContainer.querySelectorAll('.state-section');
    const index = STYLEABLE_STATE_KEYS.indexOf(stateKey);

    if (index >= 0 && sections[index]) {
      const details = sections[index] as HTMLDetailsElement;

      this._refreshStateSection(details, stateKey);
    }
  }

  private _handleUserEdit(): void {
    const resolved = resolveThemeSync(this._config.theme, this._savedThemes);

    if (resolved.type === 'saved') {
      this._scheduleAutoSave(resolved.saved.id);

      return;
    }

    if (resolved.type === 'preset') {
      this._config.theme = 'custom';
      this._populateThemeDropdown();
      this._themeSelect.value = 'custom';
      this._updateThemeActions();
    }
  }

  private _scheduleAutoSave(id: string): void {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
    }

    this._autoSaveTimer = setTimeout(() => {
      this._autoSaveTimer = null;

      const saved = this._savedThemes.find((t) => t.id === id);

      if (saved) {
        saved.config = structuredClone(this._config);
        saved.config.theme = id;
        void updateSavedTheme(id, { config: saved.config });
      }
    }, 250);
  }

  private _syncHiddenInput(): void {
    if (this._input) {
      this._input.value = JSON.stringify(this._config);
    }
  }

  private _emitChange(): void {
    this._syncHiddenInput();

    if (this._emitTimer) {
      clearTimeout(this._emitTimer);
    }

    this._emitTimer = setTimeout(() => {
      this._emitTimer = null;
      this._input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 250);
  }
}
