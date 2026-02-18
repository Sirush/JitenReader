import { JitenToken } from '@shared/jiten/types';
import { Fragment } from '../../../batches/types';
import { Registry } from '../../../integration/registry';

let statsUpdateTimeout: number | undefined;

export const manatanMangaApplyTokens = (fragments: Fragment[], tokens: JitenToken[]): void => {
  if (!fragments.length) {
    return;
  }

  const fragment = fragments[0];
  const textNode = fragment.node;
  const box = textNode.parentElement;

  if (!box) {
    return;
  }

  box.querySelector('.jiten-manatan-overlay')?.remove();
  box.setAttribute('data-jiten-parsed', '');

  const overlay = document.createElement('div');

  overlay.className = 'jiten-manatan-overlay';

  const fullText = textNode.data;
  let cursor = fragment.start;

  const sortedTokens = [...tokens].sort((a, b) => a.start - b.start);

  for (const token of sortedTokens) {
    const tokenStart = token.start - fragment.start;
    const tokenEnd = token.end - fragment.start;

    if (tokenStart > cursor - fragment.start) {
      appendUnparsedSpan(overlay, fullText.substring(cursor - fragment.start, tokenStart));
    }

    const span = createTokenSpan(token, fullText.substring(tokenStart, tokenEnd));

    overlay.appendChild(span);
    cursor = token.end;
  }

  if (cursor - fragment.start < fullText.length) {
    appendUnparsedSpan(overlay, fullText.substring(cursor - fragment.start));
  }

  box.appendChild(overlay);

  if (statsUpdateTimeout) {
    clearTimeout(statsUpdateTimeout);
  }
  statsUpdateTimeout = window.setTimeout(() => {
    Registry.statusBar?.recalculateStats();
    statsUpdateTimeout = undefined;
  }, 100);
};

const createTokenSpan = (token: JitenToken, text: string): HTMLSpanElement => {
  const { markFrequency, markAll, generatePitch, markIPlus1, newStates } =
    Registry.textHighlighterOptions;
  const { card, pitchClass, sentence, conjugations } = token;
  const span = document.createElement('span');

  span.setAttribute('ajb', 'true');
  span.setAttribute('data-text', text);

  if (card) {
    Registry.addCard(card, span, conjugations);

    span.classList.add('jiten-word', ...card.cardState);

    if (markFrequency && card.frequencyRank <= markFrequency) {
      const isNew = card.cardState.some((s) => newStates.includes(s));

      if (markAll || isNew) {
        span.classList.add('frequent');
      }
    }

    if (pitchClass && generatePitch) {
      span.classList.add(pitchClass);
    }

    span.setAttribute('wordId', card.wordId.toString());
    span.setAttribute('readingIndex', card.readingIndex.toString());

    if (markIPlus1) {
      Registry.sentenceManager.addElement(span, token);
    }

    Registry.wordEventDelegator.setSentence(span, sentence);
  } else {
    span.classList.add('jiten-word', 'unparsed');
  }

  return span;
};

const appendUnparsedSpan = (parent: HTMLElement, text: string): void => {
  if (!text) {
    return;
  }

  const span = document.createElement('span');

  span.className = 'jiten-word unparsed';
  span.setAttribute('ajb', 'true');
  span.setAttribute('data-text', text);

  parent.appendChild(span);
};
