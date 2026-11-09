/**
 * 🎬 `/urshorts` 첫 화면 보조 (2026-11-09 대표 *"유어쇼츠도 그렇고 너무 늦는데?"*).
 *
 * 라이브 실측(Pixel 7 흉내): 1.5초에 '페이지 로딩 중…', 목록(`/api/urshorts?all=1`)은 앱이 켜진 **뒤** 2.2초에 출발,
 * 썸네일은 4초에 다 떴다. 목록은 4KB(10편)인데 HTML 과 따로 한 왕복(한국→LA) 더 기다린 것이다.
 *
 * 처방 둘 — 둘 다 **같은 시드**(`/api/urshorts`, cron 예열 키)에서 나온다:
 *   ① 워커가 그 시드를 `__SSR_INITIAL_URSHORTS__` 로 HTML 에 싣고(종전엔 크롤러 본문까지만 쓰고 **버렸다**),
 *      화면(`UrShortsBrowsePage`)이 첫 렌더에 그걸 그린 뒤 `?all=1` 전량을 받아 갈아끼운다 —
 *      2026-10-13 규율("10편 시드가 전량을 대체하면 안 된다")은 **갈아끼움**으로 지킨다(시드는 자리값이지 대체가 아니다).
 *   ② 첫 두 장 썸네일을 응답 헤더 `Link: rel=preload` 로 미리 당긴다 — 카드와 **같은 함수·같은 폭**(`cfImage(…, {width:360})`).
 */
import { cfImage } from '../../utils/cf-image'

/** 카드(`urshorts/BrowseCard`)가 그리는 썸네일 폭 — 다르면 preload 가 버려진다. */
export const URSHORTS_CARD_THUMB_WIDTH = 360
export const URSHORTS_PRELOAD_COUNT = 2

export function urshortsThumbPreloadHrefs(ssrPayload: string | null | undefined, n = URSHORTS_PRELOAD_COUNT): string[] {
  try {
    if (!ssrPayload) return []
    const parsed = JSON.parse(ssrPayload) as { success?: boolean; data?: Array<{ thumb_url?: string | null; product_image?: string | null }> }
    if (!parsed?.success || !Array.isArray(parsed.data)) return []
    return parsed.data.slice(0, n)
      .map((it) => it.thumb_url || it.product_image || '')
      .filter(Boolean)
      .map((src) => cfImage(src, { width: URSHORTS_CARD_THUMB_WIDTH }))
      .filter((u) => !!u && u.startsWith('/') && !u.startsWith('//'))
  } catch { return [] }
}
