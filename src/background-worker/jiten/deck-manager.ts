import { getConfiguration } from '@shared/configuration/get-configuration';
import { listUserDecks } from '@shared/jiten/list-user-decks';
import { JPDBDeck } from '@shared/jiten/types';
import { DeckListUpdatedCommand } from '@shared/messages/broadcast/deck-list-updated.command';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';

export class DeckManager {
  private jitenApiKey: string | null = null;
  private internalDecks: JPDBDeck[] = [
    { id: 'blacklist', name: '[Blacklist]' },
    { id: 'never-forget', name: '[Never forget]' },
    { id: 'forq', name: '[ForQ]' },
  ];
  private decks: JPDBDeck[] = [];
  private managableDecks: JPDBDeck[] = [];

  constructor() {
    onBroadcastMessage(
      'configurationUpdated',
      async () => {
        const jitenApiKey = await getConfiguration('jitenApiKey');

        if (jitenApiKey === this.jitenApiKey) {
          return;
        }

        this.jitenApiKey = jitenApiKey;

        if (this.jitenApiKey) {
          await this.loadDecks();
        }
      },
      true,
    );
  }

  public async loadDecks(): Promise<void> {
    this.decks = [...this.internalDecks, ...(await this.fetchDecks())];
    this.managableDecks = this.decks.filter(
      (deck) => !deck.is_built_in || typeof deck.id === 'string',
    );

    new DeckListUpdatedCommand(this.managableDecks).send();
  }

  private async fetchDecks(): Promise<JPDBDeck[]> {
    return await listUserDecks(
      [
        'id',
        'name',
        'vocabulary_count',
        'word_count',
        'vocabulary_known_coverage',
        'vocabulary_in_progress_coverage',
        'is_built_in',
      ],
      {
        apiToken: this.jitenApiKey!,
      },
    );
  }
}
