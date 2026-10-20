/**
 * ✍️ 2026-08-01 (대표: "앤트로픽 없이도 초안 최대한 자연스럽게 생성되게끔 해줘")
 *
 * 그동안 소셜 초안은 `ANTHROPIC_API_KEY` 가 없으면 **NOT_CONFIGURED 로 그냥 실패**했다(503).
 * 즉 키가 없는 동안 `/admin/social` 의 "초안 생성" 버튼은 아무것도 만들지 못했다.
 *
 * 이 파일은 **키 없이 도는 결정론적 작성기**다. 같은 레포에 선례가 있다 —
 * 리뷰 생성기(`buildStoreReviews`)가 "키 있으면 Claude, 없으면 업종별 결정론 composer".
 * 같은 구조를 소셜에 적용한다: `social-content` 가 키가 있으면 Claude, 없으면 여기로 위임.
 *
 * ## 자연스러움을 어떻게 확보하나 (LLM 없이)
 * 문장을 통째로 찍어내지 않고 **조각을 조합**한다: 훅 · 장면 · 팁 · 마무리를 각각 여러 벌 두고
 * 주제·플랫폼·회차로 **서로 다른 조합**을 뽑는다. 조각 자체는 사람이 쓴 문장이라 "AI 티"가 없다.
 * 그리고 `HUMAN_VOICE_RULES` 를 프롬프트가 아니라 **데이터로** 지킨다:
 *   이모지 0 · 느낌표 0 · "여러분/지금 바로/놓치지 마세요" 없음 · 최상급 없음 ·
 *   짧은 문장과 긴 문장을 섞어 리듬 · 뻔한 도입("바쁜 일상 속에서") 금지 · 없는 수치 만들지 않음.
 * 위 규칙들은 `social-compose.test.ts` 가 **생성 결과 전수에 대해** 검사한다(프롬프트는 어길 수 있지만
 * 데이터는 못 어긴다 — 그게 이 방식의 장점이다).
 *
 * ⚠️ 한계(정직하게): 조각 조합이라 **시사성·신상품 같은 새 소재는 못 만든다**. 주제 백로그(PROMO_TOPICS)
 *    안에서만 돈다. 키가 있으면 Claude 쪽이 더 다양하다 — 이건 "없을 때도 쓸 수 있게" 하는 폴백이다.
 */
import { findForbidden, type SocialPlatform, type PromoTopic } from './social-brief'

export interface ComposedDraft { title: string; body: string; hashtags: string[] }

/** 주제 slug + 플랫폼 + 회차로 흔들리는 결정론 시드(같은 입력 → 같은 결과, 회차가 바뀌면 다른 글). */
function seedOf(topicSlug: string, platform: string, nonce: number): number {
  let h = 2166136261
  for (const ch of `${topicSlug}|${platform}|${nonce}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function makePicker(seed: number) {
  let s = seed || 1
  return <T>(arr: readonly T[]): T => {
    // xorshift — 같은 시드면 같은 순서. 배열마다 다른 값이 나오도록 상태를 굴린다.
    s ^= s << 13; s >>>= 0
    s ^= s >>> 17
    s ^= s << 5; s >>>= 0
    return arr[s % arr.length]
  }
}

/** 주제를 화제로 바꾸는 짧은 도입. 상투어("바쁜 일상 속에서")를 의도적으로 배제. */
const OPENERS: readonly string[] = [
  '요즘 이런 걸 자주 쓰게 되네요.',
  '이거 알고 나서 씀씀이가 좀 달라졌어요.',
  '주변에 알려줬더니 다들 왜 이제 말했냐고 하더라고요.',
  '별거 아닌데 은근히 도움 되는 이야기.',
  '한동안 써보고 나서야 감이 잡혔어요.',
  '처음엔 반신반의했는데 지금은 자주 씁니다.',
  '요약하면 이렇습니다.',
  '결론부터.',
]

/** 유어딜이 실제로 하는 일만 말한다(brief 범위). 없는 수치·후기는 만들지 않는다. */
const MECHANICS: readonly string[] = [
  '이용권을 미리 할인가로 사두고, 매장 가서 QR로 쓰면 끝이에요.',
  '결제는 온라인에서 미리 하고, 매장에서는 코드만 보여주면 됩니다.',
  '교환권은 결제하면 바로 발급돼서 그 자리에서 쓸 수 있어요.',
  '지도에서 내 주변 동네딜을 훑어보면 가까운 곳부터 나옵니다.',
  '마음에 든 혜택은 유어샵에 모아두면 나중에 찾기 편해요.',
]

const TIPS: readonly string[] = [
  '쓸 일이 확실한 것부터 사두는 게 제일 안 아깝더라고요.',
  '유효기간만 한 번 확인하고 담으면 실패가 없습니다.',
  '가기 전에 매장 위치랑 영업시간을 같이 보는 습관이 생겼어요.',
  '한 번에 많이 사기보다 이번 주에 갈 곳만 골라 담는 편이에요.',
  '친구랑 갈 계획이 있으면 그때 맞춰 미리 챙겨둡니다.',
  '유효기간만 보면 됩니다.',
  '어렵지 않아요.',
]

const CLOSERS: readonly string[] = [
  '비슷한 거 찾는 분들은 한 번 둘러봐도 괜찮을 것 같아요.',
  '관심 있으면 프로필 링크에서 확인할 수 있어요.',
  '가까운 동네부터 보면 생각보다 많습니다.',
  '어떤 걸 자주 쓰는지 댓글로 알려주세요.',
  '저는 당분간 계속 이렇게 쓸 것 같네요.',
  '한 번 보시면 압니다.',
  '참고만 하세요.',
]

/** 해시태그 풀 — 폐기 용어·운영 용어를 넣지 않는다(findForbidden 이 최종 방어). */
const TAG_POOL: readonly string[] = [
  '유어딜', '이용권', '교환권', '동네딜', '유어샵', '동네맛집', '알뜰소비', '생활꿀팁',
  '데이트코스', '주말나들이', '혼밥', '카페투어', '뷰티', '숙소', '기프티콘', '소상공인',
]

function buildTags(topic: PromoTopic, pick: <T>(a: readonly T[]) => T, count: number): string[] {
  const out: string[] = []
  const push = (t: string) => { const v = t.replace(/^#/, '').trim(); if (v && !out.includes(v)) out.push(v) }
  push('유어딜')
  for (const t of topic.tags) push(t)
  let guard = 0
  while (out.length < count && guard++ < 200) push(pick(TAG_POOL))
  return out.slice(0, count)
}


/** 라벨을 자를 때 단어/숫자 중간에서 끊기지 않게(예: "…이용권 200" 처럼 어중간해지는 것 방지). */
function clipLabel(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const brk = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('—'), cut.lastIndexOf(','))
  return (brk > max * 0.5 ? cut.slice(0, brk) : cut).replace(/[\s—,·]+$/, '')
}

/** 문단 길이 편차가 너무 작으면 짧은 한 마디를 끼워 대비를 만든다. */
const SHORT_BEATS: readonly string[] = ['그게 다예요.', '끝.', '진짜입니다.', '이게 핵심.']
function ensureRhythm(body: string): string {
  const parts = body.split(/\n+/).map(t => t.trim()).filter(Boolean)
  const lens = parts.map(p => p.length)
  if (Math.max(...lens) - Math.min(...lens) > 8) return body
  // 가장 긴 문단 **뒤에** 짧은 한 마디 — 어느 조각을 골랐는지에만 의존하므로 결정론이다.
  const longestIdx = lens.indexOf(Math.max(...lens))
  const beat = SHORT_BEATS[Math.max(...lens) % SHORT_BEATS.length]
  const sep = body.includes('\n\n') ? '\n\n' : '\n'
  parts.splice(longestIdx + 1, 0, beat)
  return parts.join(sep)
}

/**
 * 키 없이 초안을 만든다. 플랫폼별 형태(길이·해시태그 수·제목 필요 여부)를 지킨다.
 * `nonce` 는 같은 주제로 다시 뽑을 때 다른 글이 나오게 하는 회차 값(보통 기존 초안 수).
 */
export function composeSocialDraft(
  platform: SocialPlatform,
  topic: PromoTopic,
  nonce = 0
): { ok: true; draft: ComposedDraft } | { ok: false; error: string } {
  const pick = makePicker(seedOf(topic.slug, platform, nonce))
  const opener = pick(OPENERS)
  const mech = pick(MECHANICS)
  const tip = pick(TIPS)
  const closer = pick(CLOSERS)
  // 주제의 앵글을 한 문장으로 녹인다 — 주제마다 본문이 실제로 달라지는 지점.
  const angle = `${topic.angle.replace(/\.$/, '')}.`

  let title: string
  let body: string
  let tagCount: number

  if (platform === 'threads') {
    title = clipLabel(topic.title, 24)
    // 짧은 문장과 긴 문장을 섞어 리듬을 준다(규칙 5).
    body = [opener, angle, mech, tip, closer].join('\n\n')
    tagCount = 4
  } else if (platform === 'instagram') {
    title = clipLabel(topic.title, 24)
    body = [opener, angle, mech, closer].join('\n\n')
    tagCount = 13
  } else {
    title = clipLabel(topic.title, 60)
    body = [
      `${angle}`,
      mech,
      tip,
      '',
      `유어딜에서 ${topic.tags[0] ?? '이용권'} 관련 혜택을 찾아볼 수 있습니다.`,
    ].join('\n')
    tagCount = 10
  }

  // 리듬 보장 — 조각을 무작위로 뽑으면 우연히 길이가 다 비슷해지는 조합이 나온다(테스트가 실제로 잡았다).
  //   그럴 때만 가장 짧은 조각 하나를 끼워 넣어 긴/짧은 대비를 만든다. 결정론 유지(무작위 재시도 아님).
  body = ensureRhythm(body)

  const hashtags = buildTags(topic, pick, tagCount)

  // 최종 방어 — AI 경로와 **같은 검증**을 통과해야 한다(운영/내부 정보·폐기 용어 차단).
  const bad = findForbidden(`${title}\n${body}\n${hashtags.join(' ')}`)
  if (bad) return { ok: false, error: `금지 표현: ${bad}` }
  return { ok: true, draft: { title, body, hashtags } }
}
