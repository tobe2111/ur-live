import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cfImage } from '@/utils/cf-image'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useHomeBanners } from './useHomeBanners'
import HomeHeroDefault from './HomeHeroDefault'

/**
 * 🏠 ④ 히어로 배너 (2026-08-04 대표 시안 승인 "좋다 이렇게 가자").
 *
 * 홈 최상단, 배경(이미지 **또는 영상**) 위에 카피가 얹힌다. 어드민이 `banner_type='hero'` 로
 * 올린 배너 중 첫 번째만 쓴다 — 히어로는 하나여야 하고, 여러 개면 캐러셀이 되어
 * 첫 화면이 산만해진다(그건 별도 결정이지 이 시안이 아니다).
 *
 * 🔄 **등록된 히어로가 없으면 브랜드 기본 배경**(`HomeHeroDefault`)을 그린다
 *    — 2026-08-04 대표 지시 *"히어로도 브랜드 배경으로 적합한 거 영상으로 넣어줘"*.
 *    ⚠️ 이전 판은 여기서 `null` 을 반환했다(대표의 "배너 안 올리면 안 보이게" 규칙 적용).
 *    그 규칙은 **배너 콘텐츠**에 대한 것이고, 히어로 자리 자체는 화면의 뼈대라 대표가 직접
 *    기본 배경을 요구했다. 중간·와이드 배너는 **여전히 없으면 안 그린다**(규칙 유지).
 *
 * 영상 배경 주의:
 *  - `muted`·`playsInline` 없으면 모바일 사파리가 재생을 거부한다(그러면 검은 화면만 남는다).
 *  - `poster` 에 이미지가 있으면 영상이 로드되기 전까지 그 그림이 보인다 — 빈 검정 방지.
 *  - `prefers-reduced-motion` 이면 영상을 아예 붙이지 않고 이미지로 간다.
 */
export default function HomeHeroBanner() {
  const banners = useHomeBanners('hero')
  const hero = banners[0]

  const reduceMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }, [])

  if (!hero) return <HomeHeroDefault />

  const poster = hero.image_url ? cfImage(hero.image_url, { width: 1600, quality: 78 }) : ''
  const useVideo = !!hero.video_url && !reduceMotion
  const href = hero.link_url ? safeInternalPath(hero.link_url, '') : ''

  const body = (
    <div className="relative h-[240px] lg:h-[300px] overflow-hidden isolate">
      {useVideo ? (
        <video
          className="absolute inset-0 -z-10 w-full h-full object-cover"
          src={hero.video_url as string}
          poster={poster || undefined}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
      ) : poster ? (
        <img
          className="absolute inset-0 -z-10 w-full h-full object-cover"
          src={poster}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
        />
      ) : (
        <div className="absolute inset-0 -z-10 bg-gray-800 dark:bg-[#1A2334]" aria-hidden="true" />
      )}

      {/* 좌측이 진한 그라디언트 — 어떤 사진이 와도 흰 글자가 읽힌다.
          (사진마다 밝기가 달라서 오버레이 없이는 글자가 사라지는 경우가 반드시 생긴다.) */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/35 to-black/10"
        aria-hidden="true"
      />

      <div className="relative h-full max-w-[1600px] mx-auto px-6 lg:px-10 flex items-center">
        <div className="max-w-[560px]">
          <h2 className="text-[26px] lg:text-[31px] font-black tracking-tight text-white leading-[1.22] [text-wrap:balance] drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)]">
            {hero.title}
          </h2>
          {hero.description && (
            <p className="mt-2 text-[14px] lg:text-[15px] text-white/85">{hero.description}</p>
          )}
          {href && (
            <span className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-[14px] font-bold transition-colors">
              자세히 보기 →
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return href
    ? <Link to={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white">{body}</Link>
    : body
}
