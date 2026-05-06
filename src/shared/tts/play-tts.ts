import { runtime } from '../extension/runtime';

export function stopTts(): void {
  runtime.sendMessage({ type: 'stopTts' }, () => {
    void runtime.lastError;
  });
}

export async function playTts(wordId: number, readingIndex: number, voice: string): Promise<void> {
  const response = await new Promise<{ ok: boolean; error?: string }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('TTS timeout')), 20_000);

    runtime.sendMessage({ type: 'playTts', wordId, readingIndex, voice }, (res) => {
      clearTimeout(timeout);

      if (runtime.lastError) {
        return reject(new Error(runtime.lastError.message));
      }

      resolve(res as { ok: boolean; error?: string });
    });
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? 'TTS playback failed');
  }
}
