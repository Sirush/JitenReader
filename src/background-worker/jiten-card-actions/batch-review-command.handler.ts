import { MessageSender } from '@shared/extension/types';
import { JitenBatchReviewResult } from '@shared/jiten/api.types';
import { batchReview } from '@shared/jiten/batch-review';
import { getCardStates } from '@shared/jiten/get-card-state';
import { BatchReviewItem } from '@shared/jiten/types';
import { BatchReviewCommand } from '@shared/messages/background/batch-review.command';
import { CardStateUpdatedCommand } from '@shared/messages/broadcast/card-state-updated.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

export class BatchReviewCommandHandler extends BackgroundCommandHandler<BatchReviewCommand> {
  public readonly command = BatchReviewCommand;

  public async handle(
    sender: MessageSender,
    items: BatchReviewItem[],
  ): Promise<JitenBatchReviewResult> {
    const result = await batchReview(items);

    const words: [number, number][] = items.map((item) => [item.wordId, item.readingIndex]);
    const states = await getCardStates(words);

    words.forEach(([wordId, readingIndex], index) => {
      const state = states[index];

      if (state) {
        new CardStateUpdatedCommand(wordId, readingIndex, state.states, state.deckIds).send();
      }
    });

    return result;
  }
}
