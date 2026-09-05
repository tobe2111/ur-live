import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useHomeBanners, type HomeBanner } from './useHomeBanners'
import type { BannerSlot } from '@/shared/constants/home-showcase'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'

/**
 * 🏠 ③ 중간 배너 (2026-08-04 대표 시안 승인).
 *
 * `inline` = 3열 프로모션, `wide` = 가로 전체 한 줄. 섹션 사이에 놓인다.
 *
 * 📐 **가로 여백(max-w·px)은 갖지 않는다** — 홈 컨테이너 안에 놓이므로 여기서 또 주면
 *    안쪽으로 한 겹 더 들어가 다른 블록과 좌우가 어긋난다. 세로는 **아래쪽(pb)만** —
 *    위가 아니라 아래여야 아무것도 안 그려질 때 유령 여백이 남지 않는다.
 *
 * 🚫 **등록된 배너가 없으면 아무것도 안 그린다**(대표 확정 규칙 — "올리지 않으면 아예
 *    보이지 않도록"). 제목만 남거나 회색 자리가 생기지 않고 레이아웃이 위로 붙는다.
 *
 * 배경은 이미지가 있으면 이미지, 없으면 잉크 톤 단색이다. 배너 문구가 사진 위에서
 * 안 읽히는 사고를 막으려고 어두운 오버레이를 항상 깐다 — 어떤 사진이 올라올지 모른다.
 */

function bannerHref(b: HomeBanner): string {
  return b.link_url ? safeInternalPath(b.link_url, '') : ''
}

function Wrap({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return href
    ? <Link to={href} className={className}>{children}</Link>
    : <div className={className}>{children}</div>
}

export default function HomeBannerStrip({ variant }: { variant: Extract<BannerSlot, 'strip' | 'inline' | 'wide'> }) {
  const banners = useHomeBanners(variant)
  if (banners.length === 0) return null

  /**
   * 🎫 2026-09-05 (대표 "인기 이용권 섹션 위에 배너가 작게 있어야 할 것 같음" — 시안 안 2 확정):
   *   첫 섹션 **위** 가로 카드. 다른 두 자리와 달리 **사진 위에 글자를 얹지 않는다** —
   *   아래 딜 카드와 같은 흰 표면·같은 들림(`shadow-lift`)이라 화면이 한 벌로 읽힌다.
   *   잉크 색면 띠(시안 안 1)는 흰 카드가 이어지는 그 자리에서 이물감이 있었다.
   *
   * 📐 **아래 여백만** — 이 자리는 카테고리 탭 바로 밑이라 위 여백을 주면 탭과 벌어진다.
   *   그리고 배너가 없으면 통째로 null 이라 유령 여백이 안 남는다(다른 두 자리와 같은 규칙).
   */
  if (variant === 'strip') {
    const b = banners[0]
    const href = bannerHref(b)
    const th = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.strip.requestWidth, quality: 78 }) : ''
    return (
      <div className="pb-4">
        <Wrap
          href={href}
          className="flex items-center gap-3 rounded-xl bg-white dark:bg-[#1D1F29] shadow-lift px-3.5 py-2.5 min-h-[76px] transition-transform active:scale-[.995]"
        >
          <div className="shrink-0 w-14 h-14 rounded-[9px] overflow-hidden bg-brand">
            {th && (
              <img
                src={th} alt="" aria-hidden="true" width={56} height={56} loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => cfImageOnError(e.currentTarget, b.image_url)}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {b.description && (
              <span className="block text-[10.5px] font-extrabold text-brand-text truncate">{b.description}</span>
            )}
            <strong className="block text-[14px] font-extrabold tracking-tight text-gray-900 dark:text-white truncate">{b.title}</strong>
          </div>
          {href && <ChevronRight className="shrink-0 w-[18px] h-[18px] text-gray-300 dark:text-gray-600" aria-hidden="true" />}
        </Wrap>
      </div>
    )
  }

  if (variant === 'wide') {
    const b = banners[0]
    const href = bannerHref(b)
    const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.wide.requestWidth, quality: 76 }) : ''
    return (
      <div className="pb-6">
        <Wrap
          href={href}
          className="relative block overflow-hidden rounded-xl isolate min-h-[104px] flex items-center justify-between gap-5 px-6 py-5 bg-gray-900 dark:bg-[#1D1F29] transition-transform hover:scale-[1.004]"
        >
          {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 to-black/25" aria-hidden="true" />
          <div className="min-w-0">
            <strong className="block text-[17px] font-black tracking-tight text-white">{b.title}</strong>
            {b.description && <span className="block mt-1 text-[13px] text-white/78">{b.description}</span>}
          </div>
          {href && (
            <span className="shrink-0 px-5 py-2.5 rounded-lg bg-brand text-white text-[13px] font-bold">
              바로가기
            </span>
          )}
        </Wrap>
      </div>
    )
  }

  return (
    <div className="pb-6">
      {/* 📐 열 수를 **개수에 맞춘다** — 1장을 3열 그리드에 두면 1/3 폭에 홀로 서서
          가로로 긴 홍보 이미지가 잘린다(2026-08-04 대표 신고 화면이 정확히 그랬다). */}
      <div className={`grid gap-3 ${
        banners.length === 1 ? 'grid-cols-1'
        : banners.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {banners.slice(0, 3).map(b => {
          const href = bannerHref(b)
          const bg = b.image_url ? cfImage(b.image_url, { width: BANNER_SLOT_SPECS.inline.requestWidth, quality: 76 }) : ''
          return (
            <Wrap
              key={b.id}
              href={href}
              className="relative block overflow-hidden rounded-xl isolate min-h-[96px] flex flex-col justify-center px-5 py-4 bg-gray-800 dark:bg-[#1D1F29] transition-transform hover:scale-[1.008]"
            >
              {bg && <img src={bg} alt="" aria-hidden="true" className="absolute inset-0 -z-10 w-full h-full object-cover" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/62 to-black/38" aria-hidden="true" />
              {b.description && (
                <small className="block mb-1 text-[11px] font-bold tracking-wide text-white/82">{b.description}</small>
              )}
              <strong className="text-[15px] font-bold leading-snug tracking-tight text-white">{b.title}</strong>
            </Wrap>
          )
        })}
      </div>
    </div>
  )
}
