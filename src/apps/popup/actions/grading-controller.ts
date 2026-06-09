import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCard, JitenRating } from '@shared/jiten/types';
import { AddToStudyDeckCommand } from '@shared/messages/background/add-to-study-deck.command';
import { GradeCardCommand } from '@shared/messages/background/grade-card.command';
import { Registry } from '../../integration/registry';
import { ReviewCooldown } from '../../integration/review-cooldown';
import { BaseController } from './base-controller';

export class GradingController extends BaseController {
  private _disableReviews: boolean;
  private _showActions: boolean;
  private _useTwoPointGrading: boolean;
  private _autoMineOnReview: boolean;
  private _studyDeckId: string;
  private _massReviewCooldownHours = 20;

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

    // Any card the user grades directly (or that is auto-failed, which routes through here)
    // is excluded from mass review — for the rest of the session and, across navigations,
    // for the cooldown window — so a later mass review can't override the grade just given.
    Registry.markSessionTouched(wordId, readingIndex);
    void ReviewCooldown.mark([{ wordId, readingIndex }], this._massReviewCooldownHours);

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
    this._massReviewCooldownHours = await getConfiguration('massReviewCooldownHours');
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
