import { createElement } from '@shared/dom/create-element';
import { READER_THEMES } from '@shared/reader-mode/themes';

const observedAttributes = ['value', 'name'] as const;

export class HTMLReaderThemeInputElement extends HTMLElement {
  public static observedAttributes = observedAttributes;

  private _swatches: Record<string, HTMLButtonElement> = {};

  public get value(): string {
    return this.getAttribute('value') ?? '';
  }
  public set value(value: string) {
    this.setAttribute('value', value);
  }

  public get name(): string {
    return this.getAttribute('name') ?? '';
  }
  public set name(value: string) {
    this.setAttribute('name', value);
  }

  public connectedCallback(): void {
    this.render();
  }

  public attributeChangedCallback(name: string): void {
    if (name === 'value') {
      this.updateActive();
    }
  }

  private render(): void {
    if (Object.keys(this._swatches).length) {
      this.updateActive();

      return;
    }

    const container = createElement('div', {
      class: ['reader-theme-swatches'],
      children: READER_THEMES.map((theme) => {
        const swatch = createElement('button', {
          class: ['reader-theme-swatch'],
          attributes: { type: 'button', title: theme.label, 'data-theme': theme.id },
          style: { backgroundColor: theme.bg, borderColor: theme.fg },
          handler: () => this.select(theme.id),
        });

        this._swatches[theme.id] = swatch;

        return swatch;
      }),
    });

    this.appendChild(container);
    this.updateActive();
  }

  private select(theme: string): void {
    if (this.value === theme) {
      return;
    }

    this.value = theme;
    this.dispatchEvent(new Event('change'));
  }

  private updateActive(): void {
    for (const [id, swatch] of Object.entries(this._swatches)) {
      swatch.classList.toggle('active', id === this.value);
    }
  }
}
