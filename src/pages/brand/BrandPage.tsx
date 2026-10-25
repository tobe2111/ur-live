/**
 * 🏷️ 브랜드 페이지 — `/brand/:slug` (2026-10-17 대표 "응응 다 해줘" — 프랜차이즈를 손님에게 한 브랜드로)
 *
 * 지점이 여럿인 브랜드를 한 페이지에서 보여 준다: [브랜드 이름 · 지점 N곳] → [가까운 지점] → [이용권].
 * 지점을 누르면 그 지점 이용권만 걸러진다(다시 누르면 전체).
 *
 * ## 거리는 화면이 계산한다
 * 서버는 지점 좌표만 준다(`brands-public.routes`). 손님 위치는 기기에 저장된 마지막 측위
 * (`readCachedLoc`)를 쓰고, 없으면 등록 순서로 보여 준다 — 브랜드 페이지에 들어왔다고 위치 권한을
 * 묻지 않는다(홈과 같은 판단).
 *
 * ## 카드는 홈과 같은 부품
 * `GroupBuyFeedCard` 를 그대로 쓴다. 카드가 두 벌이면 한쪽만 고쳐지고 결국 갈린다.
 */
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import NotFoundPage from '@/pages/NotFoundPage'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { readCachedLoc } from '@/shared/utils/cached-loc'
import { distanceKm } from '@/pages/restaurant-map/utils'
import { PinIcon } from '@/components/icons/urdeal-icons'
import { sortBranchesByDistance, type BrandStore } from './brand-branches'

interface BrandPayload {
  brand: { slug: string; name: string }
  stores: BrandStore[]
  products: Array<Record<string, unknown> & { id: number; seller_id?: number }>
}

export default function BrandPage() {
  const { slug = '' } = useParams()
  const [userLoc] = useState(() => readCachedLoc())
  const [onlyStore, setOnlyStore] = useState<number | null>(null)
  const { data, isLoading, isError } = useApiQuery<BrandPayload | null>(
    ['brand', slug],
    `/api/brands/${encodeURIComponent(slug)}`,
    { select: (raw) => { const r = raw as { success?: boolean; data?: BrandPayload }; return r?.success && r.data ? r.data : null } },
  )

  const branches = useMemo(() => sortBranchesByDistance(data?.stores || [], userLoc), [data, userLoc])
  const products = useMemo(
    () => (data?.products || []).filter((p) => onlyStore == null || Number(p.seller_id) === onlyStore),
    [data, onlyStore],
  )

  if (isLoading) return <BrandLoader fullScreen />
  if (isError || !data) return <NotFoundPage />

  const { brand } = data
  return (
    <div className="min-h-[100dvh] bg-surface pb-24">
      <SEO title={`${brand.name} - 유어딜`} description={`${brand.name} 지점 ${branches.length}곳의 이용권을 한 곳에서. 가까운 지점부터 보여 드려요.`} url={`/brand/${brand.slug}`} />
      <div className="ur-content-wide px-4 lg:px-8">
        <header className="pt-6 pb-4">
          <h1 className="text-[24px] font-bold text-gray-900 dark:text-white">{brand.name}</h1>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            지점 {branches.length}곳{userLoc ? ' · 가까운 순' : ''}
          </p>
        </header>

        {branches.length > 0 && (
          <section aria-label="지점">
            <ul className="divide-y divide-rule">
              {branches.slice(0, 20).map((s) => {
                const on = onlyStore === s.seller_id
                const km = userLoc && s.lat != null && s.lng != null ? distanceKm(userLoc.lat, userLoc.lng, s.lat, s.lng) : null
                return (
                  <li key={s.seller_id}>
                    <button type="button" onClick={() => setOnlyStore(on ? null : s.seller_id)} aria-pressed={on}
                      className="flex w-full items-center gap-3 py-3 text-left">
                      <PinIcon size={18} className={on ? 'text-brand-text' : 'text-gray-400 dark:text-gray-500'} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[15px] font-medium ${on ? 'text-brand-text' : 'text-gray-900 dark:text-white'}`}>{s.name}</span>
                        <span className="block truncate text-[13px] text-gray-500 dark:text-gray-400">{s.address}</span>
                      </span>
                      {km != null && <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400">{km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            {branches.length > 20 && <p className="py-2 text-[12px] text-gray-500 dark:text-gray-400">가까운 20곳만 보여요</p>}
          </section>
        )}

        <section aria-label="이용권" className="pt-8">
          <h2 className="pb-3 text-[17px] font-bold text-gray-900 dark:text-white">
            {onlyStore != null ? `${branches.find((b) => b.seller_id === onlyStore)?.name ?? ''} 이용권` : '이용권'}
          </h2>
          {products.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-gray-500 dark:text-gray-400">지금 판매 중인 이용권이 없어요</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p, i) => (
                <GroupBuyFeedCard key={p.id} p={p as never} aboveFold={i < 4} userLoc={userLoc} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
