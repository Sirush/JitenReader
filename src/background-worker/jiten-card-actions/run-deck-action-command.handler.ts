import { getConfiguration } from '@shared/configuration/get-configuration';
import { MessageSender } from '@shared/extension/types';
import { addVocabulary } from '@shared/jiten/add-vocabulary';
import { removeVocabulary } from '@shared/jiten/remove-vocabulary';
import { setCardSentence } from '@shared/jiten/set-card-sentence';
import { RunDeckActionCommand } from '@shared/messages/background/run-deck-action.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';

export class RunDeckActionCommandHandler extends BackgroundCommandHandler<RunDeckActionCommand> {
  public readonly command = RunDeckActionCommand;

  public async handle(
    sender: MessageSender,
    wordId: number,
    readingIndex: number,
    deck: 'mining' | 'blacklist' | 'neverForget' | 'suspend',
    action: 'add' | 'remove',
    sentence?: string,
  ): Promise<void> {
    const addSentence = await getConfiguration('setSentences');

    const fn = action === 'add' ? addVocabulary : removeVocabulary;

    await fn(deck, wordId, readingIndex);

    if (addSentence && sentence?.length && action === 'add' && deck === 'mining') {
      await setCardSentence(wordId, readingIndex, sentence);
    }
  }
}
