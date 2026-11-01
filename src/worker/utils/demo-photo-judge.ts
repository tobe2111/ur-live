/**
 * 🤖 2026-10-27 (대표 "매장주 제공 사진이 있는 매장만 하자 … 근데 그 사진들 중에서도 연관되게 해야할텐데"
 *   → AskUserQuestion "AI로 사진 판정 (추천)" · "숨기고 자동 교체 (추천)"):
 *   데모 사진 후보를 Claude Haiku 가 한 장씩 보고 **매대에 걸 만한 사진만** 통과시킨다.
 *
 * 왜 필요한가(라이브 실측): 카카오 '매장주 제공' 사진도 사진마다 장면 분류가 없다 — 메뉴판·가격표,
 *   글자 포스터, 로고·캡처, 공사 중 사진이 섞인다. 출처만으로는 거를 수 없다.
 *
 * 🔑 켜짐 조건 = `ANTHROPIC_API_KEY` 가 있을 때만(`demoPhotoJudgeOn`). 키가 없으면 이 모듈은 아무것도
 *   하지 않고 사진 수집은 종전과 같다 — 키 없이 "매장주 사진만 + 판정" 을 켜면 판정이 전부 실패해
 *   데모가 통째로 내려간다(2026-10-27 라이브 실측: 키 미설정).
 *
 * 실패 처리: 판정 호출이 실패하면 `null` — **사진을 쓰지도, 데모를 내리지도 않는다**(모른다 ≠ 무관하다).
 *   호출부는 null 이면 그 회차를 건너뛰고 나중에 다시 시도한다.
 */
import type { Env } from '../types/env'

export const DEMO_JUDGE_MODEL = 'claude-haiku-4-5-20251001'
/** 한 번에 판정할 최대 장수 — 비용·응답 크기 상한. */
export const JUDGE_MAX_IMAGES = 10

export function demoPhotoJudgeOn(env: Env): boolean {
  return !!(env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY
}

const CATEGORY_LABEL: Record<string, string> = {
  meal_voucher: '음식점·카페',
  beauty_voucher: '미용·뷰티(미용실·네일·피부관리 등)',
  stay_voucher: '숙소(펜션·호텔·글램핑 등)',
  etc_voucher: '체험·운동·여가 시설',
}

/** 판정 기준 — 업종마다 "그 가게를 보여 주는 사진" 이 다르다. */
export function judgePrompt(storeName: string, category: string | null | undefined, n: number): string {
  const kind = CATEGORY_LABEL[category || ''] || '오프라인 매장'
  const pass = category === 'meal_voucher'
    ? '그 가게의 음식·음료 사진, 매장 내부, 매장 외관'
    : category === 'stay_voucher'
      ? '객실·침실·욕실, 건물 외관, 수영장·바비큐장 같은 부대시설, 숙소에서 보이는 풍경'
      : category === 'beauty_voucher'
        ? '시술 결과물(헤어·네일·피부 등), 시술 공간·매장 내부, 매장 외관'
        : '그 시설의 내부·외관, 실제로 이용하는 장면이나 공간'
  return `아래 ${n}장의 사진은 "${storeName}" (${kind}) 이 지도 앱에 올린 사진이다.
할인 이용권 판매 페이지에 걸 사진을 고른다. 손님이 보고 "이 가게가 이렇구나" 를 알 수 있어야 한다.

통과: ${pass}.
탈락:
- 메뉴판·가격표·전단지, 글자가 사진의 주인공인 포스터·현수막·안내문
- 로고만 있는 이미지, 화면 캡처, 그래픽 디자인 이미지
- 공사·리모델링 중인 모습, 공사 자재
- 사람(직원·손님·모델)의 얼굴이나 몸이 주인공인 사진
- ${category === 'meal_voucher' ? '음식점과 관계없는 사진' : '이 업종과 관계없는 사진(예: 음식점이 아닌데 음식 사진)'}
- 흐리거나 너무 어두워 무엇인지 알 수 없는 사진

사진 번호는 0부터 ${n - 1}까지다. 통과한 번호만 JSON 으로 답하라. 다른 글자는 쓰지 마라.
형식: {"keep":[0,2]}`
}

/** 응답 파싱 — 형식이 틀리면 null(모른다). 순수 함수, 시험 대상. */
export function parseJudgeReply(text: string, n: number): boolean[] | null {
  const m = String(text || '').match(/\{[\s\S]*\}/)
  if (!m) return null
  let obj: unknown
  try { obj = JSON.parse(m[0]) } catch { return null }
  const keep = (obj as { keep?: unknown })?.keep
  if (!Array.isArray(keep)) return null
  const out = new Array<boolean>(n).fill(false)
  for (const k of keep) {
    if (typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < n) out[k] = true
  }
  return out
}

/** 판정용 축소 주소 — 카카오 이미지는 카카오 썸네일 서비스로 300px(토큰·전송량 절감). */
export function judgeImageUrl(u: string): string {
  if (/^https:\/\/[^/]*(daumcdn|kakaocdn)\.net\//i.test(u) && !/\/thumb\//.test(u)) {
    return `https://t1.kakaocdn.net/thumb/C300x300/?fname=${encodeURIComponent(u)}`
  }
  return u
}

/**
 * 사진들을 판정한다. 반환 = 장마다 통과 여부. 키 없음·호출 실패·형식 오류 → null(모른다).
 * 서브리퀘스트 1회.
 */
export async function judgeDemoPhotos(
  env: Env,
  urls: string[],
  ctx: { storeName: string; category?: string | null },
): Promise<boolean[] | null> {
  const apiKey = (env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY
  if (!apiKey) return null
  const list = urls.slice(0, JUDGE_MAX_IMAGES)
  if (list.length === 0) return []
  const content: Array<Record<string, unknown>> = []
  list.forEach((u, i) => {
    content.push({ type: 'text', text: `사진 ${i}` })
    content.push({ type: 'image', source: { type: 'url', url: judgeImageUrl(u) } })
  })
  content.push({ type: 'text', text: judgePrompt(ctx.storeName, ctx.category, list.length) })
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ model: DEMO_JUDGE_MODEL, max_tokens: 200, messages: [{ role: 'user', content }] }),
    })
    if (!res.ok) {
      console.error('[demo-photo-judge] HTTP', res.status, (await res.text().catch(() => '')).slice(0, 200))
      return null
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    const verdict = parseJudgeReply(data?.content?.[0]?.text || '', list.length)
    if (!verdict) console.error('[demo-photo-judge] 응답 형식 오류')
    return verdict
  } catch (err) {
    console.error('[demo-photo-judge] 호출 실패', String((err as Error)?.message || err).slice(0, 200))
    return null
  }
}
