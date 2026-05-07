import { getConfiguration } from '@shared/configuration/get-configuration';
import { MessageSender } from '@shared/extension/types';
import { addToStudyDeck } from '@shared/jiten/add-to-study-deck';
import { AddToStudyDeckCommand } from '@shared/messages/background/add-to-study-deck.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

export class AddToStudyDeckCommandHandler extends BackgroundCommandHandler<AddToStudyDeckCommand> {
  public readonly command = AddToStudyDeckCommand;

  public async handle(
    _sender: MessageSender,
    deckId: number,
    wordId: number,
    readingIndex: number,
    sentence?: string,
    source?: string,
  ): Promise<void> {
    const setSentences = await getConfiguration('setSentences');

    await addToStudyDeck(
      deckId,
      wordId,
      readingIndex,
      setSentences ? sentence : undefined,
      setSentences ? source : undefined,
    );
  }
}
