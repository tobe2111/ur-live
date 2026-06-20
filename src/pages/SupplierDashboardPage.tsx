/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 대시보드.
 *   탭: 개요(잔고/카운트) · 카탈로그(내 공급상품 + 등록) · 정산(매출 내역).
 *   self-guard: supplier_token 없으면 /supplier/login.
 *   라이트 테마 (대시보드 계열) + i18n.
 */
import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, Wallet, Receipt, LogOut, Truck, MessageCircle, Loader2, Download, Factory } from 'lucide-react'
import SEO from '@/components/SEO'
import { supplierApi, isSupplierLoggedIn, clearSupplierSession } from '@/lib/supplier-api'
import WholesaleDashboardShell, { type WholesaleNavItem } from '@/components/wholesale/WholesaleDashboardShell'
// 🏭 2026-06-09 Wave 4b: 채팅 — adaptive 폴링(배지) + lazy 위젯(탭 열 때만 chunk fetch).
import { useChatPoll } from '@/hooks/useChatPoll'
import { wholesaleChatApi, hasChatToken } from '@/hooks/queries/useWholesaleChat'
// 분해 (순수 추출, 동작 변화 0): 탭/모달/타입은 ./supplier-dashboard/ 폴더로 추출.
import { downloadSupplierCsv } from './supplier-dashboard/download-csv'
import type { Tab, Me, CatalogItem, SettlementItem, WithdrawalItem, SupplierTaxInvoiceRow, AnalyticsPeriod, AnalyticsData, OrderItem } from './supplier-dashboard/types'
import PriceChangeModal from './supplier-dashboard/PriceChangeModal'
import ChannelModal from './supplier-dashboard/ChannelModal'
import AnalyticsTab from './supplier-dashboard/AnalyticsTab'
import BulkPriceModal from './supplier-dashboard/BulkPriceModal'
import OverviewTab from './supplier-dashboard/OverviewTab'
import CatalogTab from './supplier-dashboard/CatalogTab'
import SettlementsTab from './supplier-dashboard/SettlementsTab'
import WithdrawalSection from './supplier-dashboard/WithdrawalSection'
import WithdrawModal from './supplier-dashboard/WithdrawModal'
import SupplierTaxInvoicesTab from './supplier-dashboard/SupplierTaxInvoicesTab'
import OrdersTab from './supplier-dashboard/OrdersTab'
import ShipModal from './supplier-dashboard/ShipModal'
import AddProductModal from './supplier-dashboard/AddProductModal'
import NotificationsBell from './supplier-dashboard/NotificationsBell'
const WholesaleChatWidget = lazy(() => import('./wholesale/WholesaleChatWidget'))

export default function SupplierDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 💬 채팅 알림 딥링크(/supplier/chat) → 채팅 탭으로 진입.
  const [tab, setTab] = useState<Tab>(() => (typeof window !== 'undefined' && window.location.pathname.endsWith('/chat')) ? 'chat' : 'overview')
  const [me, setMe] = useState<Me | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [settlements, setSettlements] = useState<SettlementItem[]>([])
  // 🏦 출금: 신청 내역 + 실가용(spendable) 잔액 + 출금 모달.
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([])
  const [spendable, setSpendable] = useState(0)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [taxInvoices, setTaxInvoices] = useState<SupplierTaxInvoiceRow[]>([])
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('30d')
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [orderStatus, setOrderStatus] = useState<'to_ship' | 'shipped'>('to_ship')
  // 홈 '할 일' — 발송 대기(to_ship) 주문 건수. orders 탭 토글(orderStatus)과 독립적으로 집계.
  const [pendingShipCount, setPendingShipCount] = useState(0)
  const [shipModal, setShipModal] = useState<OrderItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [meError, setMeError] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [channelItem, setChannelItem] = useState<CatalogItem | null>(null)
  const [priceChangeItem, setPriceChangeItem] = useState<CatalogItem | null>(null)
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false)
  // 🏭 Wave 4b: 채팅 unread 배지 — 가벼운 폴링(탭 숨김이면 중단). 채팅 탭 열려도 다른 스레드 unread 계속 추적.
  const [chatUnread, setChatUnread] = useState(0)

  useEffect(() => {
    if (!isSupplierLoggedIn()) { navigate('/supplier/login', { replace: true }); return }
  }, [navigate])

  // 배지 폴링 — base 25s, 백오프 120s. supplier_token 없으면 비활성.
  useChatPoll(
    async () => {
      try { setChatUnread((await wholesaleChatApi.unread()).unread); return true } catch { return false }
    },
    { baseInterval: 25_000, maxInterval: 120_000, enabled: hasChatToken() },
  )

  const loadMe = useCallback(async () => {
    setMeError(false)
    try {
      const res = await supplierApi.get<{ data: Me }>('/api/supplier/me')
      setMe(res.data)
    } catch (err) {
      if (import.meta.env.DEV) console.error(err)
      setMeError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    try {
      const res = await supplierApi.get<{ data: { items: CatalogItem[] } }>('/api/supplier/products?limit=100')
      setCatalog(res.data.items ?? [])
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
  }, [])

  const loadSettlements = useCallback(async () => {
    try {
      const res = await supplierApi.get<{ data: { items: SettlementItem[] } }>('/api/supplier/settlements?limit=100')
      setSettlements(res.data.items ?? [])
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
  }, [])

  // 🏦 2026-06-09: 정산금 출금 신청 내역 + 실가용 잔액(available - reserved).
  const loadWithdrawals = useCallback(async () => {
    try {
      const res = await supplierApi.get<{ withdrawals: WithdrawalItem[]; spendable: number }>('/api/supplier/withdrawals')
      setWithdrawals(res.withdrawals ?? [])
      setSpendable(Number(res.spendable) || 0)
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
  }, [])

  // 🏭 Wave 3c: 매입 역발행 전자세금계산서(제조사→플랫폼) — 도매 주문 정산 시 자동발행.
  const loadTaxInvoices = useCallback(async () => {
    try {
      const res = await supplierApi.get<{ invoices: SupplierTaxInvoiceRow[] }>('/api/supplier/tax-invoices')
      setTaxInvoices(res.invoices ?? [])
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
  }, [])

  const loadOrders = useCallback(async () => {
    try {
      const res = await supplierApi.get<{ data: { items: OrderItem[] } }>(`/api/supplier/orders?status=${orderStatus}&limit=100`)
      setOrders(res.data.items ?? [])
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
  }, [orderStatus])

  // 발송 대기(to_ship) 건수만 별도 집계 — OrdersTab 가 to_ship 상태에서 onShip(운송장 입력) 을 노출하는 것과 동일 기준.
  const loadPendingShipCount = useCallback(async () => {
    try {
      const res = await supplierApi.get<{ data: { items: OrderItem[] } }>('/api/supplier/orders?status=to_ship&limit=100')
      setPendingShipCount((res.data.items ?? []).length)
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
  }, [])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const res = await supplierApi.get<{ data: AnalyticsData }>(`/api/supplier/analytics?period=${analyticsPeriod}`)
      setAnalytics(res.data)
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
    finally { setAnalyticsLoading(false) }
  }, [analyticsPeriod])

  useEffect(() => { loadMe() }, [loadMe])
  useEffect(() => { if (tab === 'catalog') loadCatalog() }, [tab, loadCatalog])
  useEffect(() => { if (tab === 'settlements') { loadSettlements(); loadAnalytics(); loadTaxInvoices(); loadWithdrawals() } }, [tab, loadSettlements, loadAnalytics, loadTaxInvoices, loadWithdrawals])
  useEffect(() => { if (tab === 'orders') loadOrders() }, [tab, loadOrders])
  useEffect(() => { if (tab === 'overview') loadPendingShipCount() }, [tab, loadPendingShipCount])

  const logout = () => {
    clearSupplierSession()
    navigate('/supplier/login', { replace: true })
  }

  const tabs: { key: Tab; label: string; Icon: typeof Wallet }[] = [
    { key: 'overview', label: t('supplier.tabHome', { defaultValue: '홈' }), Icon: Wallet },
    { key: 'catalog', label: t('supplier.tabProducts', { defaultValue: '상품' }), Icon: Package },
    { key: 'orders', label: t('supplier.tabOrdersShip', { defaultValue: '주문/발송' }), Icon: Truck },
    { key: 'settlements', label: t('supplier.tabSettlements', { defaultValue: '정산' }), Icon: Receipt },
    { key: 'chat', label: t('supplier.tabChat', { defaultValue: '채팅' }), Icon: MessageCircle },
  ]

  // 탭 → 사이드바 nav 항목. active = 현재 tab, onClick = setTab. 발송대기 배지는 주문, 안읽음 배지는 채팅 탭에.
  const navItems: WholesaleNavItem[] = tabs.map(({ key, label, Icon }) => ({
    key,
    label,
    icon: Icon,
    active: tab === key,
    onClick: () => setTab(key),
    badge: key === 'orders' ? pendingShipCount : key === 'chat' ? chatUnread : undefined,
  }))

  const activeTabLabel = tabs.find(tb => tb.key === tab)?.label ?? t('supplier.dashTitle', { defaultValue: '공급자 대시보드' })

  const headerRight = (
    <>
      <span className="text-sm text-gray-600 hidden sm:inline max-w-[160px] truncate">{me?.profile.business_name}</span>
      {/* 🔔 2026-06-12 (도매몰 감사 fix): supplier 알림 벨 — 출금 승인/반려·신규 도매주문. */}
      <NotificationsBell t={t} onNavigate={(link) => navigate(link)} />
      <button onClick={() => navigate('/supplier/wholesale-orders')} className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 font-medium">
        <Truck className="w-4 h-4" /> <span className="hidden sm:inline">{t('supplier.wholesaleOrders', { defaultValue: '도매 주문' })}</span>
      </button>
      <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">{t('supplier.logout', { defaultValue: '로그아웃' })}</span>
      </button>
    </>
  )

  return (
    <WholesaleDashboardShell
      brand={t('supplier.center', { defaultValue: '제조사 센터' })}
      roleIcon={Factory}
      brandSubtitle={me?.profile.business_name}
      navItems={navItems}
      title={activeTabLabel}
      headerRight={headerRight}
    >
      <SEO title={t('supplier.dashTitle', { defaultValue: '공급자 대시보드' }) + ' - 유어딜'} description="유어딜 도매 공급자 대시보드" url="/supplier" />

      {loading ? (
        <div className="py-20 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
      ) : tab === 'overview' ? (
        <OverviewTab me={me} meError={meError} onRetry={loadMe} t={t} onAdd={() => setShowAdd(true)} onGoTab={setTab} pendingShipCount={pendingShipCount} />
      ) : tab === 'orders' ? (
        <OrdersTab items={orders} t={t} status={orderStatus} setStatus={setOrderStatus} onShip={setShipModal} />
      ) : tab === 'catalog' ? (
        <CatalogTab items={catalog} t={t} onAdd={() => setShowAdd(true)} onBulkDone={() => { loadMe(); loadCatalog() }} onManageChannel={setChannelItem} onRequestPriceChange={setPriceChangeItem} onBulkPrice={() => setBulkPriceOpen(true)} />
      ) : tab === 'chat' ? (
        <Suspense fallback={<div className="py-20 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>}>
          {/* embedded — slide-in 없이 콘텐츠 채움. onClose 는 임베드에선 미사용. */}
          <WholesaleChatWidget embedded onClose={() => { /* embedded */ }} onUnreadChange={setChatUnread} />
        </Suspense>
      ) : (
        <div className="space-y-6">
          {/* 정산 탭 상단: 매출 추이 + 베스트셀러(분석 요약). 아래는 정산 내역 리스트. 한 스크롤. */}
          <AnalyticsTab data={analytics} loading={analyticsLoading} period={analyticsPeriod} setPeriod={setAnalyticsPeriod} t={t} />
          {/* 🏦 출금 신청 + 신청 내역 */}
          <WithdrawalSection
            spendable={spendable}
            items={withdrawals}
            t={t}
            onRequest={() => setShowWithdraw(true)}
          />
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">{t('supplier.settlementList', { defaultValue: '정산 내역' })}</p>
              <button
                onClick={() => downloadSupplierCsv('/api/supplier/settlements/export', `supplier-settlements-${new Date().toISOString().slice(0, 10)}.xlsx`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
              >
                <Download className="w-3.5 h-3.5" />
                {t('supplier.exportSettlements', { defaultValue: '엑셀 다운로드' })}
              </button>
            </div>
            <SettlementsTab items={settlements} t={t} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">{t('supplier.taxInvoiceList', { defaultValue: '세금계산서' })}</p>
            <p className="text-xs text-gray-500 mb-3">{t('supplier.taxInvoiceDesc', { defaultValue: '도매 주문 정산 시 자동 발행되는 매입 역발행 세금계산서예요.' })}</p>
            <SupplierTaxInvoicesTab items={taxInvoices} t={t} />
          </div>
        </div>
      )}

      {shipModal && (
        <ShipModal
          t={t}
          order={shipModal}
          onClose={() => setShipModal(null)}
          onShipped={() => { setShipModal(null); loadOrders() }}
        />
      )}

      {showWithdraw && (
        <WithdrawModal
          t={t}
          spendable={spendable}
          onClose={() => setShowWithdraw(false)}
          onDone={() => { setShowWithdraw(false); loadWithdrawals(); loadMe() }}
        />
      )}

      {showAdd && (
        <AddProductModal
          t={t}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); loadMe(); if (tab === 'catalog') loadCatalog() }}
        />
      )}
      {bulkPriceOpen && (
        <BulkPriceModal
          t={t}
          items={catalog.filter(i => i.approval_status === 'approved')}
          onClose={() => setBulkPriceOpen(false)}
          onDone={() => { setBulkPriceOpen(false); loadCatalog() }}
        />
      )}
      {channelItem && <ChannelModal t={t} item={channelItem} onClose={() => setChannelItem(null)} />}
      {priceChangeItem && (
        <PriceChangeModal
          t={t}
          item={priceChangeItem}
          onClose={() => setPriceChangeItem(null)}
          onDone={() => { setPriceChangeItem(null); loadCatalog() }}
        />
      )}
    </WholesaleDashboardShell>
  )
}
