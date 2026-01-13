import { JitenToken } from '@shared/jiten/types';
import { Registry } from '../integration/registry';
import { TextHighlighter } from '../text-highlighter/text-highlighter';
import { Fragment } from './types';

let statsUpdateTimeout: number | undefined;

export const applyTokens = (fragments: Fragment[], tokens: JitenToken[]): void => {
  new TextHighlighter(fragments, tokens).apply();

  // Debounce stats recalculation to avoid calling it too often when there's a lot of paragraphs
  if (statsUpdateTimeout) {
    clearTimeout(statsUpdateTimeout);
  }
  statsUpdateTimeout = window.setTimeout(() => {
    Registry.statusBar?.recalculateStats();
    statsUpdateTimeout = undefined;
  }, 100);
};
