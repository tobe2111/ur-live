import { useNavigate } from 'react-router-dom'
import { WT } from '../wholesale/wholesale-theme'
import { SectionHead, Rail, ReorderCard, MiniCard } from './cards'
import type { CatalogItem, ReorderItem } from './types'
import type { WholesaleHomeData } from '@/hooks/queries/useWholesale'

// 빠른 재주문 / 전용 공급 레일 — WholesaleCatalogPage 분해.
// 🏭 2026-06-15 (시안 리디자인): 베스트/신규 입고 레일은 시안의 "실시간 베스트" 순위 그리드(BestGrid)로
//   대체 — 여기엔 개인화 레일(빠른 재주문·전용 공급)만 남김(로그인 데이터 기반, 데이터 없으면 미노출).
export default function HomeRails({ recent, home, reorder, openDetail, addToCart, prefetchProduct }: {
  recent: ReorderItem[]
  home: WholesaleHomeData | undefined
  reorder: (r: ReorderItem) => void
  openDetail: (p: CatalogItem) => void
  addToCart: (p: CatalogItem) => void
  prefetchProduct: (id: number) => void
}) {
  const navigate = useNavigate()
  return (
    <>
        {/* 빠른 재주문 (최근 사입) */}
        {recent.length > 0 && (
          <section className="py-6">
            <SectionHead title="빠른 재주문" sub="최근 사입한 상품" />
            <Rail>{recent.map((r) => <ReorderCard key={r.id} r={r} onOpen={(id) => navigate(`/wholesale/product/${id}`)} onReorder={reorder} onPrefetch={prefetchProduct} />)}</Rail>
          </section>
        )}

        {/* 전용 공급 (관리자 제안) */}
        {home && home.proposals.length > 0 && (
          <section className="py-6">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[18px] font-extrabold tracking-[-0.01em]" style={{ color: WT.ink }}>회원님 전용 공급</h3>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: WT.ink, color: '#fff' }}>선정 회원 전용</span>
            </div>
            <p className="text-[13px] mb-3.5" style={{ color: WT.ink3 }}>유통스타트가 회원님께만 공개하는 상품이에요</p>
            <Rail>{(home.proposals as unknown as CatalogItem[]).map((p) => <MiniCard key={p.id} p={p} onOpen={openDetail} onAdd={addToCart} tag="전용" onPrefetch={prefetchProduct} />)}</Rail>
          </section>
        )}

    </>
  )
}
