import { Registry } from '../../integration/registry';
import { TtsuParser } from './ttsu.parser';

export class YatsuParser extends TtsuParser {
  protected override visibleObserverOnEnter(elements: HTMLElement[]): void {
    const [element] = elements;
    const container = element.querySelector('.book-content-container');
    const chapters = element.querySelectorAll('[id^="ttu"], [id^="section-"]');

    if (container) {
      this._pageObserver = new MutationObserver(() => {
        Registry.sentenceManager.reset();

        this.parseNode(container);
      });

      this._pageObserver.observe(container, {
        attributes: true,
        attributeFilter: ['id'],
      });

      this.parseNode(container);

      return;
    }

    if (chapters.length) {
      this.setupChapterObservers(chapters);

      return;
    }

    this._pageObserver = new MutationObserver(() => {
      if (element.querySelector('.book-content-container')) {
        this._pageObserver?.disconnect();
        this.visibleObserverOnEnter(elements);
      }
    });

    this._pageObserver.observe(element, { childList: true, subtree: true });
  }
}
