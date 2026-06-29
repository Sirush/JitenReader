import { getConfiguration } from '@shared/configuration/get-configuration';
import { setConfiguration } from '@shared/configuration/set-configuration';
import { ConfigurationSchema } from '@shared/configuration/types';
import { createElement } from '@shared/dom/create-element';
import { displayToast } from '@shared/dom/display-toast';
import { FetchPdfCommand } from '@shared/messages/background/fetch-pdf.command';
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
import {
  enumerateAllFonts,
  getCommonJapaneseFonts,
  getInstalledFonts,
  isJapaneseFont,
  loadPersistedFonts,
  supportsFontEnumeration,
} from '../reader-mode/get-japanese-fonts';
import { CMAP_URL, loadPdfjs, Pdfjs } from './pdfjs';
import { reconstructParagraphs } from './reconstruct';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

type PdfReaderMode = ConfigurationSchema['pdfReaderMode'];

type ReaderConfigKey =
  | 'readerModeTheme'
  | 'readerModeFont'
  | 'readerModeFontSize'
  | 'readerModeBold'
  | 'readerModeWidth'
  | 'readerModeLineHeight'
  | 'pdfReaderMode';

interface PageEntry {
  number: number;
  section: HTMLElement;
  rendered: boolean;
}

const LOAD_FONTS_VALUE = '__jiten_load_fonts__';

export class PdfReader {
  private readonly _root: HTMLElement;

  private _pdfjs?: Pdfjs;
  private _doc?: PDFDocumentProxy;
  private _pages: PageEntry[] = [];
  private _observer?: IntersectionObserver;
  private _pagesEl?: HTMLElement;
  private _emptyEl?: HTMLElement;
  private _panel?: HTMLElement;
  private _fontSelect?: HTMLSelectElement;
  private _pageLabel?: HTMLElement;

  private _mode: PdfReaderMode = 'reflow';
  private _theme: ReaderTheme = DEFAULT_READER_THEME;
  private _font: string = DEFAULT_READER_FONT;
  private _fontSize: number = READER_FONT_SIZE.default;
  private _bold: boolean = DEFAULT_READER_BOLD;
  private _width: number = READER_WIDTH.default;
  private _lineHeight: number = READER_LINE_HEIGHT.default;

  constructor(root: HTMLElement) {
    this._root = root;
  }

  public async init(): Promise<void> {
    this._mode = await getConfiguration('pdfReaderMode');
    this._theme = await getConfiguration('readerModeTheme');
    this._font = await getConfiguration('readerModeFont');
    this._fontSize = await getConfiguration('readerModeFontSize');
    this._bold = await getConfiguration('readerModeBold');
    this._width = await getConfiguration('readerModeWidth');
    this._lineHeight = await getConfiguration('readerModeLineHeight');

    await loadPersistedFonts();

    this.render();
    this.applyTypography();

    // Allow deep-linking a PDF: views/pdf-reader.html?src=<url> opens it straight away.
    const src = new URLSearchParams(location.search).get('src');

    if (src) {
      void this.openUrl(src);
    }
  }

  public async openFile(file: File): Promise<void> {
    try {
      await this.loadDocument(await file.arrayBuffer());
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      displayToast('error', 'PDF reader', 'Could not open this PDF');
    }
  }

  public async openUrl(url: string): Promise<void> {
    try {
      // A normal page fetch is subject to CORS and most PDF hosts send no Access-Control headers, so
      // the bytes get blocked. The service worker has real host-permission cross-origin access, so it
      // does the fetch (and the 202-retry / %PDF validation) and returns the bytes base64-encoded.
      const result = await new FetchPdfCommand(url).call();

      if (!result.ok) {
        displayToast('error', 'PDF reader', result.error);

        return;
      }

      await this.loadDocument(this.decodeBase64(result.base64));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      displayToast('error', 'PDF reader', 'Could not open a PDF from that URL');
    }
  }

  private decodeBase64(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
  }

  private async loadDocument(data: ArrayBuffer): Promise<void> {
    const pdfjs = await this.ensurePdfjs();

    this.reset();

    this._doc = await pdfjs.getDocument({
      data,
      cMapUrl: CMAP_URL(),
      cMapPacked: true,
      isEvalSupported: false,
    }).promise;

    this.buildPages();
  }

  // #region Shell

  private render(): void {
    this._root.classList.add(`reader-theme-${this._theme}`);
    this._root.classList.toggle('reader-bold', this._bold);

    this._emptyEl = this.buildEmptyState();
    this._pagesEl = createElement('div', { class: ['pdf-pages'] });

    const controls = createElement('div', {
      class: ['reader-controls-anchor'],
      children: [this.buildToolbar(), this.buildPanel()],
    });

    this._root.append(controls, this._emptyEl, this._pagesEl);
    this.updateModeUi();

    this.installDragAndDrop();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._panel?.classList.contains('open')) {
        this.closePanel();
      }
    });
  }

  private buildEmptyState(): HTMLElement {
    const input = createElement('input', {
      class: ['pdf-file-input'],
      attributes: { type: 'file', accept: 'application/pdf' },
    });

    input.addEventListener('change', () => {
      const file = input.files?.[0];

      if (file) {
        void this.openFile(file);
      }
    });

    return createElement('div', {
      class: ['pdf-empty'],
      children: [
        createElement('p', { class: ['pdf-empty-title'], innerText: 'Open a Japanese PDF' }),
        createElement('p', {
          class: ['pdf-empty-hint'],
          innerText: 'Choose a file, drop one anywhere on this page, or paste a URL.',
        }),
        input,
        this.buildUrlRow(),
      ],
    });
  }

  private buildUrlRow(): HTMLElement {
    const urlInput = createElement('input', {
      class: ['pdf-url-input'],
      attributes: { type: 'url', placeholder: 'https://…/document.pdf' },
    });

    const open = (): void => {
      const url = urlInput.value.trim();

      if (url) {
        void this.openUrl(url);
      }
    };

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        open();
      }
    });

    return createElement('div', {
      class: ['pdf-url-row'],
      children: [
        urlInput,
        createElement('button', { class: ['reader-btn'], innerText: 'Open URL', handler: open }),
      ],
    });
  }

  private buildToolbar(): HTMLElement {
    this._pageLabel = createElement('span', { class: ['pdf-page-label'], innerText: '' });

    return createElement('div', {
      class: ['reader-toolbar'],
      children: [
        this._pageLabel,
        createElement('button', {
          class: ['reader-btn'],
          innerText: 'Open',
          attributes: { title: 'Open another PDF' },
          handler: () => this._emptyEl?.querySelector<HTMLInputElement>('.pdf-file-input')?.click(),
        }),
        createElement('button', {
          class: ['reader-btn', 'reader-options-btn'],
          innerText: 'Aa',
          attributes: { title: 'Reading options' },
          handler: () => this.togglePanel(),
        }),
      ],
    });
  }

  private buildPanel(): HTMLElement {
    this._panel = createElement('div', {
      class: ['reader-panel'],
      children: [
        this.buildModeToggle(),
        this.buildThemeSection(),
        this.panelRow('Text size', this.buildSizeStepper(), 'pdf-typography'),
        this.panelRow('Font', this.buildFontSelect(), 'pdf-typography'),
        this.panelRow('Font weight', this.buildWeightSelect(), 'pdf-typography'),
        this.panelRow(
          'Content width',
          this.buildRange(READER_WIDTH, this._width, (v) => void this.setWidth(v)),
          'pdf-typography',
        ),
        this.panelRow(
          'Line spacing',
          this.buildRange(READER_LINE_HEIGHT, this._lineHeight, (v) => void this.setLineHeight(v)),
          'pdf-typography',
        ),
      ],
    });

    return this._panel;
  }

  private buildModeToggle(): HTMLElement {
    const button = (mode: PdfReaderMode, label: string): HTMLElement =>
      createElement('button', {
        class: ['reader-btn', 'pdf-mode-btn', ...(this._mode === mode ? ['active'] : [])],
        innerText: label,
        attributes: { 'data-mode': mode },
        handler: () => void this.setMode(mode),
      });

    return createElement('div', {
      class: ['pdf-mode-toggle'],
      children: [button('reflow', 'Reflow'), button('faithful', 'Faithful')],
    });
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
          handler: () => void this.changeFontSize(-READER_FONT_SIZE.step),
        }),
        createElement('span', { class: ['reader-stepper-label'], innerText: 'A' }),
        createElement('button', {
          class: ['reader-btn'],
          innerText: '+',
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

    for (const option of [
      { value: 'regular', label: 'Regular' },
      { value: 'bold', label: 'Bold' },
    ]) {
      const el = document.createElement('option');

      el.value = option.value;
      el.textContent = option.label;
      select.appendChild(el);
    }

    select.value = this._bold ? 'bold' : 'regular';
    select.onchange = (): void => void this.setBold(select.value === 'bold');

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

  private panelRow(label: string, control: HTMLElement, extraClass?: string): HTMLElement {
    return createElement('div', {
      class: ['reader-panel-row', ...(extraClass ? [extraClass] : [])],
      children: [
        createElement('span', { class: ['reader-panel-label'], innerText: label }),
        control,
      ],
    });
  }

  // #endregion
  // #region Pages

  private buildPages(): void {
    if (!this._doc || !this._pagesEl) {
      return;
    }

    this._emptyEl?.classList.add('hidden');
    this._pagesEl.replaceChildren();
    this._pages = [];

    this._observer = new IntersectionObserver((entries) => this.onIntersect(entries), {
      rootMargin: '600px 0px',
    });

    for (let number = 1; number <= this._doc.numPages; number++) {
      const section = createElement('section', {
        class: ['pdf-page'],
        attributes: { 'data-page': String(number) },
      });

      this._pages.push({ number, section, rendered: false });
      this._pagesEl.appendChild(section);
      this._observer.observe(section);
    }

    this.updatePageLabel(1);
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const number = Number((entry.target as HTMLElement).dataset.page);
      const entryData = this._pages[number - 1];

      if (entry.isIntersecting) {
        this.updatePageLabel(number);

        if (entryData && !entryData.rendered) {
          entryData.rendered = true;
          void this.renderPage(entryData);
        }
      }
    }
  }

  private async renderPage(entry: PageEntry): Promise<void> {
    if (!this._doc) {
      return;
    }

    try {
      const page = await this._doc.getPage(entry.number);

      if (this._mode === 'faithful') {
        await this.renderFaithful(page, entry.section);
      } else {
        await this.renderReflow(page, entry.section);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to render page', entry.number, error);
      entry.rendered = false;
    }
  }

  private async renderReflow(page: PDFPageProxy, section: HTMLElement): Promise<void> {
    const content = await page.getTextContent();
    const paragraphs = reconstructParagraphs(content);

    section.classList.add('pdf-page-reflow');
    section.replaceChildren();

    for (const text of paragraphs) {
      const para = document.createElement('p');

      para.textContent = text;
      section.appendChild(para);
    }

    this.parse(section);
  }

  private async renderFaithful(page: PDFPageProxy, section: HTMLElement): Promise<void> {
    const pdfjs = await this.ensurePdfjs();
    const targetWidth = section.clientWidth || 800;
    const baseWidth = page.getViewport({ scale: 1 }).width;
    const scale = targetWidth / baseWidth;
    const viewport = page.getViewport({ scale });
    const dpr = window.devicePixelRatio || 1;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    context.scale(dpr, dpr);

    section.classList.add('pdf-page-faithful');
    section.replaceChildren();
    section.style.width = `${viewport.width}px`;
    section.style.height = `${viewport.height}px`;

    await page.render({ canvasContext: context, viewport }).promise;

    // The crisp canvas stays the only visible text (so its baked-in furigana survives and there's no
    // misaligned double-text). PDF.js' TextLayer lays a transparent, positioned span over each run
    // purely for selection/parsing; parsed words then get a translucent state-coloured highlight box.
    const textLayer = createElement('div', { class: ['pdf-text-layer', 'textLayer'] });

    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;
    section.append(canvas, textLayer);

    const content = await page.getTextContent();

    await new pdfjs.TextLayer({
      textContentSource: content,
      container: textLayer,
      viewport,
    }).render();

    this.parse(textLayer);
  }

  private parse(node: HTMLElement): void {
    Registry.batchController.registerNode(node);
    Registry.batchController.parseBatches();
  }

  private updatePageLabel(current: number): void {
    if (this._pageLabel && this._doc) {
      this._pageLabel.innerText = `${current} / ${this._doc.numPages}`;
    }
  }

  private reset(): void {
    this._observer?.disconnect();
    this._observer = undefined;

    for (const entry of this._pages) {
      Registry.batchController.dismissNode(entry.section);
    }

    this._pages = [];

    if (this._pagesEl) {
      this._pagesEl.replaceChildren();
    }

    void this._doc?.destroy();
    this._doc = undefined;
  }

  // #endregion
  // #region Options

  private togglePanel(): void {
    if (this._panel?.classList.contains('open')) {
      this.closePanel();
    } else {
      this._panel?.classList.add('open');
    }
  }

  private closePanel(): void {
    this._panel?.classList.remove('open');
  }

  private async setMode(mode: PdfReaderMode): Promise<void> {
    if (mode === this._mode) {
      return;
    }

    this._mode = mode;
    this.updateModeUi();

    await this.persist('pdfReaderMode', mode);
    this.rerenderPages();
  }

  private updateModeUi(): void {
    const faithful = this._mode === 'faithful';

    this._root.classList.toggle('pdf-mode-faithful', faithful);
    this._root.classList.toggle('pdf-mode-reflow', !faithful);

    this._panel?.querySelectorAll<HTMLElement>('.pdf-mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === this._mode);
    });
  }

  private rerenderPages(): void {
    for (const entry of this._pages) {
      Registry.batchController.dismissNode(entry.section);
      entry.rendered = false;
      entry.section.replaceChildren();
      entry.section.removeAttribute('style');
      entry.section.classList.remove('pdf-page-reflow', 'pdf-page-faithful');
    }

    // Re-trigger rendering for whatever is currently on screen.
    for (const entry of this._pages) {
      const rect = entry.section.getBoundingClientRect();

      if (rect.bottom > -600 && rect.top < window.innerHeight + 600 && !entry.rendered) {
        entry.rendered = true;
        void this.renderPage(entry);
      }
    }
  }

  private applyTypography(): void {
    this._root.style.setProperty('--reader-font-family', resolveReaderFont(this._font));
    this._root.style.setProperty('--reader-font-size', `${this._fontSize}px`);
    this._root.style.setProperty('--reader-width', `${this._width}em`);
    this._root.style.setProperty('--reader-line-height', `${this._lineHeight}`);
    this._root.classList.toggle('reader-bold', this._bold);
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

    select.replaceChildren();

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
      addGroup('Japanese fonts', toEntries(all.filter(isJapaneseFont)));
      addGroup('Other fonts', toEntries(all.filter((f) => !isJapaneseFont(f))), false);
    } else {
      addGroup('Japanese fonts', toEntries(getCommonJapaneseFonts()));
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

  private async setTheme(theme: ReaderTheme): Promise<void> {
    if (theme === this._theme) {
      return;
    }

    this._root.classList.remove(`reader-theme-${this._theme}`);
    this._theme = theme;
    this._root.classList.add(`reader-theme-${theme}`);

    this._panel?.querySelectorAll<HTMLElement>('.reader-theme-option').forEach((option) => {
      option.classList.toggle('active', option.getAttribute('data-theme') === theme);
    });

    await this.persist('readerModeTheme', theme);
  }

  private async setFont(value: string): Promise<void> {
    this._font = value;
    this._root.style.setProperty('--reader-font-family', resolveReaderFont(value));

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
    this._root.style.setProperty('--reader-font-size', `${next}px`);

    await this.persist('readerModeFontSize', next);
  }

  private async setBold(bold: boolean): Promise<void> {
    this._bold = bold;
    this._root.classList.toggle('reader-bold', bold);

    await this.persist('readerModeBold', bold);
  }

  private async setWidth(width: number): Promise<void> {
    this._width = width;
    this._root.style.setProperty('--reader-width', `${width}em`);

    await this.persist('readerModeWidth', width);
  }

  private async setLineHeight(lineHeight: number): Promise<void> {
    this._lineHeight = lineHeight;
    this._root.style.setProperty('--reader-line-height', `${lineHeight}`);

    await this.persist('readerModeLineHeight', lineHeight);
  }

  private async persist<K extends ReaderConfigKey>(
    key: K,
    value: ConfigurationSchema[K],
  ): Promise<void> {
    await setConfiguration(key, value);
  }

  // #endregion

  private installDragAndDrop(): void {
    const prevent = (e: DragEvent): void => {
      e.preventDefault();
      e.stopPropagation();
    };

    this._root.addEventListener('dragover', (e) => {
      prevent(e);
      this._root.classList.add('pdf-drag-over');
    });

    this._root.addEventListener('dragleave', (e) => {
      prevent(e);
      this._root.classList.remove('pdf-drag-over');
    });

    this._root.addEventListener('drop', (e) => {
      prevent(e);
      this._root.classList.remove('pdf-drag-over');

      const file = Array.from(e.dataTransfer?.files ?? []).find(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );

      if (file) {
        void this.openFile(file);
      }
    });
  }

  private async ensurePdfjs(): Promise<Pdfjs> {
    if (!this._pdfjs) {
      this._pdfjs = await loadPdfjs();
    }

    return this._pdfjs;
  }
}
