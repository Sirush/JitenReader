import { Paragraph } from '../../../batches/types';

export const getManatanMangaParagraphs = (node: Element | Node): Paragraph[] => {
  const el = node as HTMLElement;
  const boxes = el.classList?.contains('gemini-ocr-text-box')
    ? [el]
    : [...el.querySelectorAll<HTMLElement>('.gemini-ocr-text-box')];

  return boxes
    .filter((box) => !box.hasAttribute('data-jiten-parsed'))
    .map((box) => {
      const textNode = [...box.childNodes].find((n) => n.nodeType === Node.TEXT_NODE) as Text;

      if (!textNode?.data?.length) {
        return [];
      }

      return [
        {
          node: textNode,
          start: 0,
          end: textNode.length,
          length: textNode.length,
          hasRuby: false,
        },
      ];
    })
    .filter((p) => p.length > 0);
};
