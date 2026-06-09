import { useNavigate, Navigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { ArrowLeft, Trash2, ShoppingCart } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'
import { WT, won, comma } from './wholesale/wholesale-theme'
import { useWholesaleCart, groupBySupplier } from './wholesale/useWholesaleCart'

// 🏭 2026-06-04 유통스타트 도매몰 — 다품목 장바구니 (TDS 라이트).
// 🏦 2026-06-09: 예치금 전용 결제로 전환 — 여신(외상)/Toss 옵션 제거.
//   카트 → /wholesale/checkout (주문 확인 + 예치금 결제). 주문 생성은 체크아웃에서.

export default function WholesaleCartPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { items, setQty, remove, clear, subtotal, totalQty } = useWholesaleCart()

  if (!token) return <Navigate to="/wholesale/intro" replace />

  // 🚚 제조사별 최소주문금액/배송비 계산(표시용 — 서버가 청구 시 재계산 = SSOT).
  const grouped = groupBySupplier(items)
  const shippingTotal = grouped.shippingTotal
  const grandTotal = subtotal + shippingTotal
  const hasMultiSupplier = grouped.groups.length > 1
  // 최소주문금액 미달 그룹이 하나라도 있으면 주문 불가(서버도 422 차단 — UX 선제).
  const canOrder = grouped.allMinMet

  // 🏦 주문 생성·결제는 체크아웃에서 예치금으로 처리(잔액 확인 + 부족 시 충전 유도).
  const goCheckout = () => { if (items.length && canOrder) navigate('/wholesale/checkout') }

  return (
    <div className="min-h-screen pb-28" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="장바구니 - 유통스타트 도매" description="도매 장바구니" url="/wholesale/cart" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <button onClick={() => navigate('/wholesale')} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold" style={{ color: WT.ink }}>장바구니 {items.length > 0 && <span style={{ color: WT.brand }}>{items.length}</span>}</h1>
        </div>
      </header>

      <main className="ur-content-narrow px-5 lg:px-8 py-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <ShoppingCart className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
            <p className="text-[15px] font-medium mb-1" style={{ color: WT.ink2 }}>장바구니가 비어 있어요</p>
            <p className="text-[13px] mb-6" style={{ color: WT.ink3 }}>도매 상품을 담아 한 번에 주문하세요</p>
            <button onClick={() => navigate('/wholesale')} className="px-6 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>상품 둘러보기</button>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {items.map((it) => {
                return (
                <div key={it.id} className="flex gap-3 rounded-2xl bg-white p-3" style={{ border: '1px solid ' + WT.line, background: '#fff' }}>
                  <button onClick={() => navigate(`/wholesale/product/${it.id}`)} className="w-16 h-16 shrink-0 rounded-xl overflow-hidden" style={{ background: WT.fill }}>
                    {it.image_url && <img src={cfImage(it.image_url, { width: 128, format: 'auto' }) || it.image_url} alt={it.name || ''} className="w-full h-full object-cover" loading="lazy" decoding="async" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button onClick={() => navigate(`/wholesale/product/${it.id}`)} className="text-left text-[14px] font-medium line-clamp-2 leading-[1.4]" style={{ color: WT.ink }}>{it.name || `상품 #${it.id}`}</button>
                      </div>
                      <button onClick={() => remove(it.id)} aria-label="삭제" className="shrink-0 p-1"><Trash2 className="w-4 h-4" style={{ color: WT.ink4 }} /></button>
                    </div>
                    <div className="mt-1 text-[14px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(it.price || 0)} <span className="text-[12px] font-medium" style={{ color: WT.ink4 }}>/ 개</span></div>
                    <div className="mt-2 flex items-center justify-between">
                      {(() => { const step = Math.max(1, it.moq || 1); return (
                      <div className="inline-flex items-center rounded-full h-9" style={{ background: WT.fill }}>
                        <button className="h-9 w-9 text-[18px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty - step)} disabled={it.qty <= step}>−</button>
                        <span className="w-10 text-center text-[14px] font-bold tabular-nums" style={{ color: WT.ink }}>{comma(it.qty)}</span>
                        <button className="h-9 w-9 text-[18px]" style={{ color: WT.ink2 }} onClick={() => setQty(it.id, it.qty + step)}>+</button>
                      </div>
                      )})()}
                      <span className="text-[14px] font-bold tabular-nums" style={{ color: WT.ink }}>{won((it.price || 0) * it.qty)}</span>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
            <button onClick={clear} className="mt-3 text-[13px] font-medium" style={{ color: WT.ink3 }}>전체 비우기</button>

            {/* 🚚 제조사별 최소주문금액/배송비 진행 (정책이 설정된 그룹만 표시) */}
            {grouped.groups.some((g) => g.minOrderAmount > 0 || g.shipping > 0 || g.freeShipRemaining > 0) && (
              <div className="mt-4 space-y-2">
                {grouped.groups.map((g, gi) => {
                  const showPolicy = g.minOrderAmount > 0 || g.shipping > 0 || g.freeShipRemaining > 0
                  if (!showPolicy) return null
                  return (
                    <div key={g.group} className="rounded-2xl p-3.5" style={{ border: '1px solid ' + (g.meetsMin ? WT.line : '#F8C9D2'), background: g.meetsMin ? '#fff' : '#FDECEF' }}>
                      {hasMultiSupplier && (
                        <div className="text-[12px] font-bold mb-1.5" style={{ color: WT.ink2 }}>공급처 {gi + 1} <span className="font-medium" style={{ color: WT.ink4 }}>· {comma(g.items.length)}개 상품 · {won(g.subtotal)}</span></div>
                      )}
                      {!g.meetsMin ? (
                        <p className="text-[13px] font-bold" style={{ color: '#B3253B' }}>
                          {won(g.shortfall)} 더 담아야 주문할 수 있어요 <span className="font-medium" style={{ color: WT.ink3 }}>(최소 {won(g.minOrderAmount)})</span>
                        </p>
                      ) : g.minOrderAmount > 0 ? (
                        <p className="text-[13px] font-semibold" style={{ color: WT.pos }}>최소 주문 금액 충족 ✓ <span className="font-medium" style={{ color: WT.ink4 }}>(최소 {won(g.minOrderAmount)})</span></p>
                      ) : null}
                      <div className="mt-1 flex items-center justify-between text-[12px]">
                        <span style={{ color: WT.ink3 }}>배송비</span>
                        <span className="tabular-nums font-semibold" style={{ color: g.shipping === 0 ? WT.pos : WT.ink }}>{g.shipping === 0 ? '무료' : won(g.shipping)}</span>
                      </div>
                      {g.freeShipRemaining > 0 && (
                        <p className="mt-0.5 text-[11px]" style={{ color: WT.ink4 }}>{won(g.freeShipRemaining)} 더 담으면 무료배송</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-5 rounded-2xl p-4" style={{ background: WT.fill2 }}>
              <div className="flex items-center justify-between text-[14px]">
                <span style={{ color: WT.ink3 }}>상품 금액 · 총 {comma(totalQty)}개</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: WT.ink }}>{won(subtotal)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[14px]">
                <span style={{ color: WT.ink3 }}>배송비</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: shippingTotal === 0 ? WT.pos : WT.ink }}>{shippingTotal === 0 ? '무료' : won(shippingTotal)}</span>
              </div>
              <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid ' + WT.line }}>
                <span className="text-[14px] font-bold" style={{ color: WT.ink2 }}>합계</span>
                <span className="text-[18px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(grandTotal)}</span>
              </div>
              <p className="mt-1 text-[12px]" style={{ color: WT.ink4 }}>실제 결제 금액은 주문 시 서버에서 등급 공급가·배송비로 재계산됩니다.</p>
            </div>

            {/* 🏦 2026-06-09: 예치금 전용 결제 안내 (여신/외상 옵션 제거) */}
            <p className="mt-3 text-[12px]" style={{ color: WT.ink3 }}>예치금으로 결제됩니다. 다음 단계에서 잔액을 확인하세요.</p>
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white z-40 px-5" style={{ borderTop: '1px solid ' + WT.line, boxShadow: WT.shUp, paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', paddingTop: '0.75rem' }}>
          <div className="ur-content-narrow mx-auto flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[12px]" style={{ color: WT.ink3 }}>합계 {shippingTotal > 0 && <span style={{ color: WT.ink4 }}>(배송비 포함)</span>}</div>
              <div className="text-[19px] font-extrabold tabular-nums" style={{ color: WT.ink }}>{won(grandTotal)}</div>
            </div>
            <button onClick={goCheckout} disabled={!canOrder} className="flex-1 h-14 rounded-2xl text-[16px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
              {canOrder ? `${comma(items.length)}개 상품 주문` : '최소 주문 금액 부족'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
