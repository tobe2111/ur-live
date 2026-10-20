/**
 * ✍️ 2026-10-15 공급 모으기 — 키 없이 도는 결정론 작성기(매장 사장님 · 소개 파트너).
 *
 * `social-compose.ts`(손님용)와 같은 방식이다: 사람이 쓴 문장 조각을 주제·플랫폼·회차로 조합한다.
 * 조각이 데이터라서 **전수 검사**가 된다(`social-supply.test.ts` 가 모든 조합을 만들어 본다).
 *
 * 말투: 사장님에게는 **동료 사장님이 경험을 나누는** 톤, 소개 파트너에게는 **동네 이야기** 톤.
 * 둘 다 영업 문구처럼 들리지 않게 — 숫자는 하나(수수료)만, 그것도 설정값만.
 *
 * ⚠️ 한계: 조각 조합이라 새 소재(이번 주 실제 입점 사례 등)는 못 만든다. 키가 있으면 LLM 경로가 더 다양하다.
 */
import type { SocialPlatform } from './social-brief'
import type { PromoTopic } from './social-brief'
import { findSupplyViolation, type SupplyAudience, type SupplyFacts } from './social-supply-brief'

export interface SupplyDraft { title: string; body: string; hashtags: string[] }

function seedOf(key: string): number {
  let h = 2166136261
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return h >>> 0
}

function makePicker(seed: number) {
  let s = seed || 1
  return <T>(arr: readonly T[]): T => {
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return arr[s % arr.length]
  }
}

const STORE_OPENERS: readonly string[] = [
  '가게 하시는 분들이 제일 많이 묻는 게 결국 비용이더라고요.',
  '광고를 몇 번 돌려 보고 나서야 알게 된 것.',
  '홍보는 하고 싶은데 돈이 먼저 나가는 게 늘 부담이었어요.',
  '동네 가게 사장님들이랑 얘기하다 보면 같은 고민이 나옵니다.',
  '결론부터 말하면 이렇습니다.',
  '짧게 정리해 둘게요.',
]

const STORE_TIPS: readonly string[] = [
  '처음에는 메뉴 하나만 올려 보고 반응을 보는 게 부담이 적어요.',
  '할인 폭보다 언제 쓸 수 있는지를 분명하게 적는 쪽이 문의가 덜 옵니다.',
  '손님이 많은 시간보다 비는 시간에 맞춰 여는 게 남는 장사입니다.',
  '등록은 지도에 있는 가게 정보를 불러와서 시작하면 됩니다.',
  '어렵지 않아요.',
  '해 보면 압니다.',
]

const STORE_CLOSERS: readonly string[] = [
  '궁금한 건 댓글로 남겨 주시면 아는 만큼 답할게요.',
  '비슷한 고민 하시는 사장님께 도움이 되면 좋겠습니다.',
  '천천히 보시고 맞으면 해 보시면 됩니다.',
  '참고만 하세요.',
]

const CREATOR_OPENERS: readonly string[] = [
  '동네 가게 소개하는 걸 좋아하는 분들께.',
  '맛집 글 쓰다 보면 이런 생각이 들 때가 있어요.',
  '팔로워가 많지 않아도 되는 일이 있습니다.',
  '동네를 잘 아는 사람이 할 수 있는 일 이야기.',
  '짧게 적어 둡니다.',
  '결론부터.',
]

const CREATOR_MECHANICS: readonly string[] = [
  '가게가 소개해 줄 사람에게 직접 몫을 정해서 제안하고, 마음에 드는 제안만 골라 받으면 됩니다.',
  '내가 가게를 하나하나 찾아다니며 섭외하는 방식이 아니라, 가게 쪽에서 먼저 제안이 오는 구조예요.',
  '써 보고 괜찮았던 동네 가게를 소개하고, 그 가게가 정한 몫을 받는 방식입니다.',
]

const CREATOR_TIPS: readonly string[] = [
  '직접 가 본 곳만 소개하는 게 결국 오래갑니다.',
  '잘 아는 분야 하나만 정해서 시작하는 편이 편해요.',
  '아직 시작 단계라서 초기에 함께하는 분들 의견이 많이 반영됩니다.',
  '동네 이름을 같이 적어 주면 찾는 사람이 훨씬 잘 찾아요.',
  '그게 다예요.',
]

const CREATOR_CLOSERS: readonly string[] = [
  '채널 주소만 남겨 두면 확인하고 연락드려요.',
  '관심 있으면 천천히 보고 신청해 주세요.',
  '궁금한 건 댓글로 물어봐 주세요.',
]

const STORE_TAGS: readonly string[] = [
  '유어딜', '자영업', '소상공인', '사장님', '가게홍보', '동네가게', '창업', '가게운영',
  '매장홍보', '로컬마케팅', '카페창업', '식당운영', '미용실', '네일샵', '펜션',
]

const CREATOR_TAGS: readonly string[] = [
  '유어딜', '동네맛집', '로컬', '맛집추천', '카페투어', '부업', '블로그', '동네소개',
  '협업', '뷰티', '숙소추천', '솔직후기', '동네탐방', '맛집블로그', '로컬가이드',
]

function storeMechanic(f: SupplyFacts, pick: <T>(a: readonly T[]) => T): string {
  const fee = f.feeBrokered != null
    ? `직접 올리면 ${f.feeDirect}%, 대행사를 통하면 ${f.feeBrokered}%고요.`
    : `수수료는 ${f.feeDirect}% 입니다.`
  return pick([
    `손님이 온라인에서 이용권을 먼저 사고 매장에서는 코드만 확인하는 방식이라, 수수료는 실제로 팔린 다음에만 붙어요. ${fee}`,
    `클릭마다 돈이 나가는 광고랑은 다르게 이용권이 팔린 다음에만 수수료가 붙습니다. ${fee} 카드 수수료는 유어딜이 자기 몫에서 냅니다.`,
    `미리 결제하고 오는 손님이라 매장에서는 휴대폰으로 코드만 확인하면 끝이에요. 수수료는 팔렸을 때만이고 ${fee}`,
  ])
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const brk = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf(','))
  return (brk > max * 0.5 ? cut.slice(0, brk) : cut).replace(/[\s,]+$/, '')
}

function tags(base: readonly string[], topic: PromoTopic, pick: <T>(a: readonly T[]) => T, count: number): string[] {
  const out: string[] = []
  const push = (t: string) => { const v = t.replace(/^#/, '').trim(); if (v && !out.includes(v)) out.push(v) }
  push('유어딜')
  for (const t of topic.tags) push(t)
  let guard = 0
  while (out.length < count && guard++ < 300) push(pick(base))
  return out.slice(0, count)
}

const BEATS: readonly string[] = ['진짜예요.', '이게 핵심.', '그게 다예요.', '끝.']
function ensureRhythm(parts: string[]): string[] {
  const lens = parts.map((p) => p.length)
  if (Math.max(...lens) - Math.min(...lens) > 8) return parts
  const i = lens.indexOf(Math.max(...lens))
  const out = parts.slice()
  out.splice(i + 1, 0, BEATS[Math.max(...lens) % BEATS.length])
  return out
}

/** 본문 길이 상한(링크 줄 포함) — 넘치면 팁 조각부터 뺀다. */
const LIMIT: Record<SocialPlatform, number> = { threads: 500, instagram: 300, youtube: 1500 }

/**
 * 공급 초안 1개. `link` 는 이미 만들어진 행동 유도 줄(`linkLine`)이다 — 본문 끝에 붙는다.
 */
export function composeSupplyDraft(
  platform: SocialPlatform,
  audience: SupplyAudience,
  topic: PromoTopic,
  facts: SupplyFacts,
  link: string,
  nonce = 0,
): { ok: true; draft: SupplyDraft } | { ok: false; error: string } {
  const pick = makePicker(seedOf(`${audience}|${topic.slug}|${platform}|${nonce}`))
  const angle = `${topic.angle.replace(/\.$/, '')}.`
  const isStore = audience === 'store'
  const opener = pick(isStore ? STORE_OPENERS : CREATOR_OPENERS)
  const mech = isStore ? storeMechanic(facts, pick) : pick(CREATOR_MECHANICS)
  const tip = pick(isStore ? STORE_TIPS : CREATOR_TIPS)
  const closer = pick(isStore ? STORE_CLOSERS : CREATOR_CLOSERS)

  const candidates: string[][] = platform === 'instagram'
    ? [[opener, angle, mech, closer], [opener, mech, closer], [mech, closer]]
    : platform === 'threads'
      ? [[opener, angle, mech, tip, closer], [opener, angle, mech, closer], [opener, mech, closer]]
      : [[angle, mech, tip, closer], [angle, mech, closer]]

  const sep = platform === 'youtube' ? '\n' : '\n\n'
  let body = ''
  for (const parts of candidates) {
    const b = [...ensureRhythm(parts), link].join(sep)
    if (b.length <= LIMIT[platform]) { body = b; break }
  }
  if (!body) return { ok: false, error: `${platform} 길이 초과` }

  const title = platform === 'youtube' ? clip(topic.title, 60) : clip(topic.title, 24)
  const tagCount = platform === 'instagram' ? 13 : platform === 'youtube' ? 10 : 4
  const hashtags = tags(isStore ? STORE_TAGS : CREATOR_TAGS, topic, pick, tagCount)

  const bad = findSupplyViolation(`${title}\n${body}\n${hashtags.join(' ')}`, audience, facts)
  if (bad) return { ok: false, error: `금지 표현: ${bad}` }
  return { ok: true, draft: { title, body, hashtags } }
}
