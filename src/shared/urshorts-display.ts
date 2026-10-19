/**
 * 🎬 유어쇼츠 **보여 주는 규칙** — 제목 정리 · 같은 이용권 떨어뜨리기 · 유튜브 제목 줄 가리기
 * (2026-10-19 대표 *"가장 이상적으로 해줘"*).
 *
 * 순수 함수만 둔다. 서버(`/api/urshorts` 순서)와 화면(전체 보기 카드)이 같은 함수를 쓴다 —
 * 두 벌이면 홈 레일·전체 보기·뷰어가 서로 다른 순서를 보이게 된다(에러 0).
 */

/** 원제목에서 지우는 것: 해시태그 · 이모지(국기·변형 선택자 포함) · 꼬리에 붙은 구분자. */
const HASHTAG = /#[^\s#]+/g
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}️‍⃣]/gu

/**
 * 유튜브 원제목 → 목록에 쓸 제목. 남는 글자가 없으면 `null`(그 줄을 안 그린다).
 *
 * 예) `부산 최초 타이셀렉트 !!! 여기 맛있어용 태국음식집 최애! 📍아임타이 #서면맛집 #부산맛집`
 *   → `부산 최초 타이셀렉트 !!! 여기 맛있어용 태국음식집 최애! 아임타이`
 *
 * ⚠️ **문장을 고치지 않는다** — 크리에이터가 쓴 말은 그대로 두고, 검색용 꼬리표와 그림 글자만 뗀다.
 *    `!!!`·`~` 같은 말투까지 다듬으면 남의 제목을 우리가 다시 쓰는 셈이다.
 */
export function cleanShortTitle(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw
    .replace(HASHTAG, ' ')
    .replace(EMOJI, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s|·\-–—:]+|[\s|·\-–—:]+$/g, '')
    .trim()
  return s.length >= 2 ? s : null
}

/** 카드에 쓸 제목 — 정리한 원제목, 없으면 붙은 상품명. 둘 다 없으면 `null`. */
export function shortDisplayTitle(item: { title?: string | null; product_name?: string | null }): string | null {
  return cleanShortTitle(item.title) ?? (item.product_name?.trim() || null)
}

/**
 * 같은 이용권 영상끼리 **붙어 나오지 않게** 순서를 고른다.
 *
 * 왜: 한 가게를 여러 크리에이터가 찍으면(라이옥 2편 · 2026-10-19 실측) 전체 보기 2열 그리드에서
 * 같은 줄에 나란히 서고, 뷰어에서는 넘겨도 같은 가게가 또 나온다. 목록이 실제보다 빈약해 보인다.
 *
 * 규칙: 원래 순서(어드민 `sort_order`)를 최대한 지키면서, 직전 `gap` 편 안에 같은 이용권이 있으면
 * 다음 후보를 먼저 꺼낸다. 피할 수 없으면(남은 게 전부 같은 이용권) 원래 순서대로 둔다.
 * 이용권이 안 붙은 영상(`product_id` 없음)은 서로 겹치는 것으로 보지 않는다 — 가게를 모른다.
 */
export function spreadSameProduct<T extends { product_id?: number | null }>(list: readonly T[], gap = 2): T[] {
  const pending = list.slice()
  const out: T[] = []
  while (pending.length) {
    const recent = new Set(out.slice(-gap).map((x) => x.product_id).filter((v): v is number => v != null))
    let at = pending.findIndex((x) => x.product_id == null || !recent.has(x.product_id))
    if (at < 0) at = 0
    out.push(pending.splice(at, 1)[0])
  }
  return out
}

/**
 * 🎬 뷰어에서 재생기를 **화면 위로 이만큼 올려** 유튜브 제목 줄을 화면 밖으로 보낸다.
 *
 * 유튜브는 `controls=0` 이어도 영상이 시작할 때·멈췄을 때 **맨 위에 채널 로고 + 원제목**을 띄운다
 * (대표 스크린샷 2026-10-19: "부산일보TV · 부슐랭 베트남 쌀국수 맛집 '라이옥' #sh…").
 * 설정으로 끌 수 없고, 교차 출처라 CSS 로 지울 수도 없다.
 * ⇒ 재생기를 이만큼 위로 늘려 그 줄이 잘려 나가게 한다. 9:16 영상은 폰 화면보다 납작해서
 *    위아래에 검은 띠가 생기는데, 늘린 만큼의 절반이 그 띠 안에서 흡수돼 영상은 거의 안 잘린다.
 * ⚠️ 덮개 띠를 그리는 방식은 버렸다 — 2026-09-08 대표 *"번잡해, 깔끔하게"* 로 위쪽 chrome 을
 *    걷어 낸 화면이다. 잘라 내는 쪽은 아무것도 더하지 않는다.
 */
export const YT_TITLE_CLIP_PX = 72
