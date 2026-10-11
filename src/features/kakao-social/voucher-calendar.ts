/**
 * 📅 이용권 만료일 → 카카오톡 캘린더 일정 (2026-10-11 대표 "1,2,4 해줄래" 중 2번)
 *
 * 순수 함수만 둔다 — 라우트(`kakao-social.routes.ts`)는 조회·호출만 하고 일정 모양은 여기서 정한다.
 *
 * ## 규칙
 * - 일정은 **만료일(KST) 오전 10시, 30분짜리**. 종일 일정으로 만들지 않는다 — 카카오 종일 일정의
 *   알림 기준 시각이 문서마다 달라 "몇 시에 울리는가" 를 우리가 장담할 수 없다.
 * - 만료일 계산은 `expires_at − 1초` 의 KST 날짜다. D1 의 `expires_at` 은 `Z` 없는 UTC 이고,
 *   자정(KST 00:00 = 전날 15:00Z)에 끝나는 이용권은 "전날까지" 라는 뜻이라 1초를 빼야 날짜가 맞는다.
 * - 알림은 3일 전 · 하루 전 · 1시간 전 중 **아직 안 지난 것** 앞에서 두 개(카카오 상한 2개).
 * - 만료일 10시가 이미 지났으면 지금부터 가장 가까운 5분 단위 + 10분에 잡는다. 그것도 만료 뒤면 null.
 *
 * ## 못 하는 것
 * 카카오 쪽 요청 형식(필드 이름·5분 단위·시간 문자열)은 공개 문서 기준이고, 이 컨테이너에서
 * 실제 호출로 검증하지 못했다. 거절되면 라우트가 카카오 원문(msg)을 그대로 돌려준다.
 */

export interface VoucherCalendarInput {
  productName: string | null | undefined
  storeName?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  /** D1 원문(`YYYY-MM-DD HH:MM:SS`, UTC) 또는 ISO. */
  expiresAt: string | null | undefined
}

export interface KakaoCalendarEvent {
  title: string
  time: { start_at: string; end_at: string; time_zone: 'Asia/Seoul'; all_day: false; lunar: false }
  description: string
  reminders?: number[]
  color: 'BLUE'
  location?: { name: string; address?: string; latitude?: number; longitude?: number }
}

const KST_MS = 9 * 3600_000
const FIVE_MIN = 5 * 60_000
const TITLE_MAX = 50
const LOCATION_NAME_MAX = 50
const WALLET_URL = 'https://urdeal.kr/my-vouchers'

/** D1 UTC-naive 문자열과 ISO 둘 다 받는다(`src/utils/date.ts parseUTCDate` 와 같은 규약). */
export function parseUtcMs(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z'
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

/** 카카오 형식 `yyyy-MM-ddTHH:mm:ssZ`(밀리초 없음). */
export function kakaoTime(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function clip(s: string, max: number): string {
  const arr = Array.from(s)
  return arr.length <= max ? s : arr.slice(0, max - 1).join('') + '…'
}

export function buildVoucherExpiryEvent(input: VoucherCalendarInput, nowMs: number): KakaoCalendarEvent | null {
  const expMs = parseUtcMs(input.expiresAt)
  if (expMs == null || expMs <= nowMs) return null

  // 만료일(KST) 10:00 = 그 날짜 01:00Z
  const kst = new Date(expMs - 1000 + KST_MS)
  let start = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 1, 0, 0)
  if (start <= nowMs) start = Math.ceil(nowMs / FIVE_MIN) * FIVE_MIN + 2 * FIVE_MIN
  if (start >= expMs) return null
  const end = start + 6 * FIVE_MIN

  const reminders = [4320, 1440, 60].filter((m) => start - m * 60_000 > nowMs).slice(0, 2)

  const product = (input.productName || '이용권').trim() || '이용권'
  const store = (input.storeName || '').trim()
  const description = [
    `${store ? `${store}에서 쓰는 ` : ''}이용권이 오늘 만료돼요.`,
    '만료되면 결제한 수단으로 자동 환불돼요.',
    '',
    `내 이용권 열기: ${WALLET_URL}`,
  ].join('\n')

  const ev: KakaoCalendarEvent = {
    title: clip(`이용권 만료 · ${product}`, TITLE_MAX),
    time: { start_at: kakaoTime(start), end_at: kakaoTime(end), time_zone: 'Asia/Seoul', all_day: false, lunar: false },
    description,
    color: 'BLUE',
  }
  if (reminders.length) ev.reminders = reminders
  if (store) {
    const loc: NonNullable<KakaoCalendarEvent['location']> = { name: clip(store, LOCATION_NAME_MAX) }
    if (input.address) loc.address = input.address
    if (Number.isFinite(input.lat) && Number.isFinite(input.lng) && input.lat && input.lng) {
      loc.latitude = Number(input.lat)
      loc.longitude = Number(input.lng)
    }
    ev.location = loc
  }
  return ev
}

/** 카카오가 "권한·토큰 문제" 로 거절했는가 — 그때만 동의 화면으로 보낸다(그 외 오류로 보내면 무한 반복). */
export function isKakaoConsentError(data: unknown): boolean {
  const d = (data || {}) as { code?: number; msg?: string }
  if (d.code === -402 || d.code === -401) return true
  const msg = String(d.msg || '').toLowerCase()
  return msg.includes('insufficient scope') || msg.includes('scope')
}
