// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-04 유통사 대시보드 허브 (사용자 요청 — 제조사 대시보드와 대칭)
//   매입현황 · 진행중 주문 · 누적 매입 · 등급 · 빠른 진입(카탈로그/주문/거래/자료/OEM) 한 화면.
//   서버 신규 엔드포인트 없이 기존 /me + /orders 재사용(클라 집계). WT 라이트 고정 B2B 서피스.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ShoppingBag, ClipboardList, Receipt, FileText, Factory, Wallet,
  TrendingUp, Box, ChevronRight, LogOut, ShoppingCart, Sparkles, Store,
} from 'lucide-react'
import SEO from '@/components/SEO'
import { WT, won, comma, GRADE_LABEL, wholesaleOrderStatusBadge } from './wholesale/wholesale-theme'
import { useWholesaleMe, useWholesaleOrders, useWholesaleDeposit, type WholesaleOrderRow } from '@/hooks/queries/useWholesale'
import { useWholesaleCart } from './wholesale/useWholesaleCart'
import { buildWholesaleNav } from './wholesale/wholesale-nav'
import { getSupplierToken } from '@/lib/supplier-api'
import { clearAuthData } from '@/utils/auth'
import WholesaleDashboardShell from '@/components/wholesale/WholesaleDashboardShell'
import PlusMembershipCard from '@/components/wholesale/PlusMembershipCard'

// 🏭 2026-06-12 (감사 부채): 주문 상태 뱃지 → wholesale-theme.ts SSOT 로 통합.
//   기존 자체 정의(5종)는 주문내역 페이지와 라벨이 달랐음('배송준비' vs '결제완료').

const PAID_STATUSES = ['PAID', 'SHIPPED']

export default function WholesaleDashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const supplierToken = typeof window !== 'undefined' ? getSupplierToken() : null
  const isDistributor = typeof window !== 'undefined' && localStorage.getItem('is_distributor') === '1'

  // 🏭 2026-06-08: 유통사(seller_token + is_distributor) 전용 — 역할 엄격화(제조사 가드와 대칭).
  //   미로그인 → 유통사 로그인. 셀러지만 유통사 아님 → 카탈로그(유통사 전환 CTA).
  useEffect(() => {
    if (!token) { navigate('/wholesale/login', { replace: true }); return }
    if (!isDistributor) { navigate('/wholesale', { replace: true }); return }
  }, [token, isDistributor, navigate])

  const meQ = useWholesaleMe()
  const ordersQ = useWholesaleOrders()
  const depositQ = useWholesaleDeposit()
  const cart = useWholesaleCart()
  const [orderTab, setOrderTab] = useState('all')

  const me = (meQ.data ?? null) as { grade: string; margin_pct: number; special_active: boolean; sub_role?: string | null; can_manage_staff?: boolean } | null
  const grade = me?.grade || 'C'
  // 👥 직원 서브계정 컨텍스트 — owner(sub_role 없음)면 직원관리 노출. 직원이면 역할 배지 표시.
  const canManageStaff = me ? me.can_manage_staff !== false : true
  const subRole = me?.sub_role || null
  const SUB_ROLE_LABEL: Record<string, string> = { admin: '관리자', staff: '직원', viewer: '뷰어' }
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
  // 🧾 주문 내역 — 상태 탭 필터 (시안: 마이페이지 주문관리 테이블)
  const ORDER_TABS = [{ id: 'all', label: '전체' }, { id: 'PAID', label: '결제완료' }, { id: 'SHIPPED', label: '배송중' }, { id: 'DONE', label: '구매확정' }]
  const filteredOrders = (orderTab === 'all' ? orders : orders.filter((o) => o.status === orderTab)).slice(0, 12)

  const company = localStorage.getItem('seller_name') || '유통사'
  const depositBalance = Number(depositQ.data?.balance) || 0

  // 🏭 2026-06-08: 유통사 섹션은 별도 라우트 → 사이드바 nav 가 navigate. 대시보드 항목이 활성.
  // 🏦 2026-06-09: 예치금 항목 포함(공유 nav 단일 출처).
  const navItems = buildWholesaleNav(location.pathname, navigate, canManageStaff)

  const logout = () => {
    clearAuthData('seller')
    try { localStorage.removeItem('is_distributor') } catch { /* ignore */ }
    window.location.assign('/wholesale')
  }

  const headerRight = (
    <>
      {subRole && (
        <span
          className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
          style={{ background: WT.fill, color: WT.ink2 }}
          title={`${company} · ${SUB_ROLE_LABEL[subRole] || subRole}`}
        >
          {company} · {SUB_ROLE_LABEL[subRole] || subRole}
        </span>
      )}
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
        style={{ background: WT.brandSoft, color: WT.brand }}
      >
        {GRADE_LABEL[grade] || grade}등급
      </span>
      <button
        onClick={() => navigate('/wholesale/cart')}
        aria-label="장바구니"
        className="relative shrink-0 p-1.5 rounded-lg hover:bg-gray-100"
        style={{ color: WT.ink2 }}
      >
        <ShoppingCart className="w-5 h-5" />
        {cart.count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: WT.brand }}>
            {cart.count}
          </span>
        )}
      </button>
      <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">로그아웃</span>
      </button>
    </>
  )

  const stats = [
    { label: '예치금 잔액', value: won(depositBalance), icon: Wallet, accent: WT.brand, sub: '주문 결제에 사용' },
    { label: '이번달 매입액', value: won(thisMonthSpend), icon: TrendingUp, accent: WT.ink, sub: `${ym} 기준` },
    { label: '진행중 주문', value: `${comma(activeCount)}건`, icon: Box, accent: WT.ink, sub: '배송 진행 중' },
    { label: '누적 매입액', value: won(totalSpend), icon: Wallet, accent: WT.pos, sub: `${comma(paidOrders.length)}건 완료` },
  ]

  const actions = [
    { label: '예치금 충전', desc: '선불 충전 후 주문 결제', icon: Wallet, to: '/wholesale/deposits', primary: true },
    { label: '카탈로그 둘러보기', desc: '내 등급 공급가로 사입', icon: ShoppingBag, to: '/wholesale' },
    { label: '주문내역', desc: '주문·배송 추적', icon: ClipboardList, to: '/wholesale/orders' },
    { label: '거래내역', desc: '매입 거래명세', icon: Receipt, to: '/wholesale/statement' },
    { label: '자료', desc: '거래명세서·세금계산서', icon: FileText, to: '/wholesale/documents' },
    { label: 'OEM/ODM', desc: '제조 의뢰', icon: Factory, to: '/wholesale/oem' },
    // 🛒 2026-06-16 무재고 위탁판매 허브 — 스마트스토어/쿠팡 연동 통합(채널 연동).
    { label: '판매채널 연동', desc: '사입 상품을 내 스토어로', icon: Store, to: '/wholesale/channels' },
  ]

  return (
    <WholesaleDashboardShell
      brand="유통사 센터"
      roleIcon={Store}
      brandSubtitle={company}
      navItems={navItems}
      title="유통사 대시보드"
      headerRight={headerRight}
    >
      <SEO title="유통사 대시보드 - 유통스타트 도매몰" description="매입 현황과 주문·거래·자료를 한 화면에서 관리하세요." url="/wholesale/dashboard" noindex />

      <div className="space-y-5">
        {/* 인사 + 등급 칩 (시안: 라이트 마이페이지) */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-[20px] lg:text-[23px] font-extrabold tracking-[-0.02em]" style={{ color: WT.ink }}>{company}님</h2>
          <span className="text-[11.5px] font-bold rounded-full px-2.5 py-1" style={{ background: WT.brandSoft, color: WT.brand }}>
            {GRADE_LABEL[grade] || grade}등급 · 마진 {me?.margin_pct ?? 0}%{me?.special_active ? ' · 특별가' : ''}
          </span>
        </div>

        {/* KPI 카드 (라이트 보더 + 색상 값 + 부제) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-white p-4" style={{ border: '1px solid ' + WT.line2 }}>
              <div className="text-[12px]" style={{ color: WT.ink3 }}>{s.label}</div>
              <div className="text-[21px] font-extrabold tracking-[-0.02em] mt-1.5 truncate" style={{ color: s.accent }}>{s.value}</div>
              <div className="text-[11px] mt-1 truncate" style={{ color: WT.ink4 }}>{s.sub}</div>
            </div>
          ))}
        </section>

        {/* 🏅 플러스 멤버십(연 구독) — 예치금 차감. 일반→구독 CTA / 플러스→만료·연장 / 프리미엄→안내 */}
        <PlusMembershipCard />

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

        {/* 주문 내역 — 상태 탭 + 테이블 (시안) */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h2 className="text-[16px] font-extrabold" style={{ color: WT.ink }}>주문 내역</h2>
            <div className="flex gap-1.5">
              {ORDER_TABS.map((tb) => {
                const on = orderTab === tb.id
                return (
                  <button key={tb.id} onClick={() => setOrderTab(tb.id)} className="text-[12px] font-semibold rounded-full px-3 py-1.5 transition-colors"
                    style={on ? { background: WT.ink, color: '#fff' } : { background: '#fff', color: WT.ink2, border: '1px solid ' + WT.line2 }}>{tb.label}</button>
                )
              })}
            </div>
          </div>
          <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid ' + WT.line2 }}>
            <div className="hidden lg:grid grid-cols-[1.7fr_1fr_1fr_0.7fr] gap-3 px-4 py-3 text-[11.5px] font-bold" style={{ color: WT.ink3, background: WT.trustBg, borderBottom: '1px solid ' + WT.line }}>
              <span>주문번호</span><span className="text-right">결제금액</span><span className="text-center">상태</span><span className="text-center">상세</span>
            </div>
            {ordersQ.isLoading ? (
              <div className="py-12 text-center text-[13px]" style={{ color: WT.ink4 }}>불러오는 중…</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center" style={{ color: WT.ink3 }}>
                <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: WT.ink4 }} />
                <p className="text-[13px]">{orderTab === 'all' ? '아직 주문이 없어요' : '해당 상태의 주문이 없어요'}</p>
                {orderTab === 'all' && (
                  <button onClick={() => navigate('/wholesale')} className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[12px] font-bold text-white" style={{ background: WT.brand }}>
                    <ShoppingBag className="w-3.5 h-3.5" /> 카탈로그에서 사입 시작
                  </button>
                )}
              </div>
            ) : (
              <ul>
                {filteredOrders.map((o) => {
                  const badge = wholesaleOrderStatusBadge(o.status)
                  return (
                    <li key={o.id}>
                      <button onClick={() => navigate('/wholesale/orders')} className="w-full flex lg:grid lg:grid-cols-[1.7fr_1fr_1fr_0.7fr] items-center gap-3 px-4 py-3.5 text-left" style={{ borderTop: '1px solid ' + WT.line }}>
                        <div className="min-w-0 flex-1 lg:flex-none">
                          <div className="text-[13px] font-bold truncate" style={{ color: WT.ink }}>주문 #{o.id}{o.toss_order_id ? ` · ${o.toss_order_id}` : ''}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px]" style={{ color: WT.ink3 }}>{(o.paid_at || o.created_at || '').slice(0, 10)}</span>
                            <span className="lg:hidden rounded-full px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span>
                          </div>
                        </div>
                        <span className="text-[14px] lg:text-[13px] font-extrabold tabular-nums shrink-0 lg:text-right" style={{ color: WT.ink }}>{won(o.subtotal)}</span>
                        <span className="hidden lg:flex justify-center"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ color: badge.color, background: badge.bg }}>{badge.label}</span></span>
                        <span className="hidden lg:flex justify-center"><ChevronRight className="w-4 h-4" style={{ color: WT.ink4 }} /></span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

      </div>
    </WholesaleDashboardShell>
  )
}
