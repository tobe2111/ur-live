import { Link } from 'react-router-dom'
import { cfImage } from '@/utils/cf-image'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useHomeBanners, type HomeBanner } from './useHomeBanners'
import type { BannerType } from '@/shared/constants/home-showcase'

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

export default function HomeBannerStrip({ variant }: { variant: Extract<BannerType, 'inline' | 'wide'> }) {
  const banners = useHomeBanners(variant)
  if (banners.length === 0) return null

  if (variant === 'wide') {
    const b = banners[0]
    const href = bannerHref(b)
    const bg = b.image_url ? cfImage(b.image_url, { width: 1600, quality: 76 }) : ''
    return (
      <div className="pb-6">
        <Wrap
          href={href}
          className="relative block overflow-hidden rounded-xl isolate min-h-[104px] flex items-center justify-between gap-5 px-6 py-5 bg-gray-900 dark:bg-[#1A2334] transition-transform hover:scale-[1.004]"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {banners.slice(0, 3).map(b => {
          const href = bannerHref(b)
          const bg = b.image_url ? cfImage(b.image_url, { width: 700, quality: 76 }) : ''
          return (
            <Wrap
              key={b.id}
              href={href}
              className="relative block overflow-hidden rounded-xl isolate min-h-[96px] flex flex-col justify-center px-5 py-4 bg-gray-800 dark:bg-[#1A2334] transition-transform hover:scale-[1.008]"
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
