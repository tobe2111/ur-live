/**
 * DB query helpers — defensive wrappers around D1 / async DB operations.
 *
 * D1 itself enforces internal timeouts, so `queryWithTimeout` is primarily
 * belt-and-suspenders: it guarantees a bounded wait for any single awaited
 * operation even if the underlying driver stalls.
 */

/**
 * Race a promise against a timeout. Rejects with a descriptive error if the
 * promise does not settle within `timeoutMs`.
 *
 * @param promise    The operation to race.
 * @param timeoutMs  Timeout in milliseconds. Default 5000.
 * @param label      Human-readable label used in the timeout error message.
 */
export async function queryWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 5000,
  label = 'DB query'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timeout after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
