/**
 * 🏘️ "서울 서초구 이용권 N개 더 보기" — 이용권 상세 매장 카드 안 (2026-10-19).
 * 판정은 `neighborhood-link.ts`. 매장 카드가 화면에 들어온 **뒤에** 지역 집계를 묻는다
 * (첫 화면 요청에 끼어들지 않게 — `BrandBranchesLink` 와 같은 규율). 카드 맨 아래라 늦게 생겨도
 * 위 내용을 밀지 않는다. 색인 대상 동네가 아니면 아무것도 그리지 않는다.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import type { SidoStat } from '@/shared/constants/region-slugs'
import { REGION_PAGES_ENABLED } from '@/shared/feature-flags'
import { pickNeighborhood } from './neighborhood-link'

export default function NeighborhoodLink({ address }: { address?: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  // 지역 페이지와 **같은 키** — 이미 받아 둔 집계가 있으면 요청 0회.
  const { data: regions = [] } = useApiQuery<SidoStat[]>(['regions', 'stats'], '/api/regions', {
    enabled: seen && REGION_PAGES_ENABLED && !!address,
    staleTime: 10 * 60_000,
    select: (raw) => {
      const r = raw as { success?: boolean; data?: SidoStat[] }
      return r?.success && Array.isArray(r.data) ? r.data : []
    },
  })
  const target = pickNeighborhood(address, regions)
  return (
    <div ref={ref}>
      {target && (
        <Link to={target.href} className="mt-3 flex items-center justify-between gap-2 py-2 text-[13px] font-medium" style={{ color: 'var(--gbd-accent)' }}>
          <span className="truncate">{target.label} 이용권 {target.count}개 더 보기</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      )}
    </div>
  )
}
