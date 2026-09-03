/**
 * 🖼️ 히어로 사진 고르기 — **입구가 어디였든** 같은 답 (2026-09-03 대표 신고).
 *
 * ## 무엇이 깨져 있었나
 * 대표: *"메인페이지에 히어로의 이미지는 항상 새로고침을 해야 이미지나 영상이 보이네..? 심각해"*
 *
 * 히어로 사진의 출처는 하나뿐이었다 — 워커가 **`/` 를 하드로드할 때만** 문서에 넣어 주는
 * `<script id="__SSR_INITIAL_MAIN__">` 시드. 그래서:
 *
 *     `/` 로 직접 들어오거나 새로고침  → 시드 있음 → 사진 보임
 *     앱 안에서 홈 탭을 눌러 들어옴     → 시드 **없음** → 색면만 (에러도 로그도 없다)
 *
 * 라이브 실측으로 확인한 것: 하드로드 HTML 에 시드 1개 + 히어로 preload 2줄이 정상으로 있고,
 * **어드민 히어로 배너는 0건**(`/api/banners?type=hero` → `[]`)이다. 즉 사진의 유일한 소스가
 * 그 시드였고, 시드가 없는 진입에서는 대안이 아예 없었다.
 *
 * ## 처방
 * 시드는 **빠른 길**로 남기고(하드로드에서 왕복 0), 시드가 없으면 홈 피드가 **이미 받아 둔**
 * 목록에서 고른다. 새 요청은 하지 않는다 — 같은 React Query 캐시를 *구독만* 한다.
 * 그래서 피드가 도착하는 순간 히어로도 함께 채워진다(새로고침 불필요).
 *
 * ⚠️ 고르는 규칙 자체는 여기 없다 — `shared/home-hero-photo` 가 SSOT 다(워커의 preload 와
 *    같은 답을 내야 한다. 한 장이라도 어긋나면 preload 가 버려지고 사진을 두 번 받는다).
 */
import { useMemo, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { pickHeroPhotoFrom, pickHeroPhotoFromSeedJson, type HeroPhotoPick } from '@/shared/home-hero-photo'

/**
 * 문서에 구워진 홈 시드에서 사진 1장. 하드로드에서만 존재한다.
 * ⚠️ 이 함수는 원래 `HomeHeroDefault` 안에 있었는데, 훅이 그걸 부르고 컴포넌트가 훅을 부르면
 *    **순환 import** 가 된다(번들 순서에 따라 TDZ 로 터지는, 에러 메시지가 엉뚱한 종류의 사고).
 *    시드 읽기는 훅의 일이므로 여기로 옮긴다.
 */
export function pickHeroPhoto(): HeroPhotoPick | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById('__SSR_INITIAL_MAIN__')
  if (!el?.textContent) return null
  return pickHeroPhotoFromSeedJson(el.textContent)
}

/** 홈 피드 캐시의 키 앞부분 — `queryKeys.groupBuyList(status, category)` = ['group-buy','list',…]. */
const FEED_PREFIX = ['group-buy', 'list'] as const

export function useHeroPhoto(enabled = true): HeroPhotoPick | null {
  // ① 하드로드 빠른 길 — 문서 시드를 동기로 1회. (리렌더·왕복 0)
  const seed = useMemo(() => (enabled ? pickHeroPhoto() : null), [enabled])

  const qc = useQueryClient()
  /**
   * ② 시드가 없을 때만 캐시를 본다. 전체 캐시를 구독하되 **스냅샷이 바뀔 때만** 리렌더된다
   *    (`useSyncExternalStore` 가 Object.is 로 거른다) — 첫 데이터가 도착하는 그 순간 한 번.
   */
  const feed = useSyncExternalStore(
    (onChange) => qc.getQueryCache().subscribe(onChange),
    () => {
      if (!enabled || seed) return undefined
      // 카테고리를 눌러 둔 상태로 들어올 수도 있으므로 **데이터가 있는 첫 목록**을 쓴다.
      for (const [, data] of qc.getQueriesData({ queryKey: FEED_PREFIX })) {
        if (Array.isArray(data) && data.length) return data
      }
      return undefined
    },
    () => undefined, // 서버 스냅샷(SSR/prerender) — 캐시가 없다
  )

  return useMemo(() => seed ?? (feed ? pickHeroPhotoFrom(feed) : null), [seed, feed])
}
