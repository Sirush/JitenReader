import { JitenRuby } from '@shared/jiten/types';
import { Fragment } from '../../batches/types';
import { TextHighlighter } from '../../text-highlighter/text-highlighter';

const RT_SCALE = 0.6;
const WIDEN_HEADROOM = 0.1;

export class TtsuTextHighlighter extends TextHighlighter {
  protected override createRubyNodesForFragment(
    fragment: Fragment,
    rubies: JitenRuby[],
  ): DocumentFragment {
    const nodeText = fragment.node.textContent;
    const docFrag = document.createDocumentFragment();
    const sortedRubies = [...rubies].sort((a, b) => a.start - b.start);

    let lastIndex = 0;

    for (const ruby of sortedRubies) {
      const rubyStart = ruby.start - fragment.start;
      const rubyEnd = ruby.end - fragment.start;

      if (rubyStart > lastIndex) {
        docFrag.append(document.createTextNode(nodeText.slice(lastIndex, rubyStart)));
      }

      const baseText = nodeText.slice(rubyStart, rubyEnd);
      const rubyElem = document.createElement('ruby');
      const rt = document.createElement('rt');

      rubyElem.append(document.createTextNode(baseText));
      rubyElem.setAttribute('data-furi', ruby.text);

      const furiInline = ruby.text.length * RT_SCALE;

      if (furiInline > baseText.length) {
        rubyElem.style.minInlineSize = `${(furiInline + WIDEN_HEADROOM).toFixed(2)}em`;
      }

      rt.className = 'jiten-furi';
      rt.textContent = ruby.text;
      rubyElem.append(rt);

      docFrag.append(rubyElem);
      lastIndex = rubyEnd;
    }

    if (lastIndex < nodeText.length) {
      docFrag.append(document.createTextNode(nodeText.slice(lastIndex)));
    }

    return docFrag;
  }
}
