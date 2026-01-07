import { createElement } from '@shared/dom/create-element';

export interface ConfirmDialogOptions {
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmClass?: string;
}

export class ConfirmDialog {
  private _overlay: HTMLDivElement | null = null;
  private _resolvePromise?: (confirmed: boolean) => void;

  constructor(
    private _shadowRoot: ShadowRoot,
    private _getPopupPosition: () => { x: number; y: number },
  ) {}

  public get isOpen(): boolean {
    return this._overlay !== null;
  }

  public show(options: ConfirmDialogOptions): Promise<boolean> {
    const {
      message,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      confirmClass = 'forget',
    } = options;

    this._overlay = this.createOverlay();
    const dialog = this.createDialog(message, confirmText, cancelText, confirmClass);
    this._overlay.appendChild(dialog);
    this._shadowRoot.appendChild(this._overlay);

    return new Promise<boolean>((resolve) => {
      this._resolvePromise = resolve;
    });
  }

  private createOverlay(): HTMLDivElement {
    const { x, y } = this._getPopupPosition();
    const overlay = createElement('div', {
      id: 'confirm-overlay',
      handler: () => this.close(false),
    });
    overlay.style.transform = `translate(${-x}px, ${-y}px)`;
    return overlay;
  }

  private createDialog(
    message: string,
    confirmText: string,
    cancelText: string,
    confirmClass: string,
  ): HTMLDivElement {
    return createElement('div', {
      id: 'confirm-dialog',
      events: {
        onclick: (e: Event) => e.stopPropagation(),
      },
      children: [
        createElement('p', {
          id: 'confirm-message',
          innerText: message,
        }),
        createElement('div', {
          id: 'confirm-buttons',
          children: [
            createElement('a', {
              class: ['outline'],
              innerText: cancelText,
              handler: () => this.close(false),
            }),
            createElement('a', {
              class: ['outline', confirmClass],
              innerText: confirmText,
              handler: () => this.close(true),
            }),
          ],
        }),
      ],
    });
  }

  private close(confirmed: boolean): void {
    this._overlay?.remove();
    this._overlay = null;
    this._resolvePromise?.(confirmed);
  }
}
