import { JitenRuby } from '@shared/jiten/types';
import { Fragment } from '../../batches/types';
import { TextHighlighter } from '../../text-highlighter/text-highlighter';

type RubyGroup = { start: number; end: number; text: string };

export class TtsuTextHighlighter extends TextHighlighter {
  protected override createRubyNodesForFragment(
    fragment: Fragment,
    rubies: JitenRuby[],
  ): DocumentFragment {
    const nodeText = fragment.node.textContent;
    const docFrag = document.createDocumentFragment();
    const sortedRubies = [...rubies].sort((a, b) => a.start - b.start);

    let lastIndex = 0;
    let group: RubyGroup | null = null;

    const flushGroup = (): void => {
      if (!group) {
        return;
      }

      const rubyElem = document.createElement('ruby');
      const rt = document.createElement('rt');

      rubyElem.append(document.createTextNode(nodeText.slice(group.start, group.end)));
      rubyElem.setAttribute('data-furi', group.text);

      rt.className = 'jiten-furi';
      rt.textContent = group.text;
      rubyElem.append(rt);

      docFrag.append(rubyElem);
      group = null;
    };

    for (const ruby of sortedRubies) {
      const rubyStart = ruby.start - fragment.start;
      const rubyEnd = ruby.end - fragment.start;

      // Any non-ruby text before this ruby ends the current run of fused kanji.
      if (group && rubyStart > group.end) {
        flushGroup();
      }

      if (!group && rubyStart > lastIndex) {
        docFrag.append(document.createTextNode(nodeText.slice(lastIndex, rubyStart)));
      }

      if (group) {
        group.end = rubyEnd;
        group.text += ruby.text;
      } else {
        group = { start: rubyStart, end: rubyEnd, text: ruby.text };
      }

      lastIndex = rubyEnd;
    }

    flushGroup();

    if (lastIndex < nodeText.length) {
      docFrag.append(document.createTextNode(nodeText.slice(lastIndex)));
    }

    return docFrag;
  }
}
