/**
 * 🎯 2026-10-15 소셜 자동화 — "누구에게 말하는가"(대상) SSOT.
 *
 * 대표(2026-10-15): *"한동안은 매장을 꾸준히 모으는 형태로 가야지. 인플루언서도 모아야하고
 * 양면성 플랫폼이잖아."* ⇒ 종전 소셜 초안은 전부 **소비자**에게 말했다(PROMO_BRIEF). 그런데
 * 라이브 활성 이용권 대부분이 데모이고 실제 입점 매장이 손에 꼽힌다(`partners-facts.ts` realStores).
 * 소비자를 불러 봐야 살 물건이 없다 — 지금 돈을 만드는 쪽은 **공급(매장 · 소개 파트너)** 이다.
 *
 * 이 파일은 순수 모듈이다(DB·네트워크 없음 — 테스트가 동작을 직접 잰다).
 *   - 대상 3종과 각자의 착지 페이지
 *   - 게시물마다 붙는 유입 태그(`?src=`) — 기존 어트리뷰션(`lib/acquisition.ts`)이 그대로 받는다
 *   - 대상 혼합비(어드민 `platform_settings.social_audience_mix`)와 다음 대상 고르기
 *
 * 🔑 사람 지칭은 명칭 SSOT 를 따른다: "인플루언서" 라고 쓰지 않고 **"소개 파트너"** 라고 쓴다
 *    (`/creators`·`/creators/apply` 가 이미 그 말을 쓴다).
 */
import type { SocialPlatform } from './social-brief'

export type SocialAudience = 'store' | 'creator' | 'consumer'
export const SOCIAL_AUDIENCES: readonly SocialAudience[] = ['store', 'creator', 'consumer'] as const

export function isSocialAudience(v: unknown): v is SocialAudience {
  return typeof v === 'string' && (SOCIAL_AUDIENCES as readonly string[]).includes(v)
}

export const AUDIENCE_LABEL: Record<SocialAudience, string> = {
  store: '매장 사장님',
  creator: '소개 파트너',
  consumer: '손님',
}

/**
 * 대상별 착지 페이지. 매장은 입점 안내(`/partners` — 수수료가 `PARTNER_FACTS` 와 같은 값),
 * 소개 파트너는 **신청서**(`/creators/apply`)로 보낸다.
 *
 * 🔴 `/influencer`·`/creators` 로 보내지 않는다 — 2026-10-15 실측으로 두 페이지 문구가
 *    *"유어샵에 담아 소개하면 팔릴 때마다 몫이 쌓인다"* 를 약속하는데 그 보상
 *    (`affiliate_program_enabled`)은 **꺼져 있다**(`actor-benefit-map.md` §1). 마케터가 그 페이지로
 *    사람을 보내면 거짓 약속을 확성한다. 대표 결정(같은 날 Q3=A)으로 두 페이지 문구는
 *    "매장이 소개 몫을 건 딜이면" 조건부로 고쳤지만, 신청서가 여전히 가장 정확한 착지다
 *    (`docs/decisions/2026-10-15-supply-marketer-launch.md`).
 */
export const AUDIENCE_LANDING: Record<SocialAudience, string> = {
  store: '/partners',
  creator: '/creators/apply',
  consumer: '/',
}

export const SITE_ORIGIN = 'https://urdeal.kr'

const PLATFORM_CODE: Record<SocialPlatform, string> = { threads: 'th', instagram: 'ig', youtube: 'yt' }

/**
 * 게시물 유입 태그. 형식은 어트리뷰션 규칙(`normalizeAcqSource` — 소문자·숫자·하이픈 1~40자)을 따른다.
 *
 * 인스타그램만 게시물 번호를 안 붙인다 — 캡션의 주소는 **눌리지 않아서** 사람은 프로필 링크로 들어온다.
 * 그 링크는 게시물마다 바꿀 수 없으므로 게시물 단위 귀속은 원리상 불가능하고, 플랫폼 단위(`sns-ig`)로 센다.
 * 거짓 정밀도(아무도 안 누른 게시물 번호)를 만들지 않는 것이 요점이다.
 */
export function postSrcTag(platform: SocialPlatform, postId: number): string {
  const code = PLATFORM_CODE[platform]
  if (platform === 'instagram') return `sns-${code}`
  return `sns-${code}-${Math.max(0, Math.trunc(postId))}`
}

/** 프로필 링크용(인스타 바이오) 고정 태그. */
export const INSTAGRAM_BIO_SRC = 'sns-ig'

export function landingUrl(audience: SocialAudience, src: string): string {
  return `${SITE_ORIGIN}${AUDIENCE_LANDING[audience]}?src=${encodeURIComponent(src)}`
}

/**
 * 본문 끝에 붙일 행동 유도 한 줄 + 주소. 플랫폼마다 링크를 다루는 방식이 달라 문장이 다르다.
 *   - 스레드·유튜브: 주소를 그대로 붙인다(눌린다)
 *   - 인스타그램: 주소를 붙이지 않고 프로필 링크를 가리킨다(캡션 주소는 안 눌린다)
 */
export function linkLine(platform: SocialPlatform, audience: SocialAudience, src: string): string {
  const lead: Record<SocialAudience, string> = {
    store: '우리 가게도 올려 볼까 싶으면',
    creator: '동네 가게 소개해 주실 분은',
    consumer: '근처에 뭐가 있는지 궁금하면',
  }
  if (platform === 'instagram') return `${lead[audience]} 프로필 링크에서 볼 수 있어요.`
  return `${lead[audience]} 여기서 보면 됩니다.\n${landingUrl(audience, src)}`
}

// ── 대상 혼합비 ─────────────────────────────────────────────────────────

export type AudienceMix = Record<SocialAudience, number>

/**
 * 기본 혼합비 — 매장 3 : 소개 파트너 2 : 손님 0.
 * 손님 홍보를 0 으로 두는 이유: 실제로 팔 수 있는 이용권이 거의 없는 동안 손님을 부르면
 * 데모 상품을 보고 실망하거나(데모는 실제 가게 이름·주소를 쓴다) 기만 광고 소지가 생긴다.
 * 실물이 늘면 어드민에서 `social_audience_mix` 로 손님 비중을 올린다(코드 수정 없이).
 */
export const DEFAULT_AUDIENCE_MIX: AudienceMix = { store: 3, creator: 2, consumer: 0 }

/** "store:3,creator:2,consumer:0" → 혼합비. 잘못된 조각은 무시, 전부 0/무효면 기본값. */
export function parseAudienceMix(raw: unknown): AudienceMix {
  const s = String(raw ?? '').trim()
  if (!s) return { ...DEFAULT_AUDIENCE_MIX }
  const out: AudienceMix = { store: 0, creator: 0, consumer: 0 }
  let seen = false
  for (const part of s.split(',')) {
    const [k, v] = part.split(':').map((x) => x.trim())
    if (!isSocialAudience(k)) continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) continue
    out[k] = Math.min(100, Math.floor(n))
    seen = true
  }
  const total = out.store + out.creator + out.consumer
  return seen && total > 0 ? out : { ...DEFAULT_AUDIENCE_MIX }
}

/**
 * 다음 초안의 대상 — 목표 비중 대비 **가장 모자란** 대상을 고른다(결정론, 동률이면 store → creator → consumer).
 * 비중 0 인 대상은 절대 고르지 않는다(손님 0 이면 손님 글은 안 나온다).
 */
export function pickAudience(mix: AudienceMix, recent: Partial<Record<SocialAudience, number>>): SocialAudience {
  const weightTotal = mix.store + mix.creator + mix.consumer
  if (weightTotal <= 0) return 'store'
  const counts = SOCIAL_AUDIENCES.map((a) => Math.max(0, recent[a] ?? 0))
  const countTotal = counts.reduce((x, y) => x + y, 0)
  let best: SocialAudience = 'store'
  let bestDeficit = -Infinity
  SOCIAL_AUDIENCES.forEach((a, i) => {
    if (mix[a] <= 0) return
    const target = mix[a] / weightTotal
    const actual = countTotal > 0 ? counts[i] / countTotal : 0
    const deficit = target - actual
    if (deficit > bestDeficit + 1e-9) { bestDeficit = deficit; best = a }
  })
  return best
}
