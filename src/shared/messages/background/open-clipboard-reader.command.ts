import { BackgroundCommand } from '../lib/background-command';

export class OpenClipboardReaderCommand extends BackgroundCommand<[]> {
  public readonly key = 'openClipboardReader';
}
