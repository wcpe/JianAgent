/**
 * Execute a function that may throw (e.g. mineflayer API calls on a disconnected bot)
 * and return a default value on failure. Optionally logs the error.
 */
export function safeExec<T>(fn: () => T, fallback: T, onError?: (err: unknown) => void): T {
  try {
    return fn();
  } catch (err) {
    onError?.(err);
    return fallback;
  }
}

export async function safeExecAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (err: unknown) => void,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    onError?.(err);
    return fallback;
  }
}
