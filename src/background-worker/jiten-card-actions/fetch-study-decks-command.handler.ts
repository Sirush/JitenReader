import { StudyDeckListItem } from '@shared/jiten/api.types';
import { fetchStudyDecks } from '@shared/jiten/fetch-study-decks';
import { FetchStudyDecksCommand } from '@shared/messages/background/fetch-study-decks.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

const CACHE_TTL_MS = 60_000;

let cached: { value: Promise<StudyDeckListItem[]>; expiresAt: number } | undefined;

export function invalidateStudyDecksCache(): void {
  cached = undefined;
}

export class FetchStudyDecksCommandHandler extends BackgroundCommandHandler<FetchStudyDecksCommand> {
  public readonly command = FetchStudyDecksCommand;

  public handle(): Promise<StudyDeckListItem[]> {
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    // Cache the in-flight promise so concurrent calls (e.g. a burst of frame
    // inits) share a single request rather than each hitting the API.
    const value = fetchStudyDecks().catch((error: unknown) => {
      invalidateStudyDecksCache();

      throw error;
    });

    cached = { value, expiresAt: now + CACHE_TTL_MS };

    return value;
  }
}
