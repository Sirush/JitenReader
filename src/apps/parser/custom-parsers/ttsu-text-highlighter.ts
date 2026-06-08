import { JitenRuby } from '@shared/jiten/types';
import { Fragment } from '../../batches/types';
import { TextHighlighter } from '../../text-highlighter/text-highlighter';

export class TtsuTextHighlighter extends TextHighlighter {
  protected override createRubyNodesForFragment(
    fragment: Fragment,
    rubies: JitenRuby[],
  ): DocumentFragment {
    const nodeText = fragment.node.textContent;
    let lastIndex = 0;
    const docFrag = document.createDocumentFragment();
    const sortedRubies = [...rubies].sort((a, b) => a.start - b.start);

    for (const ruby of sortedRubies) {
      const rubyStart = ruby.start - fragment.start;
      const rubyEnd = ruby.end - fragment.start;

      if (rubyStart > lastIndex) {
        docFrag.append(document.createTextNode(nodeText.slice(lastIndex, rubyStart)));
      }

      const rubyElem = document.createElement('ruby');
      const rt = document.createElement('rt');

      rubyElem.append(document.createTextNode(nodeText.slice(rubyStart, rubyEnd)));
      rubyElem.setAttribute('data-furi', ruby.text);

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
