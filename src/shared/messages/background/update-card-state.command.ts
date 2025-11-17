import { BackgroundCommand } from '../lib/background-command';

export class UpdateCardStateCommand extends BackgroundCommand<
  [wordId: number, readingIndex: number]
> {
  public readonly key = 'updateCardState';
}
