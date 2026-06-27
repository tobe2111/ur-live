/**
 * 🏭 2026-06-01 유통스타트 도메인 인식 (Phase 5).
 * live.ur-team.com = 소비자몰 / utongstart.com = 도매몰. 같은 코드·DB, 진입 화면만 분기.
 */

/** 도매몰 도메인 호스트 목록 (서브도메인 포함). */
const WHOLESALE_HOSTS = ['utongstart.com', 'www.utongstart.com']

/** 현재 접속이 유통스타트(도매몰) 도메인인지. SSR/비브라우저 환경에선 false. */
export function isUtongstart(): boolean {
  if (typeof window === 'undefined' || !window.location) return false
  const host = window.location.hostname.toLowerCase()
  if (WHOLESALE_HOSTS.includes(host)) return true
  // 로컬/프리뷰 테스트용 — ?wholesale=1 또는 utongstart 포함 호스트
  if (host.includes('utongstart')) return true
  try {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('wholesale') === '1') return true
  } catch { /* noop */ }
  return false
}

// 🏭 2026-06-04 도매몰 도메인 게이팅 (SPA 가드).
//   utongstart.com 에서 허용되는 경로 prefix. worker(src/worker/index.ts `WHOLESALE_ALLOWED_PATHS`)
//   와 동일 — 한쪽 변경 시 반드시 같이 갱신. worker 302 가 주 방어, 이건 SPA navigate() 보강.
//   ⚠️ 추가만 OK — 제거 시 도매몰에 소비자몰 페이지가 노출됨.
const WHOLESALE_ALLOWED_PATHS = [
  '/wholesale', '/supplier',            // 도매몰 + 제조사 surface
  '/seller/login', '/seller/register',  // 판매사 = 셀러 계정 인증
  '/auth/', '/login',                   // 카카오 OAuth 콜백 / 로그인
]

/** utongstart.com 에서 해당 SPA 경로가 도매몰 surface 인지 (밖이면 /wholesale/intro 로 보냄). */
export function isWholesaleAllowedPath(pathname: string): boolean {
  for (const p of WHOLESALE_ALLOWED_PATHS) {
    if (pathname === p) return true
    if (pathname.startsWith(p.endsWith('/') ? p : p + '/')) return true
  }
  return false
}

/**
 * 🏭 도매몰(B2B) surface 판별 SSOT — `/wholesale*`·`/supplier*`.
 *
 * "소비자 chrome(BottomNav·DesktopTopNav·검색바)이 절대 렌더되면 안 되는 경로"의
 * 단일 진실원천. worker(`src/worker/index.ts:isWholesaleSurface` `/^\/(wholesale|supplier)(\/|$)/`)
 * 와 **동일 규칙** — 한쪽 변경 시 같이 갱신.
 *
 * 도메인 무관(live.ur-team.com / utongstart.com 양쪽 동일). 소비자 nav 컴포넌트가
 * 직접 호출해 자기-차단(이중 방어). App.tsx 의 hideBottomNav allowlist 가 깨져도
 * 컴포넌트 단에서 한 번 더 막아 도매몰에 소비자 UI 누출을 구조적으로 차단.
 */
export function isWholesaleSurface(pathname: string): boolean {
  return /^\/(wholesale|supplier)(\/|$)/.test(pathname)
}

/**
 * 🆕 2026-06-26 유어애즈(UR Ads, /ads) — 3번째 서비스. 도매몰처럼 PC 풀너비 + 소비자 chrome 비노출.
 *   worker(`isMarketingSurface` `/^\/(ads)(\/|$)/`)와 동일 규칙.
 */
export function isMarketingSurface(pathname: string): boolean {
  return /^\/ads(\/|$)/.test(pathname)
}
