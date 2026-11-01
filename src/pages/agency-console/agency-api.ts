/**
 * 🏢 에이전시 콘솔 전용 요청 도구.
 *
 * 공용 `@/lib/api`(axios)를 쓰지 않는다 — 그쪽 인터셉터는 소비자·셀러 토큰을 붙이고, 401 이면
 * 옛 에이전시 로그인 주소로 보내는 잔재 분기가 있다. 에이전시 직원 토큰은 **다른 열쇠**로 서명돼
 * 공용 API 에서는 통하지 않으므로(그래야 안전하다) 이 콘솔은 자기 토큰만 자기 API 에 보낸다.
 *
 * 토큰 자리도 옛 `agency_token` 과 **다른 이름**(`agency_console_token`)을 쓴다 — 옛 카카오 콜백이
 * 아직 `agency_token` 을 쓰는 경로가 남아 있어 섞이면 서로를 지운다.
 */
export const AGENCY_TOKEN_KEY = 'agency_console_token'
export const PROFILE_KEY = 'agency_console_profile'
/** 카카오로 이은 로그인을 그 손님에게 묶는 자리 — 정본은 `lib/agency-presence.ts`. */
import { AGENCY_KAKAO_UID_KEY } from '@/lib/agency-presence'

export interface AgencyStaffInfo {
  id: number; email: string; name: string | null; role: 'admin' | 'staff'; isOwner: boolean
  /** kakao = 카카오로 만든 혼자 쓰는 계정(2026-10-26) · email = 이메일 계정. 옛 캐시엔 없을 수 있다. */
  loginKind?: 'kakao' | 'email'
}
export interface AgencyInfo { id: number; name: string; kind: 'business' | 'individual'; businessNumber?: string | null }
export interface AgencyLoginPayload { token: string; expiresAt: number; staff: AgencyStaffInfo; agency: AgencyInfo }

export interface AgencyResult<T = Record<string, unknown>> {
  ok: boolean
  status: number
  data: T & { success?: boolean; error?: string; message?: string; code?: string }
}

function stores(): Storage[] {
  const out: Storage[] = []
  try { out.push(localStorage) } catch { /* 막힘 */ }
  try { out.push(sessionStorage) } catch { /* 막힘 */ }
  return out
}

export function readAgencyToken(): string {
  for (const s of stores()) {
    try { const v = s.getItem(AGENCY_TOKEN_KEY); if (v) return v } catch { /* 다음 */ }
  }
  return ''
}

/**
 * "이 컴퓨터에서 로그인 유지" — 켜면 브라우저를 닫아도 남고(localStorage), 끄면 이 탭을 닫는 순간
 * 사라진다(sessionStorage). 여러 사람이 쓰는 매장 컴퓨터에서 끄라고 있는 칸이다.
 */
export function saveAgencySession(p: AgencyLoginPayload, remember = true): void {
  clearAgencySession()
  try {
    const s = remember ? localStorage : sessionStorage
    s.setItem(AGENCY_TOKEN_KEY, p.token)
    s.setItem(PROFILE_KEY, JSON.stringify({ staff: p.staff, agency: p.agency }))
  } catch { /* 저장소가 막힌 브라우저 — 이번 화면에서만 못 이어간다 */ }
}

export function readAgencyProfile(): { staff: AgencyStaffInfo; agency: AgencyInfo } | null {
  for (const s of stores()) {
    try { const raw = s.getItem(PROFILE_KEY); if (raw) return JSON.parse(raw) } catch { /* 다음 */ }
  }
  return null
}

export function clearAgencySession(): void {
  for (const s of stores()) {
    try { s.removeItem(AGENCY_TOKEN_KEY); s.removeItem(PROFILE_KEY); s.removeItem(AGENCY_KAKAO_UID_KEY) } catch { /* 무시 */ }
  }
}

/**
 * 🏠 2026-10-26 대표 확정 **안 A** — 에이전시 화면은 마이 안 '에이전시' 구역이다(`/agency` 는 마이로 보낸다).
 *   마이의 `?tool=` 은 이미 사장님 판매 구역이 쓰므로, 에이전시 깊은 링크는 **다른 이름**(`atool`)으로 싣는다 —
 *   같은 이름이면 사장님 판과 에이전시 판이 같은 화면을 동시에 열려고 다툰다.
 */
export const AGENCY_TOOL_PARAM = 'atool'
export const AGENCY_MY_PATH = '/user/profile'
export function agencyMyPath(tool: string | null | undefined): string {
  return tool ? `${AGENCY_MY_PATH}?${AGENCY_TOOL_PARAM}=${encodeURIComponent(tool)}` : AGENCY_MY_PATH
}

/** 로그인 후 돌아갈 곳 — 콘솔 안쪽(`/agency` 아래)만 받는다. 밖으로 보내는 주소는 버린다. */
export function safeAgencyReturn(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/agency'
  if (!/^\/agency(\/|$|\?)/.test(raw)) return '/agency'
  if (/^\/agency\/(login|signup|verify|invite|reset)/.test(raw)) return '/agency'
  if (raw.includes('//') || raw.includes('\\')) return '/agency'
  return raw
}

export async function agencyRequest<T = Record<string, unknown>>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: unknown; auth?: boolean } = {},
): Promise<AgencyResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (init.auth !== false) {
    const token = readAgencyToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  try {
    const res = await fetch(`/api/agency-console${path}`, {
      method: init.method || 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: 'omit',
    })
    let data: AgencyResult<T>['data']
    try { data = await res.json() } catch { data = { success: false, error: '잠시 후 다시 시도해 주세요.' } as AgencyResult<T>['data'] }
    if (res.status === 401 && (data.code === 'AGENCY_AUTH_REQUIRED' || data.code === 'AGENCY_STAFF_INACTIVE')) {
      clearAgencySession()
    }
    return { ok: res.ok && data.success !== false, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { success: false, error: '인터넷 연결을 확인해 주세요.' } as AgencyResult<T>['data'] }
  }
}

// ── 🏢 2단계 — 맡은 매장에 들어가기 ─────────────────────────────────────────
/** 셀러 화면이 "에이전시로 운영 중" 띠를 그릴 때 읽는 이름 — 키 SSOT 는 띠 쪽. */
import { AGENCY_SEAT_NAME_KEY } from '@/shared/agency-seat-token'
import { bumpSeatGeneration } from '@/lib/seller-seat'

/**
 * 맡은 매장의 셀러 화면 좌석을 받아 심는다. 셀러 화면은 `seller_token` 하나로 매장을 고르므로 그 자리를 쓴다.
 * ⚠️ 이 브라우저에 남아 있던 **다른 사람의 셀러 refresh 토큰을 먼저 지운다** — 남겨 두면 에이전시 좌석이 401 일 때
 *   공용 인터셉터가 그 refresh 로 **그 사람의 매장 좌석**을 받아 온다.
 */
export async function enterAgencyStore(sellerId: number, storeName: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await agencyRequest<{ data: { seller_token: string; seller: { id: number; username: string | null; is_distributor: number }; agency_name: string } }>(
    `/stores/${sellerId}/seat`, { method: 'POST' },
  )
  if (!r.ok || !r.data.data?.seller_token) return { ok: false, error: r.data.error || '매장에 들어가지 못했어요.' }
  const d = r.data.data
  try {
    for (const k of ['seller_refresh_token', 'seller_username', 'seller_email']) localStorage.removeItem(k)
    localStorage.setItem('seller_token', d.seller_token)
    localStorage.setItem('seller_id', String(d.seller.id))
    if (d.seller.username) localStorage.setItem('seller_username', d.seller.username)
    localStorage.setItem('seller_name', storeName)
    localStorage.setItem('is_distributor', String(d.seller.is_distributor ?? 0))
    localStorage.setItem(AGENCY_SEAT_NAME_KEY, d.agency_name)
  } catch {
    return { ok: false, error: '브라우저 저장공간을 쓸 수 없어요.' }
  }
  // 🪑 콘솔이 매장을 바꿔 앉으면 좌석을 구독하는 화면(시트 안 대시보드 화면)이 옛 매장 데이터를 버리게 알린다.
  bumpSeatGeneration()
  return { ok: true }
}

/**
 * 🪑 지금 브라우저의 셀러 좌석이 **이 직원의 · 이 매장** 좌석인가 — 맞으면 새로 발급하지 않는다.
 *   ⚠️ 매장 id 만 보면 안 된다. 여러 사람이 쓰는 매장 컴퓨터에서 **다른 직원**(배정이 다를 수 있다)이나
 *   사장님 본인이 같은 매장에 앉아 있던 토큰을 그대로 쓰게 된다. 직원 id 까지 맞아야 '내 좌석' 이다.
 */
export function isMyAgencySeat(sellerId: number, staffId: number, token?: string | null): boolean {
  let raw = token
  if (raw === undefined) { try { raw = localStorage.getItem('seller_token') } catch { raw = null } }
  const part = raw?.split('.')[1]
  if (!part) return false
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const p = JSON.parse(atob(b64)) as { seller_id?: unknown; agency_staff_id?: unknown }
    return Number(p.seller_id) === sellerId && Number(p.agency_staff_id) === staffId
  } catch { return false }
}
