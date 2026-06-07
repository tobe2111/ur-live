/**
 * 🛡️ 2026-06-01 도매몰 INC-6: 공급자(도매상) 대시보드.
 *   탭: 개요(잔고/카운트) · 카탈로그(내 공급상품 + 등록) · 정산(매출 내역).
 *   self-guard: supplier_token 없으면 /supplier/login.
 *   라이트 테마 (대시보드 계열) + i18n.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, Wallet, Receipt, Plus, LogOut, Clock, CheckCircle, XCircle, X, Truck, Tag, ShieldCheck } from 'lucide-react'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { supplierApi, isSupplierLoggedIn, clearSupplierSession, getSupplierToken } from '@/lib/supplier-api'
import { WHOLESALE_CATEGORIES } from './wholesale/wholesale-theme'

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

type Tab = 'overview' | 'orders' | 'catalog' | 'settlements'

interface Me {
  profile: { business_name: string; email: string; status: string }
  balance: { pending_amount: number; available_amount: number; paid_amount: number }
  product_counts: { total: number; pending: number; approved: number; rejected: number }
}
interface CatalogItem {
  id: number; name: string; retail_price: number; supply_price: number; stock: number
  category: string | null; approval_status: string; admin_memo: string | null; created_at: string
  supply_visibility?: string; barcode?: string | null; is_brand_product?: number
  lowest_price_url?: string | null; lowest_price_checked?: number
  pending_supply_price?: number | null; pending_retail_price?: number | null
  pending_price_reason?: string | null
}
interface SettlementItem {
  id: number; order_id: number | null; product_id: number | null; product_name: string | null
  retail_amount: number; supply_amount: number; status: string; created_at: string; available_at: string | null
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
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [orderStatus, setOrderStatus] = useState<'to_ship' | 'shipped'>('to_ship')
  const [shipModal, setShipModal] = useState<OrderItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [meError, setMeError] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [channelItem, setChannelItem] = useState<CatalogItem | null>(null)
  const [priceChangeItem, setPriceChangeItem] = useState<CatalogItem | null>(null)

  useEffect(() => {
    if (!isSupplierLoggedIn()) { navigate('/supplier/login', { replace: true }); return }
  }, [navigate])

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

  const loadOrders = useCallback(async () => {
    try {
      const res = await supplierApi.get<{ data: { items: OrderItem[] } }>(`/api/supplier/orders?status=${orderStatus}&limit=100`)
      setOrders(res.data.items ?? [])
    } catch (err) { if (import.meta.env.DEV) console.error(err) }
  }, [orderStatus])

  useEffect(() => { loadMe() }, [loadMe])
  useEffect(() => { if (tab === 'catalog') loadCatalog() }, [tab, loadCatalog])
  useEffect(() => { if (tab === 'settlements') loadSettlements() }, [tab, loadSettlements])
  useEffect(() => { if (tab === 'orders') loadOrders() }, [tab, loadOrders])

  const logout = () => {
    clearSupplierSession()
    navigate('/supplier/login', { replace: true })
  }

  const tabs: { key: Tab; label: string; Icon: typeof Wallet }[] = [
    { key: 'overview', label: t('supplier.tabOverview', { defaultValue: '개요' }), Icon: Wallet },
    { key: 'orders', label: t('supplier.tabOrders', { defaultValue: '발송 관리' }), Icon: Truck },
    { key: 'catalog', label: t('supplier.tabCatalog', { defaultValue: '내 카탈로그' }), Icon: Package },
    { key: 'settlements', label: t('supplier.tabSettlements', { defaultValue: '정산 내역' }), Icon: Receipt },
  ]

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <SEO title={t('supplier.dashTitle', { defaultValue: '공급자 대시보드' }) + ' - 유어딜'} description="유어딜 도매 공급자 대시보드" url="/supplier" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UrDealLogo size={14} forceLight />
            <span className="text-[9px] font-bold tracking-wider text-[#FF0033]">{t('supplier.studio', { defaultValue: 'SUPPLIER' })}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:inline">{me?.profile.business_name}</span>
            <button onClick={() => navigate('/supplier/wholesale-orders')} className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 font-medium">
              <Truck className="w-4 h-4" /> {t('supplier.wholesaleOrders', { defaultValue: '도매 주문' })}
            </button>
            <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <LogOut className="w-4 h-4" /> {t('supplier.logout', { defaultValue: '로그아웃' })}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-200 w-fit">
          {tabs.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-[#FF0033] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
        ) : tab === 'overview' ? (
          <OverviewTab me={me} meError={meError} onRetry={loadMe} t={t} />
        ) : tab === 'orders' ? (
          <OrdersTab items={orders} t={t} status={orderStatus} setStatus={setOrderStatus} onShip={setShipModal} />
        ) : tab === 'catalog' ? (
          <CatalogTab items={catalog} t={t} onAdd={() => setShowAdd(true)} onBulkDone={() => { loadMe(); loadCatalog() }} onManageChannel={setChannelItem} onRequestPriceChange={setPriceChangeItem} />
        ) : (
          <SettlementsTab items={settlements} t={t} />
        )}
      </main>

      {shipModal && (
        <ShipModal
          t={t}
          order={shipModal}
          onClose={() => setShipModal(null)}
          onShipped={() => { setShipModal(null); loadOrders() }}
        />
      )}

      {showAdd && (
        <AddProductModal
          t={t}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); loadMe(); if (tab === 'catalog') loadCatalog() }}
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
    </div>
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

function OverviewTab({ me, meError, onRetry, t }: { me: Me | null; meError: boolean; onRetry: () => void; t: (k: string, o?: Record<string, unknown>) => string }) {
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
  const cards = [
    { label: t('supplier.balPending', { defaultValue: '정산 대기' }), value: b.pending_amount, cls: 'text-amber-600' },
    { label: t('supplier.balAvailable', { defaultValue: '출금 가능' }), value: b.available_amount, cls: 'text-blue-600' },
    { label: t('supplier.balPaid', { defaultValue: '지급 완료(누적)' }), value: b.paid_amount, cls: 'text-green-600' },
  ]
  return (
    <div className="space-y-6">
      {me.profile.status !== 'approved' && (
        <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          {t('supplier.notApprovedYet', { defaultValue: '아직 승인 대기 중인 계정입니다. 승인 후 상품 등록·정산이 활성화됩니다.' })}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.cls}`}>{formatWon(card.value)}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-semibold text-gray-900 mb-4">{t('supplier.productSummary', { defaultValue: '공급상품 현황' })}</p>
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
    </div>
  )
}

function CatalogTab({ items, t, onAdd, onBulkDone, onManageChannel, onRequestPriceChange }: { items: CatalogItem[]; t: (k: string, o?: Record<string, unknown>) => string; onAdd: () => void; onBulkDone: () => void; onManageChannel: (item: CatalogItem) => void; onRequestPriceChange: (item: CatalogItem) => void }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-600">{t('supplier.catalogCount', { defaultValue: '총 {{n}}개', n: items.length }).replace('{{n}}', String(items.length))}</p>
        <div className="flex items-center gap-2">
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
  const [form, setForm] = useState({ name: '', description: '', supply_price: '', suggested_retail_price: '', stock: '', min_order_qty: '', category: 'lifestyle', image_url: '', supply_visibility: 'ALL', barcode: '', is_brand_product: false, lowest_price_url: '' })
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
        category: form.category,
        image_url: form.image_url.trim() || undefined,
        supply_visibility: form.supply_visibility,
        barcode: form.barcode.trim() || undefined,
        is_brand_product: form.is_brand_product,
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
          <div>
            <label className={labelCls}>{t('supplier.fieldMoq', { defaultValue: '최소 주문 수량 (MOQ)' })}</label>
            <input type="number" min={1} disabled={saving} value={form.min_order_qty} onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))} className={inputCls} placeholder="1" />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.moqHint', { defaultValue: '박스 단위 최소 주문 수량. 비우면 1(낱개 주문 가능).' })}</p>
          </div>
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
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.submitProduct', { defaultValue: '등록 신청' })}
          </button>
        </form>
      </div>
    </div>
  )
}
