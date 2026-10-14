import { JitenCardState } from '@shared/jiten/types';
import { Registry } from '../integration/registry';
import { StatusBarStats } from './types';

export type CoverageStats = {
  total: number;
  known: number;
  young: number;
  uniqueTotal: number;
  uniqueKnown: number;
  uniqueYoung: number;
};

export function calculateStatsFromRegistry(): StatusBarStats {
  const stats: StatusBarStats = {
    total: 0,
    mastered: 0,
    mature: 0,
    young: 0,
    blacklisted: 0,
    new: 0,
    due: 0,
  };

  for (const card of Registry.getAllCards().values()) {
    stats.total++;

    if (card.cardState.includes(JitenCardState.MATURE)) {
      stats.mature++;
    }

    if (card.cardState.includes(JitenCardState.YOUNG)) {
      stats.young++;
    }

    if (card.cardState.includes(JitenCardState.BLACKLISTED)) {
      stats.blacklisted++;
    }

    if (card.cardState.includes(JitenCardState.MASTERED)) {
      stats.mastered++;
    }

    if (card.cardState.includes(JitenCardState.DUE)) {
      stats.due++;
    }

    if (card.cardState.includes(JitenCardState.NEW)) {
      stats.new++;
    }
  }

  return stats;
}

export function calculateCoverageFromDOM(): CoverageStats {
  const stats: CoverageStats = {
    total: 0,
    known: 0,
    young: 0,
    uniqueTotal: 0,
    uniqueKnown: 0,
    uniqueYoung: 0,
  };
  const seenWords = new Set<string>();

  const elements = document.querySelectorAll('.jiten-word');

  for (const element of elements) {
    if (element.classList.contains('unparsed') || element.classList.contains('misparsed')) {
      continue;
    }

    stats.total++;

    const wordId = element.getAttribute('wordId');
    const readingIndex = element.getAttribute('readingIndex');
    const key = `${wordId}/${readingIndex}`;
    const isUnique = !seenWords.has(key);

    if (isUnique) {
      seenWords.add(key);
      stats.uniqueTotal++;
    }

    if (
      element.classList.contains('mature') ||
      element.classList.contains('mastered') ||
      element.classList.contains('blacklisted')
    ) {
      stats.known++;

      if (isUnique) {
        stats.uniqueKnown++;
      }
    } else if (element.classList.contains('young')) {
      stats.young++;

      if (isUnique) {
        stats.uniqueYoung++;
      }
    }
  }

  return stats;
}

function toPercentage(part: number, whole: number): number {
  if (whole === 0) {
    return 0;
  }

  return Math.round((part / whole) * 100);
}

export function calculateCoverage(stats: CoverageStats): number {
  return toPercentage(stats.known, stats.total);
}

export function calculateUniqueCoverage(stats: CoverageStats): number {
  return toPercentage(stats.uniqueKnown, stats.uniqueTotal);
}

// Derived from the rounded combined figure so coverage plus young coverage never exceeds 100.
export function calculateYoungCoverage(stats: CoverageStats): number {
  return toPercentage(stats.known + stats.young, stats.total) - calculateCoverage(stats);
}

export function calculateUniqueYoungCoverage(stats: CoverageStats): number {
  return (
    toPercentage(stats.uniqueKnown + stats.uniqueYoung, stats.uniqueTotal) -
    calculateUniqueCoverage(stats)
  );
}

export function getCoverageColour(percentage: number): string {
  const hue = Math.round(percentage * 1.42);

  return `hsl(${hue}, 78%, 52%)`;
}
