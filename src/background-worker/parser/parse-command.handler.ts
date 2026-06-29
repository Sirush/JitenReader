import { getConfiguration } from '@shared/configuration/get-configuration';
import { openOptionsPage } from '@shared/extension/open-options-page';
import { MessageSender } from '@shared/extension/types';
import { isApiTokenRejected } from '@shared/jiten/request-by-url';
import { ParseCommand } from '@shared/messages/background/parse.command';
import { ToastCommand } from '@shared/messages/foreground/toast.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';
import { ParseController } from './parse.controller';

export class ParseCommandHandler extends BackgroundCommandHandler<ParseCommand> {
  public readonly command = ParseCommand;

  private _failToast = new ToastCommand(
    'error',
    'Jiten API key is not set. Please set it in the extension settings.',
  );

  private _rejectedToast = new ToastCommand(
    'error',
    'Jiten API key was rejected by the server. Please update it in the extension settings.',
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

    if (await isApiTokenRejected()) {
      await this._rejectedToast.call(sender.tab!.id!);

      return;
    }

    this._parseController.parseSequences(sender, data);
  }
}
