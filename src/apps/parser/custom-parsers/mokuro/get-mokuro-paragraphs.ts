import { Paragraph } from '../../../batches/types';

const collectTextNodes = (p: HTMLParagraphElement): Text[] =>
  [...p.childNodes].flatMap((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return [child as Text];
    }

    if (child instanceof Element) {
      return [...child.childNodes].filter((n): n is Text => n.nodeType === Node.TEXT_NODE);
    }

    return [];
  });

export const getMokuroParagraphs = (page: HTMLElement): Paragraph[] => {
  return [...page.querySelectorAll('.textBox')].map((box) => {
    const fragments: Paragraph = [];
    let offset = 0;

    const p = box.querySelector('p');

    if (!p) {
      return fragments;
    }

    // Each child is either a text node or one of Mokuro's per-line wrappers, which the parser
    // reduces to a single text node while keeping the element for its sizing and positioning.
    for (const text of collectTextNodes(p)) {
      if (!text.data?.length) {
        continue;
      }

      text.data = text.data
        .replaceAll('．．．', '…')
        .replaceAll('．．', '…')
        .replaceAll('！！', '‼')
        .replaceAll('！？', '⁉');

      const start = offset;
      const length = text.length;
      const end = (offset += length);

      fragments.push({
        node: text,
        start,
        end,
        length,
        hasRuby: false,
      });
    }

    return fragments;
  });
};
