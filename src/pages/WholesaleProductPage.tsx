import { lazy, Suspense, useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Check, Lock, BellRing, BellOff, MessageCircle, Store } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { useWholesaleProduct } from '@/hooks/queries/useWholesale'
import { cfImage } from '@/utils/cf-image'
import { WT, won, comma, discountRate, unitMargin, marginVsRetail, GRADE_LABEL, WHOLESALE_CATEGORIES } from './wholesale/wholesale-theme'
import { useWholesaleCart } from './wholesale/useWholesaleCart'

// 💬 채팅 위젯은 lazy — 상품 상세 초기 청크에 채팅 코드 0 byte(버튼 클릭 시에만 fetch).
//   (floating FAB 없이 위젯만 직접 mount — 상품 상세는 인라인 "제조사에 문의" 버튼이 트리거)
const WholesaleChatWidget = lazy(() => import('@/pages/wholesale/WholesaleChatWidget'))
// 🛒 스마트스토어 내보내기 모달 — lazy (연동 안 쓰는 판매사는 chunk 비용 0).
const NaverExportModal = lazy(() => import('@/pages/wholesale/NaverExportModal'))
// 🛒 쿠팡 내보내기 모달 — lazy (연결 폼 내장).
const CoupangExportModal = lazy(() => import('@/pages/wholesale/CoupangExportModal'))
// 📊 시장 신호 카드 — lazy (로그인 판매사만 마운트, 키 미설정이면 자체 숨김).
const MarketSignalCard = lazy(() => import('@/pages/wholesale/MarketSignalCard'))

// 🏭 2026-06-04 유통스타트 도매 상품 상세 — Claude Design 시안(TDS/Toss 라이트) 구현.
//   등급 공급가 앵커 + 권장가 대비 할인%/마진 + 수량 구간별 단가표(volume tier) + 하단 고정 CTA.
//   가격 = 등급가 × (1 − 수량구간 할인). 결제액은 /orders 가 동일 규칙으로 재계산(SSOT).

interface QtyTierView { min_qty: number; discount_pct: number; unit_price: number }
interface DetailItem {
  id: number; name: string; description?: string | null; image_url: string | null
  // 🖼️ 2026-06-12: 상세페이지 이미지(썸네일과 분리) — 상세설명 탭에 세로 갤러리.
  detail_images?: string[]
  category: string | null; stock: number; distributor_price: number | null
  retail_price?: number | null; moq?: number; pack_size?: number; order_multiple?: number; sold_count?: number; tiers?: QtyTierView[]; requires_login?: boolean
  // 🚚 제조사별 배송/주문 정책(비식별 group key + 정책 숫자) — 카트 그룹 계산용.
  supplier_group?: string | null
  supplier_policy?: { min_order_amount?: number; shipping_fee?: number; free_ship_threshold?: number } | null
  // 🚚 2026-06-16: 상품별 배송비(설정 시 정책 배송비보다 우선). null = 미설정 → 정책 배송비 폴백.
  product_shipping_fee?: number | null
  // 🛡️ 2026-06-13 (채팅 fix): 연결된 제조사 있는 상품만 true → '제조사에 문의' 노출.
  inquirable?: boolean
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

  // 💬 "제조사에 문의" — 로그인 판매사만. 서버가 상품→제조사를 서버사이드 해석(신원 비공개).
  //   버튼 클릭 시에만 lazy 위젯 mount + 상품 기준 스레드 자동 진입.
  const [chatOpen, setChatOpen] = useState(false)
  // 🛒 2026-06-12: 스마트스토어/쿠팡 내보내기 모달.
  const [naverOpen, setNaverOpen] = useState(false)
  const [coupangOpen, setCoupangOpen] = useState(false)

  // 🏭 NOTI-1 (2026-06-08): 품절 상품 재입고 알림 구독 상태.
  //   로그인 + 품절일 때만 노출. 내 구독 목록(/restock/subscriptions)에서 이 상품 포함 여부로 초기화.
  const [restockSubbed, setRestockSubbed] = useState(false)
  const [restockBusy, setRestockBusy] = useState(false)
  useEffect(() => {
    if (!token || !item || item.stock > 0) { setRestockSubbed(false); return }
    let cancelled = false
    api.get('/api/wholesale/restock/subscriptions', h)
      .then((r) => {
        if (cancelled) return
        const subs = (r.data?.subscriptions ?? []) as { product_id: number }[]
        setRestockSubbed(subs.some((s) => Number(s.product_id) === Number(item.id)))
      })
      .catch(() => { /* 조용히 무시 — 미구독으로 표시 */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, item?.id, item?.stock])

  async function toggleRestock() {
    if (!item || restockBusy) return
    if (!token) { toast.info('로그인하면 재입고 알림을 받을 수 있어요'); goLogin(); return }
    setRestockBusy(true)
    try {
      if (restockSubbed) {
        await api.delete(`/api/wholesale/restock/subscribe/${item.id}`, h)
        setRestockSubbed(false)
        toast.success('재입고 알림을 해제했어요')
      } else {
        const r = await api.post('/api/wholesale/restock/subscribe', { product_id: item.id }, h)
        if (r.data?.success) { setRestockSubbed(true); toast.success('재입고되면 알림으로 알려드릴게요') }
        else toast.error(r.data?.error || '재입고 알림 신청에 실패했어요')
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '재입고 알림 처리 중 오류가 발생했어요')
    } finally { setRestockBusy(false) }
  }

  // 🏭 2026-06-04 몰-first: 비로그인도 상세 열람 가능(가격은 가림). 강제 로그인 redirect 제거.
  const goLogin = () => navigate('/wholesale/login')
  // 🏭 BIZ-8: 초기 수량 = MOQ 를 만족하는 최소 order_multiple 배수(서버 검증과 일치).
  useEffect(() => {
    const m = Math.max(1, item?.moq || 1)
    const om = Math.max(1, item?.order_multiple || 1)
    setQty(om > 1 ? Math.ceil(m / om) * om : m)
    setTab('desc')
  }, [item?.id, item?.moq, item?.order_multiple])

  // 🏭 BIZ-8: 수량 제약 검증 — MOQ 이상 + order_multiple 배수. 위반 시 친절한 안내 toast(서버 검증과 일치).
  function validateQty(): boolean {
    if (!item) return false
    const m = Math.max(1, item.moq || 1)
    const om = Math.max(1, item.order_multiple || 1)
    if (qty < m) { toast.error(`최소 ${comma(m)}개부터 주문할 수 있어요`); return false }
    if (om > 1 && qty % om !== 0) { toast.error(`${comma(om)}개 단위로만 주문할 수 있어요`); return false }
    return true
  }

  function addToCart() {
    if (!item) return
    if (item.distributor_price == null) { toast.info('로그인하면 등급 공급가로 담을 수 있어요'); goLogin(); return }
    if (!validateQty()) return
    // 현재 수량 구간 단가를 스냅샷으로 저장(표시용). 결제액은 주문 시 서버 재계산(SSOT).
    let unit = item.distributor_price, bm = 0
    for (const t of (item.tiers || [])) if (qty >= t.min_qty && t.min_qty >= bm) { bm = t.min_qty; unit = t.unit_price }
    cart.add({ id: item.id, qty, name: item.name, image_url: item.image_url, price: unit, moq: Math.max(1, item.moq || 1), supplier_group: item.supplier_group ?? null, supplier_policy: item.supplier_policy ?? null })
    toast.success(`장바구니에 ${comma(qty)}개 담았어요`)
  }

  async function placeOrder() {
    if (!item || ordering) return
    if (item.distributor_price == null) { toast.info('로그인하면 주문할 수 있어요'); goLogin(); return }
    if (!validateQty()) return
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

  // 🏭 perf: 풀스크린 스피너 대신 상세 레이아웃 스켈레톤(빈 화면 X — 체감 로딩 ↓).
  if (loading) return (
    <div className="min-h-screen pb-28" style={{ background: '#fff' }}>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <ArrowLeft className="w-5 h-5" style={{ color: WT.ink4 }} />
          <div className="h-4 w-40 rounded animate-pulse" style={{ background: WT.fill }} />
        </div>
      </header>
      <main className="ur-content-wide px-5 lg:px-8 py-5 lg:flex lg:gap-8">
        <div className="lg:w-[46%] lg:shrink-0 mb-5 lg:mb-0">
          <div className="aspect-square rounded-2xl animate-pulse" style={{ background: WT.fill }} />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="h-5 w-20 rounded-full animate-pulse" style={{ background: WT.fill }} />
          <div className="h-7 w-3/4 rounded animate-pulse" style={{ background: WT.fill }} />
          <div className="h-24 w-full rounded-2xl animate-pulse" style={{ background: WT.fill }} />
          <div className="h-12 w-full rounded-xl animate-pulse" style={{ background: WT.fill }} />
        </div>
      </main>
    </div>
  )
  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#fff' }}>
        <p className="mb-4 text-[14px]" style={{ color: WT.ink3 }}>상품을 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/wholesale')} className="px-5 h-11 rounded-xl font-bold text-white" style={{ background: WT.ink }}>카탈로그로</button>
      </div>
    )
  }

  const moq = Math.max(1, item.moq || 1)
  // 🏭 BIZ-8: 주문 배수(박스 단위). step = order_multiple(없으면 moq fallback 으로 기존 박스단위 UX 유지).
  const orderMultiple = Math.max(1, item.order_multiple || 1)
  const step = orderMultiple > 1 ? orderMultiple : moq
  const tiers = item.tiers || []
  // 🏭 2026-06-19 (대표 신고 — 로그인했는데 비로그인 UI): 로그인 유도는 '실제 비로그인'(토큰 없음)일 때만.
  //   기존 `distributor_price == null` 만으로 판정하면, 로그인 상태인데 가격이 잠시 null(스테일 캐시/일시 누락)일 때
  //   '로그인하세요' 가 잘못 뜸. 토큰 있으면(로그인) 절대 로그인 UI 안 띄움 — 가격은 useWholesaleProduct 의
  //   인증별 캐시 키로 fresh 보장. (가격 null 가드는 담기/주문 액션에 별도로 남아 안전.)
  const locked = !token // 비로그인(토큰 없음) → 가격 가림 + 로그인 유도
  // 현재 수량에 적용되는 단가 — qty 이상 만족하는 최대 min_qty tier(없으면 등급가). 서버 /orders 와 동일 규칙.
  let effUnit = item.distributor_price ?? 0, bestMin = 0
  for (const t of tiers) if (qty >= t.min_qty && t.min_qty >= bestMin) { bestMin = t.min_qty; effUnit = t.unit_price }
  const total = effUnit * qty
  const dr = item.retail_price ? discountRate(item.distributor_price ?? 0, item.retail_price) : 0
  const um = item.retail_price ? unitMargin(item.distributor_price ?? 0, item.retail_price) : 0
  const mr = item.retail_price ? marginVsRetail(item.distributor_price ?? 0, item.retail_price) : 0
  const catLabel = WHOLESALE_CATEGORIES.find(c => c.id === item.category)?.label
  const tabs: [typeof tab, string][] = [['desc', '상세설명'], ['ship', '배송'], ['settle', '정산'], ['return', '반품·교환']]

  return (
    <div className="min-h-screen pb-28" style={{ background: '#fff', color: WT.ink }}>
      {/* 🏭 2026-06-08 도매 상품 상세 — canonical=utongstart 이되 noindex 유지(공급가/거래정보 비노출 룰).
          description 에도 공급가 절대 미포함. */}
      <SEO domain="wholesale" title={`${item.name} - 유통스타트 도매`} description="판매사 전용 도매 상품 상세 — 도매가는 로그인 후 확인" url={`/wholesale/product/${item.id}`} noindex />
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
            {item.image_url && <img src={cfImage(item.image_url, { width: 800, format: 'auto' }) || item.image_url} alt={item.name} loading="eager" decoding="async" draggable={false} className="w-full h-full object-cover" />}
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
              <p className="mt-1 text-[13px]" style={{ color: WT.ink3 }}>판매사 가입 즉시 C등급 공급가로 사입 시작 · 실적 쌓이면 A·B 상향</p>
              <div className="mt-3 flex gap-2.5">
                <button onClick={goLogin} className="flex-1 h-12 rounded-xl text-[15px] font-bold" style={{ background: WT.fill2, color: WT.ink, border: '1px solid ' + WT.line }}>로그인</button>
                <button onClick={() => navigate('/wholesale/join')} className="flex-1 h-12 rounded-xl text-[15px] font-bold text-white" style={{ background: WT.brand }}>판매사 가입</button>
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
              {/* 🏭 BIZ-8: 주문 수량 제약 배지 — 최소 N개 · M개 단위 */}
              {(moq > 1 || orderMultiple > 1) && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}>
                  {moq > 1 ? `최소 ${comma(moq)}개` : ''}
                  {orderMultiple > 1 ? `${moq > 1 ? ' · ' : ''}${comma(orderMultiple)}개 단위` : ''}
                </div>
              )}

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
          {(() => {
            // 🚚 2026-06-16: 배송비 표시 — 상품별 배송비(설정 시 우선) > 제조사 정책 배송비 > 0(무료).
            const effShip = item.product_shipping_fee != null ? item.product_shipping_fee : (item.supplier_policy?.shipping_fee ?? 0)
            const freeThreshold = item.supplier_policy?.free_ship_threshold ?? 0
            return (
              <div className="mt-3.5 rounded-2xl overflow-hidden" style={{ background: WT.fill2 }}>
                <KV label="재고" value={comma(item.stock) + '개'} accent={item.stock < 200 ? '#C2620C' : undefined} />
                <div style={{ borderTop: '1px solid ' + WT.line }} />
                <KV label="배송비" value={effShip > 0 ? won(effShip) : '무료'} accent={effShip === 0 ? WT.pos : undefined} />
                {freeThreshold > 0 && effShip > 0 && (
                  <div className="px-4 pb-2.5 -mt-1 text-[12px]" style={{ color: WT.ink3 }}>{won(freeThreshold)} 이상 무료배송</div>
                )}
                <div style={{ borderTop: '1px solid ' + WT.line }} />
                <KV label="누적 사입" value={comma(item.sold_count || 0) + '건'} />
                <div style={{ borderTop: '1px solid ' + WT.line }} />
                <KV label="제조사" value="검증 제조사 (신원 비공개)" />
              </div>
            )
          })()}

          {/* 📊 2026-06-12 (감사 개선 ⑤): 시장 신호 — 시중 최저가 vs 내 공급가, 수요/시즌. 사입 확신 보조. */}
          {!locked && token && (
            <Suspense fallback={null}>
              <MarketSignalCard name={item.name} category={item.category} distributorPrice={item.distributor_price} />
            </Suspense>
          )}

          {/* 💬 제조사에 문의 — 로그인 판매사 + 연결된 제조사 있는 상품만(데모/관리자 상품은 숨김). */}
          {!locked && token && item.inquirable !== false && (
            <button
              type="button"
              onClick={() => setChatOpen(true)}
              className="mt-3 w-full h-12 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
              style={{ background: WT.fill, color: WT.ink, border: '1px solid ' + WT.line }}
            >
              <MessageCircle className="w-4.5 h-4.5" style={{ color: WT.brand }} />
              제조사에 문의
            </button>
          )}

          {/* 🛒 2026-06-12 — 스마트스토어/쿠팡 내보내기 (로그인 판매사만). 사입 즉시 양대 채널 등록. */}
          {!locked && token && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNaverOpen(true)}
                className="h-12 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5"
                style={{ background: WT.fill, color: WT.ink, border: '1px solid ' + WT.line }}
              >
                <Store className="w-4 h-4" style={{ color: '#03C75A' }} />
                스마트스토어 등록
              </button>
              <button
                type="button"
                onClick={() => setCoupangOpen(true)}
                className="h-12 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5"
                style={{ background: WT.fill, color: WT.ink, border: '1px solid ' + WT.line }}
              >
                <Store className="w-4 h-4" style={{ color: '#346AFF' }} />
                쿠팡 등록
              </button>
            </div>
          )}

          {/* 데스크톱 인라인 CTA */}
          <div className="hidden lg:block">
            {locked ? (
              <button onClick={goLogin} className="mt-5 w-full h-14 rounded-2xl text-[16px] font-bold text-white flex items-center justify-center gap-2" style={{ background: WT.brand }}>
                <Lock className="w-5 h-5" /> 로그인하고 공급가 확인
              </button>
            ) : (<>
            <div className="mt-5 flex items-center gap-3">
              <div className="inline-flex items-center rounded-full h-11" style={{ background: WT.fill }}>
                <button className="h-11 w-11 text-[20px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(q => Math.max(moq, q - step))} disabled={qty <= moq}>−</button>
                <span className="w-12 text-center text-[15px] font-bold tabular-nums" style={{ color: WT.ink }}>{comma(qty)}</span>
                <button className="h-11 w-11 text-[20px]" style={{ color: WT.ink2 }} onClick={() => setQty(q => q + step)}>+</button>
              </div>
              <div className="flex-1 text-right">
                <span className="text-[13px] mr-2" style={{ color: WT.ink3 }}>합계</span>
                <span className="text-[20px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{won(total)}</span>
              </div>
            </div>
            {item.stock <= 0 ? (
              <button onClick={toggleRestock} disabled={restockBusy}
                className="mt-3 w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                style={restockSubbed ? { background: WT.fill, color: WT.ink2, border: '1px solid ' + WT.line } : { background: WT.ink, color: '#fff' }}>
                {restockBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : restockSubbed ? <BellOff className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
                {restockSubbed ? '재입고 알림 해제' : '재입고 알림 신청'}
              </button>
            ) : (
              <div className="mt-3 flex gap-2.5">
                <button onClick={addToCart} className="px-7 h-14 rounded-2xl text-[16px] font-bold" style={{ background: WT.fill, color: WT.ink }}>담기</button>
                <button onClick={placeOrder} disabled={ordering}
                  className="flex-1 h-14 rounded-2xl text-[16px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
                  {ordering ? <Loader2 className="w-5 h-5 animate-spin inline" /> : '바로 주문'}
                </button>
              </div>
            )}
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
          {tab === 'desc' && (<>
            {item.description
              ? <p className="whitespace-pre-wrap">{item.description}</p>
              : <p>검증된 제조사가 공급하는 <b style={{ color: WT.ink }}>{item.name}</b> 입니다. 대량 사입에 최적화된 도매 공급가로, 소매 판매 시 충분한 마진 여력을 확보할 수 있어요.</p>}
            {/* 🖼️ 2026-06-12: 상세페이지 이미지 갤러리 (썸네일과 분리 — 엑셀/단건 등록의 '상세 이미지URL'). */}
            {(item.detail_images?.length ?? 0) > 0 && (
              <div className="mt-5 space-y-3">
                {item.detail_images!.map((u, i) => (
                  <img key={i} src={cfImage(u, { width: 800, format: 'auto' }) || u} alt={`${item.name} 상세 ${i + 1}`}
                    className="w-full rounded-xl" loading="lazy" decoding="async"
                    onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ))}
              </div>
            )}
          </>)}
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
        ) : item.stock <= 0 ? (
          <button onClick={toggleRestock} disabled={restockBusy}
            className="w-full h-14 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            style={restockSubbed ? { background: WT.fill, color: WT.ink2, border: '1px solid ' + WT.line } : { background: WT.ink, color: '#fff' }}>
            {restockBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : restockSubbed ? <BellOff className="w-5 h-5" /> : <BellRing className="w-5 h-5" />}
            {restockSubbed ? '재입고 알림 해제' : '재입고 알림 신청'}
          </button>
        ) : (<>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="inline-flex items-center rounded-full h-10" style={{ background: WT.fill }}>
            <button className="h-10 w-10 text-[20px] disabled:opacity-30" style={{ color: WT.ink2 }} onClick={() => setQty(q => Math.max(moq, q - step))} disabled={qty <= moq}>−</button>
            <span className="w-11 text-center text-[15px] font-bold tabular-nums" style={{ color: WT.ink }}>{comma(qty)}</span>
            <button className="h-10 w-10 text-[20px]" style={{ color: WT.ink2 }} onClick={() => setQty(q => q + step)}>+</button>
          </div>
          <div className="text-right">
            <span className="text-[12px] mr-1.5" style={{ color: WT.ink3 }}>합계</span>
            <span className="text-[19px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{won(total)}</span>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={addToCart} className="px-6 h-14 rounded-2xl text-[16px] font-bold" style={{ background: WT.fill, color: WT.ink }}>담기</button>
          <button onClick={placeOrder} disabled={ordering}
            className="flex-1 h-14 rounded-2xl text-[16px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
            {ordering ? <Loader2 className="w-5 h-5 animate-spin inline" /> : '바로 주문'}
          </button>
        </div>
        </>)}
      </div>

      {/* 💬 "제조사에 문의" 위젯 — 클릭 시에만 lazy mount, 상품 기준 스레드 자동 진입.
          🛡️ 서버가 product_id → 제조사를 서버사이드 해석 — 클라는 제조사 신원/ID 를 모름. */}
      {chatOpen && (
        <Suspense fallback={null}>
          <WholesaleChatWidget onClose={() => setChatOpen(false)} initialProductId={item.id} />
        </Suspense>
      )}

      {/* 🛒 스마트스토어/쿠팡 내보내기 — lazy 모달. */}
      {naverOpen && (
        <Suspense fallback={null}>
          <NaverExportModal
            product={{ id: item.id, name: item.name, retail_price: item.retail_price, distributor_price: item.distributor_price, stock: item.stock }}
            onClose={() => setNaverOpen(false)}
          />
        </Suspense>
      )}
      {coupangOpen && (
        <Suspense fallback={null}>
          <CoupangExportModal
            product={{ id: item.id, name: item.name, retail_price: item.retail_price, distributor_price: item.distributor_price, stock: item.stock }}
            onClose={() => setCoupangOpen(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
