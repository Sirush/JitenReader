import { BackgroundCommand } from '../lib/background-command';

export class RunDeckActionCommand extends BackgroundCommand<
  [
    wordId: number,
    readingIndex: number,
    key: 'mining' | 'blacklist' | 'neverForget' | 'suspend',
    action: 'add' | 'remove',
    sentence?: string,
  ]
> {
  public readonly key = 'runDeckAction';
}
