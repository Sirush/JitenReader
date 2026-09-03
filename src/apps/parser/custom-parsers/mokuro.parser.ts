import { JitenToken } from '@shared/jiten/types';
import { applyTokens } from '../../batches/apply-tokens';
import { Fragment } from '../../batches/types';
import { Registry } from '../../integration/registry';
import { AutomaticParser } from '../automatic.parser';
import { getMokuroParagraphs } from './mokuro/get-mokuro-paragraphs';

// Mokuro aligns each OCR line by measuring where it lands and writing target-minus-actual to a
// transform, but only recomputes on mouseenter, touchstart or fonts-ready. Rewrapping the text moves
// the lines without triggering any of those, leaving every line offset until the box is hovered, so
// re-run the same computation ourselves. offsetLeft/offsetTop ignore transforms, so the stale one
// does not need clearing first; reads are batched ahead of writes to avoid thrashing layout.
const repositionOcrLines = (box: Element): void => {
  const lines = [...box.querySelectorAll<HTMLElement>('.positionedLine')];

  if (!lines.length || lines[0].offsetParent === null) {
    return;
  }

  const offsets = lines.map((line) => [line.offsetLeft, line.offsetTop]);

  lines.forEach((line, index) => {
    const targetLeft = Number(line.dataset.targetLeft);
    const targetTop = Number(line.dataset.targetTop);

    if (!Number.isFinite(targetLeft) || !Number.isFinite(targetTop)) {
      return;
    }

    const [left, top] = offsets[index];

    line.style.transform = `translate(${targetLeft - left}px, ${targetTop - top}px)`;
  });
};

const repositionRoot = (root: Element): void =>
  root.querySelectorAll('.textBox').forEach(repositionOcrLines);

// The word stylesheet and the generated word styles both load asynchronously, so the first frame
// after a box is filled can still be measuring pre-style layout. Mokuro hedges the same way, running
// its own pass again once fonts settle.
const scheduleReposition = (root: Element): void => {
  const run = (): void => repositionRoot(root);

  requestAnimationFrame(run);
  void document.fonts?.ready.then(() => requestAnimationFrame(run));
};

const mokuroApplyTokens = (fragments: Fragment[], tokens: JitenToken[]): void => {
  // Resolve the boxes first - applying the tokens replaces the fragment text nodes.
  const boxes = new Set<Element>();

  for (const fragment of fragments) {
    const box = fragment.node.parentElement?.closest('.textBox');

    if (box) {
      boxes.add(box);
    }
  }

  applyTokens(fragments, tokens);

  requestAnimationFrame(() => boxes.forEach(repositionOcrLines));
};

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
      // The observer fires half a viewport early, so a page can be parsed while its boxes are still
      // unrendered - where measuring is impossible and repositioning after applying tokens bails.
      // Run it again now the root is actually on screen.
      scheduleReposition(root);
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
      applyFn: mokuroApplyTokens,
      // applyFn runs per textBox mid-sequence; this fires once the whole root is finished.
      onComplete: () => scheduleReposition(root),
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

        // Mokuro wraps every OCR line in its own element carrying the font-size and transform that
        // fit that line to the box. Replacing it with a bare text node merges the lines into one run
        // and lets them inherit the larger textBox font, which overflows the box. Keep the wrapper
        // and reduce it to a single furigana-free text node instead.
        if (child instanceof Element) {
          const clone = child.cloneNode(true) as Element;

          clone.querySelectorAll('rt, rp').forEach((el) => el.remove());

          const textContent = clone.textContent || '';

          if (textContent) {
            child.replaceChildren(document.createTextNode(textContent));
            newChildren.push(child);
          }

          continue;
        }

        const textContent = child.textContent || '';

        if (textContent) {
          newChildren.push(document.createTextNode(textContent));
        }
      }

      p.replaceChildren(...newChildren);
    });
  }
}
