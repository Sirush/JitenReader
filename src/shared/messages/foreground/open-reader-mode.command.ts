import { ForegroundCommand } from '../lib/foreground-command';

export class OpenReaderModeCommand extends ForegroundCommand<[text?: string]> {
  public readonly key = 'openReaderMode';
}
