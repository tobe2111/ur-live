/**
 * 🧭 옛 유어샵 주소(`/u/<바뀌기 전 핸들>`)는 서버가 새 주소로 바로 넘긴다 (2026-11-13 대표 *"유어샵 … 최적화 극대화"*).
 *
 * ## 무엇이 문제였나 (라이브 실측 · 폰 4G·CPU 4배)
 *   핸들이 바뀐 유어샵(`/u/jiwon` → `jiwon1228`)을 옛 주소로 열면, 서버는 시드에 `HANDLE_MOVED` 만 담아 **로더**를 내주고,
 *   앱이 켜진 **뒤에야** `CuratorPage` 가 새 주소로 다시 갔다 — 첫 글자 폰 **1.4~1.5s** · PC 1.7s · 가장 큰 그림 2.3~2.6s
 *   (새 주소로 바로 열면 0.76~0.81s). 바뀌기 전에 공유된 링크가 전부 이 길로 온다.
 *
 * ## 처방
 *   워커는 그 시드를 **이미 받아 들고 있다** — `HANDLE_MOVED` 면 302. 새 조회 0. 이용권의 `productCanonicalRedirect` 와 같은 모양.
 *   🔴 쿼리가 붙은 주소(`?ref=` 등 귀속)는 손대지 않는다 — 호출부가 `url.search` 가 빌 때만 부른다(종전대로 앱이 처리).
 *   302 인 이유: 옛 핸들은 다른 사람이 다시 가질 수 있다 — 301 은 브라우저가 영구 기억한다.
 */
const HANDLE_RE = /^[A-Za-z0-9_-]{1,40}$/

export function curatorMovedRedirect(ssrPayload: string | null | undefined, pathname: string): string | null {
  try {
    if (!ssrPayload) return null
    const m = /^\/u\/([A-Za-z0-9_-]{1,40})\/?$/.exec(pathname)
    if (!m || m[1] === 'me') return null
    const d = JSON.parse(ssrPayload) as { success?: boolean; code?: string; new_handle?: string }
    if (d?.code !== 'HANDLE_MOVED' || typeof d.new_handle !== 'string' || !HANDLE_RE.test(d.new_handle)) return null
    if (d.new_handle === m[1] || d.new_handle === 'me') return null
    return `/u/${d.new_handle}`
  } catch { return null }
}
