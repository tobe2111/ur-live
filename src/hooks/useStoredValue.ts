import { useCallback, useSyncExternalStore } from 'react'

/**
 * 🧊 localStorage 값을 **렌더 중에 안전하게** 읽는다 (2026-10-15 상세 서버 렌더 2단계).
 *
 * 렌더 본문에서 `localStorage.getItem` 을 바로 부르면 두 가지가 깨진다:
 *   ① 서버(워커) 렌더 — `localStorage` 가 없어 **던진다**(페이지 전체가 실패).
 *   ② hydrate — 서버는 '없음', 브라우저는 '있음'을 그려 **결과가 갈린다**(React 가 그 루트를 버리고 다시 그린다).
 *
 * `useSyncExternalStore` 의 서버 스냅샷이 둘을 한 번에 푼다:
 *   - 서버·hydrate 첫 렌더 → `null`(서버와 같은 값) → hydrate 직후 브라우저 값으로 한 번 다시 그린다.
 *   - 보통의 브라우저 렌더(createRoot) → 첫 렌더부터 실제 값. **오늘 화면은 한 프레임도 안 바뀐다.**
 * 같은 탭의 쓰기는 `storage` 이벤트가 안 오지만, React 가 렌더마다 스냅샷을 다시 읽으므로 종전(렌더마다 읽기)과 같다.
 */
function subscribeStorage(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

export function readStored(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}

const serverNull = () => null

export function useStoredValue(key: string): string | null {
  const get = useCallback(() => readStored(key), [key])
  return useSyncExternalStore(subscribeStorage, get, serverNull)
}
