import { readStorage } from '@shared/extension/read-storage';
import { writeStorage } from '@shared/extension/write-storage';

const STORAGE_KEY = 'ajb-mass-review-cooldown';
const HOUR_MS = 3_600_000;

type CooldownMap = Record<string, number>;

const key = (wordId: number, readingIndex: number): string => `${wordId}/${readingIndex}`;

/**
 * Persisted per-word cooldown so the same word isn't pushed through the SRS as "good"
 * repeatedly over a short period (e.g. re-reviewing the same words across pages).
 */
export class ReviewCooldown {
  private static cache?: CooldownMap;

  public static async isCoolingDown(
    wordId: number,
    readingIndex: number,
    cooldownHours: number,
  ): Promise<boolean> {
    if (cooldownHours <= 0) {
      return false;
    }

    const map = await this.load();
    const timestamp = map[key(wordId, readingIndex)];

    return timestamp !== undefined && Date.now() - timestamp < cooldownHours * HOUR_MS;
  }

  public static async mark(
    entries: { wordId: number; readingIndex: number }[],
    cooldownHours: number,
  ): Promise<void> {
    const map = await this.load();
    const now = Date.now();

    for (const entry of entries) {
      map[key(entry.wordId, entry.readingIndex)] = now;
    }

    if (cooldownHours > 0) {
      const cutoff = now - cooldownHours * HOUR_MS;

      for (const storedKey of Object.keys(map)) {
        if (map[storedKey] < cutoff) {
          delete map[storedKey];
        }
      }
    }

    this.cache = map;
    await writeStorage(STORAGE_KEY, JSON.stringify(map));
  }

  private static async load(): Promise<CooldownMap> {
    if (this.cache) {
      return this.cache;
    }

    try {
      this.cache = JSON.parse(await readStorage(STORAGE_KEY, '{}')) as CooldownMap;
    } catch {
      this.cache = {};
    }

    return this.cache;
  }
}
