import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Check, Lock } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { useWholesaleProduct } from '@/hooks/queries/useWholesale'
import { WT, won, comma, discountRate, unitMargin, marginRate, GRADE_LABEL, WHOLESALE_CATEGORIES } from './wholesale/wholesale-theme'
import { useWholesaleCart } from './wholesale/useWholesaleCart'

// 🏭 2026-06-04 유통스타트 도매 상품 상세 — Claude Design 시안(TDS/Toss 라이트) 구현.
//   등급 공급가 앵커 + 권장가 대비 할인%/마진 + 수량 구간별 단가표(volume tier) + 하단 고정 CTA.
//   가격 = 등급가 × (1 − 수량구간 할인). 결제액은 /orders 가 동일 규칙으로 재계산(SSOT).

interface QtyTierView { min_qty: number; discount_pct: number; unit_price: number }
interface DetailItem {
  id: number; name: string; description?: string | null; image_url: string | null
  category: string | null; stock: number; distributor_price: number | null
  retail_price?: number | null; moq?: number; sold_count?: number; tiers?: QtyTierView[]; requires_login?: boolean
}

// 수량 구간별 단가표 (등급가 위 volume 할인 — 많이 살수록 ↓). 현재 수량 구간 강조.
function TierTable({ basePrice, moq, tiers, qty }: { basePrice: number; moq: number; tiers: QtyTierView[]; qty: number }) {
  // 기본(moq) 행 단가 = moq 에서 실제 적용되는 단가(moq 이하 tier 는 접어 반영) — 표시=결제 일치.
  let moqUnit = basePrice, foldBest = 0
  for (const t of tiers) if (moq >= t.min_qty && t.min_qty >= foldBest) { foldBest = t.min_qty; moqUnit = t.unit_price }
  // moq 초과 구간만 추가 band(중복/무의미 구간 제거).
  const above = tiers.filter(t => t.min_qty > moq).sort((a, b) => a.min_qty - b.min_qty)
  const rows = [{ min_qty: moq, unit_price: moqUnit }, ...above.map(t => ({ min_qty: t.min_qty, unit_price: t.unit_price }))]
  const baseUnit = rows[0]?.unit_price ?? basePrice
  // 현재 적용 구간 = qty 이상 만족하는 최대 min_qty.
  let curMin = rows[0]?.min_qty ?? moq
  for (const r of rows) if (qty >= r.min_qty) curMin = r.min_qty
  return (
    <div className="mt-3.5 rounded-2xl overflow-hidden" style={{ border: '1px solid ' + WT.line }}>
      <div className="flex items-center justify-between px-4 h-10" style={{ background: WT.fill2 }}>
        <span className="text-[12px] font-bold" style={{ color: WT.ink2 }}>수량 구간별 단가</span>
        <span className="text-[12px]" style={{ color: WT.ink3 }}>많이 살수록 ↓</span>
      </div>
      {rows.map((r) => {
        const cur = r.min_qty === curMin
        const save = baseUnit - r.unit_price
        return (
          <div key={r.min_qty} className="flex items-center justify-between px-4 h-12" style={{ borderTop: '1px solid ' + WT.line, background: cur ? WT.brandSoft : '#fff' }}>
            <span className="text-[14px] font-semibold" style={{ color: cur ? WT.brand : WT.ink }}>{comma(r.min_qty)}개~{cur && <span className="ml-1.5 text-[11px] font-bold" style={{ color: WT.brand }}>현재</span>}</span>
            <span className="flex items-baseline gap-2">
              {save > 0 && <span className="text-[12px] font-semibold tabular-nums" style={{ color: WT.pos }}>개당 -{won(save)}</span>}
              <span className="text-[15px] font-extrabold tabular-nums" style={{ color: cur ? WT.brand : WT.ink }}>{won(r.unit_price)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

function KV({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between px-4 h-12 whitespace-nowrap">
      <span className="text-[14px]" style={{ color: WT.ink3 }}>{label}</span>
      <span className="text-[15px] font-bold tabular-nums" style={{ color: accent || WT.ink }}>{value}</span>
    </div>
  )
}

export default function WholesaleProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const h = { headers: { Authorization: `Bearer ${token}` } }

  const { data, isLoading: loading } = useWholesaleProduct(id)
  const item = (data?.item ?? null) as DetailItem | null
  const grade = data?.grade ?? ''
  const [qty, setQty] = useState(1)
  const [ordering, setOrdering] = useState(false)
  const [tab, setTab] = useState<'desc' | 'ship' | 'settle' | 'return'>('desc')
  const cart = useWholesaleCart()

  // 🏭 2026-06-04 몰-first: 비로그인도 상세 열람 가능(가격은 가림). 강제 로그인 redirect 제거.
  const goLogin = () => navigate('/wholesale/login')
  useEffect(() => { setQty(Math.max(1, item?.moq || 1)); setTab('desc') }, [item?.id, item?.moq])

  function addToCart() {
    if (!item) return
    if (item.distributor_price == null) { toast.info('로그인하면 등급 공급가로 담을 수 있어요'); goLogin(); return }
    // 현재 수량 구간 단가를 스냅샷으로 저장(표시용). 결제액은 주문 시 서버 재계산(SSOT).
    let unit = item.distributor_price, bm = 0
    for (const t of (item.tiers || [])) if (qty >= t.min_qty && t.min_qty >= bm) { bm = t.min_qty; unit = t.unit_price }
    cart.add({ id: item.id, qty, name: item.name, image_url: item.image_url, price: unit, moq: Math.max(1, item.moq || 1) })
    toast.success(`장바구니에 ${comma(qty)}개 담았어요`)
  }

  async function placeOrder() {
    if (!item || ordering) return
    if (item.distributor_price == null) { toast.info('로그인하면 주문할 수 있어요'); goLogin(); return }
    setOrdering(true)
    try {
      const r = await api.post('/api/wholesale/orders', { items: [{ product_id: item.id, qty }] }, h)
      if (r.data.success) {
        navigate(`/wholesale/checkout?order=${r.data.order_id}`, { state: { orderId: r.data.toss_order_id, amount: r.data.amount, orderName: r.data.order_name } })
      } else { toast.error(r.data.error || '주문 생성 실패') }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '주문 생성 중 오류')
    } finally { setOrdering(false) }
  }

  if (loading) return <div className="min-h-screen flex justify-center items-center" style={{ background: '#fff' }}><Loader2 className="w-7 h-7 animate-spin" style={{ color: WT.ink4 }} /></div>
  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#fff' }}>
        <p className="mb-4 text-[14px]" style={{ color: WT.ink3 }}>상품을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/wholesale')} className="px-5 h-11 rounded-xl font-bold text-white" style={{ background: WT.ink }}>카탈로그로</button>
      </div>
    )
  }

  const moq = Math.max(1, item.moq || 1)
  const tiers = item.tiers || []
  const locked = item.distributor_price == null // 비로그인 → 가격 가림 + 로그인 유도
  // 현재 수량에 적용되는 단가 — qty 이상 만족하는 최대 min_qty tier(없으면 등급가). 서버 /orders 와 동일 규칙.
  let effUnit = item.distributor_price ?? 0, bestMin = 0
  for (const t of tiers) if (qty >= t.min_qty && t.min_qty >= bestMin) { bestMin = t.min_qty; effUnit = t.unit_price }
  const total = effUnit * qty
  const dr = item.retail_price ? discountRate(item.distributor_price ?? 0, item.retail_price) : 0
  const um = item.retail_price ? unitMargin(item.distributor_price ?? 0, item.retail_price) : 0
  const mr = item.retail_price ? marginRate(item.distributor_price ?? 0, item.retail_price) : 0
  const catLabel = WHOLESALE_CATEGORIES.find(c => c.id === item.category)?.label
  const tabs: [typeof tab, string][] = [['desc', '상세설명'], ['ship', '배송'], ['settle', '정산'], ['return', '반품·교환']]

  return (
    <div className="min-h-screen pb-28" style={{ background: '#fff', color: WT.ink }}>
      {/* 🏭 2026-06-08 도매 상품 상세 — canonical=utongstart 이되 noindex 유지(공급가/거래정보 비노출 룰).
          description 에도 공급가 절대 미포함. */}
      <SEO domain="wholesale" title={`${item.name} - 유통스타트 도매`} description="유통회원 전용 도매 상품 상세 — 도매가는 로그인 후 확인" url={`/wholesale/product/${item.id}`} noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold truncate" style={{ color: WT.ink }}>{item.name}</h1>
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 py-5 lg:flex lg:gap-8">
        {/* 갤러리 */}
        <div className="lg:w-[46%] lg:shrink-0 mb-5 lg:mb-0">
          <div className="aspect-square rounded-2xl overflow-hidden" style={{ border: '1px solid ' + WT.line, background: WT.fill }}>
            {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
          </div>
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          {catLabel && <span className="inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold mb-2.5" style={{ background: WT.fill, color: WT.ink2 }}>{catLabel}</span>}
          <h2 className="font-extrabold tracking-[-0.01em] leading-snug text-[21px] lg:text-[26px]" style={{ color: WT.ink }}>{item.name}</h2>

          {locked ? (
            // 비로그인: 도매가 숨김 + 로그인/가입 유도
            <div className="mt-4 rounded-2xl p-4" style={{ background: WT.fill }}>
              <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: WT.ink }}>
                <Lock className="w-4 h-4" style={{ color: WT.brand }} /> 등급 공급가는 로그인 후 확인할 수 있어요
              </div>
              <p className="mt-1 text-[13px]" style={{ color: WT.ink3 }}>유통사 가입 즉시 C등급 공급가로 사입 시작 · 실적 쌓이면 A·B 상향</p>
              <div className="mt-3 flex gap-2.5">
                <button onClick={goLogin} className="flex-1 h-12 rounded-xl text-[15px] font-bold" style={{ background: WT.fill2, color: WT.ink, border: '1px solid ' + WT.line }}>로그인</button>
                <button onClick={() => navigate('/wholesale/join')} className="flex-1 h-12 rounded-xl text-[15px] font-bold text-white" style={{ background: WT.brand }}>유통사 가입</button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center font-bold rounded-full px-2.5 py-0.5 text-[13px]" style={{ color: WT.brand, background: WT.brandSoft }}>{GRADE_LABEL[grade] || grade}등급가</span>
                <span className="text-[13px]" style={{ color: WT.ink3 }}>개당 공급가</span>
              </div>
              <div className="mt-1.5 flex items-end gap-2.5">
                <span className="font-extrabold tracking-[-0.02em] tabular-nums leading-none text-[34px] lg:text-[42px]" style={{ color: WT.ink }}>{won(item.distributor_price ?? 0)}</span>
                {dr > 0 && <span className="text-[15px] font-bold tabular-nums mb-1" style={{ color: WT.brand }}>-{dr}%</span>}
              </div>
              <div className="mt-1.5 text-[14px] tabular-nums" style={{ color: WT.ink4 }}>
                {item.retail_price ? <>권장 소비자가 <span className="line-through">{won(item.retail_price)}</span></> : null}
                {moq > 1 && <>{item.retail_price ? <span className="mx-2" style={{ color: WT.line }}>|</span> : null}박스 {comma(moq)}개 <span className="font-semibold" style={{ color: WT.ink2 }}>{won((item.distributor_price ?? 0) * moq)}</span></>}
              </div>

              {/* 마진 여력 */}
              {um > 0 && (
                <div className="mt-3.5 flex items-center gap-2 rounded-2xl p-3.5" style={{ background: WT.posBg }}>
                  <Check className="w-5 h-5" style={{ color: WT.pos }} strokeWidth={2.6} />
                  <span className="text-[14px] font-bold" style={{ color: WT.pos }}>개당 마진 +{won(um)} <span className="font-extrabold">({mr}%)</span></span>
                </div>
              )}

              {/* 수량 구간별 단가표 (tier 있을 때만) */}
              {tiers.length > 0 && <TierTable basePrice={item.distributor_price ?? 0} moq={moq} tiers={tiers} qty={qty} />}
            </>
          )}

          {/* 정보 리스트 */}
          <div className="mt-3.5 rounded-2xl overflow-hidden" style={{ background: WT.fill2 }}>
            <KV label="재고" value={comma(item.stock) + '개'} accent={item.stock < 200 ? '#C2620C' : undefined} />
            <div style={{ borderTop: '1px solid ' + WT.line }} />
            <KV label="누적 사입" value={comma(item.sold_count || 0) + '건'} />
            <div style={{ borderTop: '1px solid ' + WT.line }} />
            <KV label="공급사" value="검증 제조사 (신원 비공개)" />
          </div>

          {/* 데스크톱 인라인 CTA */}
          <div className="hidden lg:block">
            {locked ? (
              <button onClick={goLogin} className="mt-5 w-full h-14 rounded-2xl text-[16px] font-bold text-white flex items-center justify-center gap-2" style={{ background: WT.brand }}>
                <Lock className="w-5 h-5" /> 로그인하고 공급가 확인
              </button>
            ) : (<>
            <div className="mt-5 flex items-center gap-3">
              <div className="inline-flex items-center rounded-full h-11" style={{ background: WT.fill }}>
                <button className="h-11 w-11 text-[20px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(q => Math.max(moq, q - moq))} disabled={qty <= moq}>−</button>
                <span className="w-12 text-center text-[15px] font-bold tabular-nums" style={{ color: WT.ink }}>{comma(qty)}</span>
                <button className="h-11 w-11 text-[20px]" style={{ color: WT.ink2 }} onClick={() => setQty(q => q + moq)}>+</button>
              </div>
              <div className="flex-1 text-right">
                <span className="text-[13px] mr-2" style={{ color: WT.ink3 }}>합계</span>
                <span className="text-[20px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{won(total)}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2.5">
              <button onClick={addToCart} disabled={item.stock <= 0} className="px-7 h-14 rounded-2xl text-[16px] font-bold disabled:opacity-50" style={{ background: WT.fill, color: WT.ink }}>담기</button>
              <button onClick={placeOrder} disabled={ordering || item.stock <= 0}
                className="flex-1 h-14 rounded-2xl text-[16px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
                {ordering ? <Loader2 className="w-5 h-5 animate-spin inline" /> : item.stock <= 0 ? '품절' : '바로 주문'}
              </button>
            </div>
            </>)}
          </div>
        </div>
      </main>

      {/* 섹션 탭 */}
      <div className="ur-content-wide px-5 lg:px-8">
        <div className="flex gap-1" style={{ borderBottom: '1px solid ' + WT.line }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="px-3.5 py-2.5 text-[15px] font-bold -mb-px whitespace-nowrap"
              style={tab === k ? { color: WT.ink, borderBottom: '2px solid ' + WT.ink } : { color: WT.ink4, borderBottom: '2px solid transparent' }}>{l}</button>
          ))}
        </div>
        <div className="py-5 text-[15px] leading-relaxed" style={{ color: WT.ink2 }}>
          {tab === 'desc' && (item.description
            ? <p className="whitespace-pre-wrap">{item.description}</p>
            : <p>검증된 제조사가 공급하는 <b style={{ color: WT.ink }}>{item.name}</b> 입니다. 대량 사입에 최적화된 도매 공급가로, 소매 판매 시 충분한 마진 여력을 확보할 수 있어요.</p>)}
          {tab === 'ship' && <p>주문 확정 후 1~2 영업일 내 출고됩니다. 한 주문에 같은 제조사 상품은 합배송될 수 있어요. 도서산간은 추가 배송비가 발생할 수 있어요.</p>}
          {tab === 'settle' && <p>브랜드 상품은 출고 익일, 일반 상품은 출고 후 7일에 정산돼요. 정산 내역은 <b style={{ color: WT.ink }}>거래내역</b>에서 확인할 수 있어요.</p>}
          {tab === 'return' && <p>단순 변심 반품은 미개봉 상태에 한해 출고일로부터 7일 내 가능합니다. 식품·위생용품은 개봉 시 교환·반품이 제한돼요.</p>}
        </div>
      </div>

      {/* 모바일 하단 고정 CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white z-40 px-5 pt-2.5" style={{ borderTop: '1px solid ' + WT.line, boxShadow: WT.shUp, paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        {locked ? (
          <button onClick={goLogin} className="w-full h-14 rounded-2xl text-[16px] font-bold text-white flex items-center justify-center gap-2" style={{ background: WT.brand }}>
            <Lock className="w-5 h-5" /> 로그인하고 공급가 확인
          </button>
        ) : (<>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="inline-flex items-center rounded-full h-10" style={{ background: WT.fill }}>
            <button className="h-10 w-10 text-[20px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(q => Math.max(moq, q - moq))} disabled={qty <= moq}>−</button>
            <span className="w-11 text-center text-[15px] font-bold tabular-nums" style={{ color: WT.ink }}>{comma(qty)}</span>
            <button className="h-10 w-10 text-[20px]" style={{ color: WT.ink2 }} onClick={() => setQty(q => q + moq)}>+</button>
          </div>
          <div className="text-right">
            <span className="text-[12px] mr-1.5" style={{ color: WT.ink3 }}>합계</span>
            <span className="text-[19px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{won(total)}</span>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={addToCart} disabled={item.stock <= 0} className="px-6 h-14 rounded-2xl text-[16px] font-bold disabled:opacity-50" style={{ background: WT.fill, color: WT.ink }}>담기</button>
          <button onClick={placeOrder} disabled={ordering || item.stock <= 0}
            className="flex-1 h-14 rounded-2xl text-[16px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
            {ordering ? <Loader2 className="w-5 h-5 animate-spin inline" /> : item.stock <= 0 ? '품절' : '바로 주문'}
          </button>
        </div>
        </>)}
      </div>
    </div>
  )
}
