import { parse } from '@shared/jiten/parse';
import { JitenCard, JitenRawVocabulary, JitenToken, JitenRuby } from '@shared/jiten/types';
import { Batch } from './parser.types';
import { getPitchClass } from './pitch-accent-utils';

type PrefixReadings = readonly [prefix: string, reading: string][];

// First prefix match wins, so longer prefixes come first.
const KURU_READINGS: PrefixReadings = [
  ['ない', 'こ'],
  ['なか', 'こ'],
  ['なく', 'こ'],
  ['なけ', 'こ'],
  ['なきゃ', 'こ'],
  ['れば', 'く'],
  ['りゃ', 'く'],
  ['る', 'く'],
  ['な', 'き'],
  ['た', 'き'],
  ['て', 'き'],
  ['ま', 'き'],
  ['ち', 'き'],
  ['そう', 'き'],
  ['と', 'き'],
  ['や', 'き'],
  ['つ', 'き'],
  ['っ', 'き'],
  ['れ', 'こ'],
  ['ら', 'こ'],
  ['さ', 'こ'],
  ['よ', 'こ'],
  ['い', 'こ'],
  ['ず', 'こ'],
  ['ぬ', 'こ'],
  ['ね', 'こ'],
  ['ん', 'こ'],
];

// うる survives only in the plain and べき forms; every other conjugation of 得る reads え (あり得ない, あり得ます).
const URU_READINGS: PrefixReadings = [
  ['る', 'う'],
  ['べ', 'う'],
];

export class Parser {
  constructor(private batch: Batch) {}

  public async parse(): Promise<void> {
    const paragraphs = this.batch.strings;
    const { tokens, vocabulary } = await parse(paragraphs, { failFastOnRateLimit: true });

    const cards = this.vocabToCard(vocabulary);
    const parsedTokens = this.parseTokens(tokens, cards, vocabulary, paragraphs);

    this.addSentenceInfo(paragraphs, parsedTokens);

    for (const [i, handle] of this.batch.handles.entries()) {
      handle.resolve(parsedTokens[i]);
    }
  }

  private extractRubiesFromAnnotated(input: string): JitenRuby[] {
    const rubies: JitenRuby[] = [];

    // Group 1: Prefix (any text before the target, including newlines)
    // Group 2: The Base (any non-kana run, so digits like １ in １[いっ]本[ぽん] carry their own reading)
    // Group 3: The Ruby (inside brackets)
    const regex = /((?:.|\n)*?)([^\u3040-\u309f\u30a0-\u30ff[\]]+)\[([^\]]+)\]/g;

    let match: RegExpExecArray | null;
    let currentOffset = 0; // This tracks the position in the CLEAN (displayed) string

    while ((match = regex.exec(input)) !== null) {
      const prefix = match[1]; // e.g., "もう" in "もう一度"
      const base = match[2]; // e.g., "一度"
      const ruby = match[3]; // e.g., "いちど"

      // 1. Advance offset past the prefix (plain text that has no ruby); stray [reading] groups are not displayed
      currentOffset += prefix.replace(/\[[^\]]*\]/g, '').length;

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

  /** Moves dictionary-form rubies onto the token's surface text, dropping any whose base the surface does not share. */
  private alignRubiesToSurface(
    rubies: JitenRuby[],
    vocab: JitenRawVocabulary,
    paragraph: string,
    token: JitenToken,
  ): JitenRuby[] {
    const dictionaryText = vocab.reading.replace(/\[[^\]]*\]/g, '');
    const surface = paragraph.slice(token.start, token.end);

    return rubies.flatMap((ruby) => {
      const base = dictionaryText.slice(ruby.start, ruby.end);

      if (surface.slice(ruby.start, ruby.end) !== base) {
        return [];
      }

      const text =
        dictionaryText.slice(ruby.end) === 'る'
          ? this.getVerbFinalReading(base, ruby.text, paragraph.slice(token.start + ruby.end))
          : ruby.text;

      if (!text) {
        return [];
      }

      return [{ ...ruby, text, start: token.start + ruby.start, end: token.start + ruby.end }];
    });
  }

  /** The kanji's reading in a verb ending in ruby + る (やって来[く]る, あり得[う]る), where 来 and 得 change reading with the conjugation. */
  private getVerbFinalReading(
    base: string,
    reading: string,
    following: string,
  ): string | undefined {
    if ((base === '来' || base === '來') && reading === 'く') {
      return this.matchFollowing(KURU_READINGS, following);
    }

    if (base === '得' && reading === 'う') {
      return this.matchFollowing(URU_READINGS, following) ?? 'え';
    }

    return reading;
  }

  private matchFollowing(table: PrefixReadings, following: string): string | undefined {
    const next = following
      .slice(0, 3)
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

    return table.find(([prefix]) => next.startsWith(prefix))?.[1];
  }

  private vocabToCard(vocabulary: JitenRawVocabulary[]): JitenCard[] {
    const CARD_STATE_MAP: Record<number, string> = {
      0: 'new',
      1: 'young',
      2: 'mature',
      3: 'blacklisted',
      4: 'due',
      5: 'mastered',
      6: 'redundant',
      7: 'suspended',
    };

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
        pitchAccents,
        studyDeckIds,
      } = vocab;

      const cardState = knownState
        .map((state) => CARD_STATE_MAP[state])
        .filter((s): s is string => s !== undefined);

      if (cardState.length === 0) {
        cardState.push('mature');
      }

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
        cardState,
        pitchAccents: pitchAccents ?? [],
        wordWithReading: null,
        deckIds: studyDeckIds ?? [],
      };
    });
  }

  private buildLookupKey(wordId: number, readingIndex: number): string {
    return `${wordId}:${readingIndex}`;
  }

  private parseTokens(
    tokens: JitenToken[][],
    cards: JitenCard[],
    vocabulary: JitenRawVocabulary[],
    paragraphs: string[],
  ): JitenToken[][] {
    const vocabMap = new Map<string, JitenRawVocabulary>();
    const cardMap = new Map<string, JitenCard>();

    for (const v of vocabulary) {
      vocabMap.set(this.buildLookupKey(v.wordId, v.readingIndex), v);
    }

    for (const c of cards) {
      cardMap.set(this.buildLookupKey(c.wordId, c.readingIndex), c);
    }

    return tokens.map((group, i) => {
      let lastPitchClass = '';

      return group.map((token) => {
        const key = this.buildLookupKey(token.wordId, token.readingIndex);
        const vocabEntry = vocabMap.get(key);
        const card = cardMap.get(key)!;

        const isParticle = card.partsOfSpeech.includes('prt');
        const pitchClass = isParticle ? '' : getPitchClass(card.pitchAccents, card.reading);

        lastPitchClass = pitchClass || lastPitchClass;

        const dictionaryRubies = vocabEntry?.reading
          ? this.extractRubiesFromAnnotated(vocabEntry.reading)
          : [];
        const rubies = vocabEntry
          ? this.alignRubiesToSurface(dictionaryRubies, vocabEntry, paragraphs[i], token)
          : [];

        const updated: JitenToken = {
          ...token,
          card,
          pitchClass: lastPitchClass,
          rubies,
        };

        if (card) {
          this.assignWordWithReadingJiten(card, dictionaryRubies);
        }

        return updated;
      });
    });
  }

  private assignWordWithReadingJiten(card: JitenCard, rubies: JitenRuby[]): void {
    if (!rubies.length) {
      return;
    }

    const word = card.spelling.split('');

    // Misaligned rubies would garble the headword; leaving it null falls back to the plain spelling
    if (rubies.some(({ start, length }) => start + length > word.length)) {
      return;
    }

    for (let i = rubies.length - 1; i >= 0; i--) {
      const { text, start, length } = rubies[i];

      word.splice(start + length, 0, `[${text}]`);
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

      for (let s = 0; s < sentences.length; s++) {
        const sentence = sentences[s];
        const compareSentence = sentence.replace(/(^[「『])|([。！？」』]$)/g, '');
        const positionInParagraphs = paragraph.substring(offset).indexOf(compareSentence);

        if (positionInParagraphs === -1) {
          continue;
        }

        const sentenceStart = offset + positionInParagraphs;

        const nextCompareSentence = sentences[s + 1]?.replace(/(^[「『])|([。！？」』]$)/g, '');
        const nextPosition = nextCompareSentence
          ? paragraph.indexOf(nextCompareSentence, sentenceStart + compareSentence.length)
          : -1;
        const sentenceEnd = nextPosition !== -1 ? nextPosition : paragraph.length;

        for (const token of tokenData) {
          if (token.start >= sentenceStart && token.end <= sentenceEnd) {
            token.sentence = sentence;
          }
        }

        offset = sentenceStart + compareSentence.length;
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
