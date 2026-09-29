import { OpenClipboardReaderCommand } from '@shared/messages/background/open-clipboard-reader.command';
import { BackgroundCommandHandler } from './background-command-handler';
import { openClipboardReader } from './open-clipboard-reader';

export class OpenClipboardReaderCommandHandler extends BackgroundCommandHandler<OpenClipboardReaderCommand> {
  public readonly command = OpenClipboardReaderCommand;

  public handle(): void {
    void openClipboardReader();
  }
}
