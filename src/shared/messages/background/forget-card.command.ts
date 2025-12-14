import { BackgroundCommand } from '../lib/background-command';

export class ForgetCardCommand extends BackgroundCommand<[wordId: number, readingIndex: number]> {
  public readonly key = 'forgetCard';

  constructor(wordId: number, readingIndex: number) {
    super(wordId, readingIndex);
  }
}
