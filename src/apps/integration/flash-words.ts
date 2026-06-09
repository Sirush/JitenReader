export type FlashKind = 'good' | 'fail';

const CLASS_BY_KIND: Record<FlashKind, string> = {
  good: 'jiten-flash-good',
  fail: 'jiten-flash-fail',
};

/**
 * Briefly flashes a set of word elements to give visual feedback that they were
 * reviewed (green) or auto-failed (red). The class is removed once the animation
 * ends so it can be re-triggered later.
 */
export function flashElements(elements: Iterable<Element>, kind: FlashKind): void {
  const cls = CLASS_BY_KIND[kind];
  const list = [...elements];

  for (const element of list) {
    element.classList.remove(cls);
  }

  // Force a single reflow so re-adding the class restarts the animation, rather than
  // one forced layout per element.
  void document.body.offsetWidth;

  for (const element of list) {
    element.classList.add(cls);

    const onEnd = (): void => {
      element.classList.remove(cls);
      element.removeEventListener('animationend', onEnd);
    };

    element.addEventListener('animationend', onEnd);
  }
}

export function flashWords(wordId: number, readingIndex: number, kind: FlashKind): void {
  flashElements(
    document.querySelectorAll(`[wordId="${wordId}"][readingIndex="${readingIndex}"]`),
    kind,
  );
}

const PENDING_CLASS = 'jiten-review-pending';

/**
 * Marks the words a pending mass review would affect with a static highlight, so the user
 * can see exactly what will be marked before confirming.
 */
export function setPendingHighlight(elements: Iterable<Element>): void {
  clearPendingHighlight();

  for (const element of elements) {
    element.classList.add(PENDING_CLASS);
  }
}

export function clearPendingHighlight(): void {
  document.querySelectorAll(`.${PENDING_CLASS}`).forEach((element) => {
    element.classList.remove(PENDING_CLASS);
  });
}
