/**
 * 안전한 localStorage 래퍼.
 *
 * 직접 `localStorage.getItem` / `setItem` 호출 시 다음 상황에서 throw:
 *  - 시크릿/InPrivate 모드 (Safari 일부 버전)
 *  - quota exceeded (5MB 한계 초과)
 *  - 브라우저 확장 프로그램이 prototype 변경
 *  - SSR (window 미정의)
 *
 * 이 래퍼는 모든 경우에 silent fail 하고 fallback 값을 반환.
 *
 * @example
 *   storage.get('user_id')                 // null on fail
 *   storage.get('count', '0')              // fallback
 *   storage.set('cart', JSON.stringify(x)) // boolean (성공 여부)
 *   storage.remove('expired_token')
 *   storage.getJSON<User>('user', null)
 */

const isAvailable = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

export const storage = {
  /** localStorage.getItem with try-catch. fallback 기본값 null. */
  get(key: string, fallback: string | null = null): string | null {
    if (!isAvailable()) return fallback;
    try {
      const v = window.localStorage.getItem(key);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  },

  /** localStorage.setItem with try-catch. quota exceeded 시 false 반환. */
  set(key: string, value: string): boolean {
    if (!isAvailable()) return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  /** localStorage.removeItem with try-catch. */
  remove(key: string): void {
    if (!isAvailable()) return;
    try {
      window.localStorage.removeItem(key);
    } catch { /* ignore */ }
  },

  /** JSON.parse with try-catch. parse 실패 시 fallback. */
  getJSON<T>(key: string, fallback: T): T {
    const raw = storage.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  /** JSON.stringify + setItem. set 실패 시 false. */
  setJSON<T>(key: string, value: T): boolean {
    try {
      return storage.set(key, JSON.stringify(value));
    } catch {
      return false;
    }
  },

  /** key 존재 여부 (null 과 빈 문자열 모두 false). */
  has(key: string): boolean {
    const v = storage.get(key);
    return v !== null && v !== '';
  },
};
