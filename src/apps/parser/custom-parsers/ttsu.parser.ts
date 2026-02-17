import { JitenToken } from '@shared/jiten/types';
import { Fragment } from '../../batches/types';
import { Registry } from '../../integration/registry';
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

export class TtsuParser extends AutomaticParser {
  protected _pageObserver?: MutationObserver;
  protected _chapterObserver?: IntersectionObserver;
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
    style.textContent = [
      '.book-content-container > *:not(.ttu-book-html-wrapper) > *,',
      '.book-content-container > div.ttu-book-html-wrapper > div.ttu-book-body-wrapper > * {',
      '  padding-top: 10px !important;',
      '}',
      '.book-content--writing-vertical-rl .book-content-container > *:not(.ttu-book-html-wrapper) > *,',
      '.book-content--writing-vertical-rl .book-content-container > div.ttu-book-html-wrapper > div.ttu-book-body-wrapper > * {',
      '  padding-top: 0 !important;',
      '  padding-right: 10px !important;',
      '}',
    ].join('\n');

    document.head.appendChild(style);
    window.dispatchEvent(new Event('resize'));
  }
}
