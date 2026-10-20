/**
 * Silent error swallow with optional DEV logging.
 *
 * 에러 삼키기 패턴 (`.catch(() => {})`) 대신 사용. 운영에선 silent, DEV 에선 console.warn.
 *
 * @example
 *   await DB.prepare(...).run().catch(swallow('agency:notify'));
 *   audio.play().catch(swallow('audio:autoplay-blocked'));
 */
export function swallow(label: string) {
  return (err: unknown) => {
    if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
      console.warn(`[swallow:${label}]`, err);
    } else if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn(`[swallow:${label}]`, err);
    }
    // Production: silent (의도된 graceful degradation)
  };
}

/**
 * Synchronous version (try/catch 안에서 사용).
 *
 * @example
 *   try { JSON.parse(s) } catch (e) { swallowSync('json:parse', e) }
 */
export function swallowSync(label: string, err: unknown): void {
  if (typeof window !== 'undefined' && (import.meta as any).env?.DEV) {
    console.warn(`[swallow:${label}]`, err);
  } else if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    console.warn(`[swallow:${label}]`, err);
  }
}
