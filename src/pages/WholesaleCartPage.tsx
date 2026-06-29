import { useNavigate, Navigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Trash2, ShoppingCart, ShieldCheck } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'
import { WT, won, comma } from './wholesale/wholesale-theme'
import { useWholesaleCart, groupBySupplier } from './wholesale/useWholesaleCart'
import { useWholesaleBack } from '@/hooks/useWholesaleBack'

// 🏭 2026-06-04 유통스타트 도매몰 — 다품목 장바구니. 2026-06-16 시안(서브페이지) 2단 레이아웃 리디자인.
// 🏦 예치금 전용 결제 — 카트 → /wholesale/checkout (주문 확인 + 예치금 결제). 주문 생성은 체크아웃에서.
export default function WholesaleCartPage() {
  const navigate = useNavigate()
  const goBack = useWholesaleBack()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { items, setQty, remove, clear, subtotal, totalQty } = useWholesaleCart()

  if (!token) return <Navigate to="/wholesale/intro" replace />

  // 🚚 제조사별 최소주문금액/배송비 계산(표시용 — 서버가 청구 시 재계산 = SSOT).
  const grouped = groupBySupplier(items)
  const shippingTotal = grouped.shippingTotal
  const grandTotal = subtotal + shippingTotal
  const hasMultiSupplier = grouped.groups.length > 1
  const canOrder = grouped.allMinMet
  const policyGroups = grouped.groups.filter((g) => g.minOrderAmount > 0 || g.shipping > 0 || g.freeShipRemaining > 0)

  const goCheckout = () => { if (items.length && canOrder) navigate('/wholesale/checkout') }

  // ── 주문 예상금액 카드 (데스크톱 우측 sticky / 모바일 인라인) ──
  const summaryCard = (withButton: boolean) => (
    <div className="rounded-2xl p-5" style={{ border: '1px solid ' + WT.line2 }}>
      <div className="text-[15px] font-extrabold mb-4" style={{ color: WT.ink }}>주문 예상금액</div>
      <div className="flex items-center justify-between text-[13.5px] mb-2.5">
        <span style={{ color: WT.ink2 }}>상품금액 · {comma(totalQty)}개</span>
        <span className="font-semibold tabular-nums" style={{ color: WT.ink }}>{won(subtotal)}</span>
      </div>
      <div className="flex items-center justify-between text-[13.5px] mb-3.5">
        <span style={{ color: WT.ink2 }}>배송비</span>
        <span className="font-semibold tabular-nums" style={{ color: shippingTotal === 0 ? WT.pos : WT.ink }}>{shippingTotal === 0 ? '무료' : won(shippingTotal)}</span>
      </div>
      <div className="pt-3.5 flex items-baseline justify-between" style={{ borderTop: '1px solid ' + WT.line }}>
        <span className="text-[14px] font-bold" style={{ color: WT.ink }}>결제 예정</span>
        <span className="text-[24px] font-extrabold tabular-nums tracking-[-0.02em]" style={{ color: WT.brand }}>{won(grandTotal)}</span>
      </div>
      <p className="mt-1 text-[11.5px] text-right" style={{ color: WT.ink4 }}>주문 시 서버에서 등급 공급가·배송비로 재계산</p>
      {!canOrder && (
        <p className="mt-3 text-[12px] font-semibold" style={{ color: '#B3253B' }}>최소 주문 금액을 채워야 주문할 수 있어요</p>
      )}
      {withButton && (
        <button onClick={goCheckout} disabled={!canOrder} className="mt-4 w-full rounded-[11px] py-3.5 text-[15px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
          {canOrder ? '예치금으로 주문하기' : '최소 주문 금액 부족'}
        </button>
      )}
      <div className="mt-3.5 flex items-center gap-2 px-3 py-2.5 rounded-[9px]" style={{ background: WT.trustBg, border: '1px solid ' + WT.line }}>
        <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: WT.pos }} />
        <span className="text-[11.5px] leading-snug" style={{ color: WT.ink2 }}>KCP 에스크로 안전거래 · 전자세금계산서 자동발행</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-[100dvh] pb-24 lg:pb-10" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="장바구니 - 유통스타트 도매" description="도매 장바구니" url="/wholesale/cart" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide flex items-center gap-3 px-5 lg:px-8 h-[54px]">
          <button onClick={goBack} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          {/* 🏭 2026-06-29: 로고는 공통 <WholesaleShopBar/> 가 담당 — 중복 제거하고 페이지 제목만 표시. */}
          <span className="text-[15px] font-bold" style={{ color: WT.ink }}>장바구니</span>
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 py-6 lg:py-8">
        <h1 className="text-[22px] lg:text-[24px] font-extrabold tracking-[-0.02em] mb-5" style={{ color: WT.ink }}>장바구니 {items.length > 0 && <span style={{ color: WT.brand }}>{items.length}</span>}</h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <ShoppingCart className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
            <p className="text-[15px] font-medium mb-1" style={{ color: WT.ink2 }}>장바구니가 비어 있어요</p>
            <p className="text-[13px] mb-6" style={{ color: WT.ink3 }}>도매 상품을 담아 한 번에 주문하세요</p>
            <button onClick={() => navigate('/wholesale')} className="px-6 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>상품 둘러보기</button>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-7 lg:items-start">
            {/* ── 좌: 품목 리스트 ── */}
            <div>
              <div className="flex items-center justify-between pb-2.5 mb-1 text-[13px]" style={{ borderBottom: '1px solid ' + WT.line, color: WT.ink2 }}>
                <span>총 <b style={{ color: WT.ink }}>{comma(items.length)}</b>개 상품</span>
                <button onClick={clear} className="hover:underline" style={{ color: WT.ink3 }}>전체 비우기</button>
              </div>

              <div>
                {items.map((it) => {
                  const step = Math.max(1, it.moq || 1)
                  return (
                    <div key={it.id} className="flex gap-3.5 py-4 items-center" style={{ borderBottom: '1px solid ' + WT.line }}>
                      <button onClick={() => navigate(`/wholesale/product/${it.id}`)} className="w-[72px] h-[72px] lg:w-[78px] lg:h-[78px] shrink-0 rounded-xl overflow-hidden" style={{ background: WT.fill }}>
                        {it.image_url && <img src={cfImage(it.image_url, { width: 160, format: 'auto' }) || it.image_url} alt={it.name || ''} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => navigate(`/wholesale/product/${it.id}`)} className="text-left text-[14px] font-medium line-clamp-2 leading-[1.4]" style={{ color: WT.ink }}>{it.name || `상품 #${it.id}`}</button>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {step > 1 && <span className="text-[10.5px] font-bold rounded-[5px] px-1.5 py-0.5" style={{ border: '1px solid ' + WT.line2, color: WT.ink2 }}>MOQ {comma(step)}</span>}
                          <button onClick={() => remove(it.id)} className="inline-flex items-center gap-0.5 text-[11.5px]" style={{ color: WT.ink4 }}><Trash2 className="w-3 h-3" /> 삭제</button>
                        </div>
                        {/* 모바일: 수량 스텝퍼 + 라인합 (좁은 화면용 인라인) */}
                        <div className="mt-2 flex items-center justify-between lg:hidden">
                          <div className="inline-flex items-center rounded-lg h-9" style={{ border: '1px solid ' + WT.line2 }}>
                            <button className="h-9 w-9 text-[16px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty - step)} disabled={it.qty <= step}>−</button>
                            <span className="w-10 text-center text-[14px] font-bold tabular-nums" style={{ color: WT.ink }}>{comma(it.qty)}</span>
                            <button className="h-9 w-9 text-[16px]" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty + step)}>+</button>
                          </div>
                          <span className="text-[16px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won((it.price || 0) * it.qty)}</span>
                        </div>
                      </div>
                      {/* 데스크톱: 수량 스텝퍼 */}
                      <div className="hidden lg:flex flex-col items-center gap-1.5 shrink-0">
                        <div className="inline-flex items-center rounded-lg h-8" style={{ border: '1px solid ' + WT.line2 }}>
                          <button className="h-8 w-[30px] text-[15px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty - step)} disabled={it.qty <= step}>−</button>
                          <span className="w-[42px] text-center text-[13px] font-bold tabular-nums" style={{ color: WT.ink, borderLeft: '1px solid ' + WT.line, borderRight: '1px solid ' + WT.line }}>{comma(it.qty)}</span>
                          <button className="h-8 w-[30px] text-[15px]" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty + step)}>+</button>
                        </div>
                      </div>
                      {/* 데스크톱: 공급가/라인합 */}
                      <div className="hidden lg:block w-[124px] text-right shrink-0">
                        <div className="text-[11px]" style={{ color: WT.ink3 }}>공급가 {won(it.price || 0)}</div>
                        <div className="text-[19px] font-extrabold tabular-nums tracking-[-0.02em] mt-0.5" style={{ color: WT.ink }}>{won((it.price || 0) * it.qty)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 🚚 제조사별 최소주문금액/배송비 진행 (정책이 설정된 그룹만) */}
              {policyGroups.length > 0 && (
                <div className="mt-4 space-y-2">
                  {grouped.groups.map((g, gi) => {
                    if (!(g.minOrderAmount > 0 || g.shipping > 0 || g.freeShipRemaining > 0)) return null
                    return (
                      <div key={g.group} className="rounded-2xl p-3.5" style={{ border: '1px solid ' + (g.meetsMin ? WT.line2 : '#F8C9D2'), background: g.meetsMin ? '#fff' : '#FDECEF' }}>
                        {hasMultiSupplier && (
                          <div className="text-[12px] font-bold mb-1.5" style={{ color: WT.ink2 }}>공급처 {gi + 1} <span className="font-medium" style={{ color: WT.ink4 }}>· {comma(g.items.length)}개 상품 · {won(g.subtotal)}</span></div>
                        )}
                        {!g.meetsMin ? (
                          <p className="text-[13px] font-bold" style={{ color: '#B3253B' }}>{won(g.shortfall)} 더 담아야 주문할 수 있어요 <span className="font-medium" style={{ color: WT.ink3 }}>(최소 {won(g.minOrderAmount)})</span></p>
                        ) : g.minOrderAmount > 0 ? (
                          <p className="text-[13px] font-semibold" style={{ color: WT.pos }}>최소 주문 금액 충족 ✓ <span className="font-medium" style={{ color: WT.ink4 }}>(최소 {won(g.minOrderAmount)})</span></p>
                        ) : null}
                        <div className="mt-1 flex items-center justify-between text-[12px]">
                          <span style={{ color: WT.ink3 }}>배송비</span>
                          <span className="tabular-nums font-semibold" style={{ color: g.shipping === 0 ? WT.pos : WT.ink }}>{g.shipping === 0 ? '무료' : won(g.shipping)}</span>
                        </div>
                        {g.freeShipRemaining > 0 && <p className="mt-0.5 text-[11px]" style={{ color: WT.ink4 }}>{won(g.freeShipRemaining)} 더 담으면 무료배송</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── 우: 주문 예상금액 (데스크톱 sticky) ── */}
            <aside className="hidden lg:block lg:sticky lg:top-[70px]">
              {summaryCard(true)}
            </aside>

            {/* 모바일: 요약 카드(버튼 없음 — 하단 바로 결제) */}
            <div className="mt-5 lg:hidden">
              {summaryCard(false)}
            </div>
          </div>
        )}
      </main>

      {/* 모바일 하단 결제 바 */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white z-40 px-5 lg:hidden" style={{ borderTop: '1px solid ' + WT.line, boxShadow: WT.shUp, paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', paddingTop: '0.75rem' }}>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[12px]" style={{ color: WT.ink3 }}>결제 예정</div>
            <div className="text-[19px] font-extrabold tabular-nums" style={{ color: WT.brand }}>{won(grandTotal)}</div>
          </div>
          <button onClick={goCheckout} disabled={!canOrder} className="flex-1 h-14 rounded-2xl text-[16px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
            {canOrder ? '예치금으로 주문' : '금액 부족'}
          </button>
        </div>
        </div>
      )}
    </div>
  )
}
