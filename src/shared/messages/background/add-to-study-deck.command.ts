import { BackgroundCommand } from '../lib/background-command';

export class AddToStudyDeckCommand extends BackgroundCommand<
  [deckId: number, wordId: number, readingIndex: number, sentence?: string, source?: string]
> {
  public readonly key = 'addToStudyDeck';
}
