import { Fragment, memo } from 'react'
import { Link } from 'react-router-dom'
import { cfImage } from '@/utils/cf-image'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon } from '@/utils/format'
import { canonicalDetailPath } from '@/shared/product-flow'

/**
 * 🏠 ① 카테고리 섹션 + 더보기 (2026-08-04 대표 시안 승인).
 *
 * 어드민이 만든 홈 섹션(`homepage_sections`)을 주제별 한 줄씩 그린다.
 * 상품은 규칙(인기·마감임박·최신·카테고리) 또는 직접 고른 목록에서 온다 — 서버가 정한다.
 *
 * 🚫 **상품이 0건인 섹션은 서버가 목록에서 빼고 내려준다.** 여기서 또 거르지 않아도 되지만,
 *    방어적으로 한 번 더 본다(서버가 바뀌어도 홈에 빈 제목이 남지 않게).
 *
 * 카드가 링크하는 곳은 `canonicalDetailPath` SSOT 로 정한다 — 교환권(`deal_only=1`)은 `/vouchers`,
 * 숙소는 `/stays`, 나머지 이용권은 `/group-buy` 다. 이름으로 찍으면 반드시 틀린다.
 */

interface SectionProduct {
  id: number
  name: string
  price?: number | null
  original_price?: number | null
  image_url?: string | null
  category?: string | null
  deal_only?: number | null
  dominant_color?: string | null
  restaurant_name?: string | null
  restaurant_address?: string | null
}
interface HomeSection {
  id: number
  title: string
  subtitle?: string | null
  more_href?: string | null
  products: SectionProduct[]
}

function discountPct(p: SectionProduct): number | null {
  const now = Number(p.price), was = Number(p.original_price)
  if (!Number.isFinite(now) || !Number.isFinite(was) || was <= 0 || now >= was) return null
  return Math.round((1 - now / was) * 100)
}

const DealCard = memo(function DealCard({ p }: { p: SectionProduct }) {
  // 목적지는 `canonicalDetailPath` SSOT 만 쓴다 — 교환권 /vouchers · 숙소 /stays · 그 외 이용권
  // /group-buy 로 갈린다. 카테고리를 손으로 찍으면 숙소가 객실·날짜 없는 상세로 떨어진다.
  const href = canonicalDetailPath({ id: p.id, deal_only: p.deal_only, category: p.category })
    ?? `/products/${p.id}`
  const img = p.image_url ? cfImage(p.image_url, { width: 480, quality: 76 }) : ''
  const off = discountPct(p)
  const where = [p.restaurant_name, (p.restaurant_address || '').split(' ').slice(0, 2).join(' ')]
    .filter(Boolean).join(' · ')

  return (
    <Link to={href} className="block min-w-0 group">
      <div
        className="relative aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 dark:bg-[#1A2334]"
        style={p.dominant_color ? { backgroundColor: p.dominant_color } : undefined}
      >
        {img && (
          <img
            src={img}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <h4 className="mt-2.5 text-[13.5px] font-bold leading-snug text-gray-900 dark:text-white line-clamp-2">
        {p.name}
      </h4>
      {where && <div className="mt-0.5 text-[11.5px] text-gray-400 dark:text-gray-500 truncate">{where}</div>}
      <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-[15px] font-black tracking-tight text-gray-900 dark:text-white">
          {formatWon(p.price)}
        </span>
        {off !== null && (
          <>
            <span className="text-[11.5px] text-gray-400 dark:text-gray-500 line-through">
              {Number(p.original_price).toLocaleString()}
            </span>
            <span className="text-[12px] font-bold text-brand">{off}%</span>
          </>
        )}
      </div>
    </Link>
  )
})

/**
 * @param midBanner 첫 섹션 **뒤에** 끼워 넣을 노드(③ 중간 배너). 섹션이 하나도 없으면 이것만
 *   남는다 — 배너 컴포넌트 자신이 "없으면 null" 이라 결국 아무것도 안 그려진다.
 */
export default function HomeSections({ midBanner }: { midBanner?: React.ReactNode }) {
  const { data: sections = [] } = useApiQuery<HomeSection[]>(
    ['home', 'sections'],
    '/api/sections',
    {
      select: (raw) => {
        const r = raw as { success?: boolean; data?: HomeSection[] }
        return r?.success && Array.isArray(r.data) ? r.data : []
      },
      staleTime: 5 * 60_000,
    },
  )

  const visible = sections.filter(s => Array.isArray(s.products) && s.products.length > 0)
  if (visible.length === 0) return <>{midBanner}</>

  return (
    <>
      {visible.map((sec, i) => {
        const more = sec.more_href ? safeInternalPath(sec.more_href, '') : ''
        return (
          <Fragment key={sec.id}>
          {/* 📐 가로 여백은 홈 컨테이너가 준다 — 여기서 또 주면 좌우가 어긋난다. */}
          <section className="pb-8">
            <div className="flex items-end justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h3 className="text-[18.5px] font-black tracking-tight text-gray-900 dark:text-white">
                  {sec.title}
                </h3>
                {sec.subtitle && (
                  <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">{sec.subtitle}</p>
                )}
              </div>
              {more && (
                <Link
                  to={more}
                  className="shrink-0 px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-[#2A3446] text-[12.5px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors whitespace-nowrap"
                >
                  더보기 →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-5">
              {sec.products.map(p => <DealCard key={p.id} p={p} />)}
            </div>
          </section>
          {i === 0 && midBanner}
          </Fragment>
        )
      })}
    </>
  )
}
