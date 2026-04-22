/**
 * localStorage 안전 래퍼.
 *
 * iOS Private mode, 쿼터 초과, Safari ITP 등으로 localStorage 접근이
 * 예외를 던질 수 있다. 모든 접근을 try/catch로 감싸고 기본값을 제공한다.
 *
 * 현재 코드베이스 전역에 있는 284개+ 직접 접근은 점진적으로 이 래퍼로
 * 교체하면 된다. 새 코드에서는 반드시 이 래퍼를 사용할 것.
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },

  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // no-op
    }
  },

  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return fallback
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },

  setJSON(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },
}
