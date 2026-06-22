/**
 * 🛡️ 2026-06-01 도매몰 INC-4: 공급자가 직접 등록한 공급상품 승인 큐 (어드민).
 *   GET /api/admin/supplier-products?status=... · PATCH /api/admin/supplier-products/:id
 * 🏭 2026-06-07 (사용자 요청): 온라인 최저가 검수 + 공급가 변경 승인 큐 추가.
 *   - 신규/대기 상품: 제조사 제출 '온라인 최저가 링크' 확인 후 '최저가 확인함' 체크 → 승인.
 *   - 판매중 상품 가격 변경 요청(price_change): 현재가→요청가 비교 후 승인(반영)/거부.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Boxes, CheckCircle, XCircle, Clock, ExternalLink, ShieldCheck, TrendingUp, Search, AlertTriangle, Percent, Save } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'
import { formatWon } from '@/utils/format'
import { distributorPriceFromCost } from '@/lib/distributor-pricing'
import api from '@/lib/api'

export interface SupplierProductRow {
  id: number
  name: string
  description: string | null
  retail_price: number
  supply_price: number
  stock: number
  category: string | null
  approval_status: string
  supplier_id: number
  supplier_name: string | null
  supplier_email: string | null
  admin_memo: string | null
  created_at: string
  margin_override?: number | null
  lowest_price_url?: string | null
  lowest_price_checked?: number
  pending_supply_price?: number | null
  pending_retail_price?: number | null
  pending_price_url?: string | null
  pending_price_reason?: string | null
  pending_price_requested_at?: string | null
}

interface Props {
  loading: boolean
  items: SupplierProductRow[]
  statusFilter: string
  setStatusFilter: (s: string) => void
  adminMemoMap: Record<number, string>
  setAdminMemoMap: (fn: (prev: Record<number, string>) => Record<number, string>) => void
  lowestCheckedMap: Record<number, boolean>
  setLowestCheckedMap: (fn: (prev: Record<number, boolean>) => Record<number, boolean>) => void
  // 🆕 2026-06-19 (대표 확정) 제품별 플랫폼 마진 — 미끼/마진 전략. id → 입력 문자열('' = 전역 기본).
  marginMap: Record<number, string>
  setMarginMap: (fn: (prev: Record<number, string>) => Record<number, string>) => void
  defaultMarginPct: number
  marginSaving: number | null
  onSetMargin: (id: number) => void
  actionLoading: number | null
  onAction: (id: number, action: 'approve' | 'reject') => void
  onPriceChangeAction: (id: number, action: 'approve' | 'reject') => void
}

const FILTERS = [
  { key: 'pending', labelKey: 'admin.products.spPending', label: '승인 대기' },
  { key: 'price_change', labelKey: 'admin.products.spPriceChange', label: '가격변경 요청' },
  { key: 'approved', labelKey: 'admin.products.spApproved', label: '승인됨' },
  { key: 'rejected', labelKey: 'admin.products.spRejected', label: '거부됨' },
  { key: 'all', labelKey: 'admin.products.spAll', label: '전체' },
]

const won = (n: number | null | undefined, suffix: string) => `${(n ?? 0).toLocaleString()}${suffix}`

// ── 네이버쇼핑 최저가 참고 (BIZ-5 v1) ─────────────────────────────────────────
// advisory only — 자동승인 아님. 어드민이 공급가/최저가링크와 눈으로 비교 후 '최저가 확인함' 체크.
interface NaverPriceRefItem {
  title: string
  lprice: number
  hprice: number | null
  mallName: string
  link: string
  image: string
  brand: string
  maker: string
}
interface NaverPriceRefResp {
  available: boolean
  reason?: string
  query?: string
  used_barcode?: boolean
  min_lprice?: number
  median_lprice?: number
  items?: NaverPriceRefItem[]
  cached?: boolean
  fetched_at?: string
}

function NaverPriceReferencePanel({ query }: { query: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NaverPriceRefResp | null>(null)
  const [error, setError] = useState(false)

  const fetchRef = async () => {
    const next = !open
    setOpen(next)
    // 닫을 때, 또는 이미 로드된 경우 재요청 안 함.
    if (!next || data || loading) return
    setLoading(true)
    setError(false)
    try {
      const res = await api.get<NaverPriceRefResp>('/api/admin/wholesale/price-reference', {
        params: { query },
      })
      setData(res.data || { available: false })
    } catch {
      // advisory — 실패해도 검수 막지 않음. 조용히 빈 상태.
      setError(true)
      setData({ available: false, reason: 'CLIENT_ERROR', items: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
          <Search className="w-3.5 h-3.5" />
          {t('admin.products.naverPriceRefTitle', { defaultValue: '네이버 최저가 참고' })}
        </p>
        <button
          type="button"
          onClick={fetchRef}
          disabled={loading}
          className="px-2 py-1 text-[11px] font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          {open
            ? t('admin.products.naverPriceRefHide', { defaultValue: '접기' })
            : t('admin.products.naverPriceRefShow', { defaultValue: '최저가 조회' })}
        </button>
      </div>

      <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
        {t('admin.products.naverPriceRefDisclaimer', {
          defaultValue: '참고용 — 자동승인 아님, 동명이품(同名異品) 주의',
        })}
      </p>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="py-3 text-center">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500 mx-auto" />
            </div>
          ) : !data || !data.available ? (
            <p className="text-[11px] text-gray-500">
              {data?.reason === 'NAVER_API_KEY_MISSING'
                ? t('admin.products.naverPriceRefNoKey', { defaultValue: '네이버 API 키 미설정' })
                : error
                  ? t('admin.products.naverPriceRefError', { defaultValue: '조회 실패 (참고값 없음)' })
                  : t('admin.products.naverPriceRefEmpty', { defaultValue: '참고할 최저가 정보가 없습니다.' })}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                <span className="text-[11px] text-gray-600">
                  {t('admin.products.naverPriceRefMin', { defaultValue: '최저가' })}:{' '}
                  <span className="font-bold text-emerald-700">{formatWon(data.min_lprice)}</span>
                </span>
                <span className="text-[11px] text-gray-600">
                  {t('admin.products.naverPriceRefMedian', { defaultValue: '중앙값' })}:{' '}
                  <span className="font-bold text-emerald-700">{formatWon(data.median_lprice)}</span>
                </span>
                {data.cached && (
                  <span className="text-[10px] text-gray-400">
                    {t('admin.products.naverPriceRefCached', { defaultValue: '(캐시됨)' })}
                  </span>
                )}
              </div>

              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {(data.items || []).slice(0, 10).map((it, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 text-[11px] bg-white rounded px-2 py-1 border border-emerald-100"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-gray-800">{it.title}</p>
                      <p className="text-gray-400">
                        {it.mallName}
                        {it.brand ? ` · ${it.brand}` : ''}
                      </p>
                    </div>
                    <span className="font-semibold text-emerald-700 whitespace-nowrap">
                      {formatWon(it.lprice)}
                    </span>
                    {it.link && (
                      <a
                        href={it.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex-shrink-0"
                        title={t('admin.products.naverPriceRefOpen', { defaultValue: '열기' })}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── 🆕 2026-06-19 (대표 확정) 제품별 플랫폼 마진 설정 — 미끼/마진 전략 ───────────────
//   제조사 공급가(원가) 위에 우리 마진%를 붙여 '유통사 공급가'를 산출. 미끼=낮게, 고수익=높게.
//   판매가(권장소비자가)를 상한, 공급원가를 하한으로 클램프(distributorPriceFromCost SSOT 동일 공식).
function MarginEditor({
  product, defaultMarginPct, raw, setRaw, saving, onSave,
}: {
  product: SupplierProductRow
  defaultMarginPct: number
  raw: string | undefined
  setRaw: (v: string) => void
  saving: boolean
  onSave: () => void
}) {
  const { t } = useTranslation()
  const cost = Math.max(0, Math.floor(product.supply_price || 0))
  const retail = Math.max(0, Math.floor(product.retail_price || 0))
  // 현재 입력값(undefined=아직 미수정 → 저장된 override 또는 '') 정규화.
  const current = raw ?? (product.margin_override != null ? String(product.margin_override) : '')
  const trimmed = current.trim()
  const usingDefault = trimmed === ''
  const effPct = usingDefault ? defaultMarginPct : Number(trimmed)
  const validPct = Number.isFinite(effPct) && effPct >= 0 && effPct <= 90
  const dist = validPct ? distributorPriceFromCost(cost, effPct, retail) : cost
  const ourMargin = Math.max(0, dist - cost)
  const cappedByRetail = retail > 0 && validPct && Math.round(cost * (1 + effPct / 100)) > retail
  // 저장 변경 감지: 입력값(빈='' → null) vs 저장된 override.
  const storedNum = product.margin_override != null ? Number(product.margin_override) : null
  const inputNum = trimmed === '' ? null : Number(trimmed)
  const changed = validPct && inputNum !== storedNum
  const presets = [3, defaultMarginPct, 30, 50]

  return (
    <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-indigo-800 flex items-center gap-1">
          <Percent className="w-3.5 h-3.5" />
          {t('admin.products.marginTitle', { defaultValue: '플랫폼 마진 설정 (미끼/마진 전략)' })}
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={!changed || saving}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {t('admin.products.marginSave', { defaultValue: '마진 저장' })}
        </button>
      </div>
      <p className="text-[11px] text-indigo-600/90 mt-0.5">
        {t('admin.products.marginHint', { defaultValue: '미끼 상품은 낮게(2~5%), 고수익 상품은 높게(30~50%) — 모든 가격은 부가세 포함.' })}
      </p>

      {/* 프리셋 칩 */}
      <div className="flex flex-wrap items-center gap-1 mt-2">
        {presets.map((p, i) => {
          const isDefaultChip = i === 1
          const active = isDefaultChip ? usingDefault : (!usingDefault && Number(trimmed) === p)
          return (
            <button
              key={`${p}-${i}`}
              type="button"
              onClick={() => setRaw(isDefaultChip ? '' : String(p))}
              className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${active ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'}`}
            >
              {isDefaultChip ? t('admin.products.marginDefault', { pct: defaultMarginPct, defaultValue: `기본 ${defaultMarginPct}%` }) : `${p}%`}
            </button>
          )
        })}
      </div>

      {/* 입력 + 실시간 공급가 미리보기 */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <div className="relative">
          <input
            type="number" min={0} max={90} step={0.5}
            value={current}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={String(defaultMarginPct)}
            aria-label={t('admin.products.marginTitle', { defaultValue: '플랫폼 마진 설정' })}
            className="w-24 pl-2.5 pr-6 py-1.5 text-sm font-bold text-indigo-900 border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-300 focus:outline-none"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-indigo-400">%</span>
        </div>
        <span className="text-[11px] text-gray-500">→ {t('admin.products.marginDistPrice', { defaultValue: '유통사 공급가' })}</span>
        <span className="text-base font-extrabold text-indigo-700">{formatWon(dist)}</span>
        {usingDefault && (
          <span className="text-[10px] text-gray-400">{t('admin.products.marginUsingDefault', { defaultValue: '(전역 기본)' })}</span>
        )}
      </div>

      <p className="text-[11px] text-gray-600 mt-1">
        {t('admin.products.marginCost', { defaultValue: '공급원가' })} <b className="text-gray-800">{formatWon(cost)}</b>
        {' · '}
        {t('admin.products.marginOur', { defaultValue: '우리 마진' })} <b className="text-emerald-600">{formatWon(ourMargin)}</b>
        {retail > 0 && <> {' · '}{t('admin.products.marginRetail', { defaultValue: '판매가' })} {formatWon(retail)}</>}
      </p>
      {cappedByRetail && (
        <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {t('admin.products.marginCapped', { defaultValue: '판매가 상한에 도달 — 공급가가 판매가로 제한됩니다.' })}
        </p>
      )}
      {!validPct && trimmed !== '' && (
        <p className="text-[11px] text-red-500 mt-0.5">{t('admin.products.marginInvalid', { defaultValue: '0~90 사이 숫자를 입력하세요.' })}</p>
      )}
    </div>
  )
}

export default function SupplierProductsTab({
  loading, items, statusFilter, setStatusFilter, adminMemoMap, setAdminMemoMap,
  lowestCheckedMap, setLowestCheckedMap, marginMap, setMarginMap, defaultMarginPct,
  marginSaving, onSetMargin, actionLoading, onAction, onPriceChangeAction,
}: Props) {
  const { t } = useTranslation()
  const wonUnit = t('common.won', { defaultValue: '원' })

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex gap-1 p-3 border-b border-gray-100 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === f.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t(f.labelKey, { defaultValue: f.label })}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <Boxes className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('admin.products.spEmpty', { defaultValue: '제조사 등록 상품이 없습니다.' })}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {items.map(p => {
            const hasPriceChange = p.pending_supply_price != null
            return (
            <div key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {p.approval_status === 'pending' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700"><Clock className="w-3 h-3" /> {t('admin.products.spPending', { defaultValue: '승인 대기' })}</span>}
                    {p.approval_status === 'approved' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700"><CheckCircle className="w-3 h-3" /> {t('admin.products.spApproved', { defaultValue: '승인됨' })}</span>}
                    {p.approval_status === 'rejected' && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600"><XCircle className="w-3 h-3" /> {t('admin.products.spRejected', { defaultValue: '거부됨' })}</span>}
                    {p.lowest_price_checked === 1 && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700"><ShieldCheck className="w-3 h-3" /> {t('admin.products.spLowestChecked', { defaultValue: '최저가 검수됨' })}</span>}
                    {hasPriceChange && <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700"><TrendingUp className="w-3 h-3" /> {t('admin.products.spPriceChange', { defaultValue: '가격변경 요청' })}</span>}
                    <span className="text-xs text-gray-400">{formatKSTDate(p.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('admin.products.spSupplier', { defaultValue: '제조사' })}: <span className="font-medium">{p.supplier_name || p.supplier_email || `#${p.supplier_id}`}</span>
                    &nbsp;·&nbsp; {t('admin.products.sampleSupplyPrice', { defaultValue: '공급가' })} <span className="text-purple-600 font-medium">{won(p.supply_price, wonUnit)}</span>
                    &nbsp;·&nbsp; {t('admin.products.spRetail', { defaultValue: '권장가' })} {won(p.retail_price, wonUnit)}
                    &nbsp;·&nbsp; {t('admin.products.spStock', { defaultValue: '재고' })} {p.stock}
                  </p>
                  {p.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>}

                  {/* 온라인 최저가 참고 링크 (검수용). */}
                  {p.lowest_price_url && (
                    <a href={p.lowest_price_url} target="_blank" rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                      <ExternalLink className="w-3 h-3" /> {t('admin.products.spLowestLink', { defaultValue: '온라인 최저가 참고 링크' })}
                    </a>
                  )}

                  {/* 네이버쇼핑 최저가 참고값 (BIZ-5 v1) — 검수 대기/가격변경 단계에서만 노출. advisory. */}
                  {(p.approval_status !== 'approved' || hasPriceChange) && p.name && (
                    <NaverPriceReferencePanel query={p.name} />
                  )}

                  {/* 🆕 2026-06-19 제품별 플랫폼 마진 설정 (미끼/마진 전략) — 가격변경 요청 외 항상 노출(승인 후도 조율 가능). */}
                  {!hasPriceChange && (
                    <MarginEditor
                      product={p}
                      defaultMarginPct={defaultMarginPct}
                      raw={marginMap[p.id]}
                      setRaw={(v) => setMarginMap(prev => ({ ...prev, [p.id]: v }))}
                      saving={marginSaving === p.id}
                      onSave={() => onSetMargin(p.id)}
                    />
                  )}

                  {/* 가격 변경 요청 상세 (현재가 → 요청가). */}
                  {hasPriceChange && (
                    <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                      <p className="text-xs font-semibold text-orange-800 mb-1">{t('admin.products.spPriceChangeReq', { defaultValue: '가격 변경 요청' })}</p>
                      <p className="text-xs text-gray-700">
                        {t('admin.products.spSupplyPriceShort', { defaultValue: '공급가' })}: <span className="line-through text-gray-400">{won(p.supply_price, wonUnit)}</span> → <span className="font-bold text-orange-700">{won(p.pending_supply_price, wonUnit)}</span>
                      </p>
                      {p.pending_retail_price != null && (
                        <p className="text-xs text-gray-700">
                          {t('admin.products.spRetail', { defaultValue: '권장가' })}: <span className="line-through text-gray-400">{won(p.retail_price, wonUnit)}</span> → <span className="font-bold text-orange-700">{won(p.pending_retail_price, wonUnit)}</span>
                        </p>
                      )}
                      {p.pending_price_reason && <p className="text-xs text-gray-500 mt-0.5">{t('admin.products.spReason', { defaultValue: '사유' })}: {p.pending_price_reason}</p>}
                      {p.pending_price_url && (
                        <a href={p.pending_price_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                          <ExternalLink className="w-3 h-3" /> {t('admin.products.spLowestLink', { defaultValue: '온라인 최저가 참고 링크' })}
                        </a>
                      )}
                    </div>
                  )}

                  {p.admin_memo && p.approval_status !== 'pending' && !hasPriceChange && (
                    <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">{t('admin.products.adminMemo', { defaultValue: '어드민 메모' })}: {p.admin_memo}</p>
                  )}
                </div>

                {/* 액션 패널 — 가격변경 요청 우선, 그 다음 신규/대기 상품 승인. */}
                {hasPriceChange ? (
                  <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                    <textarea
                      placeholder={t('admin.products.k036', { defaultValue: '어드민 메모 (선택)' })}
                      value={adminMemoMap[p.id] || ''}
                      onChange={e => setAdminMemoMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => onPriceChangeAction(p.id, 'approve')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                        {actionLoading === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        {t('admin.products.spApplyPrice', { defaultValue: '반영' })}
                      </button>
                      <button onClick={() => onPriceChangeAction(p.id, 'reject')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50">
                        <XCircle className="w-3 h-3" /> {t('admin.products.reject', { defaultValue: '거부' })}
                      </button>
                    </div>
                  </div>
                ) : p.approval_status !== 'approved' && (
                  <div className="flex-shrink-0 flex flex-col gap-2 w-48">
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={!!lowestCheckedMap[p.id]}
                        onChange={e => setLowestCheckedMap(prev => ({ ...prev, [p.id]: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300" />
                      {t('admin.products.spLowestConfirm', { defaultValue: '온라인 최저가 확인함' })}
                    </label>
                    <textarea
                      placeholder={t('admin.products.k036', { defaultValue: '어드민 메모 (선택)' })}
                      value={adminMemoMap[p.id] || ''}
                      onChange={e => setAdminMemoMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                      rows={2}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => onAction(p.id, 'approve')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {actionLoading === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        {t('admin.products.approve', { defaultValue: '승인' })}
                      </button>
                      <button onClick={() => onAction(p.id, 'reject')} disabled={actionLoading === p.id}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                        <XCircle className="w-3 h-3" /> {t('admin.products.reject', { defaultValue: '거부' })}
                      </button>
                    </div>
                  </div>
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
