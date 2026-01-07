import { Paragraph } from '../../../batches/types';

export const getMokuroParagraphs = (page: HTMLElement): Paragraph[] => {
  return [...page.querySelectorAll('.textBox')].map((box) => {
    const fragments: Paragraph = [];
    let offset = 0;

    const p = box.querySelector('p');

    if (!p) {
      return fragments;
    }

    for (const child of p.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE) {
        continue;
      }

      const text = child as Text;

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
