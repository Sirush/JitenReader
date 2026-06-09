import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCard, JitenRating } from '@shared/jiten/types';
import { AddToStudyDeckCommand } from '@shared/messages/background/add-to-study-deck.command';
import { GradeCardCommand } from '@shared/messages/background/grade-card.command';
import { BaseController } from './base-controller';

export class GradingController extends BaseController {
  private _disableReviews: boolean;
  private _showActions: boolean;
  private _useTwoPointGrading: boolean;
  private _autoMineOnReview: boolean;
  private _studyDeckId: string;

  public get gradingEnabled(): boolean {
    return !this._disableReviews;
  }

  public get showActions(): boolean {
    return this._showActions && this.gradingEnabled;
  }

  public getGradingActions(): JitenRating[] {
    return this._useTwoPointGrading ? ['again', 'good'] : ['again', 'hard', 'good', 'easy'];
  }

  public gradeCard(card: JitenCard, rating: JitenRating, sentence?: string, source?: string): void {
    if (!this.gradingEnabled || !this.getGradingActions().includes(rating)) {
      return;
    }

    const { wordId, readingIndex } = card;

    new GradeCardCommand(wordId, readingIndex, rating).send(() => {
      const deckId = this.getAutoMineDeckId(card);

      if (deckId) {
        new AddToStudyDeckCommand(deckId, wordId, readingIndex, sentence, source).send(() =>
          this.updateCardState(card),
        );

        return;
      }

      this.updateCardState(card);
    });
  }

  protected async applyConfiguration(): Promise<void> {
    this._useTwoPointGrading = await getConfiguration('jitenUseTwoGrades');
    this._disableReviews = await getConfiguration('jitenDisableReviews');
    this._showActions = await getConfiguration('showGradingActions');
    this._autoMineOnReview = await getConfiguration('jitenAutoMineOnReview');
    this._studyDeckId = await getConfiguration('jitenStudyDeckId');
  }

  /**
   * Returns the target word list id to mine the reviewed card into, or 0 when auto-mining is off,
   * no target word list is selected, or the card is already in that list.
   */
  private getAutoMineDeckId(card: JitenCard): number {
    if (!this._autoMineOnReview) {
      return 0;
    }

    const deckId = Number(this._studyDeckId);

    if (!deckId || card.deckIds.includes(deckId)) {
      return 0;
    }

    return deckId;
  }
}
