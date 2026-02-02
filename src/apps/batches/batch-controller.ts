import { displayToast } from '@shared/dom/display-toast';
import { JitenToken } from '@shared/jiten/types';
import { ParseCommand } from '@shared/messages/background/parse.command';
import { Registry } from '../integration/registry';
import { Canceled } from '../sequence/canceled';
import { AbortableSequence } from '../sequence/types';
import { applyTokens } from './apply-tokens';
import { getParagraphs } from './get-paragraphs';
import { Paragraph, RegisterOptions } from './types';

export class BatchController {
  private _pendingBatches = new Map<Node, AbortableSequence<JitenToken[], Paragraph>[]>();

  public registerNodes(nodes: (Element | Node)[], options: RegisterOptions = {}): void {
    nodes.forEach((node) => this.registerNode(node, options));
  }

  public registerNode(node: Element | Node, options: RegisterOptions = {}): void {
    const {
      filter,
      onEmpty,
      getParagraphsFn = getParagraphs,
      applyFn = applyTokens,
      collapseWhitespace,
    } = options;

    if (this._pendingBatches.has(node)) {
      return;
    }

    const paragraphs = getParagraphsFn(node, filter, collapseWhitespace);

    if (!paragraphs.length) {
      return onEmpty?.(node);
    }

    this.prepareNode(node, paragraphs, applyFn);
  }

  public dismissNode(node: Node): void {
    this._pendingBatches.get(node)?.forEach((batch) => batch.abort());
    this._pendingBatches.delete(node);
  }

  public abortAll(): void {
    this._pendingBatches.forEach((batches) => batches.forEach((batch) => batch.abort()));
    this._pendingBatches.clear();
  }

  public parseBatches(afterSend?: () => void): void {
    const batches = Array.from(this._pendingBatches.values());
    const sequences = batches.flatMap((b) => b);
    const sequenceData = sequences.map(
      (s) => [s.sequenceId, s.data.map((f) => f.node.data).join('')] as [number, string],
    );

    new ParseCommand(sequenceData).send(afterSend);

    this._pendingBatches.clear();
  }

  private prepareNode(
    node: Element | Node,
    paragraphs: Paragraph[],
    applyFn: typeof applyTokens,
  ): void {
    const batches = paragraphs.map((paragraph) =>
      Registry.sequenceManager.getAbortableSequence<JitenToken[], Paragraph>(paragraph),
    );

    this._pendingBatches.set(node, batches);
    this.prepareBatches(node, applyFn);
  }

  private prepareBatches(node: HTMLElement | Node, applyFn: typeof applyTokens): void {
    const batches = this._pendingBatches.get(node)!;

    // Process paragraphs sequentially to prevent parallel DOM flooding
    void batches.reduce(
      (previousPromise, batch) =>
        previousPromise.then(async () => {
          try {
            const value = await batch.promise;

            applyFn(batch.data, value);
          } catch (error) {
            if (error instanceof Canceled) {
              return;
            }

            if ((error as Error).message === 'Failed to fetch') {
              displayToast('error', 'api.jiten.moe is unreachable', (error as Error).message);

              return;
            }

            // eslint-disable-next-line no-console
            console.error(error);

            displayToast(
              'error',
              'An error occurred while parsing the text',
              (error as Error).message,
            );
          }
        }),
      Promise.resolve(),
    );
  }
}
