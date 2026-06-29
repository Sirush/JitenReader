import { isTextItem, TextContent } from './pdfjs';

// Reconstruct readable paragraphs from a page's text-content items. pdfjs returns text in small runs
// carrying a transform matrix (e=transform[4], f=transform[5]) but no notion of sentences. Japanese
// has no inter-word spaces, so soft line wraps must join with no separator; only a noticeably larger
// vertical gap between baselines is treated as a paragraph break. Latin runs keep pdfjs' synthetic
// space items, so spacing there survives.
export const reconstructParagraphs = (content: TextContent): string[] => {
  const paragraphs: string[] = [];
  let current = '';
  let lastY: number | null = null;
  let lastHeight = 0;

  const flush = (): void => {
    if (current.trim()) {
      paragraphs.push(current);
    }

    current = '';
  };

  for (const item of content.items) {
    if (!isTextItem(item)) {
      continue;
    }

    const y = Number(item.transform[5]);
    const height = item.height || lastHeight || 12;

    if (lastY !== null && lastY - y > height * 1.6) {
      flush();
    }

    current += item.str;
    lastY = y;
    lastHeight = height;
  }

  flush();

  return paragraphs;
};
