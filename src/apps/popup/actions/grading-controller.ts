import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCard, JitenRating } from '@shared/jiten/types';
import { GradeCardCommand } from '@shared/messages/background/grade-card.command';
import { BaseController } from './base-controller';

export class GradingController extends BaseController {
  private _disableReviews: boolean;
  private _showActions: boolean;
  private _useTwoPointGrading: boolean;

  public get gradingEnabled(): boolean {
    return !this._disableReviews;
  }

  public get showActions(): boolean {
    return this._showActions && this.gradingEnabled;
  }

  public getGradingActions(): JitenRating[] {
    return this._useTwoPointGrading ? ['again', 'good'] : ['again', 'hard', 'good', 'easy'];
  }

  public gradeCard(card: JitenCard, rating: JitenRating): void {
    if (!this.gradingEnabled || !this.getGradingActions().includes(rating)) {
      return;
    }

    const { wordId, readingIndex } = card;

    new GradeCardCommand(wordId, readingIndex, rating).send(() => this.updateCardState(card));
  }

  protected async applyConfiguration(): Promise<void> {
    this._useTwoPointGrading = await getConfiguration('jitenUseTwoGrades');
    this._disableReviews = await getConfiguration('jitenDisableReviews');
    this._showActions = await getConfiguration('showGradingActions');
  }
}
