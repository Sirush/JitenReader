import { openOptionsPage } from '@shared/extension/open-options-page';
import { OpenSettingsCommand } from '@shared/messages/background/open-settings.command';
import { BackgroundCommandHandler } from './background-command-handler';

export class OpenSettingsCommandHandler extends BackgroundCommandHandler<OpenSettingsCommand> {
  public readonly command = OpenSettingsCommand;

  public handle(): void {
    void openOptionsPage();
  }
}
