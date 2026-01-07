import { JitenRating } from '../../jiten/types';
import { BackgroundCommand } from '../lib/background-command';

export class GradeCardCommand extends BackgroundCommand<
  [wordId: number, readingIndex: number, rating: JitenRating]
> {
  public readonly key = 'gradeCard';
}
