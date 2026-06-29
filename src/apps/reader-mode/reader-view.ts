import { Readability } from '@mozilla/readability';
import { getConfiguration } from '@shared/configuration/get-configuration';
import { setConfiguration } from '@shared/configuration/set-configuration';
import { ConfigurationSchema } from '@shared/configuration/types';
import { debug } from '@shared/debug';
import { createElement } from '@shared/dom/create-element';
import { displayToast } from '@shared/dom/display-toast';
import { getStyleUrl } from '@shared/extension/get-style-url';
import {
  DEFAULT_READER_BOLD,
  DEFAULT_READER_FONT,
  DEFAULT_READER_THEME,
  READER_FONT_SIZE,
  READER_FONTS,
  READER_LINE_HEIGHT,
  READER_THEMES,
  READER_WIDTH,
  ReaderTheme,
  resolveReaderFont,
} from '@shared/reader-mode/themes';
import { Registry } from '../integration/registry';
import { ensureWordStyles } from '../text-highlighter/apply-word-styles';
import {
  enumerateAllFonts,
  getCommonJapaneseFonts,
  getInstalledFonts,
  isJapaneseFont,
  loadPersistedFonts,
  supportsFontEnumeration,
} from './get-japanese-fonts';

interface Article {
  title: string;
  byline?: string;
  content: string;
}

type ReaderConfigKey =
  | 'readerModeTheme'
  | 'readerModeFont'
  | 'readerModeFontSize'
  | 'readerModeBold'
  | 'readerModeWidth'
  | 'readerModeLineHeight';

// Attributes worth keeping on extracted article content; everything else (class, id, style, width,
// height, align, and crucially source-specific hooks like `typeof`/`role`/`data-*`) is removed so
// no host-page CSS — including attribute-selector rules such as Wikipedia's
// `figure[typeof~="mw:File/Thumb"]` framing — can match the light-DOM content.
const KEEP_ATTRS = new Set([
  'href',
  'src',
  'srcset',
  'alt',
  'title',
  'colspan',
  'rowspan',
  'datetime',
]);

// Sentinel option value that triggers the (permission-prompting) full font enumeration on demand.
const LOAD_FONTS_VALUE = '__jiten_load_fonts__';

export class ReaderView {
  private _root?: HTMLDivElement;
  private _content?: HTMLElement;
  private _panel?: HTMLElement;
  private _fontSelect?: HTMLSelectElement;
  private _theme: ReaderTheme = DEFAULT_READER_THEME;
  private _font: string = DEFAULT_READER_FONT;
  private _fontSize: number = READER_FONT_SIZE.default;
  private _bold: boolean = DEFAULT_READER_BOLD;
  private _width: number = READER_WIDTH.default;
  private _lineHeight: number = READER_LINE_HEIGHT.default;
  private _keyListener?: (e: KeyboardEvent) => void;
  private _outsideListener?: (e: MouseEvent) => void;

  public get active(): boolean {
    return !!this._root;
  }

  public toggle(): void {
    if (this.active) {
      this.close();
    } else {
      void this.open();
    }
  }

  public async open(): Promise<void> {
    if (this.active) {
      return;
    }

    const article = this.extractArticle();

    if (!article) {
      displayToast('error', 'Reader mode', 'Could not extract article content from this page');

      return;
    }

    await this.show(article);
  }

  public async openText(text: string): Promise<void> {
    const trimmed = text.trim();

    if (!trimmed) {
      return this.open();
    }

    if (this.active) {
      this.close();
    }

    const content = trimmed
      .split(/\n{2,}/)
      .map((block) => `<p>${this.escape(block.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('');

    await this.show({ title: document.title || 'Selection', content });
  }

  public close(): void {
    if (!this._root) {
      return;
    }

    if (this._content) {
      Registry.batchController.dismissNode(this._content);
    }

    if (this._keyListener) {
      window.removeEventListener('keydown', this._keyListener, true);
      this._keyListener = undefined;
    }

    if (this._outsideListener) {
      window.removeEventListener('mousedown', this._outsideListener, true);
      this._outsideListener = undefined;
    }

    this._root.remove();
    this._root = undefined;
    this._content = undefined;
    this._panel = undefined;
    this._fontSelect = undefined;
    document.documentElement.classList.remove('ajb-reader-open');
  }

  private async show(article: Article): Promise<void> {
    this._theme = await getConfiguration('readerModeTheme');
    this._font = await getConfiguration('readerModeFont');
    this._fontSize = await getConfiguration('readerModeFontSize');
    this._bold = await getConfiguration('readerModeBold');
    this._width = await getConfiguration('readerModeWidth');
    this._lineHeight = await getConfiguration('readerModeLineHeight');

    await loadPersistedFonts();
    await ensureWordStyles();

    this.render(article);
    this.parse();

    // The chosen font may load after the initial layout, re-breaking lines that ruby had grown;
    // relayout once it settles.
    if (document.fonts) {
      void document.fonts.ready.then(() => this.reflow());
    }
  }

  private extractArticle(): Article | null {
    // Readability mutates the document it receives, so always hand it a clone.
    const clone = document.cloneNode(true) as Document;

    this.stripJitenAnnotations(clone);

    const result = new Readability(clone).parse();

    if (!result?.content) {
      return null;
    }

    return {
      title: result.title || document.title,
      byline: result.byline ?? undefined,
      content: result.content,
    };
  }

  // If the live page was already parsed, its DOM is full of jiten spans carrying an `ajb` marker.
  // Readability strips the class attributes but keeps `ajb`, and the paragraph reader skips any
  // `ajb` node — so the cloned article would never re-parse. Unwrap our markup back to plain base
  // text (furigana is re-derived when the reader re-parses) before handing the clone to Readability.
  private stripJitenAnnotations(root: Document): void {
    root.querySelectorAll('rt, rp').forEach((el) => el.remove());
    root.querySelectorAll('ruby').forEach((ruby) => ruby.replaceWith(...ruby.childNodes));
    root.querySelectorAll('.jiten-word').forEach((el) => el.replaceWith(...el.childNodes));
    root.querySelectorAll('[ajb]').forEach((el) => el.removeAttribute('ajb'));
  }

  private render(article: Article): void {
    this._content = createElement('article', { class: ['reader-content'] });
    this._content.innerHTML = article.content;

    // The reader content lives in the light DOM (so the word-highlight styles apply), which means
    // the host page's CSS and the source's own inline sizing/floats can leak in — that is what
    // frames images and squashes captions. Strip every non-essential attribute so the reader's own
    // stylesheet fully controls layout.
    this._content.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (!KEEP_ATTRS.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      }
    });

    // The controls anchor lives inside the centred column so the toolbar/panel sit beside the text
    // rather than in the far viewport corner. It is sticky so they follow the scroll.
    const controls = createElement('div', {
      class: ['reader-controls-anchor'],
      children: [this.buildToolbar(), this.buildPanel()],
    });

    const surface = createElement('div', {
      class: ['reader-surface'],
      children: [controls, this.buildHeader(article), this._content],
    });

    const stylesheet = createElement('link', {
      attributes: { rel: 'stylesheet', href: getStyleUrl('reader') },
    });

    this._root = createElement('div', {
      id: 'ajb-reader',
      class: [`reader-theme-${this._theme}`],
      children: [stylesheet, surface],
    });

    this.applyTypography();
    this.installListeners();

    document.documentElement.classList.add('ajb-reader-open');
    document.body.appendChild(this._root);
  }

  private buildHeader(article: Article): HTMLElement {
    return createElement('header', {
      class: ['reader-header'],
      children: [
        createElement('h1', { class: ['reader-title'], innerText: article.title }),
        article.byline
          ? createElement('p', { class: ['reader-byline'], innerText: article.byline })
          : undefined,
      ],
    });
  }

  private buildToolbar(): HTMLElement {
    return createElement('div', {
      class: ['reader-toolbar'],
      children: [
        createElement('button', {
          class: ['reader-btn', 'reader-options-btn'],
          innerText: 'Aa',
          attributes: { title: 'Reading options' },
          handler: () => this.togglePanel(),
        }),
        createElement('button', {
          class: ['reader-btn', 'reader-close-btn'],
          innerText: '✕',
          attributes: { title: 'Close reader mode (Esc)' },
          handler: () => this.close(),
        }),
      ],
    });
  }

  private buildPanel(): HTMLElement {
    this._panel = createElement('div', {
      class: ['reader-panel'],
      children: [
        this.buildThemeSection(),
        this.panelRow('Text size', this.buildSizeStepper()),
        this.panelRow('Font', this.buildFontSelect()),
        this.panelRow('Font weight', this.buildWeightSelect()),
        this.panelRow(
          'Content width',
          this.buildRange(READER_WIDTH, this._width, (v) => void this.setWidth(v)),
        ),
        this.panelRow(
          'Line spacing',
          this.buildRange(READER_LINE_HEIGHT, this._lineHeight, (v) => void this.setLineHeight(v)),
        ),
      ],
    });

    return this._panel;
  }

  private buildThemeSection(): HTMLElement {
    return createElement('div', {
      class: ['reader-theme-grid'],
      children: READER_THEMES.map((theme) =>
        createElement('button', {
          class: ['reader-theme-option', ...(theme.id === this._theme ? ['active'] : [])],
          attributes: { title: theme.label, 'data-theme': theme.id },
          handler: () => void this.setTheme(theme.id),
          children: [
            createElement('span', {
              class: ['reader-swatch'],
              style: { backgroundColor: theme.bg, borderColor: theme.fg },
            }),
            createElement('span', { class: ['reader-theme-label'], innerText: theme.label }),
          ],
        }),
      ),
    });
  }

  private buildSizeStepper(): HTMLElement {
    return createElement('div', {
      class: ['reader-stepper'],
      children: [
        createElement('button', {
          class: ['reader-btn'],
          innerText: '−',
          attributes: { title: 'Decrease font size' },
          handler: () => void this.changeFontSize(-READER_FONT_SIZE.step),
        }),
        createElement('span', { class: ['reader-stepper-label'], innerText: 'A' }),
        createElement('button', {
          class: ['reader-btn'],
          innerText: '+',
          attributes: { title: 'Increase font size' },
          handler: () => void this.changeFontSize(READER_FONT_SIZE.step),
        }),
      ],
    });
  }

  private buildFontSelect(): HTMLElement {
    this._fontSelect = createElement('select', { class: ['reader-select'] });
    this.populateFontOptions();
    this._fontSelect.onchange = (): void => {
      const value = this._fontSelect!.value;

      if (value === LOAD_FONTS_VALUE) {
        void this.loadFonts();

        return;
      }

      void this.setFont(value);
    };

    return this._fontSelect;
  }

  private buildWeightSelect(): HTMLElement {
    const select = createElement('select', { class: ['reader-select'] });

    [
      { value: 'regular', label: 'Regular' },
      { value: 'bold', label: 'Bold' },
    ].forEach((option) => {
      const el = document.createElement('option');

      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    });

    select.value = this._bold ? 'bold' : 'regular';
    select.onchange = (): void => {
      void this.setBold(select.value === 'bold');
    };

    return select;
  }

  private buildRange(
    range: { min: number; max: number; step: number },
    value: number,
    onInput: (value: number) => void,
  ): HTMLElement {
    const input = createElement('input', {
      class: ['reader-range'],
      attributes: {
        type: 'range',
        min: String(range.min),
        max: String(range.max),
        step: String(range.step),
        value: String(value),
      },
    });

    input.addEventListener('input', () => onInput(parseFloat(input.value)));

    return input;
  }

  private panelRow(label: string, control: HTMLElement): HTMLElement {
    return createElement('div', {
      class: ['reader-panel-row'],
      children: [
        createElement('span', { class: ['reader-panel-label'], innerText: label }),
        control,
      ],
    });
  }

  private installListeners(): void {
    this._keyListener = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (this._panel?.classList.contains('open')) {
        this.closePanel();
      } else {
        this.close();
      }
    };

    this._outsideListener = (e: MouseEvent): void => {
      if (!this._panel?.classList.contains('open')) {
        return;
      }

      const target = e.target as Node;

      if (!this._root?.querySelector('.reader-controls-anchor')?.contains(target)) {
        this.closePanel();
      }
    };

    window.addEventListener('keydown', this._keyListener, true);
    window.addEventListener('mousedown', this._outsideListener, true);
  }

  private togglePanel(): void {
    if (!this._panel) {
      return;
    }

    if (this._panel.classList.contains('open')) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  private openPanel(): void {
    if (!this._panel || !this._root) {
      return;
    }

    // Pin the panel to fixed viewport coordinates derived from the toolbar, so adjusting the
    // content-width slider (which resizes the column) doesn't drag the panel out from under the
    // cursor.
    const toolbar = this._root.querySelector('.reader-toolbar');

    if (toolbar) {
      const rect = toolbar.getBoundingClientRect();

      this._panel.style.top = `${rect.bottom + 8}px`;
      this._panel.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    }

    this._panel.classList.add('open');
  }

  private closePanel(): void {
    this._panel?.classList.remove('open');
  }

  private applyTypography(): void {
    const root = this._root;

    if (!root) {
      return;
    }

    root.style.setProperty('--reader-font-family', resolveReaderFont(this._font));
    root.style.setProperty('--reader-font-size', `${this._fontSize}px`);
    root.style.setProperty('--reader-width', `${this._width}em`);
    root.style.setProperty('--reader-line-height', `${this._lineHeight}`);
    root.classList.toggle('reader-bold', this._bold);
  }

  private async loadFonts(): Promise<void> {
    await enumerateAllFonts();
    this.populateFontOptions();
  }

  private populateFontOptions(): void {
    const select = this._fontSelect;

    if (!select) {
      return;
    }

    select.innerHTML = '';

    const addGroup = (
      label: string,
      entries: { value: string; label: string }[],
      preview = true,
    ): void => {
      if (!entries.length) {
        return;
      }

      const group = document.createElement('optgroup');

      group.label = label;

      for (const entry of entries) {
        const option = document.createElement('option');

        option.value = entry.value;
        option.textContent = entry.label;

        if (preview) {
          option.style.fontFamily = resolveReaderFont(entry.value);
        }

        group.appendChild(option);
      }

      select.appendChild(group);
    };

    const toEntries = (names: string[]): { value: string; label: string }[] =>
      names.map((name) => ({ value: name, label: name }));

    addGroup(
      'Standard',
      READER_FONTS.map((font) => ({ value: font.id, label: font.label })),
    );

    const all = getInstalledFonts();

    if (all?.length) {
      // Full enumeration available: split into Japanese fonts (detected or CJK-named) and the rest,
      // so nothing is hidden but the relevant ones come first.
      addGroup('Japanese fonts', toEntries(all.filter(isJapaneseFont)));
      addGroup('Other fonts', toEntries(all.filter((f) => !isJapaneseFont(f))), false);
    } else {
      addGroup('Japanese fonts', toEntries(getCommonJapaneseFonts()));
    }

    const known =
      READER_FONTS.some((f) => f.id === this._font) ||
      (all?.includes(this._font) ?? false) ||
      getCommonJapaneseFonts().includes(this._font);

    if (!known) {
      addGroup('Current', [{ value: this._font, label: this._font }]);
    }

    if (supportsFontEnumeration()) {
      addGroup('More', [
        {
          value: LOAD_FONTS_VALUE,
          label: all?.length ? 'Reload installed fonts…' : 'Load all installed fonts…',
        },
      ]);
    }

    select.value = this._font;
  }

  private parse(): void {
    if (!this._content) {
      return;
    }

    const { batchController } = Registry;

    debug('ReaderView: parsing content', { chars: this._content.textContent?.length ?? 0 });

    batchController.registerNode(this._content, { onComplete: () => this.reflow() });
    batchController.parseBatches();
  }

  // Furigana is injected into already-laid-out lines, which can leave stale line-box heights and
  // overlapping rows until a relayout — the user noticed nudging line spacing fixes it. Replicate
  // exactly that: briefly perturb the --reader-line-height the slider drives, then restore it. The
  // glitch can also reappear once the chosen font finishes loading (it re-lays out), so callers
  // also run this on document.fonts.ready.
  private reflow(): void {
    const root = this._root;

    if (!root) {
      return;
    }

    root.style.setProperty('--reader-line-height', `${this._lineHeight + 0.01}`);

    requestAnimationFrame(() => {
      if (this._root === root) {
        root.style.setProperty('--reader-line-height', `${this._lineHeight}`);
      }
    });
  }

  private async setTheme(theme: ReaderTheme): Promise<void> {
    if (!this._root || theme === this._theme) {
      return;
    }

    this._root.classList.remove(`reader-theme-${this._theme}`);
    this._theme = theme;
    this._root.classList.add(`reader-theme-${theme}`);

    this._root.querySelectorAll<HTMLElement>('.reader-theme-option').forEach((option) => {
      option.classList.toggle('active', option.getAttribute('data-theme') === theme);
    });

    await this.persist('readerModeTheme', theme);
  }

  private async setFont(value: string): Promise<void> {
    this._font = value;
    this._root?.style.setProperty('--reader-font-family', resolveReaderFont(value));

    await this.persist('readerModeFont', value);
  }

  private async changeFontSize(delta: number): Promise<void> {
    const next = Math.min(
      READER_FONT_SIZE.max,
      Math.max(READER_FONT_SIZE.min, this._fontSize + delta),
    );

    if (next === this._fontSize) {
      return;
    }

    this._fontSize = next;
    this._root?.style.setProperty('--reader-font-size', `${next}px`);

    await this.persist('readerModeFontSize', next);
  }

  private async setBold(bold: boolean): Promise<void> {
    this._bold = bold;
    this._root?.classList.toggle('reader-bold', bold);

    await this.persist('readerModeBold', bold);
  }

  private async setWidth(width: number): Promise<void> {
    this._width = width;
    this._root?.style.setProperty('--reader-width', `${width}em`);

    await this.persist('readerModeWidth', width);
  }

  private async setLineHeight(lineHeight: number): Promise<void> {
    this._lineHeight = lineHeight;
    this._root?.style.setProperty('--reader-line-height', `${lineHeight}`);

    await this.persist('readerModeLineHeight', lineHeight);
  }

  private async persist<K extends ReaderConfigKey>(
    key: K,
    value: ConfigurationSchema[K],
  ): Promise<void> {
    // Reader preferences only need to be written; a ConfigurationUpdatedCommand broadcast cannot be
    // sent from a content script (it queries chrome.tabs, which is unavailable here) and no other
    // context needs live notification of these.
    await setConfiguration(key, value);
  }

  private escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
