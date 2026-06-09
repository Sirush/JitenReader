import { JitenBatchReviewResult } from '../../jiten/api.types';
import { BatchReviewItem } from '../../jiten/types';
import { BackgroundCommand } from '../lib/background-command';

export class BatchReviewCommand extends BackgroundCommand<
  [items: BatchReviewItem[]],
  JitenBatchReviewResult
> {
  public readonly key = 'batchReview';
}
