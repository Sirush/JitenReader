import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCardState } from '@shared/jiten/types';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { Registry } from '../integration/registry';
import { PopupManager } from '../popup/popup-manager';
import { applyWordStyles, ensureWordStyles } from '../text-highlighter/apply-word-styles';

// The shared parsing pipeline (BatchController → ParseCommand → SequenceManager → TextHighlighter)
// is normally wired up by `new AJB()` in the content script. Standalone extension pages never run
// AJB, so they replicate the minimal subset needed to parse text and get interactive, themed
// highlights: the word-event delegation + popup, the highlight options derived from configuration,
// and the word-style stylesheets. Parse results route back because these pages live in a real tab,
// so the service worker's `tabs.sendMessage(sender.tab.id, …)` reaches our SequenceManager listeners.
const applyHighlightOptions = async (): Promise<void> => {
  const options = Registry.textHighlighterOptions;

  options.skipFurigana = await getConfiguration('skipFurigana');
  options.furiganaOnlyOnNew = await getConfiguration('furiganaOnlyOnNew');
  options.generatePitch = await getConfiguration('generatePitch');
  options.markIPlus1 = await getConfiguration('markIPlus1');
  options.markAll = await getConfiguration('markAllTypes');
  options.markFrequency = (await getConfiguration('markTopX'))
    ? await getConfiguration('markTopXCount')
    : false;
  options.minSentenceLength = await getConfiguration('minSentenceLength');
  options.iPlusOneMaxFrequency = (await getConfiguration('iPlusOneMaxFrequency'))
    ? await getConfiguration('iPlusOneMaxFrequencyCount')
    : false;
  options.newStates = await getConfiguration('newStates');
  options.markWordsInDeck = await getConfiguration('markWordsInDeck');

  await applyWordStyles();
};

/** `applyPageStyles` runs after the highlight options on load and on every configuration change. */
export const bootstrapPipeline = async (applyPageStyles?: () => Promise<void>): Promise<void> => {
  const configure = async (): Promise<void> => {
    await applyHighlightOptions();
    await applyPageStyles?.();
  };

  Registry.wordEventDelegator.initialise();
  Registry.popupManager = new PopupManager();

  onBroadcastMessage(
    'cardStateUpdated',
    (wordId: number, readingIndex: number, state: JitenCardState[]) => {
      Registry.updateCard(wordId, readingIndex, state);
    },
  );

  onBroadcastMessage('configurationUpdated', () => void configure(), true);

  await configure();
  await ensureWordStyles();
};
