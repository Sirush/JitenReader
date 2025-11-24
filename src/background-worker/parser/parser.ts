import { parse } from '@shared/jiten/parse';
import { JitenCard, JitenRawVocabulary, JitenToken, JitenRuby } from '@shared/jiten/types';
import { Batch } from './parser.types';
import { getPitchClass } from './pitch-accent-utils';

export class Parser {
  constructor(private batch: Batch) {}

  public async parse(): Promise<void> {
    const paragraphs = this.batch.strings;
    const { tokens, vocabulary } = await parse(paragraphs);

    const cards = this.vocabToCard(vocabulary);
    const parsedTokens = this.parseTokens(tokens, cards, vocabulary);

    this.addSentenceInfo(paragraphs, parsedTokens);

    for (const [i, handle] of this.batch.handles.entries()) {
      handle.resolve(parsedTokens[i]);
    }
  }

  private extractRubiesFromAnnotated(input: string): JitenRuby[] {
    const rubies: JitenRuby[] = [];

    // Group 1: Prefix (any text before the target, including newlines)
    // Group 2: The Base (Kanji and Iteration marks like 々)
    // Group 3: The Ruby (inside brackets)
    const regex = /((?:.|\n)*?)([\u4e00-\u9faf\u3005-\u3007]+)\[([^\]]+)\]/g;

    let match: RegExpExecArray | null;
    let currentOffset = 0; // This tracks the position in the CLEAN (displayed) string

    while ((match = regex.exec(input)) !== null) {
      const prefix = match[1]; // e.g., "もう" in "もう一度"
      const base = match[2]; // e.g., "一度"
      const ruby = match[3]; // e.g., "いちど"

      // 1. Advance offset past the prefix (plain text that has no ruby)
      currentOffset += prefix.length;

      // 2. Mark the ruby position
      const start = currentOffset;
      const length = base.length;
      const end = start + length;

      rubies.push({
        text: ruby,
        start,
        end,
        length,
      });

      // 3. Advance offset past the base (the text covered by ruby)
      currentOffset += length;
    }

    return rubies;
  }

  private vocabToCard(vocabulary: JitenRawVocabulary[]): JitenCard[] {
    return vocabulary.map((vocab) => {
      const {
        wordId,
        readingIndex,
        spelling,
        reading,
        frequencyRank,
        partsOfSpeech,
        meaningsChunks,
        meaningsPartOfSpeech,
        knownState,
        pitchAccent,
      } = vocab;

      return {
        wordId,
        readingIndex,
        spelling,
        reading,
        frequencyRank,
        partsOfSpeech: Array.isArray(partsOfSpeech) ? partsOfSpeech : [partsOfSpeech],
        meanings: meaningsChunks.map((glosses, i) => ({
          glosses,
          partsOfSpeech: meaningsPartOfSpeech[i],
        })),
        cardState:
          knownState == 0
            ? ['new']
            : knownState == 1
              ? ['young']
              : knownState == 3
                ? ['blacklisted']
                : ['mature'],
        pitchAccent: pitchAccent ?? [],
        wordWithReading: null,
      };
    });
  }

  private parseTokens(
    tokens: JitenToken[][],
    cards: JitenCard[],
    vocabulary: JitenRawVocabulary[],
  ): JitenToken[][] {
    return tokens.map((group) => {
      let lastPitchClass = '';

      return group.map((token) => {
        const vocabEntry = vocabulary.find((v) => {
          return v.wordId === token.wordId && v.readingIndex === token.readingIndex;
        });

        const card = cards.find(
          (c) => c.wordId === token.wordId && c.readingIndex === token.readingIndex,
        )!;

        const isParticle = card.partsOfSpeech.includes('prt');
        const pitchClass = isParticle ? '' : getPitchClass(card.pitchAccent, card.reading);

        lastPitchClass = pitchClass || lastPitchClass;

        const rubies = vocabEntry?.reading
          ? this.extractRubiesFromAnnotated(vocabEntry.reading).map((ruby) => ({
              ...ruby,
              start: token.start + ruby.start,
              end: token.start + ruby.start + ruby.length,
            }))
          : [];

        const updated: JitenToken = {
          ...token,
          card,
          pitchClass: lastPitchClass,
          rubies,
        };

        if (card) {
          this.assignWordWithReadingJiten(updated, card);
        }

        return updated;
      });
    });
  }

  private assignWordWithReadingJiten(token: JitenToken, card: JitenCard): void {
    const ruby = token.rubies;
    const offset = token.start;
    const kanji = card.spelling;

    if (!ruby.length) {
      return;
    }

    const word = kanji.split('');

    for (let i = ruby.length - 1; i >= 0; i--) {
      const { text, start, length } = ruby[i];

      word.splice(start - offset + length, 0, `[${text}]`);
    }

    card.wordWithReading = word.join('');
  }

  private addSentenceInfo(paragraphs: string[], tokens: JitenToken[][]): void {
    paragraphs.forEach((paragraph, i) => {
      const tokenData = tokens[i];
      const sentences = this.splitJapaneseTextIntoSentences(paragraph);

      if (sentences.length === 1) {
        tokenData.forEach((token) => {
          token.sentence = sentences[0];
        });

        return;
      }

      let offset = 0;

      for (const sentence of sentences) {
        const compareSentence = sentence.replace(/(^[「『])|([。！？」』]$)/g, ''); // Trim quotation marks and sentence-ending punctuation from start and end
        const positionInParagraphs = paragraph.substring(offset).indexOf(compareSentence);

        if (positionInParagraphs === -1) {
          offset += sentence.length;

          return;
        }

        const sentenceStart = offset + positionInParagraphs;
        const sentenceEnd = sentenceStart + sentence.length;

        for (const token of tokenData) {
          if (token.start >= sentenceStart && token.end <= sentenceEnd) {
            token.sentence = sentence;
          }
        }

        offset += sentence.length;
      }
    });
  }

  private splitJapaneseTextIntoSentences(text: string): string[] {
    // Regular expression to match sentence-ending punctuation marks and quotation marks
    const sentenceEndRegex = /.*?[。！？」』](?=\s?|$)|「.*?」|『.*?』/g;
    const sentences = text.match(sentenceEndRegex) || [];

    return sentences.length
      ? sentences
          .map((sentence) => sentence.trim())
          .filter(Boolean)
          .filter((sentence) => !/^[」』]$/.exec(sentence))
          .map((sentence) => {
            // If the sentence is a quotation, return it as is
            if (/「.*?」|『.*?』/.exec(sentence)) {
              return sentence;
            }

            // If a quotation contained multiple sentences, remove the quotation marks
            const trimmed = sentence.replace(/(^「|『)|(」|』$)/, '');

            // Add a period at the end of the sentence if it doesn't already have a sentence-ending punctuation mark
            return /[。！？]$/.exec(trimmed) ? trimmed : `${trimmed}。`;
          })
      : [text];
  }
}
