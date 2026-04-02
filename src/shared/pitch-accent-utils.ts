const smallNonMora = new Set(['ゃ', 'ゅ', 'ょ', 'ャ', 'ュ', 'ョ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ']);

const splitMorae = (reading: string): string[] => {
  const morae: string[] = [];

  for (const ch of reading) {
    if (morae.length > 0 && smallNonMora.has(ch)) {
      morae[morae.length - 1] += ch;
    } else {
      morae.push(ch);
    }
  }

  return morae;
};

export const cleanReading = (reading: string): string =>
  reading.replace(/[\u4E00-\u9FFF\u3400-\u4DBF\uFF10-\uFF5A\[\]A-Za-z0-9]/g, '');

export type PitchDiagramData = {
  morae: string[];
  pattern: number[];
  patternName: string;
  color: string;
};

const PITCH_COLORS: Record<string, string> = {
  heiban: '#d20ca3',
  atamadaka: '#ea9316',
  nakadaka: '#27a2ff',
  odaka: '#0cd24d',
  unknown: '#cccccc',
};

export const getPitchDiagramData = (reading: string, pitchNum: number): PitchDiagramData | null => {
  const morae = splitMorae(reading);
  const moraCount = morae.length;

  if (moraCount === 0) {
    return null;
  }

  const pattern: number[] = [];

  if (pitchNum === 0) {
    pattern.push(0);

    for (let i = 1; i < moraCount; i++) {
      pattern.push(1);
    }

    pattern.push(1);
  } else {
    pattern.push(pitchNum === 1 ? 1 : 0);

    for (let i = 1; i < moraCount; i++) {
      pattern.push(i < pitchNum ? 1 : 0);
    }

    pattern.push(0);
  }

  let patternName: string;

  if (pitchNum === 0) {
    patternName = 'heiban';
  } else if (pitchNum === 1) {
    patternName = 'atamadaka';
  } else if (pitchNum === moraCount) {
    patternName = 'odaka';
  } else if (pitchNum > 1 && pitchNum < moraCount) {
    patternName = 'nakadaka';
  } else {
    patternName = 'unknown';
  }

  return {
    morae,
    pattern,
    patternName,
    color: PITCH_COLORS[patternName] || PITCH_COLORS.unknown,
  };
};
