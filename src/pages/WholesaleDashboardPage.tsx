// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통사 대시보드 허브 (사용자 요청 — 제조사 대시보드와 대칭)
//   매입현황 · 진행중 주문 · 누적 매입 · 등급 · 빠른 진입(카탈로그/주문/거래/자료/OEM) 한 화면.
//   서버 신규 엔드포인트 없이 기존 /me + /orders 재사용(클라 집계). WT 라이트 고정 B2B 서피스.
// ──────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingBag, ClipboardList, Receipt, FileText, Factory, Wallet,
  TrendingUp, Box, ChevronRight, LogOut, ShoppingCart, Sparkles,
} from 'lucide-react'
import SEO from '@/components/SEO'
import { WT, won, comma, GRADE_LABEL } from './wholesale/wholesale-theme'
import { useWholesaleMe, useWholesaleOrders, type WholesaleOrderRow } from '@/hooks/queries/useWholesale'
import { useWholesaleCart } from './wholesale/useWholesaleCart'
import { getSupplierToken } from '@/lib/supplier-api'
import { clearAuthData } from '@/utils/auth'

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: '결제대기', color: WT.ink3, bg: WT.fill },
  PAID: { label: '배송준비', color: WT.brand, bg: WT.brandSoft },
  SHIPPED: { label: '배송완료', color: WT.pos, bg: WT.posBg },
  REFUNDED: { label: '환불', color: WT.ink3, bg: WT.fill },
  CANCELLED: { label: '취소', color: WT.ink3, bg: WT.fill },
}

const PAID_STATUSES = ['PAID', 'SHIPPED']

export default function WholesaleDashboardPage() {
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const supplierToken = typeof window !== 'undefined' ? getSupplierToken() : null

  // 유통사(seller_token) 전용 — 미로그인 시 도매몰 홈으로.
  useEffect(() => {
    if (!token) navigate('/wholesale', { replace: true })
  }, [token, navigate])

  const meQ = useWholesaleMe()
  const ordersQ = useWholesaleOrders()
  const cart = useWholesaleCart()

  const me = (meQ.data ?? null) as { grade: string; margin_pct: number; special_active: boolean } | null
  const grade = me?.grade || 'C'
  const orders: WholesaleOrderRow[] = ordersQ.data ?? []

  // 클라 집계 (이번달/누적 매입, 진행중 주문).
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const paidOrders = orders.filter((o) => PAID_STATUSES.includes(o.status))
  const thisMonthSpend = paidOrders
    .filter((o) => (o.paid_at || o.created_at || '').slice(0, 7) === ym)
    .reduce((s, o) => s + (o.subtotal || 0), 0)
  const totalSpend = paidOrders.reduce((s, o) => s + (o.subtotal || 0), 0)
  const activeCount = orders.filter((o) => o.status === 'PAID').length
  const recent = orders.slice(0, 5)

  const company = localStorage.getItem('seller_name') || '유통사'

  const stats = [
    { label: '이번달 매입액', value: won(thisMonthSpend), icon: TrendingUp, accent: WT.brand },
    { label: '진행중 주문', value: `${comma(activeCount)}건`, icon: Box, accent: WT.ink },
    { label: '누적 매입액', value: won(totalSpend), icon: Wallet, accent: WT.pos },
    { label: '장바구니', value: `${comma(cart.count)}개`, icon: ShoppingCart, accent: WT.ink },
  ]

  const actions = [
    { label: '카탈로그 둘러보기', desc: '내 등급 공급가로 사입', icon: ShoppingBag, to: '/wholesale', primary: true },
    { label: '주문내역', desc: '주문·배송 추적', icon: ClipboardList, to: '/wholesale/orders' },
    { label: '거래내역', desc: '매입 거래명세', icon: Receipt, to: '/wholesale/statement' },
    { label: '자료', desc: '거래명세서·세금계산서', icon: FileText, to: '/wholesale/documents' },
    { label: 'OEM/ODM', desc: '제조 의뢰', icon: Factory, to: '/wholesale/oem' },
    { label: '장바구니', desc: '담은 상품 주문', icon: ShoppingCart, to: '/wholesale/cart' },
  ]

  return (
    <div className="min-h-screen" style={{ background: WT.fill }}>
      <SEO title="유통사 대시보드 - 유통스타트 도매몰" description="매입 현황과 주문·거래·자료를 한 화면에서 관리하세요." url="/wholesale/dashboard" noindex />

      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/wholesale')} className="flex items-center gap-2 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white font-extrabold text-[13px]" style={{ background: WT.brand }}>유</span>
            <span className="text-[15px] font-extrabold" style={{ color: WT.ink }}>유통사 대시보드</span>
          </button>
          <div className="flex-1" />
          <button onClick={() => navigate('/wholesale')} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold shrink-0" style={{ background: WT.fill, color: WT.ink }}>
            <ShoppingBag className="w-4 h-4" /> 카탈로그
          </button>
          <button onClick={() => navigate('/wholesale/cart')} aria-label="장바구니" className="relative shrink-0 p-1.5" style={{ color: WT.ink2 }}>
            <ShoppingCart className="w-5 h-5" />
            {cart.count > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: WT.brand }}>{cart.count}</span>}
          </button>
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 py-5 space-y-5">
        {/* 등급 히어로 */}
        <section className="rounded-2xl p-5 flex items-center gap-4" style={{ background: WT.ink, boxShadow: WT.shCard }}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-extrabold text-white shrink-0" style={{ background: WT.brand }}>
            {GRADE_LABEL[grade] || grade}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold text-white truncate">
              {company} · <span style={{ color: '#FF4D66' }}>{GRADE_LABEL[grade] || grade}등급</span> 단가 적용중
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {me ? `등급 마진 ${me.margin_pct}%` : '등급 정보를 불러오는 중'}{me?.special_active ? ' · 특별가 적용중' : ''} · 실적이 쌓이면 등급이 상향됩니다
            </div>
          </div>
          <ChevronRight className="w-5 h-5 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </section>

        {/* 통계 카드 */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-4" style={{ boxShadow: WT.shSoft }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold" style={{ color: WT.ink3 }}>{s.label}</span>
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
              <div className="text-[20px] font-extrabold mt-2 truncate" style={{ color: WT.ink }}>{s.value}</div>
            </div>
          ))}
        </section>

        {/* 제조사 겸업 — 제조사 대시보드 진입 */}
        {supplierToken && (
          <button onClick={() => navigate('/supplier')} className="w-full rounded-2xl bg-white p-4 flex items-center gap-3 text-left" style={{ boxShadow: WT.shSoft }}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: WT.brandSoft }}>
              <Factory className="w-5 h-5" style={{ color: WT.brand }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold" style={{ color: WT.ink }}>제조사 대시보드</div>
              <div className="text-[12px]" style={{ color: WT.ink3 }}>공급 상품·받은 주문·정산 관리</div>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0" style={{ color: WT.ink4 }} />
          </button>
        )}

        {/* 빠른 진입 */}
        <section>
          <h2 className="text-[13px] font-extrabold mb-2.5" style={{ color: WT.ink2 }}>빠른 메뉴</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
                style={a.primary ? { background: WT.brand, boxShadow: WT.shCard } : { background: '#fff', boxShadow: WT.shSoft }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: a.primary ? 'rgba(255,255,255,0.18)' : WT.fill }}>
                  <a.icon className="w-5 h-5" style={{ color: a.primary ? '#fff' : WT.ink }} />
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold truncate" style={{ color: a.primary ? '#fff' : WT.ink }}>{a.label}</div>
                  <div className="text-[11px] truncate" style={{ color: a.primary ? 'rgba(255,255,255,0.8)' : WT.ink3 }}>{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 최근 주문 */}
        <section className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: WT.shSoft }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid ' + WT.line }}>
            <h2 className="text-[14px] font-extrabold" style={{ color: WT.ink }}>최근 주문</h2>
            <button onClick={() => navigate('/wholesale/orders')} className="inline-flex items-center gap-0.5 text-[12px] font-bold" style={{ color: WT.brand }}>
              전체보기 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {ordersQ.isLoading ? (
            <div className="py-12 text-center text-[13px]" style={{ color: WT.ink4 }}>불러오는 중…</div>
          ) : recent.length === 0 ? (
            <div className="py-12 text-center" style={{ color: WT.ink3 }}>
              <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: WT.ink4 }} />
              <p className="text-[13px]">아직 주문이 없어요</p>
              <button onClick={() => navigate('/wholesale')} className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[12px] font-bold text-white" style={{ background: WT.brand }}>
                <ShoppingBag className="w-3.5 h-3.5" /> 카탈로그에서 사입 시작
              </button>
            </div>
          ) : (
            <ul>
              {recent.map((o) => {
                const badge = STATUS_BADGE[o.status] || { label: o.status, color: WT.ink3, bg: WT.fill }
                return (
                  <li key={o.id}>
                    <button onClick={() => navigate('/wholesale/orders')} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ borderTop: '1px solid ' + WT.line }}>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-bold truncate" style={{ color: WT.ink }}>
                          주문 #{o.id}{o.toss_order_id ? ` · ${o.toss_order_id}` : ''}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: WT.ink3 }}>
                          {(o.paid_at || o.created_at || '').slice(0, 10)}
                        </div>
                      </div>
                      <span className="text-[14px] font-extrabold shrink-0" style={{ color: WT.ink }}>{won(o.subtotal)}</span>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* 로그아웃 */}
        <div className="pt-1">
          <button
            onClick={() => {
              clearAuthData('seller')
              try { localStorage.removeItem('is_distributor') } catch { /* ignore */ }
              window.location.assign('/wholesale')
            }}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium"
            style={{ color: WT.ink3 }}
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </main>
    </div>
  )
}
