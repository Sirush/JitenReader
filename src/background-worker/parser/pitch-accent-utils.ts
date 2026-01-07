// Small yoon vowels that do NOT form a separate mora (small tsu DOES count as a mora)
const smallNonMora = new Set(['ゃ', 'ゅ', 'ょ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ']);

const countMorae = (reading: string): number => {
  let count = 0;

  for (const ch of reading) {
    if (!smallNonMora.has(ch)) {
      count++;
    }
  }

  return count;
};

export const getPitchClass = (pitchAccent: number[], reading: string): string => {
  if (!pitchAccent.length) {
    return '';
  }

  const [accent] = pitchAccent; // hatsuon accent number: 0, 1, 2, ...
  const morae = countMorae(reading);

  // Map accent number to pattern name
  if (accent === 0) {
    return 'heiban';
  }

  // Maintain prior special-case behavior for 1-mora words
  if (morae === 1 && accent === 1) {
    return 'odaka';
  }

  if (accent === 1) {
    return 'atamadaka';
  }

  if (morae > 0 && accent === morae) {
    return 'odaka';
  }

  if (accent > 1 && accent < morae) {
    return 'nakadaka';
  }

  // If none matched, it's an unknown or unsupported pattern
  return 'unknown-pattern';
};
