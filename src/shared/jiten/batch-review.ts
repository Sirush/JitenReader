import { JitenBatchReviewResult, JitenRequestOptions } from './api.types';
import { request } from './request';
import { BatchReviewItem, JitenRatingMap } from './types';

export const batchReview = (
  items: BatchReviewItem[],
  options?: JitenRequestOptions,
): Promise<JitenBatchReviewResult> => {
  const reviews = items.map((item) => ({
    wordId: item.wordId,
    readingIndex: item.readingIndex,
    rating: JitenRatingMap[item.rating],
  }));

  return request('srs/batch-review', { reviews }, options);
};
