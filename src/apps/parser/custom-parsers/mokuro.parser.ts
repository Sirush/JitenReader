import { Registry } from '../../integration/registry';
import { AutomaticParser } from '../automatic.parser';
import { getMokuroParagraphs } from './mokuro/get-mokuro-paragraphs';

export class MokuroParser extends AutomaticParser {
  private _trackedRoots = new Set<HTMLElement>();
  private _visibleRoots = new Set<HTMLElement>();
  private _rootObserver: IntersectionObserver;
  private _debounceTimeout: ReturnType<typeof setTimeout> | undefined;

  public override destroy(): void {
    clearTimeout(this._debounceTimeout);
    this._rootObserver?.disconnect();
    this._trackedRoots.forEach((root) => Registry.batchController.dismissNode(root));
    this._trackedRoots.clear();
    this._visibleRoots.clear();
    super.destroy();
  }

  protected override init(): void {
    Registry.sentenceManager.disable();

    this._rootObserver = new IntersectionObserver((entries) => this.onIntersection(entries), {
      rootMargin: '50% 50% 50% 50%',
    });

    const onPageChange = (): void => this.scheduleRescan();

    document.addEventListener('mokuro-reader:page.change', onPageChange);
    this._disposers.push(() =>
      document.removeEventListener('mokuro-reader:page.change', onPageChange),
    );

    this.rescan();
  }

  private scheduleRescan(): void {
    clearTimeout(this._debounceTimeout);
    this._debounceTimeout = setTimeout(() => {
      this._debounceTimeout = undefined;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!this._destroyed) {
            this.rescan();
          }
        });
      });
    }, 300);
  }

  private rescan(): void {
    const currentRoots = this.discoverPageRoots();
    let needsParse = false;

    for (const root of this._trackedRoots) {
      if (!currentRoots.has(root) || !root.isConnected) {
        Registry.batchController.dismissNode(root);
        this._rootObserver.unobserve(root);
        this._trackedRoots.delete(root);
        this._visibleRoots.delete(root);
      }
    }

    for (const root of currentRoots) {
      if (this._trackedRoots.has(root)) {
        // Content was replaced by Mokuro — re-parse
        if (this._visibleRoots.has(root) && !root.querySelector('.jiten-word')) {
          Registry.batchController.dismissNode(root);
          this.prepareRoot(root);
          needsParse = true;
        }

        continue;
      }

      this._trackedRoots.add(root);
      this._rootObserver.observe(root);
    }

    if (needsParse) {
      Registry.batchController.parseBatches();
    }
  }

  private onIntersection(entries: IntersectionObserverEntry[]): void {
    let needsParse = false;

    for (const entry of entries) {
      const root = entry.target as HTMLElement;

      if (!entry.isIntersecting) {
        this._visibleRoots.delete(root);
        Registry.batchController.dismissNode(root);

        continue;
      }

      this._visibleRoots.add(root);
      this.prepareRoot(root);
      needsParse = true;
    }

    if (needsParse) {
      Registry.batchController.parseBatches();
    }
  }

  private discoverPageRoots(): Set<HTMLElement> {
    const roots = new Set<HTMLElement>();

    document.querySelectorAll('.textBox').forEach((box) => {
      if (box.parentElement) {
        roots.add(box.parentElement);
      }
    });

    return roots;
  }

  private prepareRoot(root: HTMLElement): void {
    this.cleanupTextBoxes(root);
    this.installAppStyles();

    Registry.batchController.registerNode(root, {
      getParagraphsFn: getMokuroParagraphs,
    });
  }

  private cleanupTextBoxes(root: HTMLElement): void {
    root.querySelectorAll('.textBox p').forEach((p) => {
      const newChildren: Node[] = [];

      for (const child of [...p.childNodes]) {
        if (child instanceof HTMLBRElement) {
          newChildren.push(child.cloneNode());

          continue;
        }

        if (child instanceof Text) {
          newChildren.push(child);

          continue;
        }

        let textContent = '';

        if (child instanceof Element) {
          const clone = child.cloneNode(true) as Element;

          clone.querySelectorAll('rt, rp').forEach((el) => el.remove());
          textContent = clone.textContent || '';
        } else {
          textContent = child.textContent || '';
        }

        if (textContent) {
          newChildren.push(document.createTextNode(textContent));
        }
      }

      p.replaceChildren(...newChildren);
    });
  }
}
