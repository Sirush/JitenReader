import { StudyDeckListItem } from '../../jiten/api.types';
import { BackgroundCommand } from '../lib/background-command';

export class FetchStudyDecksCommand extends BackgroundCommand<[], StudyDeckListItem[]> {
  public readonly key = 'fetchStudyDecks';
}
