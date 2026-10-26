/**
 * 🏷️ "이 브랜드의 다른 지점" 링크 — 이용권 상세 매장 카드 안 (2026-10-17 대표 "응응 다 해줘")
 *
 * 지점이 브랜드에 묶여 있고 **지점이 둘 이상**일 때만 한 줄이 뜬다(서버가 하나뿐이면 null 을 준다).
 * 매장 카드가 화면에 들어온 **뒤에** 묻는다 — 상세 첫 화면 요청에 끼어들지 않게(첫 화면은 사진·제목이 주인).
 * 묻지 않은 동안·없을 때는 아무것도 그리지 않는다(자리를 비워 두지 않는 이유: 대부분의 매장은 브랜드가 없다 —
 * 그 다수에게 빈 칸을 남기는 쪽이 더 나쁘다. 카드 맨 아래라 늦게 생겨도 위 내용을 밀지 않는다).
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { brandBranchesLabel, type BrandBranchesRef } from './brand-branches-label'

interface BrandRef extends BrandBranchesRef { slug: string }

export default function BrandBranchesLink({ sellerId, productId }: { sellerId?: number | null; productId?: number | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  const { data } = useApiQuery<BrandRef | null>(
    ['brand-of-store', sellerId, productId ?? null],
    `/api/brands/of-store/${sellerId}${productId ? `?product=${productId}` : ''}`,
    { enabled: seen && !!sellerId, staleTime: 5 * 60_000, select: (raw) => ((raw as { data?: BrandRef | null })?.data ?? null) },
  )
  return (
    <div ref={ref}>
      {data && (() => {
        // 🏷️ 2026-10-18 이 이용권을 다른 지점에서도 쓸 수 있으면 그 사실을 먼저 말한다(서버가 사용 순간과 같은 판정으로 센 수).
        const label = brandBranchesLabel(data)
        return (
          <div className="mt-3">
            <Link to={`/brand/${data.slug}`} className="flex items-center justify-between gap-2 py-2 text-[13px] font-medium" style={{ color: 'var(--gbd-accent)' }}>
              <span className="truncate">{label.main}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
            </Link>
            {label.note && <p className="-mt-1 text-[12px]" style={{ color: 'var(--gbd-sub)' }}>{label.note}</p>}
          </div>
        )
      })()}
    </div>
  )
}
