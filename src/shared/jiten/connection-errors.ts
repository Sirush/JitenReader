export const JITEN_TIMEOUT_MESSAGE = 'jiten.moe did not respond in time';
export const JITEN_UNREACHABLE_MESSAGE = 'jiten.moe is unreachable';

export const CONNECTION_ERROR_MESSAGES: readonly string[] = [
  JITEN_TIMEOUT_MESSAGE,
  JITEN_UNREACHABLE_MESSAGE,
];

// Errors reach content scripts as a bare message, so fetch failures are reworded before the DOMException is lost.
export const toConnectionError = (error: unknown): Error =>
  error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
    ? new Error(JITEN_TIMEOUT_MESSAGE)
    : new Error(JITEN_UNREACHABLE_MESSAGE);
