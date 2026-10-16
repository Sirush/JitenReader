import {
  DICTIONARY_TIMEOUT,
  DictionaryLookup,
  DictionaryLookupResult,
  isDictionaryLookup,
  isDictionaryLookupResult,
} from '@shared/dictionaries/types';
import { MessageSender } from '@shared/extension/types';
import { LookupDictionariesCommand } from '@shared/messages/background/lookup-dictionaries.command';
import { BackgroundCommandHandler } from '../lib/background-command-handler';
import { ensureOffscreenDocument } from '../lib/offscreen-document';

export class LookupDictionariesCommandHandler extends BackgroundCommandHandler<LookupDictionariesCommand> {
  public readonly command = LookupDictionariesCommand;

  public async handle(
    _sender: MessageSender,
    lookup: DictionaryLookup,
  ): Promise<DictionaryLookupResult> {
    if (!chrome.offscreen || !isDictionaryLookup(lookup)) {
      return { status: 'unavailable' };
    }

    const deadline = Date.now() + DICTIONARY_TIMEOUT;
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        this.lookup(lookup, deadline).catch(() => ({ status: 'unavailable' as const })),
        new Promise<DictionaryLookupResult>((resolve) => {
          timer = setTimeout(() => resolve({ status: 'unavailable' }), DICTIONARY_TIMEOUT);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async lookup(
    lookup: DictionaryLookup,
    deadline: number,
  ): Promise<DictionaryLookupResult> {
    for (let attempt = 0; attempt < 2 && Date.now() < deadline; attempt++) {
      try {
        await ensureOffscreenDocument();

        const result: unknown = await chrome.runtime.sendMessage({
          target: 'dictionary-offscreen',
          lookup,
          timeout: Math.max(1, deadline - Date.now()),
        });

        if (isDictionaryLookupResult(result)) {
          return result;
        }
      } catch {
        // A disappearing offscreen document can close the message port mid-lookup.
      }

      const contexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
      });

      if (contexts.length > 0) {
        break;
      }
    }

    return { status: 'unavailable' };
  }
}
