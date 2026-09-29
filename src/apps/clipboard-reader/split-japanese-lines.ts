export interface TextLine {
  text: string;
  japanese: boolean;
}

const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

export const splitJapaneseLines = (text: string): TextLine[][] =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ text: line, japanese: KANA.test(line) })),
    )
    .filter((block) => block.length > 0);

export const japaneseOnly = (text: string): string =>
  splitJapaneseLines(text)
    .flat()
    .filter((line) => line.japanese)
    .map((line) => line.text)
    .join('\n');
