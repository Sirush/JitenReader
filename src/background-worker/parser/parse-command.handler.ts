import { getConfiguration } from '@shared/configuration/get-configuration';
import { injectStyle } from '@shared/extension/inject-style';
import { openOptionsPage } from '@shared/extension/open-options-page';
import { MessageSender } from '@shared/extension/types';
import { ParseCommand } from '@shared/messages/background/parse.command';
import { ToastCommand } from '@shared/messages/foreground/toast.command';
import { getThemeCssVars } from '@shared/theme/get-theme-css-vars';
import { generateWordStyleCSS } from '@shared/word-style/generate-css';
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

    await this.injectWordStyles(sender.tab!.id!);
    this._parseController.parseSequences(sender, data);
  }

  public async injectWordStyles(tabId: number): Promise<void> {
    const themeVars = await getThemeCssVars();
    const wordStyleConfig = await getConfiguration('wordStyleConfig');
    const generatedCSS = generateWordStyleCSS(wordStyleConfig);
    const customWordCSS = await getConfiguration('customWordCSS');

    await injectStyle(tabId, 'word', `${themeVars}\n${generatedCSS}\n${customWordCSS}`);
  }
}
