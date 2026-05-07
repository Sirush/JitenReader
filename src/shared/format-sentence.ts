const MAX_SENTENCE_LENGTH = 150;
const MARKER_OVERHEAD = 4; // length of "**" + "**"

export const formatSentenceWithMarkers = (
  sentence: string,
  surfaceForm: string,
): string | undefined => {
  if (!sentence || !surfaceForm) {
    return undefined;
  }

  const index = sentence.indexOf(surfaceForm);

  if (index === -1) {
    return undefined;
  }

  const marked =
    sentence.slice(0, index) + `**${surfaceForm}**` + sentence.slice(index + surfaceForm.length);

  if (marked.length <= MAX_SENTENCE_LENGTH) {
    return marked;
  }

  const budget = MAX_SENTENCE_LENGTH - surfaceForm.length - MARKER_OVERHEAD;

  if (budget <= 0) {
    return undefined;
  }

  const before = sentence.slice(0, index);
  const after = sentence.slice(index + surfaceForm.length);
  const halfBudget = Math.floor(budget / 2);

  const trimmedBefore = before.length > halfBudget ? before.slice(-halfBudget) : before;
  const remainingBudget = budget - trimmedBefore.length;
  const trimmedAfter = after.length > remainingBudget ? after.slice(0, remainingBudget) : after;

  return trimmedBefore + `**${surfaceForm}**` + trimmedAfter;
};
