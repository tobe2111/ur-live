/**
 * 🏪 2026-06-22 (대표 — "셀러 대시보드는 무거움, 앱에서 바로"): 사업자 유저용 경량 "내 매장" 화면.
 *   매장 이용권 원장(사용/정산 대기·완료) + "안 왔어요" 분쟁 신고. 풀 셀러 대시보드(/seller) 대신 앱 내.
 *   API: GET /api/group-buy/store-voucher-ledger · GET /api/group-buy/store-fcfs · GET /api/voucher-dispute/mine · POST /api/voucher-dispute/report
 *   소비자 앱 테마(화이트/다크 토글) — dark: variant 필수.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, LayoutDashboard, Package, Plus, Store, Tag, Ticket, Zap } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface Summary {
  total: number; unused: number; used: number; used_amount: number
  pending_settlement: number; pending_amount: number; settled: number; refunded: number
}
interface LedgerItem {
  id: number; status: string; applied_price: number; settlement_id: number | null
  product_name?: string; restaurant_name?: string
}
interface FcfsItem {
  product_id: number; name: string; spots: number; realApplied: number; appliedDisplay: number; deadline: string | null
}
// 🔗 2026-07-02 (대표 #5 심화 — 대시보드 없이 인라인 조정): 내 상품 재고·노출 관리.
interface StoreProduct { id: number; name: string; price: number; stock: number; is_active: boolean | number; is_supply_product?: boolean }

const STAT = (label: string, value: string, sub?: string) => ({ label, value, sub })

export default function MyStorePage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [recent, setRecent] = useState<LedgerItem[]>([])
  const [fcfs, setFcfs] = useState<FcfsItem[]>([])
  const [disputedIds, setDisputedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  // 🛡️ 2026-07-02: 에러 상태 — 실패를 "발급 0건"으로 위장하지 않음(에러 화면 + 재시도).
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  // 🔗 2026-07-02 (#5 심화): 내 상품 인라인 관리 상태.
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const sellerAuth = { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } }
      const [ledger, mine, fcfsRes, prodRes] = await Promise.all([
        api.get('/api/group-buy/store-voucher-ledger'),
        api.get('/api/voucher-dispute/mine').catch(() => ({ data: { data: [] } })),
        api.get('/api/group-buy/store-fcfs').catch(() => ({ data: { data: [] } })),
        api.get('/api/seller/products', sellerAuth).catch(() => ({ data: { data: [] } })),
      ])
      if (ledger.data?.success === false) { setForbidden(true); return }
      setSummary(ledger.data?.data?.summary || null)
      setRecent(ledger.data?.data?.recent || [])
      setFcfs(fcfsRes.data?.data || [])
      setProducts((prodRes.data?.data || []).filter((p: StoreProduct) => !p.is_supply_product))
      const open = new Set<number>((mine.data?.data || []).filter((d: { status: string }) => d.status === 'open').map((d: { voucher_id: number }) => d.voucher_id))
      setDisputedIds(open)
    } catch (e) {
      const err = e as { response?: { status?: number } }
      if (err.response?.status === 403) setForbidden(true)
      else { setLoadError(true); toast.error('내 매장 정보를 불러오지 못했어요') }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // 🔗 2026-07-02 (#5 심화): 상품 노출/숨김 토글 — 대시보드 안 가고 인라인.
  async function toggleActive(p: StoreProduct) {
    const next = !(Number(p.is_active) === 1 || p.is_active === true)
    setBusy(p.id)
    try {
      await api.put(`/api/seller/products/${p.id}`, { is_active: next, status: next ? 'ACTIVE' : 'PAUSED' },
        { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_active: next ? 1 : 0 } : x))
      toast.success(next ? '노출됨' : '숨김 처리됨')
    } catch { toast.error('변경 실패 — 다시 시도해주세요') } finally { setBusy(null) }
  }
  // 재고 인라인 저장.
  async function saveStock(p: StoreProduct) {
    const raw = stockDraft[p.id]
    if (raw === undefined) return
    const n = Math.floor(Number(raw))
    if (!Number.isFinite(n) || n < 0) { toast.error('재고는 0 이상 숫자'); return }
    setBusy(p.id)
    try {
      await api.put(`/api/seller/products/${p.id}`, { stock: n },
        { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, stock: n } : x))
      setStockDraft(prev => { const c = { ...prev }; delete c[p.id]; return c })
      toast.success('재고 저장됨')
    } catch { toast.error('재고 저장 실패') } finally { setBusy(null) }
  }

  async function report(v: LedgerItem) {
    if (!(await confirmDialog({ message: `이 이용권을 "고객이 방문하지 않았다"고 신고할까요?\n신고 시 해당 건의 정산이 보류되고 운영자가 확인합니다.`, danger: true }))) return
    setBusy(v.id)
    try {
      await api.post('/api/voucher-dispute/report', { voucherId: v.id })
      toast.success('신고 접수 — 정산 보류 후 운영자가 확인합니다')
      setDisputedIds(prev => new Set(prev).add(v.id))
    } catch {
      toast.error('신고할 수 없는 건입니다 (정산 전 사용건만)')
    } finally { setBusy(null) }
  }

  if (forbidden) {
    return (
      <div className="bg-white dark:bg-[#0F151D] min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <SEO title="내 매장 — 유어딜" description="사업자 유저 매장 관리" url="/my-store" noindex />
        <Store className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-900 dark:text-white font-bold">사업자 유저 전용</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">사업자 등록·판매 승인 후 이용할 수 있어요.</p>
        <button onClick={() => navigate('/store/new')} className="mt-5 px-5 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold">내 가게 등록하기</button>
      </div>
    )
  }

  const stats = summary ? [
    STAT('정산 대기', `${formatNumber(summary.pending_settlement)}건`, `${formatNumber(summary.pending_amount)}원`),
    STAT('정산 완료', `${formatNumber(summary.settled)}건`),
    STAT('총 사용', `${formatNumber(summary.used)}건`, `${formatNumber(summary.used_amount)}원`),
    STAT('미사용', `${formatNumber(summary.unused)}건`),
  ] : []

  return (
    <div className="bg-white dark:bg-[#0F151D] min-h-screen pb-8">
      <SEO title="내 매장 — 유어딜" description="내 매장 이용권 사용·정산 현황" url="/my-store" noindex />
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0F151D]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2A3446] px-4 h-12 flex items-center">
        <Store className="w-5 h-5 text-gray-900 dark:text-white mr-2" />
        <h1 className="text-[16px] font-extrabold text-gray-900 dark:text-white">내 매장</h1>
      </div>

      <div className="ur-content-medium px-4 lg:px-8 pt-4">
        {/* 🔗 2026-07-02 (대표 #5 — 대시보드 안 가도 유어샵/마이에서 셀러 기능 조정):
            고빈도 셀러 작업 빠른 진입. 세밀 설정(정산계좌·세금·커미션·알림톡)만 셀러 대시보드로. */}
        <div className="grid grid-cols-3 gap-2 pb-4">
          {[
            { label: '주문 확인', Icon: Package, to: '/seller/orders' },
            { label: '상품 관리', Icon: Tag, to: '/seller/products' },
            { label: '상품 등록', Icon: Plus, to: '/seller/products/new' },
            { label: '이용권 등록', Icon: Ticket, to: '/seller/meal-voucher/new' },
            { label: '내 유어샵', Icon: Store, to: '/u/me' },
            { label: '셀러 대시보드', Icon: LayoutDashboard, to: '/seller' },
          ].map(a => (
            <button
              key={a.to}
              type="button"
              onClick={() => navigate(a.to)}
              className="flex flex-col items-center gap-1 rounded-2xl border border-gray-100 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] py-3 active:opacity-80 transition-opacity"
            >
              <a.Icon className="w-[18px] h-[18px] text-gray-500" aria-hidden="true" />
              <span className="text-[11px] font-bold text-gray-900 dark:text-white">{a.label}</span>
            </button>
          ))}
        </div>
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중…</div>
        ) : loadError ? (
          <div className="text-center py-16">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">매장 정보를 불러오지 못했어요</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">네트워크 상태를 확인한 뒤 다시 시도해주세요</p>
            <button onClick={() => load()} className="px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-full text-sm font-bold">
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {/* 요약 */}
            <div className="grid grid-cols-2 gap-2.5">
              {stats.map(s => (
                <div key={s.label} className="rounded-2xl border border-gray-100 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] p-3.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.label}</p>
                  <p className="text-[18px] font-extrabold text-gray-900 dark:text-white mt-0.5">{s.value}</p>
                  {s.sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 px-1">월~일 사용분은 <b className="text-gray-600 dark:text-gray-300">차주 목요일</b>에 정산돼요. 고객이 방문하지 않은 건은 아래에서 신고하면 정산이 보류됩니다.</p>

            {/* 🔗 2026-07-02 (대표 #5 심화): 내 상품 재고·노출 인라인 관리 — 대시보드 안 가고 바로 조정. */}
            {products.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-[13px] font-bold text-gray-900 dark:text-white">내 상품 · 재고·노출 관리</p>
                  <button onClick={() => navigate('/seller/products')} className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">전체 관리 →</button>
                </div>
                <div className="space-y-2">
                  {products.map(p => {
                    const active = Number(p.is_active) === 1 || p.is_active === true
                    const draft = stockDraft[p.id]
                    const dirty = draft !== undefined && draft !== String(p.stock ?? 0)
                    return (
                      <div key={p.id} className="flex items-center gap-2 rounded-xl border border-gray-100 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3.5 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatNumber(p.price)}원 · 재고</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number" inputMode="numeric" min={0}
                            value={draft ?? String(p.stock ?? 0)}
                            onChange={e => setStockDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-16 px-2 py-1 rounded-lg border border-gray-200 dark:border-[#2A3446] bg-white dark:bg-[#0F151D] text-gray-900 dark:text-white text-[12px] text-right"
                            aria-label={`${p.name} 재고`}
                          />
                          {dirty && (
                            <button onClick={() => saveStock(p)} disabled={busy === p.id} className="px-2 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-bold disabled:opacity-50">저장</button>
                          )}
                        </div>
                        <button
                          onClick={() => toggleActive(p)}
                          disabled={busy === p.id}
                          className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold disabled:opacity-50 ${active ? 'bg-gray-900/10 dark:bg-white/15 text-gray-900 dark:text-white' : 'bg-gray-100 dark:bg-[#1A2334] text-gray-400 dark:text-gray-500'}`}
                        >
                          {active ? '노출중' : '숨김'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 🎯 선착순 응모 현황 — 운영자가 내 매장 상품을 선착순으로 걸었을 때만 노출(읽기 전용) */}
            {fcfs.length > 0 && (
              <div className="mt-6">
                <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-2 px-1 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> 선착순 응모 현황
                </p>
                <div className="space-y-2">
                  {fcfs.map(f => {
                    const closed = !!(f.deadline && new Date(f.deadline).getTime() < Date.now())
                    return (
                      <div key={f.product_id} className="rounded-xl border border-gray-100 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{f.name}</p>
                          <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${closed ? 'bg-gray-100 dark:bg-[#1A2334] text-gray-400 dark:text-gray-500' : 'bg-gray-900/10 dark:bg-white/15 text-gray-900 dark:text-white'}`}>
                            {closed ? '마감' : '모집중'}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                          지원 <b className="text-gray-900 dark:text-white">{formatNumber(f.appliedDisplay)}</b>명 · 모집 {formatNumber(f.spots)}명
                        </p>
                        <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-0.5">선정은 운영자가 진행해요</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 최근 이용권 */}
            <p className="text-[13px] font-bold text-gray-900 dark:text-white mt-6 mb-2 px-1">최근 이용권</p>
            {recent.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">아직 발급된 이용권이 없어요</p>
            ) : (
              <div className="space-y-2">
                {recent.map(v => {
                  const disputed = disputedIds.has(v.id)
                  const canReport = v.status === 'used' && v.settlement_id == null && !disputed
                  return (
                    <div key={v.id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-[#2A3446] bg-white dark:bg-[#1A2334] px-3.5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{v.restaurant_name || v.product_name || `이용권 #${v.id}`}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                          #{v.id} · {formatNumber(v.applied_price)}원 · {
                            v.status === 'unused' ? '미사용'
                            : v.status === 'used' ? (v.settlement_id != null ? '정산 완료' : disputed ? '신고됨(보류)' : '정산 대기')
                            : v.status === 'refunded' ? '환불' : v.status
                          }
                        </p>
                      </div>
                      {disputed ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0"><AlertCircle className="w-3.5 h-3.5" />신고됨</span>
                      ) : v.status === 'used' && v.settlement_id != null ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 shrink-0"><CheckCircle2 className="w-3.5 h-3.5" />정산완료</span>
                      ) : canReport ? (
                        <button onClick={() => report(v)} disabled={busy === v.id} className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2A3446] text-gray-600 dark:text-gray-300 text-[12px] font-bold disabled:opacity-50">안 왔어요</button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
