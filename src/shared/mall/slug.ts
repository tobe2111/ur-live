/**
 * 🏬 몰 주소(슬러그)·표시명 규칙 — 세션 ③-a 〔기획 확정 2026-07-29 §1.4〕
 *
 * 슬러그는 `urdeal.kr/{슬러그}` 자리에 앉는다. ⇒ **기존 라우트와 충돌하면 그 페이지가 죽는다.**
 * 그래서 예약어는 "손으로 적은 목록"이 아니라 **실제 라우트에서 뽑은 것**이어야 한다
 * (기획 확정: *"손 목록 폐기, 라우트 실측 추출로 대체"*).
 *
 * ⚠️ 이 상수는 정적이라 라우트가 늘면 낡는다 — **드리프트는 테스트가 강제**한다
 * (`mall-slug.test.ts` 가 `src/routes/*.tsx`·`App.tsx` 의 1st 세그먼트를 파싱해 포함 관계 검사).
 * cron `EXPECTED_CRON_EXPRESSIONS` 와 같은 방식이고, 같은 이유(코드가 진실, 목록은 사본)다.
 *
 * ⚠️ 이 목록이 **못 막는 것**: 라우트가 아닌 충돌(정적 파일 경로·워커가 가로채는 prefix 등).
 *   그건 슬러그 발급 시점에 실제 요청을 한 번 던져 보는 것이 확실하다 — P0 는 어드민 수동 개설이라
 *   사람이 확인한다.
 */

/** 실제 라우트 1st 세그먼트에서 추출(2026-07-29 기준). 라우트 추가 시 함께 갱신 — 테스트가 강제. */
export const RESERVED_SLUGS: readonly string[] = [
  '500', 'a', 'about', 'account', 'admin', 'ads',
  'agency', 'agency-partner', 'area-report', 'auth', 'blog', 'browse',
  'business', 'cart', 'checkout', 'community-group-buy', 'coupon', 'creator',
  'creators', 'district', 'experience', 'fail', 'faq', 'following',
  'g', 'gb-market', 'gdpr', 'gift', 'group-buy', 'host',
  'influencer', 'interest-list', 'introduce', 'join', 'kakao-debug', 'local',
  'login', 'map', 'meal-vouchers', 'my', 'my-appointments', 'my-commissions',
  'my-coupons', 'my-deal-history', 'my-orders', 'my-returns', 'my-reviews', 'my-stays',
  'my-store', 'my-vouchers', 'mypage', 'new-openings', 'notifications', 'orders',
  'partners', 'partnership', 'pay', 'payment', 'points', 'privacy',
  'privacy-policy', 'product', 'products', 'profile', 'referral', 'refund',
  'refund-policy', 'register', 'restaurant-map', 's', 'search', 'seller',
  'shipping-policy', 'stays', 'store', 'success', 'supplier', 'terms',
  'terms-of-service', 'toss-debug', 'u', 'user', 'v', 'vouchers',
  'wholesale', 'wishlist',
]

/** 표시명: 2~20자, 한글·영문·숫자·공백. 이모지·특수문자 불가. */
export function validateMallName(raw: string): { ok: true } | { ok: false; reason: string } {
  const s = String(raw ?? '').trim()
  if (s.length < 2) return { ok: false, reason: '몰 이름은 2자 이상이어야 합니다' }
  if (s.length > 20) return { ok: false, reason: '몰 이름은 20자 이하여야 합니다' }
  if (!/^[가-힣a-zA-Z0-9 ]+$/.test(s)) {
    return { ok: false, reason: '한글·영문·숫자·공백만 사용할 수 있습니다' }
  }
  return { ok: true }
}

/** 슬러그: 영문 소문자·숫자·하이픈 3~30자 + 예약어 차단. */
export function validateMallSlug(raw: string): { ok: true } | { ok: false; reason: string } {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s.length < 3) return { ok: false, reason: '주소는 3자 이상이어야 합니다' }
  if (s.length > 30) return { ok: false, reason: '주소는 30자 이하여야 합니다' }
  if (!/^[a-z0-9-]+$/.test(s)) return { ok: false, reason: '영문 소문자·숫자·하이픈만 사용할 수 있습니다' }
  // 하이픈으로 시작/끝나면 URL 가독성·정규화 문제 — 막는다.
  if (s.startsWith('-') || s.endsWith('-')) return { ok: false, reason: '주소는 하이픈으로 시작하거나 끝날 수 없습니다' }
  if (RESERVED_SLUGS.includes(s)) return { ok: false, reason: '이미 사용 중인 주소입니다' }
  return { ok: true }
}

/** 경로 후보로 인정되는 슬러그 문법 — `firstPathSegment`(resolve.ts) 와 **같은 식**이어야 한다. */
const PATH_CANDIDATE_RE = /^[a-z0-9-]{3,30}$/

export interface MallSlugRow { id: number; slug: string; name?: string; active?: number | boolean }
export interface SlugAuditRow { id: number; slug: string; name?: string; active?: boolean }
export interface SlugAudit {
  ok: boolean
  checked: number
  /** 🔴 예약어(=실 라우트)를 먹고 있는 몰 — 그 페이지가 몰에 가려진다. */
  conflicts: SlugAuditRow[]
  /** 🟡 만들어졌지만 **경로로 도달 불가**(리졸버 문법 밖) — 충돌은 아니나 열리지 않는다. */
  unreachable: SlugAuditRow[]
}

/**
 * 🔴 **양방향 가드의 런타임 절반** 〔대표 경계조건 ② 2026-07-29〕
 *
 * CI 는 `라우트 ⊆ 예약어` 만 본다(mall-branding.test). 반대 방향 —
 * **이미 존재하는 몰 슬러그가 라우트를 먹고 있는가** — 는 **라이브 DB** 를 읽어야 하고 CI 는 못 읽는다.
 *
 * ⚠️ 생성 시점 차단만으로는 부족하다 — 그건 **가드 이후** 행에만 걸린다.
 *   이전에 만들어진 행은 남아 있고, **조회하지 않으면 영영 모른다.**
 */
export function auditMallSlugs(rows: readonly MallSlugRow[]): SlugAudit {
  const reserved = new Set(RESERVED_SLUGS)
  const conflicts: SlugAuditRow[] = []
  const unreachable: SlugAuditRow[] = []
  for (const r of rows) {
    const s = String(r?.slug ?? '').trim().toLowerCase()
    if (!s) continue
    const row: SlugAuditRow = { id: Number(r.id), slug: s, name: r.name, active: r.active === undefined ? undefined : Boolean(Number(r.active)) }
    if (reserved.has(s)) conflicts.push(row)
    if (!PATH_CANDIDATE_RE.test(s)) unreachable.push(row)
  }
  // `ok` 는 **충돌만** 본다 — 도달 불가는 경고이지 라우트를 깨뜨리지 않는다.
  return { ok: conflicts.length === 0, checked: rows.length, conflicts, unreachable }
}
