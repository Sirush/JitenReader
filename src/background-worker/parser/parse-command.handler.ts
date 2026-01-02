import { getConfiguration } from '@shared/configuration/get-configuration';
import { injectStyle } from '@shared/extension/inject-style';
import { openOptionsPage } from '@shared/extension/open-options-page';
import { MessageSender } from '@shared/extension/types';
import { ParseCommand } from '@shared/messages/background/parse.command';
import { ToastCommand } from '@shared/messages/foreground/toast.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { getThemeCssVars } from '@shared/theme/get-theme-css-vars';
import { BackgroundCommandHandler } from '../lib/background-command-handler';
import { ParseController } from './parse.controller';

export class ParseCommandHandler extends BackgroundCommandHandler<ParseCommand> {
  public readonly command = ParseCommand;

  private _failToast = new ToastCommand(
    'error',
    'Jiten API key is not set. Please set it in the extension settings.',
  );

  constructor(private _parseController: ParseController) {
    super();
  }

  public async handle(
    sender: MessageSender,
    data: [sequenceId: number, text: string][],
  ): Promise<void> {
    const jitenApiKey = await getConfiguration('jitenApiKey');

    if (!jitenApiKey?.length) {
      await this._failToast.call(sender.tab!.id!);
      await openOptionsPage();

      return;
    }

    onBroadcastMessage(
      'configurationUpdated',
      async () => {
        const themeVars = await getThemeCssVars();
        const customWordCSS = await getConfiguration('customWordCSS');

        await injectStyle(sender.tab!.id!, 'word', `${themeVars}\n${customWordCSS}`);
      },
      true,
    );

    this._parseController.parseSequences(sender, data);
  }
}
