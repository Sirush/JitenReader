/**
 * A word crossing ruby or text-node boundaries is highlighted as multiple sibling
 * elements sharing the same wordId/readingIndex. Collect them all so callers can
 * operate on the full word rather than only the hovered fragment.
 */
export const getAdjacentWordElements = (element: Element): Element[] => {
  const wordId = element.getAttribute('wordId');
  const readingIndex = element.getAttribute('readingIndex');

  if (!wordId) {
    return [element];
  }

  const isSameWord = (candidate: Element): boolean =>
    candidate.getAttribute('wordId') === wordId &&
    candidate.getAttribute('readingIndex') === readingIndex;

  const elements: Element[] = [element];

  let prev = element.previousElementSibling;

  while (prev) {
    if (isSameWord(prev)) {
      elements.unshift(prev);
      prev = prev.previousElementSibling;
    } else if (!prev.hasAttribute('wordId')) {
      prev = prev.previousElementSibling;
    } else {
      break;
    }
  }

  let next = element.nextElementSibling;

  while (next) {
    if (isSameWord(next)) {
      elements.push(next);
      next = next.nextElementSibling;
    } else if (!next.hasAttribute('wordId')) {
      next = next.nextElementSibling;
    } else {
      break;
    }
  }

  return elements;
};

export const getTextWithoutFurigana = (element: Element): string => {
  let text = '';

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node instanceof HTMLElement && node.tagName !== 'RT') {
      text += getTextWithoutFurigana(node);
    }
  }

  return text;
};

// Highlighted words are replaced wholesale on re-parse, so a fragment's surface form never
// changes while the element lives. Cached because this runs on every hover.
const surfaceFormCache = new WeakMap<Element, string>();

export const getWordSurfaceForm = (element: Element): string => {
  const cached = surfaceFormCache.get(element);

  if (cached !== undefined) {
    return cached;
  }

  const surfaceForm = getAdjacentWordElements(element).map(getTextWithoutFurigana).join('');

  surfaceFormCache.set(element, surfaceForm);

  return surfaceForm;
};
