/**
 * 🚪 **셀러 대시보드는 없다 — `/seller/*` 주소는 마이(사장님)·에이전시 콘솔(직원)의 시트로 연다**
 *   (2026-10-12 대표 *"셀러 대시보드를 없애는 것을 목표로"* → *"대시보드는 완전히 지워줘"*)
 *
 * ## 무엇을 하나
 * 대시보드 화면 파일들은 남아 있다 — 마이·콘솔이 **같은 파일을 시트로** 연다(`ToolPageSheet` 가 실제 라우트 표를
 * 메모리 라우터로 렌더한다). 지운 것은 그 화면들을 감싸던 **단독 틀**(머리줄·전체 메뉴·홈·더보기)이다.
 * 그래서 브라우저 주소창에 `/seller/orders` 가 찍히는 순간(알림톡·메일·외부 콜백·옛 북마크) 이 파일이
 * 어디서 열지 정한다 — **틀이 없으므로 언제나 어딘가로 보낸다.**
 *
 * ## 누구를 어디로
 * - 에이전시 직원(좌석 토큰이 에이전시 좌석이거나, 콘솔 로그인만 있고 소비자 계정이 없음) → `/agency?tool=…`
 *   콘솔 로그인이 없으면 콘솔이 로그인 화면을 띄우고, 로그인 뒤 같은 `?tool=` 로 돌아온다(`AgencyHomePage`).
 * - 그 밖의 모두(카카오 사장님 · 아직 로그인 안 한 사람 · 마이가 없는 옛 계정) → `/user/profile?tool=…`
 *   로그인이 없으면 마이가 카카오 로그인으로 보내고 로그인 뒤 돌아온다. 옛 이메일 셀러도 같은 이메일의 카카오로
 *   들어오면 매장이 자동 연결된다(`KakaoAuthService` same-email auto-link).
 * - 외부 OAuth 복귀 주소(`RENDER_BARE`) — 쿼리를 그 화면이 직접 읽어야 하므로 보내지 않고 **틀 없이** 렌더한다.
 *
 * ⚠️ 이 파일은 **판정만** 한다. 토큰을 발급하거나 좌석을 바꾸지 않는다.
 */
import { isAgencySeatToken } from '@/shared/agency-seat-token'
import { MY_PATH } from '@/lib/seller-return'

/** 마이·콘솔이 읽는 쿼리 이름 — 열 화면의 주소. */
export const TOOL_PARAM = 'tool'

/** 시트가 아니라 **첫 화면** 자체가 답인 주소 — 옛 대시보드 홈·더보기. 마이의 판매 구역·'전체 도구'가 같은 일을 한다. */
export const HOME_LIKE = new Set(['/seller', '/seller/dashboard', '/seller/more'])

/** 보내지 않고 **틀 없이** 그 자리에서 렌더한다 — 외부 OAuth 복귀 주소. 쿼리(code·state)를 그 화면이 직접 읽어야 한다. */
export const RENDER_BARE = new Set(['/seller/youtube/callback'])

/**
 * 🚪 대시보드 대신 갈 **전용 길** — 마이 · 에이전시 콘솔 · 깊은 링크가 같은 표를 읽는다(2026-10-12).
 *   - `scan`       → `/store/scan`(매장 계산대 — 전체화면, 좌석 토큰으로 매장을 고른다)
 *   - `voucherNew` → `?tool=` 로 보내고, 받는 쪽(마이·콘솔)이 `VoucherNewSheet` 로 연다
 * ⚠️ 이 파일에 두는 이유: 마이가 이미 정적으로 import 하는 작은 판정 파일이다. 시트 지도(`tool-pages.ts`)를
 *   마이가 정적으로 읽으면 시트 청크가 붙으므로, 그 파일은 여기서 **재수출**만 한다.
 */
export type OwnPath = 'scan' | 'voucherNew'

export const OWN_PATH: Record<string, OwnPath> = {
  '/seller/scan': 'scan',
  '/seller/meal-voucher/new': 'voucherNew',
}

/** 계산대 — 마이·에이전시 콘솔·깊은 링크가 **같은 화면**으로 간다(대시보드 `/seller/scan` 아님). */
export const STORE_SCAN_PATH = '/store/scan'

/** 경로(쿼리 포함 가능)의 전용 길. 없으면 `null`. */
export function ownPathFor(path: string): OwnPath | null {
  const base = path.split('?')[0]
  return Object.prototype.hasOwnProperty.call(OWN_PATH, base) ? OWN_PATH[base] : null
}

/** 홈류는 그 첫 화면으로, 계산대는 전용 전체화면으로, 나머지는 `?tool=` 로. */
function toolRedirect(base: string, pathname: string, search: string): string {
  if (HOME_LIKE.has(pathname)) return base
  const q = search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''
  if (ownPathFor(pathname) === 'scan') return STORE_SCAN_PATH + q
  return `${base}?${TOOL_PARAM}=${encodeURIComponent(pathname + q)}`
}

// ── 🏢 에이전시 직원 ─────────────────────────────────────────────────────────────
/** 에이전시 콘솔. 직원은 마이가 없다(이메일 로그인) — 콘솔이 고른 매장 판에서 같은 시트를 연다. */
export const AGENCY_CONSOLE_PATH = '/agency'
/** ⚠️ 짝: `src/pages/agency-console/agency-api.ts` `AGENCY_TOKEN_KEY` — 시험이 대조한다(이 파일은 페이지를 import 하지 않는다). */
export const AGENCY_CONSOLE_TOKEN_KEY = 'agency_console_token'

/**
 * 이 브라우저의 사람이 에이전시 직원인가. 좌석 토큰이 에이전시 좌석이면 그렇다. 좌석이 없어도 콘솔 로그인만 있고
 * 소비자 계정이 없으면 그렇다(좌석이 만료된 직원 — 마이로 보내면 카카오 로그인을 요구받는다).
 */
export function isAgencyWorker(): boolean {
  try {
    if (isAgencySeatToken(localStorage.getItem('seller_token'))) return true
    const consoleLogin = !!(localStorage.getItem(AGENCY_CONSOLE_TOKEN_KEY) || sessionStorage.getItem(AGENCY_CONSOLE_TOKEN_KEY))
    return consoleLogin && !localStorage.getItem('user_id')
  } catch { return false }
}

/**
 * 🚪 **`/seller/*` 주소로 온 사람이 실제로 갈 곳** — 단독 틀(`SellerLayout`)·옛 홈 라우트·버튼(`sellerEntryPath`)이
 *   모두 이 함수 하나를 쓴다. 두 벌이면 버튼과 깊은 링크가 서로 다른 곳으로 가는 날이 온다.
 * @returns 보낼 주소. `null` 은 셀러 주소가 아니거나 `RENDER_BARE`(틀 없이 그 자리에서 렌더).
 */
export function sellerEntryRedirect(pathname: string, search: string): string | null {
  if (pathname !== '/seller' && !pathname.startsWith('/seller/')) return null
  if (RENDER_BARE.has(pathname)) return null
  return toolRedirect(isAgencyWorker() ? AGENCY_CONSOLE_PATH : MY_PATH, pathname, search)
}

/** 버튼용 — `/seller/*` 주소를 받아 지금 이 사람이 실제로 도착할 주소를 준다(셀러 주소가 아니면 그대로). */
export function sellerEntryPath(path: string): string {
  const i = path.indexOf('?')
  const pathname = i < 0 ? path : path.slice(0, i)
  const search = i < 0 ? '' : path.slice(i)
  return sellerEntryRedirect(pathname, search) ?? path
}

/**
 * 마이 주소의 `?tool=` 을 읽는다. 셀러 화면 주소가 아니면 `null` — **외부 주소·`//`·역슬래시는 버린다**
 * (이 값은 시트의 메모리 라우터로 가고, 거기서 셀러 밖을 가리키면 `onLeave` 가 `location` 에 넣으므로 열린 리다이렉트를 막는다).
 */
export function readToolParam(search: string, param: string = TOOL_PARAM): string | null {
  const raw = new URLSearchParams(search).get(param)
  if (!raw) return null
  if (!raw.startsWith('/seller/') || raw.startsWith('//') || raw.includes('\\')) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f]/.test(raw)) return null
  return raw
}
