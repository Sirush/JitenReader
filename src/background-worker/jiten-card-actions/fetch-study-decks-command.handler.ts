import { StudyDeckListItem } from '@shared/jiten/api.types';
import { fetchStudyDecks } from '@shared/jiten/fetch-study-decks';
import { FetchStudyDecksCommand } from '@shared/messages/background/fetch-study-decks.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

export class FetchStudyDecksCommandHandler extends BackgroundCommandHandler<FetchStudyDecksCommand> {
  public readonly command = FetchStudyDecksCommand;

  public handle(): Promise<StudyDeckListItem[]> {
    return fetchStudyDecks();
  }
}
