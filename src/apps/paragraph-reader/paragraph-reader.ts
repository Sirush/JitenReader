import { DisplayCategory, Fragment, Paragraph } from '../batches/types';
import { BaseParagraphReader } from './base.paragraph-reader';

export class ParagraphReader extends BaseParagraphReader {
  private _styleCache = new WeakMap<Element, CSSStyleDeclaration>();

  public read(): Paragraph[] {
    if (this.collapseWhitespace) {
      this.splitTextNodesAtWhitespace(this.node);
    }

    const fragments: Fragment[] = [];
    const paragraphs: Paragraph[] = [];

    this.recurse(paragraphs, fragments, 0, this.node, false, null, this.filter);

    if (!paragraphs.length && fragments.length) {
      paragraphs.push(fragments);
    }

    return paragraphs;
  }

  protected recurse(
    paragraphs: Paragraph[],
    fragments: Fragment[],
    offset: number,
    node: Element | Node,
    hasRuby: boolean,
    currentRubyElement: Element | null,
    filter?: (node: Element | Node) => boolean,
  ): number {
    if (node instanceof Element && node.hasAttribute('ajb')) {
      return offset;
    }

    const display = this.displayCategory(node);
    const breakIfBlock = (): void => {
      if (display === 'block') {
        offset = this.breakParagraph(paragraphs, fragments);

        fragments = [];
      }
    };

    breakIfBlock();

    if (display === 'none' || display === 'ruby-text' || filter?.(node) === false) {
      return offset;
    }

    if (display === 'text') {
      return this.pushText(
        fragments,
        offset,
        node as Text | CDATASection,
        hasRuby,
        currentRubyElement,
      );
    }

    if (display === 'ruby') {
      hasRuby = true;
      currentRubyElement = node as Element;
    }

    for (const child of node.childNodes) {
      offset = this.recurse(
        paragraphs,
        fragments,
        offset,
        child,
        hasRuby,
        currentRubyElement,
        filter,
      );
    }

    if (display === 'block') {
      breakIfBlock();
    }

    return offset;
  }

  protected breakParagraph(paragraphs: Paragraph[], fragments: Fragment[]): number {
    // Remove fragments from the end that are just whitespace
    // (the ones from the start have already been ignored)
    let end = fragments.length - 1;

    for (; end >= 0; end--) {
      if (fragments[end].node.data.trim().length > 0) {
        break;
      }
    }

    const trimmedFragments = fragments.slice(0, end + 1);

    if (trimmedFragments.length) {
      paragraphs.push(trimmedFragments);
    }

    return 0;
  }

  protected pushText(
    fragments: Fragment[],
    offset: number,
    text: Text | CDATASection,
    hasRuby: boolean,
    rubyElement: Element | null,
  ): number {
    if (text.data.length > 0 && !(fragments.length === 0 && text.data.trim().length === 0)) {
      fragments.push({
        start: offset,
        length: text.length,
        end: (offset += text.length),
        node: text,
        hasRuby,
        rubyElement: rubyElement ?? undefined,
      });
    }

    return offset;
  }

  protected displayCategory(node: Element | Node): DisplayCategory {
    if (node instanceof Text || node instanceof CDATASection) {
      return 'text';
    }

    if (node instanceof Element) {
      let style = this._styleCache.get(node);

      if (!style) {
        style = getComputedStyle(node);
        this._styleCache.set(node, style);
      }
      const display = style.display.split(/\s/g);
      const [first] = display;

      if (first === 'none') {
        return 'none';
      }

      if (node.tagName === 'RUBY') {
        return 'ruby';
      }

      if (node.tagName === 'RP') {
        return 'none';
      }

      if (node.tagName === 'RT') {
        return 'ruby-text';
      }

      if (node.tagName === 'RB') {
        return 'inline';
      }

      if (display.some((x) => x.startsWith('block'))) {
        return 'block';
      }

      if (display.some((x) => x.startsWith('inline'))) {
        return 'inline';
      }

      if (first === 'flex') {
        return 'block';
      }

      if (first === '-webkit-box') {
        return 'block';
      } // Old name of flex? Still used on Google Search for some reason.

      if (first === 'grid') {
        return 'block';
      }

      if (first.startsWith('table')) {
        return 'block';
      }

      if (first.startsWith('flow')) {
        return 'block';
      }

      if (first === 'ruby') {
        return 'ruby';
      }

      if (first.startsWith('ruby-text')) {
        return 'ruby-text';
      }

      if (first.startsWith('ruby-base')) {
        return 'inline';
      }

      if (first.startsWith('math')) {
        return 'inline';
      }

      if (display.includes('list-item')) {
        return 'block';
      }

      if (first === 'contents') {
        return 'inline';
      }

      if (first === 'run-in') {
        return 'block';
      }
    }

    return 'none';
  }

  private splitTextNodesAtWhitespace(root: Element | Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    for (const text of textNodes) {
      if (!/[\n\r\t]/.test(text.data)) {
        continue;
      }

      const parent = text.parentNode;

      if (!parent) {
        continue;
      }

      const normalised = text.data.replace(/\r\n/g, '\n').replace(/[\r\t]/g, '');
      const parts = normalised.split('\n');
      const fragment = document.createDocumentFragment();

      parts.forEach((part, i) => {
        if (i > 0) {
          fragment.appendChild(document.createElement('br'));
        }

        if (part.length > 0) {
          fragment.appendChild(document.createTextNode(part));
        }
      });

      parent.replaceChild(fragment, text);
    }
  }
}
