import { JitenToken } from '@shared/jiten/types';
import { Fragment, Paragraph } from '../../batches/types';
import { Registry } from '../../integration/registry';
import { TtsuParagraphReader } from '../../paragraph-reader/ttsu.paragraph-reader';
import { AutomaticParser } from '../automatic.parser';
import { TtsuTextHighlighter } from './ttsu-text-highlighter';

let statsUpdateTimeout: number | undefined;

const ttsuApplyTokens = (fragments: Fragment[], tokens: JitenToken[]): void => {
  new TtsuTextHighlighter(fragments, tokens).apply();

  if (statsUpdateTimeout) {
    clearTimeout(statsUpdateTimeout);
  }
  statsUpdateTimeout = window.setTimeout(() => {
    Registry.statusBar?.recalculateStats();
    statsUpdateTimeout = undefined;
  }, 100);
};

const getTtsuParagraphs = (
  node: Element | Node,
  filter?: (node: Element | Node) => boolean,
  collapseWhitespace?: boolean,
): Paragraph[] => {
  return new TtsuParagraphReader(node, filter, collapseWhitespace).read();
};

export class TtsuParser extends AutomaticParser {
  protected _pageObserver?: MutationObserver;
  protected _chapterObserver?: IntersectionObserver;

  private static readonly MIN_FURIGANA_LINE_HEIGHT = 1.65;
  private _hasReservedFuriganaSpace = false;

  public override destroy(): void {
    this._pageObserver?.disconnect();
    this._chapterObserver?.disconnect();
    super.destroy();
  }

  protected setupVisibleObserver(): void {
    this._visibleObserver = this.getParseVisibleObserver();
  }

  protected visibleObserverOnEnter(elements: HTMLElement[]): void {
    const [element] = elements;
    const container = element.querySelector('.book-content-container');
    const chapters = element.querySelectorAll('[id^="ttu');

    if (container) {
      this._pageObserver = new MutationObserver(() => {
        Registry.sentenceManager.reset();

        this.parseNode(container);
      });

      this._pageObserver.observe(container, {
        attributes: true,
        attributeFilter: ['id'],
      });

      return;
    }

    this.setupChapterObservers(chapters);
  }

  protected visibleObserverOnExit(): void {
    this._pageObserver?.disconnect();
    this._chapterObserver?.disconnect();
  }

  protected override parseNodes(
    nodes: (Node | Element)[],
    filter?: (node: Node | Element) => boolean,
  ): void {
    if (this._destroyed) {
      return;
    }

    this.installAppStyles();
    this.reserveFuriganaSpace();

    const { batchController } = Registry;

    batchController.registerNodes(nodes, {
      filter,
      collapseWhitespace: this._meta.collapseWhitespace,
      getParagraphsFn: getTtsuParagraphs,
      applyFn: ttsuApplyTokens,
      onComplete: () => window.dispatchEvent(new Event('resize')),
    });
    batchController.parseBatches();
  }

  protected setupChapterObservers(chapters: NodeListOf<Element>): void {
    this._chapterObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          this.parseNode(entry.target);

          continue;
        }

        Registry.batchController.dismissNode(entry.target);
      }
    });

    for (const chapter of chapters) {
      this._chapterObserver.observe(chapter);
    }
  }

  private reserveFuriganaSpace(): void {
    if (this._hasReservedFuriganaSpace || Registry.textHighlighterOptions.skipFurigana) {
      return;
    }

    this._hasReservedFuriganaSpace = true;

    const style = document.createElement('style');

    style.setAttribute('data-jiten-style', 'ttsu-furigana-reservation');
    // Reserve room for the absolutely-positioned furigana on the block-start side. Logical so it
    // adapts to vertical writing mode, and in em so it scales with the reader font (a fixed px
    // reserve overflowed into the previous line once the user enlarged the text). When the book's
    // line-height is too tight to hold furigana between lines/columns, floor it (only ever raising
    // it, so loosely-set books keep their exact spacing) - one consistent reflow, not a live shift.
    const rules = [
      '.book-content-container > *:not(.ttu-book-html-wrapper) > *,',
      '.book-content-container > div.ttu-book-html-wrapper > div.ttu-book-body-wrapper > * {',
      '  padding-block-start: 0.85em !important;',
    ];

    if (this.needsLineHeightFloor()) {
      rules.push(`  line-height: ${TtsuParser.MIN_FURIGANA_LINE_HEIGHT} !important;`);
    }

    rules.push('}');
    style.textContent = rules.join('\n');

    document.head.appendChild(style);
    window.dispatchEvent(new Event('resize'));
  }

  private needsLineHeightFloor(): boolean {
    const sample = document.querySelector('.book-content-container');

    if (!sample) {
      return true;
    }

    const { lineHeight, fontSize } = getComputedStyle(sample);
    const resolvedLineHeight = parseFloat(lineHeight);
    const resolvedFontSize = parseFloat(fontSize);

    if (Number.isNaN(resolvedLineHeight) || !resolvedFontSize) {
      return true;
    }

    return resolvedLineHeight / resolvedFontSize < TtsuParser.MIN_FURIGANA_LINE_HEIGHT;
  }
}
