import { MessageSender } from '@shared/extension/types';
import { getCardState } from '@shared/jiten/get-card-state';
import { UpdateCardStateCommand } from '@shared/messages/background/update-card-state.command';
import { CardStateUpdatedCommand } from '@shared/messages/broadcast/card-state-updated.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

export class UpdateCardStateCommandHandler extends BackgroundCommandHandler<UpdateCardStateCommand> {
  public readonly command = UpdateCardStateCommand;

  public async handle(sender: MessageSender, wordId: number, readingIndex: number): Promise<void> {
    const newCardState = await getCardState(wordId, readingIndex);

    new CardStateUpdatedCommand(wordId, readingIndex, newCardState).send();
  }
}
