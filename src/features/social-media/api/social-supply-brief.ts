/**
 * 🏪 2026-10-15 공급 모으기 마케터 — 매장 사장님·소개 파트너에게 말할 때의 "사실" 과 "금지".
 *
 * 소비자용 `PROMO_BRIEF`(blog-ai)는 수수료·정산·매출을 **아예 금지**한다. 손님에게 할 말이 아니라서다.
 * 그런데 사장님에게는 수수료가 **첫 번째로 궁금한 것**이다. 그래서 공급용 브리프를 따로 둔다 —
 * 단, 숫자는 손으로 적지 않고 **라이브 설정**(`platform_settings`)에서 받는다.
 *
 * 🩸 왜 그렇게까지 하나: 2026-10-12 `/partners` 검색 문구가 *"수수료 5%"* 로 하드코딩돼 있었고
 *    본문은 10% 를 말하고 있었다(사장님이 스니펫에서 5% 를 보고 들어와 10% 를 본다). 자동 마케터는
 *    그 사고를 **하루 몇 번씩** 재생산할 수 있다. ⇒ ① 수치는 설정에서 ② 출력의 모든 `N%` 는
 *    그 설정값 중 하나여야 통과(`findSupplyViolation`).
 *
 * 🛑 지금 꺼져 있는 혜택은 말하지 않는다(`docs/design/actor-benefit-map.md` §1, 2026-10-15 실측):
 *    담기 소개 보상 OFF · 초대 보상 OFF · 영입 보상 폐지 · 멀티티어 OFF.
 *    소개 파트너가 받는 것은 **매장이 제안한 몫** 하나뿐이다.
 */
import type { PromoTopic } from './social-brief'
import { PARTNER_FACTS } from '../../../shared/partners-facts'
import type { SocialAudience } from './social-audience'

export type SupplyAudience = Exclude<SocialAudience, 'consumer'>

export interface SupplyFacts {
  /** 직접 입점 수수료 % (정수) */
  feeDirect: number
  /** 대행사 경유 수수료 % — 채널 요율이 꺼져 있으면 null(한 가지 요율만 말한다) */
  feeBrokered: number | null
  signupMinutes: string
  minPayout: string
}

function pct(raw: unknown, fallback: number): number {
  // 🩸 빈 값은 0 이 아니라 "모름" 이다 — `Number('')` 는 0 이라, 그대로 두면 설정을 못 읽은 날
  //    마케터가 "수수료 0%" 를 게시한다(시험이 실제로 잡았다).
  const t = String(raw ?? '').replace('%', '').trim()
  if (!t) return fallback
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 50 ? n : fallback
}

/**
 * 라이브 설정값 → 사실. 키 이름은 `fee-resolver.ts` 가 읽는 그 키다.
 * 설정을 못 읽으면 `PARTNER_FACTS`(사장님 덱·랜딩과 같은 값)로 내려간다 — 두 곳이 같은 값이어야 하므로 안전한 폴백이다.
 */
export function supplyFactsFromSettings(s: Record<string, unknown>): SupplyFacts {
  const directFallback = pct(PARTNER_FACTS.feeDirect, 10)
  const brokeredFallback = pct(PARTNER_FACTS.feeBrokered, 5)
  const channelRates = String(s.fee_channel_rates_enabled ?? 'true') !== 'false'
  const feeDirect = channelRates
    ? pct(s.platform_fee_pct_direct, directFallback)
    : pct(s.commission_rate_default, directFallback)
  return {
    feeDirect,
    feeBrokered: channelRates ? pct(s.platform_fee_pct_brokered, brokeredFallback) : null,
    signupMinutes: PARTNER_FACTS.signupMinutes,
    minPayout: PARTNER_FACTS.minPayout,
  }
}

export const FALLBACK_SUPPLY_FACTS: SupplyFacts = supplyFactsFromSettings({})

/** 출력에 나와도 되는 퍼센트 값 — 이 밖의 `N%` 는 지어낸 숫자다. */
export function allowedPercents(f: SupplyFacts): number[] {
  const out = [f.feeDirect, 100 - f.feeDirect]
  if (f.feeBrokered != null) out.push(f.feeBrokered, 100 - f.feeBrokered)
  return out
}

/** 공급용 금지 표현 — 꺼진 혜택 · 규모 과장 · 내부 용어 · 폐기 명칭. */
export const SUPPLY_FORBIDDEN: RegExp[] = [
  // 서비스 분리 — 도매몰은 철거됐고 소비자 홍보와 섞지 않는다
  /도매/, /유통스타트/, /판매사/, /제조사/, /공급가/, /\bB2B\b/,
  // 폐기 명칭 · 사람 지칭 금지(명칭 SSOT)
  /식사권/, /공구권/, /큐레이터/, /셀러/, /인플루언서/, /크리에이터/,
  // 영구 중단 기능
  /라이브\s?커머스/, /라이브\s?방송/, /쇼츠/,
  // 내부 운영 용어
  /백오피스/, /관리자/, /원천징수/, /세금계산서/, /원장/, /예산/,
  // 🛑 꺼진·폐지된 혜택 — 약속하면 거짓말이 된다
  /영입/, /초대\s?(보상|보너스|혜택)/, /추천\s?(보상|보너스)/, /멀티/, /다단계/,
  /담(기|아|으면)[^.\n]{0,24}(몫|수익|커미션|적립)/,
  // 과장 · 보증 (표시광고법)
  /업계\s?최저/, /최저\s?수수료/, /최고/, /1위/, /보장/, /무조건/, /확실히\s?(늘|오)/, /대박/,
  // 규모를 말하지 않는다 — 실측이 작고, 숫자를 지어내면 거짓이 된다
  /\d[\d,]*\s*(곳|명)/,
  // 근거 없는 비용 주장
  /입점비/, /가입비/, /월\s?이용료/,
]

const PERCENT_RE = /(\d+(?:\.\d+)?)\s*(?:%|퍼센트|프로)/g

/**
 * 공급 초안 검증 — 금지 표현 또는 **설정에 없는 퍼센트**가 있으면 그 사유를 돌려준다(없으면 null).
 * 소개 파트너 글에는 퍼센트를 아예 못 쓴다 — 몫은 매장이 정하므로 우리가 말할 숫자가 없다.
 */
export function findSupplyViolation(text: string, audience: SupplyAudience, facts: SupplyFacts): string | null {
  for (const re of SUPPLY_FORBIDDEN) if (re.test(text)) return re.source
  const allowed = audience === 'store' ? allowedPercents(facts) : []
  for (const m of text.matchAll(PERCENT_RE)) {
    const n = Number(m[1])
    if (!allowed.includes(n)) return `설정에 없는 수치 ${m[0]}`
  }
  return null
}

// ── 주제 백로그 ─────────────────────────────────────────────────────────

export const STORE_TOPICS: readonly PromoTopic[] = [
  { slug: 'store-pay-after-visit', title: '광고비를 먼저 내지 않는 홍보', angle: '클릭할 때마다 돈이 나가는 광고와 달리 손님이 실제로 와서 쓴 다음에만 수수료가 붙는 구조', tags: ['자영업', '가게홍보', '소상공인'] },
  { slug: 'store-quiet-hours', title: '비는 시간대에만 이용권 열기', angle: '평일 오후처럼 손님이 적은 시간에 쓰는 이용권을 따로 열어 빈 테이블을 채우는 방법', tags: ['자영업', '매출고민', '사장님'] },
  { slug: 'store-prepaid-guest', title: '이미 결제하고 오는 손님', angle: '온라인에서 미리 결제한 손님이 오고, 매장에서는 코드만 확인하면 끝나는 흐름', tags: ['사장님', '선결제', '가게운영'] },
  { slug: 'store-qr-redeem', title: '계산대에 새 기계를 들이지 않아도', angle: '따로 장비 없이 휴대폰으로 손님 코드를 확인해 사용 처리하는 방법', tags: ['사장님', '가게운영', 'QR'] },
  { slug: 'store-kakaomap-signup', title: '카카오맵에서 우리 가게 찾아 등록하기', angle: '이미 지도에 있는 가게 정보를 불러와 몇 단계로 이용권을 올리는 과정', tags: ['가게등록', '자영업', '소상공인'] },
  { slug: 'store-new-opening', title: '새로 문 연 가게의 첫 손님', angle: '오픈 초기 동네 사람들에게 가게를 처음 알리는 수단으로 이용권을 쓰는 법', tags: ['신규오픈', '창업', '가게홍보'] },
  { slug: 'store-fee-clarity', title: '수수료는 어떻게 되나요', angle: '수수료가 얼마이고 언제 붙는지, 먼저 내는 돈이 있는지를 한 번에 정리', tags: ['사장님', '수수료', '가게운영'] },
  { slug: 'store-local-partners', title: '동네를 아는 사람이 가게를 소개해 준다면', angle: '가게가 소개 파트너에게 몫을 제안하고, 동네를 잘 아는 사람이 직접 소개하는 방식', tags: ['가게홍보', '동네마케팅', '자영업'] },
] as const

export const CREATOR_TOPICS: readonly PromoTopic[] = [
  { slug: 'creator-local-knowledge', title: '팔로워 수보다 동네를 아는 게 먼저', angle: '규모가 작아도 자기 동네 가게를 잘 아는 사람이 소개를 더 잘한다는 이야기', tags: ['동네맛집', '로컬', '블로그'] },
  { slug: 'creator-store-offers', title: '가게가 먼저 제안하는 방식', angle: '내가 가게를 섭외하러 다니지 않고, 가게가 몫을 정해 제안하면 고르는 방식', tags: ['부업', '동네가게', '협업'] },
  { slug: 'creator-honest-pick', title: '직접 가 본 곳만 소개하기', angle: '써 보지 않은 곳은 소개하지 않는 것이 결국 오래가는 이유', tags: ['맛집추천', '솔직후기', '로컬'] },
  { slug: 'creator-early-partner', title: '이제 막 시작하는 동네 플랫폼', angle: '아직 작은 서비스라서 초기에 함께하는 사람의 의견이 실제로 반영되는 시기', tags: ['초기멤버', '동네', '협업'] },
  { slug: 'creator-by-category', title: '맛집·카페·뷰티·숙소, 잘 아는 분야로', angle: '자기가 잘 아는 분야 하나만 골라 그 분야 가게를 소개하는 방식', tags: ['카페투어', '뷰티', '숙소'] },
  { slug: 'creator-how-to-start', title: '신청부터 첫 제안까지', angle: '채널 주소를 남겨 신청하면 확인 후 연락이 오고, 가게 제안을 받아 시작하는 순서', tags: ['부업', '시작하기', '협업'] },
] as const

export function topicsFor(audience: SupplyAudience): readonly PromoTopic[] {
  return audience === 'store' ? STORE_TOPICS : CREATOR_TOPICS
}

/** LLM 경로용 사실 브리프 — 여기 없는 말은 하지 못하게 한다. */
export function supplyBrief(audience: SupplyAudience, f: SupplyFacts): string {
  if (audience === 'store') {
    const fee = f.feeBrokered != null
      ? `직접 올리면 ${f.feeDirect}%, 대행사를 통하면 ${f.feeBrokered}% 수수료가 붙는다(사장님 몫은 각각 ${100 - f.feeDirect}%·${100 - f.feeBrokered}%).`
      : `수수료는 ${f.feeDirect}% 다.`
    return [
      '## 유어딜이 매장 사장님에게 주는 것 (이 밖의 사실은 쓰지 마라)',
      '- 손님이 온라인에서 이용권을 할인가로 미리 사고, 매장에서는 QR·코드로 사용 처리만 하면 된다.',
      `- 수수료는 손님이 실제로 이용권을 산 뒤에만 붙는다. ${fee}`,
      '- 카드 수수료는 유어딜이 자기 몫 안에서 낸다.',
      `- 카카오맵에서 가게를 찾아 등록하고 이용권을 올리는 데 ${f.signupMinutes} 정도 걸린다.`,
      `- 정산은 ${f.minPayout} 이상부터 지급된다.`,
      '- 가게가 소개 파트너(동네를 아는 사람)에게 직접 몫을 정해 소개를 제안할 수 있다.',
      '## 쓰지 마라',
      '- 입점 매장 수·이용자 수 같은 규모, 매출이 늘어난다는 약속, "업계 최저", 보장 표현.',
      '- 위에 없는 퍼센트. 영입·초대·추천 보상(지금 없다).',
    ].join('\n')
  }
  return [
    '## 유어딜이 소개 파트너에게 주는 것 (이 밖의 사실은 쓰지 마라)',
    '- 동네 가게(식당·카페·뷰티·숙소)의 이용권을 직접 써 보고 소개하는 사람을 찾는다.',
    '- 소개 몫은 가게가 정해서 제안한다. 유어딜이 정한 고정 비율은 없다 — 숫자를 쓰지 마라.',
    '- 팔로워 수보다 동네를 잘 아는 것이 중요하다.',
    '- 채널 주소를 남겨 신청하면 확인 후 연락한다.',
    '- 아직 시작 단계인 서비스다 — 규모를 부풀리지 마라.',
    '## 쓰지 마라',
    '- 유어샵에 담기만 해도 돈이 된다는 말(지금 그런 보상은 없다). 초대·추천·영입 보상(없다).',
    '- 수익 금액·퍼센트·"월 N만원" 같은 숫자. "인플루언서"·"크리에이터"라는 호칭(→ "소개 파트너").',
  ].join('\n')
}
