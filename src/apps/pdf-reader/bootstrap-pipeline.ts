import { getConfiguration } from '@shared/configuration/get-configuration';
import { JitenCardState } from '@shared/jiten/types';
import { onBroadcastMessage } from '@shared/messages/receiving/on-broadcast-message';
import { Registry } from '../integration/registry';
import { PopupManager } from '../popup/popup-manager';
import { applyWordStyles, ensureWordStyles } from '../text-highlighter/apply-word-styles';
import { generateFaithfulHighlightCss } from './faithful-highlight';

const FAITHFUL_STYLE_ID = 'pdf-faithful-highlight';

const applyFaithfulHighlight = async (): Promise<void> => {
  const config = await getConfiguration('wordStyleConfig');
  let style = document.getElementById(FAITHFUL_STYLE_ID) as HTMLStyleElement | null;

  if (!style) {
    style = document.createElement('style');
    style.id = FAITHFUL_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = generateFaithfulHighlightCss(config);
};

// The shared parsing pipeline (BatchController → ParseCommand → SequenceManager → TextHighlighter)
// is normally wired up by `new AJB()` in the content script. This standalone page never runs AJB, so
// it replicates the minimal subset needed to parse text and get interactive, themed highlights:
// the word-event delegation + popup, the highlight options derived from configuration, and the
// word-style stylesheets. Parse results route back here because the page lives in a real tab, so the
// service worker's `tabs.sendMessage(sender.tab.id, …)` reaches our SequenceManager listeners.
const applyHighlightOptions = async (): Promise<void> => {
  const options = Registry.textHighlighterOptions;

  options.skipFurigana = await getConfiguration('skipFurigana');
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
  await applyFaithfulHighlight();
};

export const bootstrapPipeline = async (): Promise<void> => {
  Registry.wordEventDelegator.initialise();
  Registry.popupManager = new PopupManager();

  onBroadcastMessage(
    'cardStateUpdated',
    (wordId: number, readingIndex: number, state: JitenCardState[]) => {
      Registry.updateCard(wordId, readingIndex, state);
    },
  );

  onBroadcastMessage('configurationUpdated', () => void applyHighlightOptions(), true);

  await applyHighlightOptions();
  await ensureWordStyles();
};
