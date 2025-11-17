import { JitenToken } from '@shared/jiten/types';
import { TextHighlighter } from '../text-highlighter/text-highlighter';
import { Fragment } from './types';

export const applyTokens = (fragments: Fragment[], tokens: JitenToken[]): void => {
  new TextHighlighter(fragments, tokens).apply();
};
