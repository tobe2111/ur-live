import { useMemo } from 'react'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useHomeBanners } from './useHomeBanners'
import HomeHeroDefault, { type HeroControls } from './HomeHeroDefault'

/**
 * 🏠 히어로 — **어드민이 지정한 사진·카피를 넣는 자리** (2026-08-19 대표 확정
 * *"히어로 사진은 어드민에서 직접 지정"*).
 *
 * ## 이전 판과 무엇이 다른가
 * 예전엔 배너가 **있고 없고에 따라 레이아웃이 통째로 갈렸다** — 배너가 있으면 이 파일이 그린
 * 전면 사진 히어로(300px), 없으면 `HomeHeroDefault`. 그래서 대표가 사진을 올리는 순간
 * **위치·지도 칩이 사라졌다**(그 칩은 기본 히어로에만 있었으니까).
 * ⇒ 이제 레이아웃은 **하나**(`HomeHeroDefault`, 통합형 190px)고, 이 파일은 *콘텐츠 소스*만
 *   고른다: 어드민 배너가 있으면 그 사진·제목·설명·링크를, 없으면 기본값(홈 시드 사진 + D안 카피).
 *   무엇을 올리든 위치·지도 칩은 항상 그 자리에 있다.
 *
 * 어드민이 `banner_type='hero'` 로 올린 배너 중 **첫 번째만** 쓴다 — 히어로는 하나여야 하고,
 * 여러 개면 캐러셀이 되어 첫 화면이 산만해진다(그건 별도 결정이지 이 시안이 아니다).
 *
 * 영상 배경 주의: `muted`·`playsInline` 없으면 모바일 사파리가 재생을 거부한다(검은 화면만 남는다).
 * `prefers-reduced-motion` 이면 영상을 붙이지 않고 이미지로 간다.
 */
export default function HomeHeroBanner({ controls }: { controls?: HeroControls }) {
  const banners = useHomeBanners('hero')
  const hero = banners[0]

  const reduceMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }, [])

  if (!hero) return <HomeHeroDefault controls={controls} />

  return (
    <HomeHeroDefault
      controls={controls}
      content={{
        photo: hero.image_url || undefined,
        // 어드민이 링크를 지정했으면 그 딜/페이지로. 외부 URL 은 safeInternalPath 가 걸러낸다.
        photoHref: hero.link_url ? safeInternalPath(hero.link_url, '') || undefined : undefined,
        title: hero.title || undefined,
        description: hero.description || undefined,
        videoUrl: !reduceMotion && hero.video_url ? hero.video_url : undefined,
      }}
    />
  )
}
