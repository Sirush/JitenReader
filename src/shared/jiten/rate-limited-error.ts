export class RateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super('jiten.moe rate limit reached');
  }
}
