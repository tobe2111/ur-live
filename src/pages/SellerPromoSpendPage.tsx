/**
 * 🔍 셀러(매장) — promo 지출(소개비) 투명성 조회 (read-only, 2026-07-10)
 *   설계 SSOT: docs/design/vendor-commission-passthrough.md §4.3 🔒 불변원칙 #1 (투명성):
 *   매장은 자기 promo 지출(누구에게 얼마·어느 딜)을 항상 조회 가능 — 완전위임형이어도.
 *   백엔드: src/features/seller/api/seller-promo-spend.routes.ts
 *     GET /api/seller/promo-spend?months=N (1..12)
 *
 * ⚠️ 재원 프레이밍은 응답 funding.owner_funded 로 게이트 (필수 요구사항):
 *   - owner_funded=true  → "매장 promo 지출 (매장 95% 안 재원 — 유어딜 5% 무관)" + 원장 debit 합계
 *   - owner_funded=false → "소개비 내역" + 중립 안내(현재 플랫폼 부담 — 재원 전환 전)
 *   platform 재원(현행 라이브 기본)인 동안 owner-펀딩 문구는 절대 노출하지 않는다.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { Receipt, RefreshCw, Eye, Users } from 'lucide-react'
import { formatWon, formatNumber, safeNum } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'

// ─── 응답 shape (seller-promo-spend.routes.ts GET / 와 1:1) ──────────────────
interface PromoSpendRow {
  id: number
  order_id: number | null
  product_id: number | null
  product_name: string | null
  commission: number
  status: string | null
  created_at: string
  referrer_id: string
  referrer_name: string | null
  referrer_handle: string | null
}
interface StatusTotal { status: string; total: number; cnt: number }
interface RecipientTotal {
  referrer_id: string
  referrer_name: string | null
  referrer_handle: string | null
  total: number
  cnt: number
}
interface PromoSpendData {
  months: number
  rows: PromoSpendRow[]
  totals_by_status: StatusTotal[]
  recipients: RecipientTotal[]
  funding: {
    funding_source: string // 'platform'(현행 기본) | 'owner'
    owner_funded: boolean
    ledger_debit_sum: number
    label: string
  }
}

const MONTH_OPTIONS = [1, 3, 6, 12]

export default function SellerPromoSpendPage() {
  const { t } = useTranslation()
  const [months, setMonths] = useState(3)

  const q = useApiQuery<PromoSpendData | null>(
    ['seller', 'promo-spend', months], '/api/seller/promo-spend',
    { params: { months }, select: (r: any) => (r?.success ? r.data : null) },
  )
  const data = q.data ?? null
  const rows = data?.rows ?? []
  const totalsByStatus = data?.totals_by_status ?? []
  const recipients = data?.recipients ?? []
  // ⚠️ 게이트: 응답으로 owner 재원이 확인될 때만 owner 프레이밍 — 미로드/platform 은 항상 중립.
  const ownerFunded = data?.funding?.owner_funded === true

  const grandTotal = totalsByStatus.reduce((sum, s) => sum + safeNum(s.total), 0)
  const grandCount = totalsByStatus.reduce((sum, s) => sum + safeNum(s.cnt), 0)

  // affiliate_earnings status 라벨 (pending/holding/granted/refunded — affiliate-credit.ts)
  function statusLabel(status: string | null): string {
    const s = status || 'pending'
    if (s === 'pending') return t('seller.promoSpend.statusPending', { defaultValue: '적립 대기' })
    if (s === 'holding') return t('seller.promoSpend.statusHolding', { defaultValue: '보류' })
    if (s === 'granted') return t('seller.promoSpend.statusGranted', { defaultValue: '적립 확정' })
    if (s === 'refunded') return t('seller.promoSpend.statusRefunded', { defaultValue: '환불 역전' })
    return s
  }
  function statusCls(status: string | null): string {
    const s = status || 'pending'
    if (s === 'granted') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (s === 'refunded') return 'bg-red-100 text-red-700 border-red-200'
    if (s === 'holding') return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-gray-100 text-gray-600 border-gray-200'
  }

  function recipientLabel(name: string | null, handle: string | null, id: string): string {
    const base = name || t('seller.promoSpend.unknownRecipient', { defaultValue: '(알 수 없음)' })
    return handle ? `${base} @${handle}` : `${base} · ${id}`
  }

  const pageTitle = ownerFunded
    ? t('seller.promoSpend.titleOwner', { defaultValue: '매장 promo 지출' })
    : t('seller.promoSpend.titlePlatform', { defaultValue: '소개비 내역' })

  return (
    <SellerLayout title={pageTitle}>
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={
            ownerFunded
              ? `${t('seller.promoSpend.titleOwner', { defaultValue: '매장 promo 지출' })} (${t('seller.promoSpend.ownerNote', { defaultValue: '매장 95% 안 재원 — 유어딜 5% 무관' })})`
              : t('seller.promoSpend.titlePlatform', { defaultValue: '소개비 내역' })
          }
          subtitle={t('seller.promoSpend.subtitle', { defaultValue: '누구에게 얼마·어느 딜 — 위임과 무관하게 항상 조회할 수 있습니다' })}
          icon={<Receipt className="h-5 w-5" />}
        />

        {/* 재원 프레이밍 — owner 확인 시에만 owner 문구, 그 외(현행 platform)는 중립 고지 */}
        {ownerFunded ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-bold text-emerald-800">
              {t('seller.promoSpend.ownerBanner', { defaultValue: '이 지출은 매장 promo 재원(매장 95% 안)에서 나갑니다 — 유어딜 5% 와 무관합니다.' })}
            </p>
            <p className="mt-1 text-[11px] text-emerald-700">
              {t('seller.promoSpend.ledgerDebit', { defaultValue: '원장 promo 차감 합계' })}:{' '}
              <strong>{formatWon(data?.funding?.ledger_debit_sum)}</strong>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs leading-relaxed text-gray-600">
              {t('seller.promoSpend.platformNotice', { defaultValue: '현재는 플랫폼 부담 구조(재원 전환 전)입니다 — 8월 전환 후 매장 promo 재원으로 표시됩니다.' })}
            </p>
          </div>
        )}

        {/* 🔒 불변원칙 #1 리마인더 */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-[11px] leading-relaxed text-blue-700">
            {t('seller.promoSpend.transparencyNote', { defaultValue: '이 내역은 위임 모드와 무관하게 항상 조회할 수 있습니다 (투명성 원칙 — 완전위임형이어도).' })}
          </p>
        </div>

        {/* 기간 선택 (1/3/6/12개월) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-700">
              {t('seller.promoSpend.period', { defaultValue: '조회 기간' })}
            </span>
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  months === m
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t('seller.promoSpend.monthsOption', { defaultValue: '{{n}}개월', n: m })}
              </button>
            ))}
            <button
              type="button"
              onClick={() => q.refetch()}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-3 w-3" />
              {t('common.refresh', { defaultValue: '새로고침' })}
            </button>
          </div>
        </div>

        {q.isLoading ? (
          <DashboardLoading />
        ) : q.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-bold text-red-700">
              {t('seller.promoSpend.loadFailed', { defaultValue: 'promo 지출 내역을 불러오지 못했습니다' })}
            </p>
            <p className="mt-1 text-xs text-red-500">
              {t('seller.promoSpend.loadFailedDesc', { defaultValue: '네트워크 상태를 확인한 뒤 다시 시도해주세요.' })}
            </p>
            <button
              type="button"
              onClick={() => q.refetch()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('seller.promoSpend.retry', { defaultValue: '재시도' })}
            </button>
          </div>
        ) : rows.length === 0 && recipients.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white">
            <DashboardEmptyState
              icon={<Receipt className="h-7 w-7" />}
              title={t('seller.promoSpend.empty', { defaultValue: '기간 내 promo 지출이 없습니다' })}
              description={t('seller.promoSpend.emptyDesc', { defaultValue: '소개(핀)로 팔린 건이 생기면 여기에 표시됩니다.' })}
            />
          </div>
        ) : (
          <>
            {/* 상태별 합계 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-bold text-gray-900">
                {t('seller.promoSpend.totalsTitle', { defaultValue: '상태별 합계' })}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-[10px] font-bold text-gray-500">
                    {t('seller.promoSpend.grandTotal', { defaultValue: '전체 합계' })}
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-gray-900">{formatWon(grandTotal)}</p>
                  <p className="text-[10px] text-gray-400">
                    {t('seller.promoSpend.itemsCount', { defaultValue: '{{n}}건', n: formatNumber(grandCount) })}
                  </p>
                </div>
                {totalsByStatus.map((s) => (
                  <div key={s.status} className="rounded-xl border border-gray-200 bg-white p-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCls(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                    <p className="mt-1.5 text-lg font-extrabold text-gray-900">{formatWon(s.total)}</p>
                    <p className="text-[10px] text-gray-400">
                      {t('seller.promoSpend.itemsCount', { defaultValue: '{{n}}건', n: formatNumber(s.cnt) })}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 수령인별 집계 — §4.3 투명성의 핵심 ("누구에게 얼마") */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                <Users className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-bold text-gray-900">
                  {t('seller.promoSpend.recipientsTitle', { defaultValue: '수령인별 집계' })} ({formatNumber(recipients.length)})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 text-[10px] font-bold uppercase text-gray-400">
                      <th className="px-4 py-2">{t('seller.promoSpend.recipient', { defaultValue: '수령인' })}</th>
                      <th className="px-4 py-2 text-right">{t('seller.promoSpend.total', { defaultValue: '합계' })}</th>
                      <th className="px-4 py-2 text-right">{t('seller.promoSpend.count', { defaultValue: '건수' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recipients.map((r) => (
                      <tr key={r.referrer_id}>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                          {recipientLabel(r.referrer_name, r.referrer_handle, r.referrer_id)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-900">{formatWon(r.total)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-500">{formatNumber(r.cnt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 행 단위 내역 */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-900">
                  {t('seller.promoSpend.rowsTitle', { defaultValue: '지출 내역' })} ({formatNumber(rows.length)})
                </h2>
              </div>
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-400">
                  {t('seller.promoSpend.empty', { defaultValue: '기간 내 promo 지출이 없습니다' })}
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-[160px] flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {row.product_name || `${t('seller.promoSpend.product', { defaultValue: '딜/상품' })} #${row.product_id ?? '-'}`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {recipientLabel(row.referrer_name, row.referrer_handle, row.referrer_id)}
                          {' · '}
                          {formatKSTDate(row.created_at)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusCls(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                      <p className="w-24 text-right text-sm font-bold text-gray-900">{formatWon(row.commission)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SellerLayout>
  )
}
