/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 대시보드.
 *   탭: 개요(잔고/카운트) · 카탈로그(내 공급상품 + 등록) · 정산(매출 내역).
 *   self-guard: supplier_token 없으면 /supplier/login.
 *   라이트 테마 (대시보드 계열) + i18n.
 */
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, Wallet, Receipt, Plus, LogOut, Clock, CheckCircle, XCircle, X, Truck, Tag, ShieldCheck, BarChart3, AlertTriangle, Upload, ChevronRight, MessageCircle, Loader2, Download } from 'lucide-react'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatWon, formatNumber } from '@/utils/format'
import { supplierApi, isSupplierLoggedIn, clearSupplierSession, getSupplierToken } from '@/lib/supplier-api'
import { WHOLESALE_CATEGORIES } from './wholesale/wholesale-theme'
import WholesaleDashboardShell, { type WholesaleNavItem } from '@/components/wholesale/WholesaleDashboardShell'
// 🏭 2026-06-09 Wave 4b: 채팅 — adaptive 폴링(배지) + lazy 위젯(탭 열 때만 chunk fetch).
import { useChatPoll } from '@/hooks/useChatPoll'
import { wholesaleChatApi, hasChatToken } from '@/hooks/queries/useWholesaleChat'
const WholesaleChatWidget = lazy(() => import('./wholesale/WholesaleChatWidget'))

// 인증 헤더로 CSV 다운로드 → blob 저장 (anchor href 는 토큰 미첨부라 fetch 사용).
async function downloadSupplierCsv(path: string, filename: string) {
  const token = getSupplierToken()
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { toast.error('다운로드 실패'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

type Tab = 'overview' | 'catalog' | 'orders' | 'settlements' | 'chat'

interface Me {
  profile: { business_name: string; email: string; status: string }
  balance: { pending_amount: number; available_amount: number; paid_amount: number }
  product_counts: { total: number; pending: number; approved: number; rejected: number }
}
interface CatalogItem {
  id: number; name: string; retail_price: number; supply_price: number; stock: number
  category: string | null; approval_status: string; admin_memo: string | null; created_at: string
  supply_visibility?: string; barcode?: string | null; is_brand_product?: number; brand_name?: string | null
  lowest_price_url?: string | null; lowest_price_checked?: number
  pending_supply_price?: number | null; pending_retail_price?: number | null
  pending_price_reason?: string | null
}
interface SettlementItem {
  id: number; order_id: number | null; product_id: number | null; product_name: string | null
  retail_amount: number; supply_amount: number; status: string; created_at: string; available_at: string | null
}
// 🏦 2026-06-09: 정산금 출금 신청.
interface WithdrawalItem {
  id: number; amount: number; status: 'requested' | 'approved' | 'paid' | 'rejected'
  bank_name: string | null; bank_account: string | null; account_holder: string | null
  admin_memo: string | null; requested_at: string; processed_at: string | null
}
// 🏭 Wave 3c: 매입 역발행 전자세금계산서(제조사→플랫폼).
interface SupplierTaxInvoiceRow {
  id: number; order_id: number; supply_amount: number; vat_amount: number; total_amount: number
  status: string; provider_ref: string | null; issued_at: string | null; created_at: string
}
type AnalyticsPeriod = '30d' | '90d' | '12m'
interface AnalyticsData {
  period: AnalyticsPeriod
  granularity: 'daily' | 'monthly'
  series: { bucket: string; revenue: number; orders: number }[]
  summary: {
    total_revenue: number; order_count: number; avg_order_value: number
    settle_pending: number; settle_available: number; settle_paid: number
  }
  best_sellers: { product_id: number; name: string; image_url: string | null; revenue: number; orders: number }[]
  stock: { total: number; out_of_stock: number; low_stock: number }
}
interface OrderItem {
  order_id: number; order_number: string | null; status: string; created_at: string
  shipping_name: string | null; shipping_phone: string | null; shipping_address: string | null
  recipient_name: string | null; recipient_phone: string | null
  courier: string | null; tracking_number: string | null; shipped_at: string | null
  line_count: number; total_qty: number; item_names: string | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: '승인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  approved: { label: '승인됨', cls: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle },
  rejected: { label: '거부됨', cls: 'bg-red-50 text-red-700 border-red-200', Icon: XCircle },
}
const SETTLE_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: '정산 대기', cls: 'bg-amber-50 text-amber-700' },
  available: { label: '출금 가능', cls: 'bg-blue-50 text-blue-700' },
  paid: { label: '지급 완료', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: '취소(환불)', cls: 'bg-gray-100 text-gray-500' },
}

export default function SupplierDashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
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
      brand={t('supplier.studio', { defaultValue: 'SUPPLIER' })}
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

// 🏭 2026-06-07 (사용자 요청): 판매중(승인) 상품 가격 수정 요청 — 운영진 승인 후 반영.
//   승인 전까지 기존 노출 가격 유지. 온라인 최저가 참고 링크 함께 제출.
function PriceChangeModal({ t, item, onClose, onDone }: {
  t: (k: string, o?: Record<string, unknown>) => string
  item: CatalogItem
  onClose: () => void
  onDone: () => void
}) {
  const [supply, setSupply] = useState(String(item.supply_price || ''))
  const [retail, setRetail] = useState(String(item.retail_price || ''))
  const [lpUrl, setLpUrl] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const newSupply = Number(supply)
    const newRetail = Number(retail || supply)
    if (!Number.isFinite(newSupply) || newSupply <= 0) { setError(t('supplier.errSupply', { defaultValue: '공급가를 올바르게 입력해주세요' })); return }
    if (newRetail < newSupply) { setError(t('supplier.errRetail', { defaultValue: '권장 소비자가는 공급가 이상이어야 합니다' })); return }
    setSaving(true)
    try {
      await supplierApi.post(`/api/supplier/products/${item.id}/price-change-request`, {
        new_supply_price: newSupply,
        new_retail_price: newRetail,
        lowest_price_url: lpUrl.trim() || undefined,
        reason: reason.trim() || undefined,
      })
      toast.success(t('supplier.priceReqOk', { defaultValue: '가격 수정 요청이 접수되었습니다. 운영진 승인 후 반영됩니다.' }))
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.priceChangeTitle', { defaultValue: '가격 수정 요청' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{item.name} · {t('supplier.priceChangeHint', { defaultValue: '판매 중인 상품의 가격은 운영진 승인 후 반영됩니다. 승인 전까지 기존 가격이 유지됩니다.' })}</p>
        {item.pending_supply_price != null && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            {t('supplier.priceChangePending', { defaultValue: '이미 승인 대기 중인 변경 요청이 있습니다. 새로 제출하면 덮어씁니다.' })}
            （{formatWon(item.pending_supply_price)}）
          </div>
        )}
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldSupplyPrice', { defaultValue: '공급가(원)' })} <span className="text-red-500">*</span></label>
              <input required type="number" min={1} disabled={saving} value={supply} onChange={e => setSupply(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldRetail', { defaultValue: '권장 소비자가(원)' })}</label>
              <input type="number" min={0} disabled={saving} value={retail} onChange={e => setRetail(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('supplier.fieldLowestUrl', { defaultValue: '온라인 최저가 참고 링크' })}</label>
            <input disabled={saving} value={lpUrl} onChange={e => setLpUrl(e.target.value)} className={inputCls} placeholder="https://search.shopping.naver.com/..." />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.lowestUrlHint', { defaultValue: '네이버쇼핑 등 온라인 최저가를 확인할 수 있는 링크 (검수용).' })}</p>
          </div>
          <div>
            <label className={labelCls}>{t('supplier.fieldReason', { defaultValue: '변경 사유 (선택)' })}</label>
            <textarea disabled={saving} value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputCls} placeholder={t('supplier.reasonPh', { defaultValue: '예: 원자재 가격 인상 반영' })} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.submitPriceChange', { defaultValue: '가격 수정 요청' })}
          </button>
        </form>
      </div>
    </div>
  )
}

// 제조사 자가관리 — '승인한 유통채널' 상품의 허용 유통사 추가/해제.
function ChannelModal({ t, item, onClose }: { t: (k: string, o?: Record<string, unknown>) => string; item: CatalogItem; onClose: () => void }) {
  const [list, setList] = useState<Array<{ id: number; distributor_seller_id: number; business_name: string | null; seller_name: string | null; username: string | null; distributor_grade: string | null }>>([])
  const [sellerId, setSellerId] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    supplierApi.get<{ distributors: typeof list }>(`/api/supplier/products/${item.id}/channel-access`)
      .then(r => setList(r.distributors || [])).catch(() => { /* ignore */ })
  }, [item.id])
  useEffect(() => { load() }, [load])
  const add = async () => {
    const dsid = Number(sellerId)
    if (!Number.isFinite(dsid) || dsid <= 0) { toast.error('유통사 ID를 입력하세요'); return }
    setBusy(true)
    try { await supplierApi.post(`/api/supplier/products/${item.id}/channel-access`, { distributor_seller_id: dsid }); setSellerId(''); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : '승인 실패') } finally { setBusy(false) }
  }
  const remove = async (accessId: number) => {
    try { await supplierApi.delete(`/api/supplier/products/${item.id}/channel-access/${accessId}`); load() } catch { toast.error('해제 실패') }
  }
  const inputCls = 'flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.manageChannel', { defaultValue: '승인 유통사 관리' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{item.name} · {t('supplier.channelHint', { defaultValue: '승인한 유통사에게만 이 상품이 노출·주문됩니다.' })}</p>
        <div className="flex gap-2 mb-4">
          <input value={sellerId} onChange={e => setSellerId(e.target.value)} type="number" placeholder={t('supplier.distributorId', { defaultValue: '유통사 ID' })} className={inputCls} />
          <button onClick={add} disabled={busy} className="px-4 py-2 bg-[#FF0033] text-white rounded-lg text-sm font-semibold disabled:opacity-60">{t('common.add', { defaultValue: '추가' })}</button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('supplier.noChannel', { defaultValue: '승인된 유통사가 없습니다.' })}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map(d => (
              <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-700">{d.business_name || d.seller_name || `#${d.distributor_seller_id}`} <span className="text-gray-400 text-xs">{d.distributor_grade || 'C'}</span></span>
                <button onClick={() => remove(d.id)} className="text-gray-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// 🏭 BIZ-6 (2026-06-08): 분석 탭 — 매출 시계열(CSS 막대) + 요약 카드 + 베스트셀러 + 재고 경고.
//   차트 라이브러리 미사용(critical path 보호) — inline CSS bar.
//   매출은 net(환불 클로백 음수 포함) 집계 — 서버 응답 그대로 표시.
function AnalyticsTab({ data, loading, period, setPeriod, t }: {
  data: AnalyticsData | null
  loading: boolean
  period: AnalyticsPeriod
  setPeriod: (p: AnalyticsPeriod) => void
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const periods: { key: AnalyticsPeriod; label: string }[] = [
    { key: '30d', label: t('supplier.period30d', { defaultValue: '최근 30일' }) },
    { key: '90d', label: t('supplier.period90d', { defaultValue: '최근 90일' }) },
    { key: '12m', label: t('supplier.period12m', { defaultValue: '최근 12개월' }) },
  ]
  const s = data?.summary
  const maxRev = Math.max(1, ...((data?.series || []).map(p => Math.abs(p.revenue))))

  const cards = [
    { label: t('supplier.aTotalRevenue', { defaultValue: '총 매출(기간)' }), value: formatWon(s?.total_revenue ?? 0), cls: 'text-gray-900' },
    { label: t('supplier.aOrderCount', { defaultValue: '주문 수' }), value: formatNumber(s?.order_count ?? 0), cls: 'text-gray-900' },
    { label: t('supplier.aAvgOrder', { defaultValue: '객단가' }), value: formatWon(s?.avg_order_value ?? 0), cls: 'text-gray-900' },
    { label: t('supplier.aSettlePending', { defaultValue: '정산 대기' }), value: formatWon(s?.settle_pending ?? 0), cls: 'text-amber-600' },
    { label: t('supplier.aSettleAvailable', { defaultValue: '출금 가능' }), value: formatWon(s?.settle_available ?? 0), cls: 'text-blue-600' },
    { label: t('supplier.aSettlePaid', { defaultValue: '지급 완료(누적)' }), value: formatWon(s?.settle_paid ?? 0), cls: 'text-green-600' },
  ]

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 w-fit">
        {periods.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-[#FF0033] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="py-16 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-lg lg:text-xl font-bold ${c.cls}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* 재고 경고 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{t('supplier.aStockTotal', { defaultValue: '공급상품' })}</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(data?.stock.total ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1 justify-center"><XCircle className="w-3 h-3 text-red-500" />{t('supplier.aStockOut', { defaultValue: '품절' })}</p>
              <p className="text-xl font-bold text-red-500">{formatNumber(data?.stock.out_of_stock ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1 justify-center"><AlertTriangle className="w-3 h-3 text-amber-500" />{t('supplier.aStockLow', { defaultValue: '저재고' })}</p>
              <p className="text-xl font-bold text-amber-600">{formatNumber(data?.stock.low_stock ?? 0)}</p>
            </div>
          </div>

          {/* 매출 시계열 (CSS 막대) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4 inline-flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-[#FF0033]" />{t('supplier.aRevenueTrend', { defaultValue: '매출 추이' })}</p>
            {(data?.series || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">{t('supplier.aNoData', { defaultValue: '해당 기간 매출 데이터가 없습니다.' })}</p>
            ) : (
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-1" role="img" aria-label={t('supplier.aRevenueTrend', { defaultValue: '매출 추이' })}>
                {(data?.series || []).map(p => {
                  const h = Math.max(2, Math.round((Math.abs(p.revenue) / maxRev) * 100))
                  const neg = p.revenue < 0
                  return (
                    <div key={p.bucket} className="flex-1 min-w-[8px] flex flex-col items-center justify-end h-full group relative">
                      <div className={`w-full rounded-t ${neg ? 'bg-red-300' : 'bg-[#FF0033]/70'} group-hover:bg-[#FF0033] transition-colors`} style={{ height: `${h}%` }} />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-[10px] rounded px-1.5 py-1 z-10">
                        {p.bucket}<br />{formatWon(p.revenue)} · {formatNumber(p.orders)}{t('supplier.aOrdersUnit', { defaultValue: '건' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2">
              {data?.granularity === 'monthly'
                ? t('supplier.aMonthly', { defaultValue: '월별 순매출 (환불 반영)' })
                : t('supplier.aDaily', { defaultValue: '일별 순매출 (환불 반영)' })}
            </p>
          </div>

          {/* 베스트셀러 top 10 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">{t('supplier.aBestSellers', { defaultValue: '베스트셀러 TOP 10' })}</p>
            {(data?.best_sellers || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('supplier.aNoBest', { defaultValue: '판매 데이터가 없습니다.' })}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(data?.best_sellers || []).map((b, i) => (
                  <li key={b.product_id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 text-center text-sm font-bold text-gray-400 shrink-0">{i + 1}</span>
                    {b.image_url
                      ? <img src={b.image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" />
                      : <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center"><Package className="w-4 h-4 text-gray-300" /></div>}
                    <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">{b.name}</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatWon(b.revenue)}</p>
                      <p className="text-[11px] text-gray-400">{formatNumber(b.orders)}{t('supplier.aOrdersUnit', { defaultValue: '건' })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// 🏭 BIZ-6 (2026-06-08): 가격 일괄변경 — 승인(판매중) 상품을 선택해 새 공급가/권장가를 일괄 제출.
//   라이브 가격은 직접 안 바뀜 — 어드민 승인 큐(pending_*)에 적재. 승인 전까지 기존 가격 유지.
function BulkPriceModal({ t, items, onClose, onDone }: {
  t: (k: string, o?: Record<string, unknown>) => string
  items: CatalogItem[]
  onClose: () => void
  onDone: () => void
}) {
  // 선택된 상품의 새 가격 입력값. 기본값은 기존 가격으로 프리필.
  const [edits, setEdits] = useState<Record<number, { selected: boolean; supply: string; retail: string }>>(() => {
    const init: Record<number, { selected: boolean; supply: string; retail: string }> = {}
    for (const it of items) init[it.id] = { selected: false, supply: String(it.supply_price || ''), retail: String(it.retail_price || '') }
    return init
  })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: number) => setEdits(e => ({ ...e, [id]: { ...e[id], selected: !e[id].selected } }))
  const setSupply = (id: number, v: string) => setEdits(e => ({ ...e, [id]: { ...e[id], supply: v } }))
  const setRetail = (id: number, v: string) => setEdits(e => ({ ...e, [id]: { ...e[id], retail: v } }))
  const selectedCount = Object.values(edits).filter(e => e.selected).length

  const submit = async () => {
    setError('')
    const payload: { product_id: number; supply_price: number; retail_price?: number; reason?: string }[] = []
    for (const it of items) {
      const e = edits[it.id]
      if (!e?.selected) continue
      const supply = Number(e.supply)
      if (!Number.isFinite(supply) || supply <= 0) { setError(t('supplier.bulkErrSupply', { defaultValue: '선택한 상품의 공급가를 올바르게 입력해주세요' })); return }
      const retailNum = Number(e.retail)
      const item: { product_id: number; supply_price: number; retail_price?: number; reason?: string } = { product_id: it.id, supply_price: supply }
      if (e.retail !== '' && Number.isFinite(retailNum)) {
        if (retailNum < supply) { setError(t('supplier.bulkErrRetail', { defaultValue: '권장 소비자가는 공급가 이상이어야 합니다' })); return }
        item.retail_price = retailNum
      }
      if (reason.trim()) item.reason = reason.trim()
      payload.push(item)
    }
    if (payload.length === 0) { setError(t('supplier.bulkErrNone', { defaultValue: '변경할 상품을 선택해주세요' })); return }
    setSaving(true)
    try {
      const res = await supplierApi.post<{ summary?: { queued: number; skipped: number } }>('/api/supplier/products/bulk-price-change', { items: payload })
      const sm = res.summary
      toast.success(t('supplier.bulkPriceDone', { defaultValue: '{{q}}건 접수, {{s}}건 제외', q: sm?.queued ?? 0, s: sm?.skipped ?? 0 })
        .replace('{{q}}', String(sm?.queued ?? 0)).replace('{{s}}', String(sm?.skipped ?? 0)))
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const cellCls = "w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.bulkPriceChange', { defaultValue: '가격 일괄변경' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t('supplier.bulkPriceHint', { defaultValue: '판매 중(승인) 상품만 변경할 수 있습니다. 운영진 승인 후 반영되며, 승인 전까지 기존 가격이 유지됩니다.' })}</p>
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">{t('supplier.bulkNoApproved', { defaultValue: '가격 변경 가능한 승인 상품이 없습니다.' })}</p>
        ) : (
          <>
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    <th className="text-left font-medium px-2 py-2">{t('supplier.colProduct', { defaultValue: '상품' })}</th>
                    <th className="text-right font-medium px-2 py-2">{t('supplier.fieldSupplyPrice', { defaultValue: '공급가(원)' })}</th>
                    <th className="text-right font-medium px-2 py-2">{t('supplier.fieldRetail', { defaultValue: '권장가(원)' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(it => {
                    const e = edits[it.id]
                    return (
                      <tr key={it.id} className={e?.selected ? 'bg-[#FF0033]/5' : ''}>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={!!e?.selected} onChange={() => toggle(it.id)} disabled={saving} className="w-4 h-4" />
                        </td>
                        <td className="px-2 py-2 text-gray-900 truncate max-w-[180px]">{it.name}</td>
                        <td className="px-2 py-2 text-right">
                          <input type="number" min={1} value={e?.supply ?? ''} disabled={saving || !e?.selected}
                            onChange={ev => setSupply(it.id, ev.target.value)} className={`${cellCls} text-right disabled:bg-gray-50 disabled:text-gray-400`} />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input type="number" min={0} value={e?.retail ?? ''} disabled={saving || !e?.selected}
                            onChange={ev => setRetail(it.id, ev.target.value)} className={`${cellCls} text-right disabled:bg-gray-50 disabled:text-gray-400`} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('supplier.fieldReason', { defaultValue: '변경 사유 (선택)' })}</label>
              <input value={reason} onChange={e => setReason(e.target.value)} disabled={saving}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
                placeholder={t('supplier.reasonPh', { defaultValue: '예: 원자재 가격 인상 반영' })} />
            </div>
            <button onClick={submit} disabled={saving || selectedCount === 0}
              className="w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60">
              {saving
                ? t('common.loading', { defaultValue: '처리 중...' })
                : t('supplier.submitBulkPrice', { defaultValue: '{{n}}개 가격 변경 요청', n: selectedCount }).replace('{{n}}', String(selectedCount))}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function OverviewTab({ me, meError, onRetry, t, onAdd, onGoTab, pendingShipCount }: { me: Me | null; meError: boolean; onRetry: () => void; t: (k: string, o?: Record<string, unknown>) => string; onAdd: () => void; onGoTab: (tab: Tab) => void; pendingShipCount: number }) {
  if (meError) return (
    <div className="py-16 text-center">
      <p className="text-sm text-gray-500 mb-3">{t('supplier.meLoadFailed', { defaultValue: '데이터를 불러오지 못했어요.' })}</p>
      <button onClick={onRetry} className="px-4 py-2 bg-[#FF0033] text-white rounded-xl text-sm font-semibold">{t('common.retry', { defaultValue: '다시 시도' })}</button>
    </div>
  )
  if (!me) return (
    <div className="py-16 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
  )
  const b = me.balance
  const c = me.product_counts
  const approved = me.profile.status === 'approved'
  const noProducts = (c.total ?? 0) === 0
  const shipN = formatNumber(pendingShipCount)
  const rejectedN = formatNumber(c.rejected ?? 0)
  const pendingN = formatNumber(c.pending ?? 0)
  // '할 일' 카드 — 가용 데이터로 actionable. 발송 대기(primary) > 반려 > 검수 대기 순.
  const todos: { key: string; label: string; count: string; Icon: typeof Package; on: () => void; tone: 'danger' | 'info' }[] = []
  if ((pendingShipCount ?? 0) > 0) todos.push({ key: 'ship', label: t('supplier.todoShip', { defaultValue: '발송 대기 {{n}}건', n: shipN }).replace('{{n}}', shipN), count: shipN, Icon: Truck, on: () => onGoTab('orders'), tone: 'danger' })
  if ((c.rejected ?? 0) > 0) todos.push({ key: 'rejected', label: t('supplier.todoRejected', { defaultValue: '반려된 상품 {{n}}건 · 수정 후 재등록', n: rejectedN }).replace('{{n}}', rejectedN), count: rejectedN, Icon: XCircle, on: () => onGoTab('catalog'), tone: 'danger' })
  if ((c.pending ?? 0) > 0) todos.push({ key: 'pending', label: t('supplier.todoPending', { defaultValue: '검수 대기 {{n}}건 (관리자 승인 중)', n: pendingN }).replace('{{n}}', pendingN), count: pendingN, Icon: Clock, on: () => onGoTab('catalog'), tone: 'info' })
  const cards = [
    { label: t('supplier.balPending', { defaultValue: '정산 대기' }), value: b.pending_amount, cls: 'text-amber-600' },
    { label: t('supplier.balAvailable', { defaultValue: '출금 가능' }), value: b.available_amount, cls: 'text-blue-600' },
    { label: t('supplier.balPaid', { defaultValue: '지급 완료(누적)' }), value: b.paid_amount, cls: 'text-green-600' },
  ]
  const actions: { label: string; desc: string; Icon: typeof Package; on: () => void; primary?: boolean; disabled?: boolean }[] = [
    { label: t('supplier.qaAddProduct', { defaultValue: '상품 등록' }), desc: t('supplier.qaAddProductDesc', { defaultValue: '도매몰에 올릴 공급상품' }), Icon: Plus, on: onAdd, primary: true, disabled: !approved },
    { label: t('supplier.qaBulk', { defaultValue: '대량 등록' }), desc: t('supplier.qaBulkDesc', { defaultValue: 'CSV로 한번에' }), Icon: Upload, on: () => onGoTab('catalog'), disabled: !approved },
    { label: t('supplier.qaCatalog', { defaultValue: '내 카탈로그' }), desc: t('supplier.qaCatalogDesc', { defaultValue: '등록 상품 관리' }), Icon: Package, on: () => onGoTab('catalog') },
    { label: t('supplier.qaShip', { defaultValue: '발송 관리' }), desc: t('supplier.qaShipDesc', { defaultValue: '주문 송장 입력' }), Icon: Truck, on: () => onGoTab('orders') },
    { label: t('supplier.qaSettle', { defaultValue: '정산 내역' }), desc: t('supplier.qaSettleDesc', { defaultValue: '매출·지급 내역' }), Icon: Receipt, on: () => onGoTab('settlements') },
    { label: t('supplier.qaSalesSettle', { defaultValue: '매출·정산' }), desc: t('supplier.qaSalesSettleDesc', { defaultValue: '추이·베스트셀러' }), Icon: BarChart3, on: () => onGoTab('settlements') },
  ]
  return (
    <div className="space-y-6">
      {/* 승인 상태 */}
      {!approved ? (
        <div className="px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">{t('supplier.pendingTitle', { defaultValue: '승인 대기 중' })}</p>
            <p className="text-xs text-amber-700 mt-0.5">{t('supplier.pendingDesc', { defaultValue: '관리자 승인 후 상품 등록·정산이 활성화됩니다. 보통 1영업일 이내 처리돼요.' })}</p>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3.5 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-semibold text-green-800">{t('supplier.approvedDesc', { defaultValue: '승인 완료 — 등록한 상품은 검수 후 전국 유통사에게 노출됩니다.' })}</p>
        </div>
      )}

      {/* 빈 상태 히어로 or 상단 등록 CTA */}
      {approved && noProducts ? (
        <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#FF0033,#FF4D77)' }}>
          <h3 className="text-lg font-bold">{t('supplier.emptyHeroTitle', { defaultValue: '첫 공급상품을 등록하세요' })}</h3>
          <p className="text-sm text-white/85 mt-1 mb-4">{t('supplier.emptyHeroDesc', { defaultValue: '등록 → 관리자 검수 → 도매몰 노출. 전국 유통사가 내 등급 공급가로 사입합니다.' })}</p>
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-[#FF0033] font-bold text-sm">
            <Plus className="w-4 h-4" /> {t('supplier.addProductBtn', { defaultValue: '상품 등록하기' })}
          </button>
        </div>
      ) : approved ? (
        <button onClick={onAdd} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-[#FF0033] text-white font-bold text-sm">
          <Plus className="w-4 h-4" /> {t('supplier.addProductNew', { defaultValue: '새 상품 등록' })}
        </button>
      ) : null}

      {/* 할 일 — actionable. 발송 대기 / 반려 / 검수 대기. 빈 상태 히어로(첫 상품 등록)는 위에서 별도 처리. */}
      {approved && !noProducts && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-3">{t('supplier.todoTitle', { defaultValue: '할 일' })}</p>
          {todos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-4 flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              {t('supplier.todoClear', { defaultValue: '✓ 처리할 일이 없어요' })}
            </div>
          ) : (
            <div className="space-y-2">
              {todos.map(td => (
                <button key={td.key} onClick={td.on}
                  className={`w-full text-left rounded-2xl border px-4 py-3.5 flex items-center gap-3 transition-colors ${td.tone === 'danger' ? 'border-amber-200 bg-amber-50 hover:bg-amber-100' : 'border-blue-200 bg-blue-50 hover:bg-blue-100'}`}>
                  <td.Icon className={`w-5 h-5 shrink-0 ${td.tone === 'danger' ? 'text-amber-600' : 'text-blue-600'}`} />
                  <p className={`flex-1 min-w-0 text-sm font-semibold ${td.tone === 'danger' ? 'text-amber-900' : 'text-blue-900'}`}>{td.label}</p>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${td.tone === 'danger' ? 'text-amber-500' : 'text-blue-500'}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 빠른 작업 */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">{t('supplier.quickActions', { defaultValue: '빠른 작업' })}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {actions.map(a => (
            <button key={a.label} onClick={a.disabled ? undefined : a.on} disabled={a.disabled}
              className={`text-left rounded-2xl border p-4 transition-colors ${a.disabled ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed' : a.primary ? 'border-[#FF0033]/30 bg-[#FF0033]/5 hover:bg-[#FF0033]/10' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <a.Icon className={`w-5 h-5 mb-2 ${a.primary ? 'text-[#FF0033]' : 'text-gray-500'}`} />
              <p className="text-sm font-bold text-gray-900">{a.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 정산 요약 */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">{t('supplier.settleSummary', { defaultValue: '정산 요약' })}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-2xl font-bold ${card.cls}`}>{formatWon(card.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 공급상품 현황 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-900">{t('supplier.productSummary', { defaultValue: '공급상품 현황' })}</p>
          <button onClick={() => onGoTab('catalog')} className="text-xs font-bold text-[#FF0033]">{t('supplier.viewAll', { defaultValue: '전체 보기 →' })}</button>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: t('supplier.cntTotal', { defaultValue: '전체' }), v: c.total, cls: 'text-gray-900' },
            { label: t('supplier.cntPending', { defaultValue: '대기' }), v: c.pending, cls: 'text-amber-600' },
            { label: t('supplier.cntApproved', { defaultValue: '승인' }), v: c.approved, cls: 'text-green-600' },
            { label: t('supplier.cntRejected', { defaultValue: '거부' }), v: c.rejected, cls: 'text-red-500' },
          ].map(x => (
            <div key={x.label}>
              <p className={`text-xl font-bold ${x.cls}`}>{x.v}</p>
              <p className="text-xs text-gray-500 mt-0.5">{x.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 🚚 배송/주문 정책 — 제조사별 최소주문금액 + 배송비 + 무료배송 기준 */}
      <ShippingPolicyCard t={t} />
    </div>
  )
}

// ── 🚚 2026-06-09 배송/주문 정책 설정 카드 (self-contained 로드/저장) ──────────────
//   min_order_amount(최소주문금액) / shipping_fee(배송비) / free_ship_threshold(무료배송 기준).
//   유통사 장바구니에서 이 제조사 라인 합이 최소주문금액 미만이면 주문 불가 + 배송비 자동 합산.
function ShippingPolicyCard({ t }: { t: (k: string, o?: Record<string, unknown>) => string }) {
  const [minOrder, setMinOrder] = useState('')
  const [shipFee, setShipFee] = useState('')
  const [freeShip, setFreeShip] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    supplierApi.get<{ data: { min_order_amount: number; shipping_fee: number; free_ship_threshold: number } }>('/api/supplier/shipping-policy')
      .then(r => {
        if (!alive) return
        setMinOrder(String(r.data?.min_order_amount ?? 0))
        setShipFee(String(r.data?.shipping_fee ?? 0))
        setFreeShip(String(r.data?.free_ship_threshold ?? 0))
      })
      .catch(err => { if (import.meta.env.DEV) console.error(err) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const save = async () => {
    const toNum = (v: string) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0 }
    setSaving(true)
    try {
      await supplierApi.patch('/api/supplier/shipping-policy', {
        min_order_amount: toNum(minOrder),
        shipping_fee: toNum(shipFee),
        free_ship_threshold: toNum(freeShip),
      })
      toast.success(t('supplier.shipPolicySaved', { defaultValue: '배송 정책이 저장되었습니다' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('supplier.shipPolicySaveErr', { defaultValue: '저장에 실패했습니다' }))
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Truck className="w-4 h-4 text-[#FF0033]" />
        <p className="text-sm font-semibold text-gray-900">{t('supplier.shipPolicyTitle', { defaultValue: '배송/주문 정책' })}</p>
      </div>
      <p className="text-xs text-gray-500 mb-4">{t('supplier.shipPolicyDesc', { defaultValue: '유통사 장바구니에서 우리 상품 합계가 최소주문금액 미만이면 주문할 수 없어요. 배송비는 주문 시 자동 합산됩니다. (0 = 제한/배송비/무료배송 없음)' })}</p>
      {loading ? (
        <div className="py-6 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.minOrderAmount', { defaultValue: '최소 주문 금액(원)' })}</label>
              <input type="number" min={0} value={minOrder} disabled={saving} onChange={e => setMinOrder(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.shippingFee', { defaultValue: '배송비(원)' })}</label>
              <input type="number" min={0} value={shipFee} disabled={saving} onChange={e => setShipFee(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.freeShipThreshold', { defaultValue: '무료배송 기준(원)' })}</label>
              <input type="number" min={0} value={freeShip} disabled={saving} onChange={e => setFreeShip(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>
          <button onClick={save} disabled={saving} className="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60">
            {saving ? t('common.loading', { defaultValue: '저장 중...' }) : t('supplier.savePolicy', { defaultValue: '정책 저장' })}
          </button>
        </>
      )}
    </div>
  )
}

function CatalogTab({ items, t, onAdd, onBulkDone, onManageChannel, onRequestPriceChange, onBulkPrice }: { items: CatalogItem[]; t: (k: string, o?: Record<string, unknown>) => string; onAdd: () => void; onBulkDone: () => void; onManageChannel: (item: CatalogItem) => void; onRequestPriceChange: (item: CatalogItem) => void; onBulkPrice: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [stockImporting, setStockImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const stockFileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const csv = await file.text()
      const res = await supplierApi.post<{ summary?: { created: number; failed: number } }>('/api/supplier/products/bulk', { csv })
      const s = res.summary
      toast.success(t('supplier.bulkDone', { defaultValue: '{{c}}건 등록, {{f}}건 실패', c: s?.created ?? 0, f: s?.failed ?? 0 })
        .replace('{{c}}', String(s?.created ?? 0)).replace('{{f}}', String(s?.failed ?? 0)))
      onBulkDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '대량 등록 실패')
    } finally { setUploading(false) }
  }

  // 재고 CSV 가져오기 (바코드,재고) — 즉시 반영(재고는 승인 대상 아님).
  const onStockFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStockImporting(true)
    try {
      const csv = await file.text()
      const res = await supplierApi.post<{ summary?: { updated: number; skipped: number } }>('/api/supplier/products/stock-import', { csv })
      const s = res.summary
      toast.success(t('supplier.stockImportDone', { defaultValue: '{{u}}건 반영, {{s}}건 건너뜀', u: s?.updated ?? 0, s: s?.skipped ?? 0 })
        .replace('{{u}}', String(s?.updated ?? 0)).replace('{{s}}', String(s?.skipped ?? 0)))
      onBulkDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재고 가져오기 실패')
    } finally { setStockImporting(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-600">{t('supplier.catalogCount', { defaultValue: '총 {{n}}개', n: items.length }).replace('{{n}}', String(items.length))}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onBulkPrice}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
            <Tag className="w-4 h-4" /> {t('supplier.bulkPriceChange', { defaultValue: '가격 일괄변경' })}
          </button>
          <button onClick={() => stockFileRef.current?.click()} disabled={stockImporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
            <Upload className="w-4 h-4" /> {stockImporting ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.stockImport', { defaultValue: '재고 CSV 가져오기' })}
          </button>
          <input ref={stockFileRef} type="file" accept=".csv,text/csv" hidden onChange={onStockFile} />
          <button onClick={() => downloadSupplierCsv('/api/supplier/products/bulk-template', 'supply-products-template.csv')}
            className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
            {t('supplier.dlTemplate', { defaultValue: '양식 다운' })}
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
            {uploading ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.bulkUpload', { defaultValue: '대량 등록(CSV)' })}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
          <button onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF0033] text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> {t('supplier.addProduct', { defaultValue: '공급상품 등록' })}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">{t('supplier.stockImportHint', { defaultValue: '재고 CSV: 헤더 "바코드,재고" — 바코드로 내 공급상품을 매칭해 재고를 즉시 반영합니다.' })}</p>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
          {t('supplier.noProducts', { defaultValue: '등록된 공급상품이 없습니다. 첫 상품을 등록해보세요.' })}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const badge = STATUS_BADGE[item.approval_status] || STATUS_BADGE.pending
            const Icon = badge.Icon
            const margin = item.retail_price - item.supply_price
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge.cls}`}>
                      <Icon className="w-3 h-3" /> {t(`supplier.status_${item.approval_status}`, { defaultValue: badge.label })}
                    </span>
                    {item.lowest_price_checked === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-medium">
                        <ShieldCheck className="w-3 h-3" /> {t('supplier.lowestChecked', { defaultValue: '최저가 검수됨' })}
                      </span>
                    )}
                    {item.pending_supply_price != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-medium">
                        <Clock className="w-3 h-3" /> {t('supplier.priceChangePendingBadge', { defaultValue: '가격변경 승인 대기' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('supplier.supplyPrice', { defaultValue: '공급가' })} <b className="text-gray-700">{formatWon(item.supply_price)}</b>
                    {' · '}{t('supplier.suggestedRetail', { defaultValue: '권장가' })} {formatWon(item.retail_price)}
                    {' · '}{t('supplier.stock', { defaultValue: '재고' })} {item.stock}
                  </p>
                  {item.pending_supply_price != null && (
                    <p className="text-xs text-amber-600 mt-1">
                      {t('supplier.priceChangeReqLine', { defaultValue: '요청한 공급가' })}: {formatWon(item.pending_supply_price)}
                      {item.pending_retail_price != null && ` / ${t('supplier.suggestedRetail', { defaultValue: '권장가' })} ${formatWon(item.pending_retail_price)}`}
                    </p>
                  )}
                  {item.approval_status === 'rejected' && item.admin_memo && (
                    <p className="text-xs text-red-500 mt-1">{t('supplier.rejectReason', { defaultValue: '거부 사유' })}: {item.admin_memo}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {item.supply_visibility === 'APPROVED_CHANNEL' && (
                      <button onClick={() => onManageChannel(item)} className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 border border-gray-300 rounded-lg px-2 py-1 hover:bg-gray-50">
                        <Package className="w-3 h-3" /> {t('supplier.manageChannel', { defaultValue: '승인 유통사 관리' })}
                      </button>
                    )}
                    {item.approval_status === 'approved' && item.pending_supply_price == null && (
                      <button onClick={() => onRequestPriceChange(item)} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FF0033] border border-[#FF0033]/30 rounded-lg px-2 py-1 hover:bg-[#FF0033]/5">
                        <Tag className="w-3 h-3" /> {t('supplier.requestPriceChange', { defaultValue: '가격 수정 요청' })}
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-gray-400">{t('supplier.marginLabel', { defaultValue: '셀러 마진 여력' })}</p>
                  <p className="text-sm font-semibold text-gray-700">{formatWon(margin)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SettlementsTab({ items, t }: { items: SettlementItem[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (items.length === 0) {
    return <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400 text-sm">{t('supplier.noSettlements', { defaultValue: '아직 정산 내역이 없습니다.' })}</div>
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="text-left font-medium px-4 py-3">{t('supplier.colProduct', { defaultValue: '상품' })}</th>
            <th className="text-right font-medium px-4 py-3">{t('supplier.colSupplyAmount', { defaultValue: '공급액' })}</th>
            <th className="text-center font-medium px-4 py-3">{t('supplier.colStatus', { defaultValue: '상태' })}</th>
            <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">{t('supplier.colDate', { defaultValue: '일시' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(s => {
            const st = SETTLE_STATUS[s.status] || SETTLE_STATUS.pending
            return (
              <tr key={s.id}>
                <td className="px-4 py-3 text-gray-900">{s.product_name || `#${s.product_id ?? '-'}`}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatWon(s.supply_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{t(`supplier.settle_${s.status}`, { defaultValue: st.label })}</span>
                </td>
                <td className="px-4 py-3 text-right text-gray-400 text-xs hidden sm:table-cell">{(s.created_at || '').slice(0, 10)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 🏦 2026-06-09: 정산금 출금 — 실가용 잔액 + 출금 신청 버튼 + 신청 내역.
const WD_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: '처리 대기', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: '승인', cls: 'bg-emerald-50 text-emerald-700' },
  paid: { label: '송금 완료', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: '반려', cls: 'bg-gray-100 text-gray-500' },
}
function WithdrawalSection({ spendable, items, t, onRequest }: {
  spendable: number
  items: WithdrawalItem[]
  t: (k: string, o?: Record<string, unknown>) => string
  onRequest: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5"><Wallet className="w-4 h-4 text-blue-600" />{t('supplier.withdrawTitle', { defaultValue: '정산금 출금' })}</p>
          <p className="text-xs text-gray-500 mt-1">{t('supplier.withdrawAvail', { defaultValue: '출금 가능' })}: <span className="font-bold text-blue-600">{formatWon(spendable)}</span></p>
        </div>
        <button
          onClick={onRequest}
          disabled={spendable < 10000}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF0033] text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wallet className="w-4 h-4" /> {t('supplier.withdrawBtn', { defaultValue: '출금 신청' })}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">{t('supplier.withdrawEmpty', { defaultValue: '출금 신청 내역이 없습니다.' })}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs">
              <tr>
                <th className="text-left font-medium py-2">{t('supplier.colDate', { defaultValue: '일시' })}</th>
                <th className="text-right font-medium py-2">{t('supplier.withdrawAmount', { defaultValue: '금액' })}</th>
                <th className="text-center font-medium py-2">{t('supplier.colStatus', { defaultValue: '상태' })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(w => {
                const st = WD_STATUS[w.status] || WD_STATUS.requested
                return (
                  <tr key={w.id}>
                    <td className="py-2.5 text-gray-500 text-xs">{(w.requested_at || '').slice(0, 10)}</td>
                    <td className="py-2.5 text-right font-semibold text-gray-900">{formatWon(w.amount)}</td>
                    <td className="py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{st.label}</span>
                      {w.admin_memo && <span className="block text-[10px] text-gray-400 mt-0.5">{w.admin_memo}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function WithdrawModal({ t, spendable, onClose, onDone }: {
  t: (k: string, o?: Record<string, unknown>) => string
  spendable: number
  onClose: () => void
  onDone: () => void
}) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const amt = Math.floor(Number(amount))
    if (!Number.isFinite(amt) || amt < 10000) { setError(t('supplier.withdrawMin', { defaultValue: '최소 출금 금액은 10,000원입니다' })); return }
    if (amt > spendable) { setError(t('supplier.withdrawOver', { defaultValue: '출금 가능 잔액을 초과했습니다' })); return }
    setSaving(true)
    try {
      await supplierApi.post('/api/supplier/withdrawals/request', { amount: amt })
      toast.success(t('supplier.withdrawOk', { defaultValue: '출금 신청이 접수되었습니다. 영업일 기준 처리됩니다.' }))
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.withdrawBtn', { defaultValue: '출금 신청' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            {t('supplier.withdrawAvail', { defaultValue: '출금 가능' })}: <span className="font-bold">{formatWon(spendable)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('supplier.withdrawAmount', { defaultValue: '금액' })}</label>
            <input
              type="number" inputMode="numeric" min={10000} step={1000}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="10000" className={inputCls}
            />
            <button type="button" onClick={() => setAmount(String(spendable))} className="mt-1.5 text-xs font-medium text-[#FF0033]">
              {t('supplier.withdrawAll', { defaultValue: '전액 신청' })}
            </button>
          </div>
          <p className="text-xs text-gray-500">{t('supplier.withdrawNote', { defaultValue: '등록된 정산 계좌로 송금됩니다. 신청 후 관리자 송금 확인 시 처리 완료됩니다.' })}</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-[#FF0033] text-white font-bold text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('supplier.withdrawSubmit', { defaultValue: '출금 신청하기' })}
          </button>
        </form>
      </div>
    </div>
  )
}

// 🏭 Wave 3c: 매입 역발행 전자세금계산서 목록(제조사→플랫폼). 공급가액/부가세/합계/상태.
const TAX_INV_STATUS: Record<string, { label: string; cls: string }> = {
  issued: { label: '발행완료', cls: 'bg-emerald-50 text-emerald-700' },
  draft: { label: '발행대기', cls: 'bg-amber-50 text-amber-700' },
  failed: { label: '발행실패', cls: 'bg-red-50 text-red-700' },
}
function SupplierTaxInvoicesTab({ items, t }: { items: SupplierTaxInvoiceRow[]; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (items.length === 0) {
    return <div className="bg-white rounded-2xl border border-gray-200 py-12 text-center text-gray-400 text-sm">{t('supplier.noTaxInvoices', { defaultValue: '아직 발행된 세금계산서가 없습니다.' })}</div>
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="text-left font-medium px-4 py-3">{t('supplier.colOrder', { defaultValue: '주문' })}</th>
            <th className="text-right font-medium px-4 py-3">{t('supplier.colSupplyValue', { defaultValue: '공급가액' })}</th>
            <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">{t('supplier.colVat', { defaultValue: '부가세' })}</th>
            <th className="text-right font-medium px-4 py-3">{t('supplier.colTotal', { defaultValue: '합계' })}</th>
            <th className="text-center font-medium px-4 py-3">{t('supplier.colStatus', { defaultValue: '상태' })}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(inv => {
            const st = TAX_INV_STATUS[inv.status] || TAX_INV_STATUS.draft
            return (
              <tr key={inv.id}>
                <td className="px-4 py-3 text-gray-900">#{inv.order_id}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatWon(inv.supply_amount)}</td>
                <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{formatWon(inv.vat_amount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatWon(inv.total_amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${st.cls}`}>{t(`supplier.taxinv_${inv.status}`, { defaultValue: st.label })}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function OrdersTab({ items, t, status, setStatus, onShip }: {
  items: OrderItem[]
  t: (k: string, o?: Record<string, unknown>) => string
  status: 'to_ship' | 'shipped'
  setStatus: (s: 'to_ship' | 'shipped') => void
  onShip: (o: OrderItem) => void
}) {
  const fmtAddr = (o: OrderItem) => {
    const name = o.recipient_name || o.shipping_name || '-'
    const phone = o.recipient_phone || o.shipping_phone || ''
    let addr = o.shipping_address || ''
    try { const p = JSON.parse(addr); addr = [p.address, p.address_detail].filter(Boolean).join(' ') } catch { /* plain text */ }
    return { name, phone, addr }
  }
  return (
    <div>
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200 w-fit">
        {([['to_ship', t('supplier.toShip', { defaultValue: '발송 대기' })], ['shipped', t('supplier.shipped', { defaultValue: '발송 완료' })]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${status === k ? 'bg-[#FF0033] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
          {status === 'to_ship' ? t('supplier.noToShip', { defaultValue: '발송할 주문이 없습니다.' }) : t('supplier.noShipped', { defaultValue: '발송 완료된 주문이 없습니다.' })}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(o => {
            const a = fmtAddr(o)
            return (
              <div key={o.order_id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 text-sm">#{o.order_number || o.order_id}</p>
                      <span className="text-xs text-gray-400">{(o.created_at || '').slice(0, 10)}</span>
                      <span className="text-xs text-gray-500">{t('supplier.qtyN', { defaultValue: '수량' })} {o.total_qty}</span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{o.item_names}</p>
                    <p className="text-xs text-gray-500 mt-1">📦 {a.name} {a.phone} · {a.addr || t('supplier.noAddr', { defaultValue: '주소 정보 없음' })}</p>
                    {o.tracking_number && (
                      <p className="text-xs text-green-600 mt-1">🚚 {o.courier || ''} {o.tracking_number}</p>
                    )}
                  </div>
                  {status === 'to_ship' && (
                    <button onClick={() => onShip(o)} className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#FF0033] text-white rounded-lg">
                      <Truck className="w-3.5 h-3.5" /> {t('supplier.enterTracking', { defaultValue: '운송장 입력' })}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ShipModal({ t, order, onClose, onShipped }: {
  t: (k: string, o?: Record<string, unknown>) => string
  order: OrderItem
  onClose: () => void
  onShipped: () => void
}) {
  const [courier, setCourier] = useState(order.courier || '')
  const [tracking, setTracking] = useState(order.tracking_number || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!tracking.trim()) { setError(t('supplier.errTracking', { defaultValue: '운송장 번호를 입력해주세요' })); return }
    setSaving(true)
    try {
      await supplierApi.put(`/api/supplier/orders/${order.order_id}/shipping`, { courier: courier.trim() || undefined, tracking_number: tracking.trim() })
      toast.success(t('supplier.shippedOk', { defaultValue: '운송장이 등록되었습니다.' }))
      onShipped()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.enterTracking', { defaultValue: '운송장 입력' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">#{order.order_number || order.order_id} · {order.item_names}</p>
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('supplier.courier', { defaultValue: '택배사' })}</label>
            <input value={courier} onChange={e => setCourier(e.target.value)} className={inputCls} placeholder={t('supplier.courierPh', { defaultValue: '예: CJ대한통운' })} disabled={saving} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('supplier.trackingNo', { defaultValue: '운송장 번호' })} <span className="text-red-500">*</span></label>
            <input value={tracking} onChange={e => setTracking(e.target.value)} className={inputCls} disabled={saving} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.registerTracking', { defaultValue: '발송 등록' })}
          </button>
        </form>
      </div>
    </div>
  )
}

function AddProductModal({ t, onClose, onCreated }: { t: (k: string, o?: Record<string, unknown>) => string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', supply_price: '', suggested_retail_price: '', stock: '', min_order_qty: '', pack_size: '', order_multiple: '', category: 'lifestyle', image_url: '', supply_visibility: 'ALL', barcode: '', is_brand_product: false, brand_name: '', lowest_price_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const supply = Number(form.supply_price)
    const retail = Number(form.suggested_retail_price || form.supply_price)
    if (!form.name.trim()) { setError(t('supplier.errName', { defaultValue: '상품명을 입력해주세요' })); return }
    if (!Number.isFinite(supply) || supply <= 0) { setError(t('supplier.errSupply', { defaultValue: '공급가를 올바르게 입력해주세요' })); return }
    if (retail < supply) { setError(t('supplier.errRetail', { defaultValue: '권장 소비자가는 공급가 이상이어야 합니다' })); return }
    setSaving(true)
    try {
      await supplierApi.post('/api/supplier/products', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        supply_price: supply,
        suggested_retail_price: retail,
        stock: Number(form.stock) || 0,
        min_order_qty: Number(form.min_order_qty) || 1,
        pack_size: Number(form.pack_size) || 1,
        order_multiple: Number(form.order_multiple) || 1,
        category: form.category,
        image_url: form.image_url.trim() || undefined,
        supply_visibility: form.supply_visibility,
        barcode: form.barcode.trim() || undefined,
        is_brand_product: form.is_brand_product,
        brand_name: form.is_brand_product ? (form.brand_name.trim() || undefined) : undefined,
        lowest_price_url: form.lowest_price_url.trim() || undefined,
      })
      toast.success(t('supplier.productCreated', { defaultValue: '상품이 등록되었습니다. 승인 후 노출됩니다.' }))
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.addProduct', { defaultValue: '공급상품 등록' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={labelCls}>{t('supplier.fieldName', { defaultValue: '상품명' })} <span className="text-red-500">*</span></label>
            <input required disabled={saving} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t('supplier.fieldDesc', { defaultValue: '설명' })}</label>
            <textarea disabled={saving} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldSupplyPrice', { defaultValue: '공급가(원)' })} <span className="text-red-500">*</span></label>
              <input required type="number" min={1} disabled={saving} value={form.supply_price} onChange={e => setForm(f => ({ ...f, supply_price: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldRetail', { defaultValue: '권장 소비자가(원)' })}</label>
              <input type="number" min={0} disabled={saving} value={form.suggested_retail_price} onChange={e => setForm(f => ({ ...f, suggested_retail_price: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldStock', { defaultValue: '재고' })}</label>
              <input type="number" min={0} disabled={saving} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldCategory', { defaultValue: '카테고리' })}</label>
              {/* 🏭 2026-06-04 카테고리 표준화 — 자유 입력 → 도매몰 표준 카테고리 select.
                  카탈로그 필터(WHOLESALE_CATEGORIES)와 값 일치 → 유통사 카테고리 필터가 항상 동작. */}
              <select disabled={saving} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                {WHOLESALE_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* 🏭 BIZ-8 (2026-06-08) MOQ / 박스당 수량 / 주문 배수 — 수량 제약(가격과 무관). */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldMoq', { defaultValue: '최소 주문 수량 (MOQ)' })}</label>
              <input type="number" min={1} disabled={saving} value={form.min_order_qty} onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))} className={inputCls} placeholder="1" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldPackSize', { defaultValue: '박스당 수량' })}</label>
              <input type="number" min={1} disabled={saving} value={form.pack_size} onChange={e => setForm(f => ({ ...f, pack_size: e.target.value }))} className={inputCls} placeholder="1" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldOrderMultiple', { defaultValue: '주문 단위(배수)' })}</label>
              <input type="number" min={1} disabled={saving} value={form.order_multiple} onChange={e => setForm(f => ({ ...f, order_multiple: e.target.value }))} className={inputCls} placeholder="1" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 -mt-1">{t('supplier.qtyConstraintHint', { defaultValue: 'MOQ=최소 주문 수량 · 박스당 수량=1박스 낱개 수(표시용) · 주문 단위=이 배수로만 주문 가능(예: 12면 12·24·36…). 비우면 모두 1.' })}</p>
          <div>
            <label className={labelCls}>{t('supplier.fieldImage', { defaultValue: '대표 이미지 URL' })}</label>
            <input disabled={saving} value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} className={inputCls} placeholder="https://..." />
          </div>
          <div>
            <label className={labelCls}>{t('supplier.fieldLowestUrl', { defaultValue: '온라인 최저가 참고 링크' })}</label>
            <input disabled={saving} value={form.lowest_price_url} onChange={e => setForm(f => ({ ...f, lowest_price_url: e.target.value }))} className={inputCls} placeholder="https://search.shopping.naver.com/..." />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.lowestUrlSubmitHint', { defaultValue: '운영진이 온라인 최저가 여부를 검수합니다. 네이버쇼핑 등 비교 링크를 입력해주세요.' })}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldBarcode', { defaultValue: '바코드 (오프라인 판로)' })}</label>
              <input disabled={saving} value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} className={inputCls} placeholder="8801234567890" />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldVisibility', { defaultValue: '공급 범위' })}</label>
              <select disabled={saving} value={form.supply_visibility} onChange={e => setForm(f => ({ ...f, supply_visibility: e.target.value }))} className={inputCls}>
                <option value="ALL">{t('supplier.visAll', { defaultValue: '전체공급 (모든 유통사)' })}</option>
                <option value="APPROVED_CHANNEL">{t('supplier.visApproved', { defaultValue: '승인한 유통채널만' })}</option>
                <option value="UTONGSTART_ONLY">{t('supplier.visUtong', { defaultValue: '유통스타트 유통채널 (선정 유통사)' })}</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" disabled={saving} checked={form.is_brand_product} onChange={e => setForm(f => ({ ...f, is_brand_product: e.target.checked }))} className="w-4 h-4" />
            {t('supplier.fieldBrand', { defaultValue: '브랜드제품 (판매 후 당일 정산)' })}
          </label>
          <p className="text-[11px] text-gray-400 -mt-1">{t('supplier.brandHint', { defaultValue: '체크 시 판매 후 당일 정산, 미체크 시 일반제품(7일 환불창 후 정산).' })}</p>
          {/* 🏷️ 브랜드 전시관 — 브랜드제품 체크 시에만 브랜드명 입력(브랜드 전시관 그리드에 노출). */}
          {form.is_brand_product && (
            <div>
              <label className={labelCls}>{t('supplier.fieldBrandName', { defaultValue: '브랜드명' })}</label>
              <input disabled={saving} value={form.brand_name} onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))} className={inputCls} placeholder={t('supplier.fieldBrandNamePh', { defaultValue: '예: 코카콜라, 농심' })} maxLength={120} />
              <p className="text-[11px] text-gray-400 mt-1">{t('supplier.brandNameHint', { defaultValue: '도매몰 브랜드 전시관에 이 브랜드로 묶여 노출됩니다.' })}</p>
            </div>
          )}
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.submitProduct', { defaultValue: '등록 신청' })}
          </button>
        </form>
      </div>
    </div>
  )
}
