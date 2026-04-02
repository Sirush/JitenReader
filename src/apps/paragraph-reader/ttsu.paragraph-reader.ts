import { Fragment } from '../batches/types';
import { ParagraphReader } from './paragraph-reader';

export class TtsuParagraphReader extends ParagraphReader {
  protected override pushText(
    fragments: Fragment[],
    offset: number,
    text: Text | CDATASection,
    hasRuby: boolean,
    rubyElement: Element | null,
  ): number {
    // Add zero-width space after all ideographic spaces "　" (U+3000)
    text.data = text.data.replace(/\u3000/g, '\u3000\u200B');

    return super.pushText(fragments, offset, text, hasRuby, rubyElement);
  }
}
