import { createElement } from '@shared/dom/create-element';
import { findElement } from '@shared/dom/find-element';

const CONTAINER_ID = 'ajb-overlay-container';
const Z_INDEX = '2147483647';

function getOverlayRoot(): ShadowRoot {
  const existing = findElement<'div'>(`#${CONTAINER_ID}`)?.shadowRoot;

  if (existing) {
    return existing;
  }

  const host = createElement('div', { id: CONTAINER_ID, style: { all: 'initial' } });
  const root = host.attachShadow({ mode: 'open' });

  document.body.appendChild(host);

  return root;
}

let activeMessage: { element: HTMLElement; timer: ReturnType<typeof setTimeout> } | undefined;

/**
 * Shows a centred, translucent, auto-dismissing message. Used for the
 * "press again to review" confirmation hint.
 */
export function showTransientMessage(text: string, durationMs = 1600): void {
  const root = getOverlayRoot();

  if (activeMessage) {
    clearTimeout(activeMessage.timer);
    activeMessage.element.remove();
    activeMessage = undefined;
  }

  const element = createElement('div', {
    innerText: text,
    style: {
      position: 'fixed',
      top: '20%',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '80vw',
      padding: '10px 18px',
      borderRadius: '8px',
      background: 'rgba(0, 0, 0, 0.82)',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontSize: '15px',
      textAlign: 'center',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.2s ease',
      zIndex: Z_INDEX,
    },
  });

  root.appendChild(element);
  requestAnimationFrame(() => (element.style.opacity = '1'));

  const timer = setTimeout(() => {
    element.style.opacity = '0';
    setTimeout(() => element.remove(), 250);
    activeMessage = undefined;
  }, durationMs);

  activeMessage = { element, timer };
}

/**
 * Shows a centred Yes/Cancel modal and resolves with the user's choice.
 */
export function showConfirmDialog(
  text: string,
  confirmLabel = 'Review',
  cancelLabel = 'Cancel',
): Promise<boolean> {
  return new Promise((resolve) => {
    const root = getOverlayRoot();
    let settled = false;

    const finish = (result: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.removeEventListener('keydown', onKeydown, true);
      backdrop.remove();
      resolve(result);
    };

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(false);
      }
    };

    const message = createElement('div', {
      innerText: text,
      style: { color: '#ffffff', fontSize: '15px', lineHeight: '1.4', marginBottom: '16px' },
    });

    const cancelButton = createElement('button', {
      innerText: cancelLabel,
      handler: () => finish(false),
      style: {
        padding: '6px 14px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        background: 'transparent',
        color: '#ffffff',
        cursor: 'pointer',
        fontSize: '14px',
      },
    });

    const confirmButton = createElement('button', {
      innerText: confirmLabel,
      handler: () => finish(true),
      style: {
        padding: '6px 14px',
        borderRadius: '6px',
        border: 'none',
        background: '#4caf50',
        color: '#ffffff',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
      },
    });

    const buttons = createElement('div', {
      style: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
      children: [cancelButton, confirmButton],
    });

    const dialog = createElement('div', {
      style: {
        maxWidth: 'min(420px, 86vw)',
        padding: '20px',
        borderRadius: '10px',
        background: '#222222',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        fontFamily: 'sans-serif',
      },
      children: [message, buttons],
    });

    const backdrop = createElement('div', {
      handler: (event) => {
        if (event?.target === backdrop) {
          finish(false);
        }
      },
      style: {
        position: 'fixed',
        inset: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        zIndex: Z_INDEX,
      },
      children: [dialog],
    });

    root.appendChild(backdrop);
    window.addEventListener('keydown', onKeydown, true);
  });
}
