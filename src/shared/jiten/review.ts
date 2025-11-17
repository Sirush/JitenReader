import { JitenRequestOptions } from './api.types';
import { request } from './request';
import { JitenRating, JitenRatingMap } from './types';

export const review = (
  rating: JitenRating,
  wordId: number,
  readingIndex: number,
  options?: JitenRequestOptions,
): Promise<void> => {
  const ratingValue = JitenRatingMap[rating];

  return request('srs/review', { wordId, readingIndex, rating: ratingValue }, options);
};
