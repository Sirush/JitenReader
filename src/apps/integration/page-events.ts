import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCard, JitenCardState, JitenRating } from '@shared/jiten/types';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';

export type PageEventTrigger = 'hover' | 'click' | 'long-press';

const MESSAGE_SOURCE = 'jiten-reader';
const MESSAGE_VERSION = 1;

/**
 * Broadcasts extension activity to the page via window.postMessage so other extensions and page
 * scripts can react to it. The payload shape is a public contract (docs/page-events.md): fields may
 * be added freely, but renaming or removing one requires a MESSAGE_VERSION bump.
 */
class PageEvents {
  private _enabled = false;
  private _lastActiveWordKey?: string;

  public get enabled(): boolean {
    return this._enabled;
  }

  public initialise(): void {
    onBroadcastMessage(
      'configurationUpdated',
      async () => {
        this._enabled = await getConfiguration('exposePageEvents');
      },
      true,
    );
  }

  /** Deduplicated: repeat interactions with the same word occurrence emit nothing. */
  public activeWordChanged(
    card: JitenCard,
    trigger: PageEventTrigger,
    surfaceForm?: string,
    sentence?: string,
  ): void {
    const key = `${card.wordId}/${card.readingIndex}/${sentence ?? ''}`;

    if (key === this._lastActiveWordKey) {
      return;
    }

    this._lastActiveWordKey = key;

    this.post('active-word-changed', {
      ...this.cardPayload(card),
      trigger,
      surfaceForm,
      sentence,
    });
  }

  /** Leaving a word ends the occurrence, so returning to it counts as a fresh interaction. */
  public clearActiveWord(): void {
    this._lastActiveWordKey = undefined;
  }

  public cardMined(
    card: JitenCard,
    deckId?: number,
    sentence?: string,
    sourceTitle?: string,
  ): void {
    this.post('card-mined', { ...this.cardPayload(card), deckId, sentence, sourceTitle });
  }

  public reviewGraded(card: JitenCard, rating: JitenRating): void {
    this.post('review-graded', { ...this.cardPayload(card), rating });
  }

  public cardStateChanged(
    wordId: number,
    readingIndex: number,
    cardState: JitenCardState[],
    deckIds: number[],
    card?: JitenCard,
  ): void {
    this.post('card-state-changed', {
      wordId,
      readingIndex,
      cardState,
      deckIds,
      spelling: card?.spelling,
      reading: card?.reading,
    });
  }

  public pageParsed(): void {
    this.post('page-parsed', {});
  }

  private cardPayload(card: JitenCard): Record<string, unknown> {
    return {
      wordId: card.wordId,
      readingIndex: card.readingIndex,
      spelling: card.spelling,
      reading: card.reading,
      cardState: card.cardState,
      frequencyRank: card.frequencyRank,
      partsOfSpeech: card.partsOfSpeech,
      pitchAccents: card.pitchAccents,
      deckIds: card.deckIds,
    };
  }

  private post(type: string, payload: Record<string, unknown>): void {
    if (!this._enabled) {
      return;
    }

    const message: Record<string, unknown> = {
      source: MESSAGE_SOURCE,
      version: MESSAGE_VERSION,
      type,
    };

    for (const [key, value] of Object.entries(payload)) {
      // The envelope identifies the message; a payload field must never shadow it.
      if (value !== undefined && !(key in message)) {
        message[key] = value;
      }
    }

    // targetOrigin deliberately omitted (same-window '/'): location.origin is the invalid
    // literal "null" on opaque origins such as sandboxed iframes and file:// pages.
    window.postMessage(message);
  }
}

export const pageEvents = new PageEvents();
