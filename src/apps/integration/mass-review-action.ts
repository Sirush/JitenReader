import { getConfiguration } from '@shared/configuration/get-configuration';
import { Keybinds } from '@shared/configuration/types';
import { displayToast } from '@shared/dom/display-toast';
import { BatchReviewItem, JitenCard, JitenCardState } from '@shared/jiten/types';
import { BatchReviewCommand } from '@shared/messages/background/batch-review.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { clearPendingHighlight, flashElements, setPendingHighlight } from './flash-words';
import { KeybindManager } from './keybind-manager';
import { Registry } from './registry';
import { ReviewCooldown } from './review-cooldown';
import { showConfirmDialog, showTransientMessage } from './transient-message';

type Candidate = { element: Element; card: JitenCard };

const CONFIRM_WINDOW_MS = 1250;
// A second press sooner than this after the first is treated as accidental (key
// auto-repeat / typing) and re-arms the prompt instead of confirming.
const CONFIRM_MIN_DELAY_MS = 200;

/**
 * Page-global action that reviews all on-screen (viewport-visible) words as "good".
 * Triggered by a keybind (with optional double-press confirmation) or the status-bar button.
 */
export class MassReviewAction {
  private _keyManager = new KeybindManager(['massReviewKey']);

  private _disableReviews = false;
  private _includeNew = true;
  private _includeDue = true;
  private _includeYoung = false;
  private _includeMature = false;
  private _cooldownHours = 20;
  private _requireConfirm = true;
  private _keyDisplay = '';

  private _pendingConfirmAt = 0;
  private _confirmTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    onBroadcastMessage('configurationUpdated', () => void this.applyConfiguration(), true);

    Registry.events.on('massReviewKey', () => void this.onKeybind());

    this._keyManager.activate();
  }

  /** Triggered by the status-bar button: always confirms through a modal. */
  public async confirmViaDialog(): Promise<void> {
    if (this._disableReviews) {
      return;
    }

    const candidates = await this.collectCandidates();

    if (candidates.length === 0) {
      displayToast('success', 'No words on screen to review.');

      return;
    }

    setPendingHighlight(candidates.map(({ element }) => element));

    const confirmed = await showConfirmDialog(
      `Review ${candidates.length} ${MassReviewAction.pluralise(candidates.length)} on screen as good?`,
    );

    if (confirmed) {
      await this.execute(candidates);
    } else {
      clearPendingHighlight();
    }
  }

  private async onKeybind(): Promise<void> {
    if (this._disableReviews) {
      return;
    }

    const candidates = await this.collectCandidates();

    if (candidates.length === 0) {
      displayToast('success', 'No words on screen to review.');
      this.clearPendingConfirm();

      return;
    }

    if (!this._requireConfirm) {
      await this.execute(candidates);

      return;
    }

    const now = Date.now();

    // Only a deliberate second press — after the minimum delay and within the window —
    // confirms; faster repeats just re-arm the prompt.
    if (this._confirmTimer !== undefined && now - this._pendingConfirmAt >= CONFIRM_MIN_DELAY_MS) {
      this.clearPendingConfirm();
      await this.execute(candidates);

      return;
    }

    this.armConfirm(candidates, now);
  }

  private armConfirm(candidates: Candidate[], now: number): void {
    this._pendingConfirmAt = now;

    setPendingHighlight(candidates.map(({ element }) => element));

    const count = candidates.length;
    const prompt = this._keyDisplay ? `Press ${this._keyDisplay} again` : 'Press again';

    showTransientMessage(`${prompt} to review ${count} ${MassReviewAction.pluralise(count)}`);

    if (this._confirmTimer) {
      clearTimeout(this._confirmTimer);
    }

    this._confirmTimer = setTimeout(() => {
      this._confirmTimer = undefined;
      clearPendingHighlight();
    }, CONFIRM_WINDOW_MS);
  }

  private clearPendingConfirm(): void {
    clearPendingHighlight();

    if (this._confirmTimer) {
      clearTimeout(this._confirmTimer);
      this._confirmTimer = undefined;
    }
  }

  private async collectCandidates(): Promise<Candidate[]> {
    const seen = new Set<string>();
    const candidates: Candidate[] = [];

    const elements = document.querySelectorAll('.jiten-word[wordId][readingIndex]');

    for (const element of elements) {
      if (!MassReviewAction.isInViewport(element)) {
        continue;
      }

      const card = Registry.getCardFromElement(element);

      if (!card) {
        continue;
      }

      const key = `${card.wordId}/${card.readingIndex}`;

      if (seen.has(key) || !this.shouldReview(card)) {
        continue;
      }

      if (await ReviewCooldown.isCoolingDown(card.wordId, card.readingIndex, this._cooldownHours)) {
        continue;
      }

      seen.add(key);
      candidates.push({ element, card });
    }

    return candidates;
  }

  private shouldReview(card: JitenCard): boolean {
    const states = card.cardState;

    if (
      states.includes(JitenCardState.REDUNDANT) ||
      states.includes(JitenCardState.MASTERED) ||
      states.includes(JitenCardState.BLACKLISTED)
    ) {
      return false;
    }

    if (Registry.isSessionTouched(card.wordId, card.readingIndex)) {
      return false;
    }

    // States are not mutually exclusive (a word can be both due and young), so any
    // enabled matching state qualifies it.
    return (
      (this._includeDue && states.includes(JitenCardState.DUE)) ||
      (this._includeNew && states.includes(JitenCardState.NEW)) ||
      (this._includeYoung && states.includes(JitenCardState.YOUNG)) ||
      (this._includeMature && states.includes(JitenCardState.MATURE))
    );
  }

  private async execute(candidates: Candidate[]): Promise<void> {
    clearPendingHighlight();

    const items: BatchReviewItem[] = candidates.map(({ card }) => ({
      wordId: card.wordId,
      readingIndex: card.readingIndex,
      rating: 'good',
    }));

    try {
      const result = await new BatchReviewCommand(items).call();

      if (!result?.success) {
        displayToast('error', 'Failed to review words on screen.');

        return;
      }

      await ReviewCooldown.mark(
        candidates.map(({ card }) => ({ wordId: card.wordId, readingIndex: card.readingIndex })),
        this._cooldownHours,
      );

      flashElements(
        candidates.map(({ element }) => element),
        'good',
      );

      displayToast(
        'success',
        `Reviewed ${result.processed} ${MassReviewAction.pluralise(result.processed)} as good.`,
      );
    } catch {
      displayToast('error', 'Failed to review words on screen.');
    }
  }

  private async applyConfiguration(): Promise<void> {
    this._disableReviews = await getConfiguration('jitenDisableReviews');
    this._includeNew = await getConfiguration('massReviewNew');
    this._includeDue = await getConfiguration('massReviewDue');
    this._includeYoung = await getConfiguration('massReviewYoung');
    this._includeMature = await getConfiguration('massReviewMature');
    this._cooldownHours = await getConfiguration('massReviewCooldownHours');
    this._requireConfirm = await getConfiguration('massReviewRequireConfirm');
    this._keyDisplay = MassReviewAction.formatKeybind(await getConfiguration('massReviewKey'));
  }

  private static formatKeybind(keybinds: Keybinds): string {
    const first = Array.isArray(keybinds)
      ? keybinds.find((candidate) => candidate?.code)
      : keybinds.code
        ? keybinds
        : undefined;

    if (!first) {
      return '';
    }

    return [...first.modifiers, first.key || first.code].join(' + ');
  }

  private static isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth
    );
  }

  private static pluralise(count: number): string {
    return count === 1 ? 'word' : 'words';
  }
}
