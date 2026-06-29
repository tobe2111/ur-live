/**
 * 🏭 2026-06-09 Wave 2 — 어드민 도매(공급) 상품 프리미엄 전용관 관리.
 *   도매 카탈로그 상품 목록 + 프리미엄 토글(크라운 스위치) + 프리미엄만 필터 + 검색.
 *   백엔드: GET /api/admin/wholesale-products?premium=&q= , POST /api/admin/wholesale-products/:id/premium
 *   라이트 테마 (어드민 대시보드). i18n defaultValue, NaN-safe.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, Crown, Search, Package, Store } from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import AdminMallSelect from '@/components/admin/AdminMallSelect'

interface WholesaleProductRow {
  id: number
  name: string
  category: string | null
  supply_price: number | null
  is_active: number
  is_premium: number
  supplier_id: number | null
  supplier_name: string | null
}

export default function AdminWholesaleProductsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [premiumFilter, setPremiumFilter] = useState<'' | '1' | '0'>('')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  // 🏬 멀티-몰: '' = 전 몰(기존 무필터 뷰 보존). 특정 몰 선택 시 ?mall_id= 로 스코프.
  const [mallId, setMallId] = useState('')
  const [togglingId, setTogglingId] = useState<number | null>(null)
  // 낙관적 업데이트용 로컬 오버라이드 (id → is_premium).
  const [optimistic, setOptimistic] = useState<Record<number, number>>({})
  // 🆕 2026-06-17: 체크박스 다중 선택 → 프리미엄 일괄 추가/제외.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const token = () => localStorage.getItem('admin_token') || localStorage.getItem('access_token')

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  const { data, isLoading: loading, refetch } = useApiQuery<{ items: WholesaleProductRow[]; premium_count: number }>(
    ['admin', 'wholesale-products', premiumFilter, query, mallId], '/api/admin/wholesale-products',
    {
      params: { premium: premiumFilter, q: query, limit: 200, ...(mallId ? { mall_id: mallId } : {}) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: (r: any) => (r?.success ? { items: r.data?.items ?? [], premium_count: r.data?.premium_count ?? 0 } : { items: [], premium_count: 0 }),
    },
  )
  const items = data?.items ?? []
  const premiumCount = data?.premium_count ?? 0

  // 🆕 목록 갱신(refetch/필터) 시 더 이상 없는 선택 항목 정리.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const valid = new Set(items.map((p) => p.id))
      let changed = false
      const next = new Set<number>()
      prev.forEach((id) => { if (valid.has(id)) next.add(id); else changed = true })
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const allSelected = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < items.length
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((p) => p.id)))
  }
  async function bulkSetPremium(isPremium: 0 | 1) {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setBulkBusy(true)
    setOptimistic((o) => { const n = { ...o }; ids.forEach((id) => { n[id] = isPremium }); return n }) // 낙관적
    try {
      const res = await api.post('/api/admin/wholesale-products/bulk-premium', { ids, is_premium: isPremium }, { headers: { Authorization: `Bearer ${token()}` } })
      const cnt = res.data?.updated ?? ids.length
      toast.success(isPremium === 1
        ? t('admin.wholesaleProducts.bulkSetPremium', { count: cnt, defaultValue: `${cnt}개를 프리미엄 전용관에 추가했습니다.` })
        : t('admin.wholesaleProducts.bulkUnsetPremium', { count: cnt, defaultValue: `${cnt}개를 프리미엄 전용관에서 제외했습니다.` }))
      setSelectedIds(new Set())
      refetch()
    } catch (err: unknown) {
      setOptimistic((o) => { const n = { ...o }; ids.forEach((id) => { delete n[id] }); return n }) // 롤백
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.wholesaleProducts.bulkFail', { defaultValue: '프리미엄 일괄 설정에 실패했습니다.' }))
    } finally { setBulkBusy(false) }
  }

  async function togglePremium(p: WholesaleProductRow) {
    const current = optimistic[p.id] ?? p.is_premium
    const next = current === 1 ? 0 : 1
    setTogglingId(p.id)
    setOptimistic((o) => ({ ...o, [p.id]: next })) // 낙관적
    try {
      await api.post(`/api/admin/wholesale-products/${p.id}/premium`, { is_premium: next }, { headers: { Authorization: `Bearer ${token()}` } })
      toast.success(next === 1
        ? t('admin.wholesaleProducts.setPremium', { defaultValue: '프리미엄 전용관에 추가했습니다.' })
        : t('admin.wholesaleProducts.unsetPremium', { defaultValue: '프리미엄 전용관에서 제외했습니다.' }))
      refetch()
    } catch (err: unknown) {
      setOptimistic((o) => { const n = { ...o }; delete n[p.id]; return n }) // 롤백
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('admin.wholesaleProducts.toggleFail', { defaultValue: '프리미엄 설정에 실패했습니다.' }))
    } finally { setTogglingId(null) }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setQuery(searchInput.trim())
  }

  const filters: { key: '' | '1' | '0'; label: string }[] = [
    { key: '', label: t('admin.wholesaleProducts.fAll', { defaultValue: '전체' }) },
    { key: '1', label: t('admin.wholesaleProducts.fPremium', { defaultValue: '프리미엄만' }) },
    { key: '0', label: t('admin.wholesaleProducts.fNormal', { defaultValue: '일반만' }) },
  ]

  return (
    <AdminLayout title={t('admin.wholesaleProducts.title', { defaultValue: '도매 프리미엄 전용관' })}>
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.wholesaleProducts.title', { defaultValue: '도매 프리미엄 전용관' })}
          subtitle={t('admin.wholesaleProducts.subtitle', { defaultValue: '도매 상품을 프리미엄 전용관에 노출/제외합니다.' })}
          icon={<Crown className="h-5 w-5" />}
        />

        {/* 검색 + 필터 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <form onSubmit={submitSearch} className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('admin.wholesaleProducts.searchPh', { defaultValue: '상품명 / 제조사명 검색' })}
              className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setQuery('') }} aria-label={t('common.clear', { defaultValue: '지우기' })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
            )}
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f) => (
              <button key={f.key || 'all'} onClick={() => setPremiumFilter(f.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${premiumFilter === f.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
            <AdminMallSelect value={mallId} onChange={setMallId} />
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-amber-600">
              <Crown className="w-3.5 h-3.5" />
              {t('admin.wholesaleProducts.premiumCount', { defaultValue: '프리미엄' })} {premiumCount}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl py-20 text-center">
            <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{t('admin.wholesaleProducts.empty', { defaultValue: '도매 상품이 없습니다.' })}</p>
          </div>
        ) : (
          <>
            {/* 🆕 전체 선택 + 일괄 프리미엄 동작 바 */}
            <div className="flex items-center gap-3 px-1 py-1">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected }} onChange={toggleSelectAll}
                  aria-label={t('admin.wholesaleProducts.selectAll', { defaultValue: '전체 선택' })}
                  className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer" />
                {t('admin.wholesaleProducts.selectAll', { defaultValue: '전체 선택' })}
              </label>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                  <span className="text-xs text-gray-500 font-medium">{t('admin.wholesaleProducts.selectedN', { count: selectedIds.size, defaultValue: `${selectedIds.size}개 선택됨` })}</span>
                  <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2">{t('admin.wholesaleProducts.clearSel', { defaultValue: '선택 해제' })}</button>
                  <button type="button" onClick={() => bulkSetPremium(1)} disabled={bulkBusy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50">
                    <Crown className="w-3.5 h-3.5" /> {t('admin.wholesaleProducts.bulkAddPremium', { defaultValue: '프리미엄 추가' })}
                  </button>
                  <button type="button" onClick={() => bulkSetPremium(0)} disabled={bulkBusy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50">
                    {t('admin.wholesaleProducts.bulkRemovePremium', { defaultValue: '프리미엄 제외' })}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
            {items.map((p) => {
              const isPremium = (optimistic[p.id] ?? p.is_premium) === 1
              const busy = togglingId === p.id
              const checked = selectedIds.has(p.id)
              return (
                <div key={p.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${isPremium ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'} ${checked ? 'ring-2 ring-amber-300' : ''}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSelect(p.id)}
                    aria-label={t('admin.wholesaleProducts.selectOne', { defaultValue: `"${p.name}" 선택` })}
                    className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isPremium && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                      <p className="font-semibold text-gray-900 truncate">{p.name || t('admin.wholesaleProducts.noName', { defaultValue: '(이름 없음)' })}</p>
                      {p.is_active !== 1 && (
                        <span className="px-2 py-0.5 rounded-full border text-[11px] font-medium bg-gray-100 text-gray-500 border-gray-200 shrink-0">
                          {t('admin.wholesaleProducts.inactive', { defaultValue: '비활성' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
                      <Store className="w-3 h-3 text-gray-400" />
                      {p.supplier_name || t('admin.wholesaleProducts.noSupplier', { defaultValue: '제조사 미상' })}
                      {p.category && <> · {p.category}</>}
                      {<> · {t('admin.wholesaleProducts.supplyPrice', { defaultValue: '공급가' })} {formatWon(p.supply_price)}</>}
                      <> · #{p.id}</>
                    </p>
                  </div>

                  <button
                    onClick={() => togglePremium(p)}
                    disabled={busy}
                    aria-pressed={isPremium}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0 disabled:opacity-50 ${
                      isPremium
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crown className="w-3.5 h-3.5" />}
                    {isPremium
                      ? t('admin.wholesaleProducts.premiumOn', { defaultValue: '프리미엄' })
                      : t('admin.wholesaleProducts.premiumOff', { defaultValue: '일반' })}
                  </button>
                </div>
              )
            })}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
