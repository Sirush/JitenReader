import { MessageSender } from '@shared/extension/types';
import { request } from '@shared/jiten/request';
import { ForgetCardCommand } from '@shared/messages/background/forget-card.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

export class ForgetCardCommandHandler extends BackgroundCommandHandler<ForgetCardCommand> {
  public readonly command = ForgetCardCommand;

  public async handle(
    sender: MessageSender,
    wordId: number,
    readingIndex: number,
  ): Promise<void> {
    await request('srs/set-vocabulary-state', {
      wordId,
      readingIndex,
      state: 'forget-add',
    });
  }
}
