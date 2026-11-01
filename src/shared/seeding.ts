/**
 * 🎁 무상 체험 제공(협찬) — 판정 규칙 SSOT (2026-10-31 대표 확정)
 *
 * 흐름:
 *   ① 사장님이 이용권을 등록할 때 "인플루언서 무상 체험 제공" 을 켜고 조건을 적는다
 *      (플랫폼 · 최소 팔로워 · 한 달 모집 인원 · 게시 의무 · 게시 기한).
 *   ② 인플루언서가 이용권 상세에서 [팔아보기] → 둘 중 하나를 고른다:
 *        - 내 유어샵에 담기(고유 링크로 판매)                 → 즉시 "유어샵에 담겼습니다"
 *        - 무료 체험 신청(사장님이 제공을 켰을 때만)          → 연동한 SNS 팔로워로 자동 판정
 *   ③ 운영자가 확인 → 사장님께 알림톡(원클릭 자동 전송 스위치 있음) → 사장님 승인/거절
 *   ④ 승인되면 인플루언서가 **노쇼 방지 보증금(신청권 1장)** 을 쓰고 방문 희망 일정을 낸다
 *      (가입 혜택 첫 3회 무료 · 신청권은 1/5/10장 묶음 · "충전한 돈"이 아니다)
 *   ⑤ 사장님이 일정을 고르면 0원 체험 이용권이 발급된다(정산 제외 — `is_experience=1`)
 *   ⑥ 방문 후 기한 안에 게시물 링크를 낸다. 노쇼·게시 미이행은 패널티.
 *
 * 화면과 서버가 같은 표를 읽는다 — 두 벌이면 화면이 "신청 가능" 이라 하고 서버가 거절한다.
 */

export { SEEDING_PLATFORMS, PLATFORM_LABEL, FOLLOWER_WORD } from './seeding-labels'
export type { SeedingPlatform } from './seeding-labels'
import { SEEDING_PLATFORMS, PLATFORM_LABEL, FOLLOWER_WORD, type SeedingPlatform } from './seeding-labels'

export function isSeedingPlatform(v: unknown): v is SeedingPlatform {
  return typeof v === 'string' && (SEEDING_PLATFORMS as readonly string[]).includes(v)
}

// ── 사장님 제공 설정 ──────────────────────────────────────────────

export interface SeedingOffer {
  enabled: boolean
  /** 한 달(KST 달력 기준) 최대 제공 인원 */
  slots_per_month: number
  /** 신청 가능한 플랫폼(하나 이상) */
  platforms: SeedingPlatform[]
  /** 최소 팔로워(구독자) — 0 이면 제한 없음 */
  min_followers: number
  /** 게시 의무 문구(예: "인스타 피드 1개 + 매장 태그") */
  post_requirement: string
  /** 방문일로부터 게시 기한(일) */
  post_deadline_days: number
  /** 제공 내용 메모(예: "2인 세트 1회") */
  offer_note: string
}

export const OFFER_LIMITS = {
  slotsMin: 1, slotsMax: 100,
  followersMax: 100_000_000,
  deadlineMin: 1, deadlineMax: 30,
  requirementMax: 300, noteMax: 100,
} as const

export const DEFAULT_OFFER: SeedingOffer = {
  enabled: false,
  slots_per_month: 5,
  platforms: ['instagram'],
  min_followers: 1000,
  post_requirement: '방문 후 인스타그램 피드(또는 릴스) 1개 게시 · 매장 위치 태그',
  post_deadline_days: 7,
  offer_note: '',
}

const clampInt = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n)) return dflt
  return Math.min(hi, Math.max(lo, n))
}

/** 화면·서버 공통 정규화 — 이상한 값은 범위 안으로 접는다(거절하지 않는다). */
export function normalizeOffer(raw: Partial<Record<keyof SeedingOffer, unknown>> | null | undefined): SeedingOffer {
  const r = raw ?? {}
  const platforms = Array.isArray(r.platforms)
    ? [...new Set(r.platforms.filter(isSeedingPlatform))]
    : DEFAULT_OFFER.platforms
  return {
    enabled: r.enabled === true || r.enabled === 1 || r.enabled === '1',
    slots_per_month: clampInt(r.slots_per_month, OFFER_LIMITS.slotsMin, OFFER_LIMITS.slotsMax, DEFAULT_OFFER.slots_per_month),
    platforms: platforms.length ? platforms : ['instagram'],
    min_followers: clampInt(r.min_followers, 0, OFFER_LIMITS.followersMax, DEFAULT_OFFER.min_followers),
    post_requirement: String(r.post_requirement ?? DEFAULT_OFFER.post_requirement).trim().slice(0, OFFER_LIMITS.requirementMax)
      || DEFAULT_OFFER.post_requirement,
    post_deadline_days: clampInt(r.post_deadline_days, OFFER_LIMITS.deadlineMin, OFFER_LIMITS.deadlineMax, DEFAULT_OFFER.post_deadline_days),
    offer_note: String(r.offer_note ?? '').trim().slice(0, OFFER_LIMITS.noteMax),
  }
}

// ── 신청 상태 ─────────────────────────────────────────────────────

export const APPLICATION_STATUSES = [
  'pending',        // 신청 완료 — 운영자 확인 대기
  'sent',           // 사장님께 보냄(알림톡)
  'approved',       // 사장님 승인 — 보증금·일정 대기
  'scheduling',     // 보증금 처리 + 희망 일정 제출 — 사장님 일정 확정 대기
  'scheduled',      // 일정 확정 + 0원 이용권 발급
  'posted',         // 게시물 링크 제출
  'completed',      // 완료(게시 확인)
  'rejected',       // 사장님 거절
  'admin_rejected', // 운영자 반려
  'cancelled',      // 인플루언서 취소
  'store_cancelled',// 사장님 취소(보증금 반환)
  'no_show',        // 노쇼(패널티)
  'post_missed',    // 게시 미이행(패널티)
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: '확인 중',
  sent: '사장님 확인 중',
  approved: '승인됨 · 일정 선택 필요',
  scheduling: '사장님 일정 확인 중',
  scheduled: '방문 확정',
  posted: '게시물 확인 중',
  completed: '완료',
  rejected: '사장님이 거절했어요',
  admin_rejected: '반려됨',
  cancelled: '취소함',
  store_cancelled: '매장 사정으로 취소됨',
  no_show: '노쇼',
  post_missed: '게시 기한 지남',
}

/** 이번 달 모집 인원에 세는 상태 — 거절·취소는 자리를 돌려준다. */
export const SLOT_COUNTED_STATUSES: readonly ApplicationStatus[] = [
  'pending', 'sent', 'approved', 'scheduling', 'scheduled', 'posted', 'completed', 'no_show', 'post_missed',
]
/** 아직 진행 중인 신청 — 같은 이용권에 두 번 신청하지 못하게 한다. */
export const OPEN_STATUSES: readonly ApplicationStatus[] = ['pending', 'sent', 'approved', 'scheduling', 'scheduled', 'posted']

export function sqlIn(list: readonly string[]): string {
  return `(${list.map((s) => `'${s}'`).join(',')})`
}

// ── 자격 판정 ─────────────────────────────────────────────────────

export interface SnsLinkLite {
  platform: SeedingPlatform
  username: string | null
  follower_count: number | null
}

export type EligibilityReason =
  | 'ok'
  | 'offer_off'
  | 'no_link'
  | 'followers_unknown'
  | 'followers_low'
  | 'slots_full'
  | 'penalized'
  | 'already_applied'

export interface Eligibility {
  ok: boolean
  reason: EligibilityReason
  /** 조건을 통과한 플랫폼(여러 개면 팔로워가 가장 많은 것) */
  platform: SeedingPlatform | null
  follower_count: number | null
  message: string
}

/**
 * 신청 자격 — 연동한 SNS 의 팔로워를 사장님 조건과 대조한다.
 * 순서가 곧 규칙이다: 제공 꺼짐 → 패널티 → 이미 신청 → 모집 마감 → 연동 → 팔로워.
 */
export function checkEligibility(input: {
  offer: SeedingOffer
  links: SnsLinkLite[]
  usedSlotsThisMonth: number
  hasOpenApplication: boolean
  blockedUntil: string | null
  now?: Date
}): Eligibility {
  const { offer, links } = input
  const no = (reason: EligibilityReason, message: string, extra: Partial<Eligibility> = {}): Eligibility =>
    ({ ok: false, reason, platform: null, follower_count: null, message, ...extra })

  if (!offer.enabled) return no('offer_off', '이 매장은 무상 체험을 제공하지 않아요')
  const now = input.now ?? new Date()
  if (input.blockedUntil && Date.parse(input.blockedUntil.replace(' ', 'T') + (input.blockedUntil.includes('Z') ? '' : 'Z')) > now.getTime()) {
    return no('penalized', '패널티로 신청이 잠시 제한돼 있어요')
  }
  if (input.hasOpenApplication) return no('already_applied', '이미 이 이용권에 신청했어요')
  if (input.usedSlotsThisMonth >= offer.slots_per_month) return no('slots_full', '이번 달 모집 인원이 다 찼어요')

  const usable = links.filter((l) => offer.platforms.includes(l.platform))
  if (!usable.length) {
    const names = offer.platforms.map((p) => PLATFORM_LABEL[p]).join('·')
    return no('no_link', `${names} 계정을 먼저 연동해 주세요`)
  }
  const known = usable.filter((l) => typeof l.follower_count === 'number')
  if (!known.length) {
    return no('followers_unknown', '팔로워 수를 읽지 못했어요. 인스타그램은 프로페셔널(크리에이터·비즈니스) 계정만 읽을 수 있어요')
  }
  const best = known.reduce((a, b) => ((b.follower_count ?? 0) > (a.follower_count ?? 0) ? b : a))
  if ((best.follower_count ?? 0) < offer.min_followers) {
    return no('followers_low', `${FOLLOWER_WORD[best.platform]} ${offer.min_followers.toLocaleString('ko-KR')}명 이상부터 신청할 수 있어요`, {
      platform: best.platform, follower_count: best.follower_count,
    })
  }
  return { ok: true, reason: 'ok', platform: best.platform, follower_count: best.follower_count, message: '신청할 수 있어요' }
}

// ── 신청권(노쇼 방지 보증금) ──────────────────────────────────────

/** 가입 혜택 — 첫 3회 무료(대표 확정). 어드민 `seeding_free_passes` 로 조정. */
export const DEFAULT_FREE_PASSES = 3

export interface PassPackage { key: string; passes: number; price: number; label: string }

/** 기본 묶음(어드민 `seeding_pass_packages` 로 조정 — "1:1000,5:4500,10:8000"). */
export const DEFAULT_PASS_PACKAGES: readonly PassPackage[] = [
  { key: 'p1', passes: 1, price: 1000, label: '1장' },
  { key: 'p5', passes: 5, price: 4500, label: '5장' },
  { key: 'p10', passes: 10, price: 8000, label: '10장' },
]

export function parsePassPackages(raw: string | null | undefined): PassPackage[] {
  if (!raw) return [...DEFAULT_PASS_PACKAGES]
  const out: PassPackage[] = []
  for (const part of String(raw).split(',')) {
    const [a, b] = part.split(':').map((s) => Math.floor(Number(s.trim())))
    if (a > 0 && a <= 100 && b > 0 && b <= 1_000_000) out.push({ key: `p${a}`, passes: a, price: b, label: `${a}장` })
  }
  return out.length ? out : [...DEFAULT_PASS_PACKAGES]
}

// ── 패널티 ────────────────────────────────────────────────────────

/** 최근 180일의 경고 수 → 신청 제한 일수. 1회는 경고만. */
export const PENALTY_WINDOW_DAYS = 180
export function penaltyBlockDays(strikes: number): number {
  if (strikes >= 3) return 90
  if (strikes === 2) return 30
  return 0
}
export const PENALTY_LABEL: Record<'no_show' | 'post_missed', string> = {
  no_show: '노쇼(방문하지 않음)',
  post_missed: '게시 기한 안에 게시물을 올리지 않음',
}

// ── 방문 희망 일정 ────────────────────────────────────────────────

export const MAX_VISIT_SLOTS = 3
const SLOT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
/** "YYYY-MM-DD HH:MM"(KST 벽시계) 만 받는다 — 지난 날짜·형식 오류는 버린다. */
export function normalizeVisitSlots(raw: unknown, now = new Date()): string[] {
  if (!Array.isArray(raw)) return []
  const todayKst = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
  const out: string[] = []
  for (const v of raw) {
    const s = String(v ?? '').trim().replace('T', ' ').slice(0, 16)
    if (!SLOT_RE.test(s)) continue
    if (s.slice(0, 10) <= todayKst) continue // 오늘 이후만(사장님이 준비할 시간)
    if (!out.includes(s)) out.push(s)
    if (out.length >= MAX_VISIT_SLOTS) break
  }
  return out
}

// ── 게시물 링크 ───────────────────────────────────────────────────

const POST_HOSTS: Record<SeedingPlatform, RegExp> = {
  instagram: /(^|\.)instagram\.com$/i,
  youtube: /(^|\.)(youtube\.com|youtu\.be)$/i,
  tiktok: /(^|\.)tiktok\.com$/i,
}
/** 그 플랫폼 주소인지만 본다(게시물 내용 확인은 운영자). */
export function validPostUrl(url: unknown, platform: SeedingPlatform): string | null {
  try {
    const u = new URL(String(url ?? '').trim())
    if (u.protocol !== 'https:') return null
    return POST_HOSTS[platform].test(u.hostname) ? u.toString().slice(0, 500) : null
  } catch {
    return null
  }
}

// ── 알림톡 ────────────────────────────────────────────────────────

/** 우리 이름(콘솔 코드는 밑줄을 뺀 소문자) — 문안: docs/alimtalk-register-list.md §무상 체험. */
export const SEEDING_TPL = {
  requestStore: 'seeding_request_store',
  slotsStore: 'seeding_slots_store',
  approved: 'seeding_approved',
  rejected: 'seeding_rejected',
  scheduled: 'seeding_scheduled',
  postReminder: 'seeding_post_reminder',
  penalty: 'seeding_penalty',
} as const

// 🩸 2026-10-31 카카오 반려 3건의 사유를 처음부터 반영한다: ① 수신자의 어떤 행동으로 받는지 문장
//   ② 변수마다 고정 라벨(`· 매장명: …`) ③ 홍보 문구 금지. 등록 문서(23~29)와 글자까지 같아야 한다.

export function msgRequestStore(v: { store: string; product: string; platform: SeedingPlatform; followers: number; handle: string }): string {
  const message = `[유어딜] 무상 체험 신청 안내

사장님께서 이용권에 설정하신 무상 체험 제공에 인플루언서가 신청했습니다.

· 매장명: ${v.store}
· 이용권: ${v.product}
· 신청 플랫폼: ${PLATFORM_LABEL[v.platform]}
· 신청자 계정: @${v.handle}
· 팔로워(구독자) 수: ${v.followers.toLocaleString('ko-KR')}명

사장님이 정하신 조건을 통과한 신청입니다.
아래 [요청 확인하기]에서 승인 또는 거절을 눌러 주세요.`
  return message
}

export function msgSlotsStore(v: { store: string; product: string; handle: string; slots: string }): string {
  const message = `[유어딜] 체험 방문 희망 일정 안내

사장님께서 승인하신 무상 체험 신청자가 방문 희망 일정을 보냈습니다.

· 매장명: ${v.store}
· 이용권: ${v.product}
· 신청자 계정: @${v.handle}
· 희망 일정: ${v.slots}

가능한 일정 하나를 골라 주세요.
아래 [요청 확인하기]에서 선택할 수 있습니다.`
  return message
}

export function msgApproved(v: { store: string; product: string }): string {
  const message = `[유어딜] 무상 체험 승인 안내

고객님께서 유어딜에서 신청하신 무상 체험을 매장이 승인했습니다.

· 매장명: ${v.store}
· 이용권: ${v.product}

노쇼 방지 보증금(신청권 1장)을 사용하고 방문 희망 일정을 골라 주세요.
아래 [내 체험 신청]에서 진행할 수 있습니다.`
  return message
}

export function msgRejected(v: { store: string; product: string }): string {
  const message = `[유어딜] 무상 체험 신청 결과 안내

고객님께서 유어딜에서 신청하신 무상 체험의 결과를 알려드립니다.

· 매장명: ${v.store}
· 이용권: ${v.product}
· 결과: 매장 사정으로 이번에는 진행이 어렵습니다

보증금(신청권)은 사용되지 않았습니다.`
  return message
}

export function msgScheduled(v: { store: string; product: string; visitAt: string; deadline: string; requirement: string }): string {
  const message = `[유어딜] 체험 방문 확정 안내

고객님께서 신청하신 무상 체험의 방문 일정이 확정되어 체험 이용권이 발급되었습니다.

· 매장명: ${v.store}
· 이용권: ${v.product}
· 방문 일정: ${v.visitAt}
· 게시 의무: ${v.requirement}
· 게시 기한: ${v.deadline}

매장에서 아래 [내 이용권 보기]를 눌러 이용권 QR을 보여 주세요.`
  return message
}

export function msgPostReminder(v: { store: string; deadline: string }): string {
  const message = `[유어딜] 체험 게시물 등록 기한 안내

고객님께서 방문하신 무상 체험의 게시물 등록 기한이 하루 남았습니다.

· 매장명: ${v.store}
· 게시 기한: ${v.deadline}

게시물을 올린 뒤 아래 [게시물 등록하기]에서 링크를 등록해 주세요.
기한이 지나면 다음 체험 신청이 제한될 수 있습니다.`
  return message
}

export function msgPenalty(v: { store: string; reason: string; blockedText: string }): string {
  const message = `[유어딜] 무상 체험 이용 제한 안내

고객님께서 신청하신 무상 체험이 이용 규칙에 따라 처리되었습니다.

· 매장명: ${v.store}
· 사유: ${v.reason}
· 조치: ${v.blockedText}

문의는 유어딜 고객센터로 남겨 주세요.`
  return message
}

/** 날짜 문자열(UTC naive 또는 KST 벽시계)을 화면용 짧은 표기로. */
export function kstWall(s: string | null | undefined): string {
  return s ? String(s).slice(0, 16) : '-'
}
