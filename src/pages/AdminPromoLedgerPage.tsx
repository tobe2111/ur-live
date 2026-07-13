/**
 * 🧾 2026-07-10 어드민 — promo/커미션 재원 원장 감사 콕핏 (불변식 #44 검증 표면, read-only).
 *
 *   목적: 8월 promo flip(재원 owner 전환) *전에* 만들어, flip 검증 시 이 화면으로
 *   "원장 platform:revenue = 5% 전액 · 성장 커미션 debit 0"(docs/AUDIT_INVARIANTS.md #44,
 *   CLAUDE.md ⭐ 커미션 재원 확정 원칙 2026-07-08)을 눈으로 확인. 돈 이동 0 · 정산 로직 무변경.
 *
 *   판정 로직(중요): promo_funding_source==='platform'(flip 전)이면 커미션 debit 은
 *   **예상된 현행 항목**(info 톤) — flip 후('owner')에만 debit 존재 = 🔴 위반.
 *
 *   데이터: GET /api/admin/promo-ledger/summary?month= · /orders?month=&page=
 *   (admin-promo-ledger.routes.ts — 응답 형태 1:1 매칭).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '@/components/AdminLayout'
import SEO from '@/components/SEO'
import { DashboardPageHeader } from '@/components/dashboard'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon, formatNumber } from '@/utils/format'
import {
  BookOpenCheck, ShieldCheck, ShieldAlert, Info, ChevronLeft, ChevronRight, Settings,
} from 'lucide-react'

const MONTH_RE = /^\d{4}-\d{2}$/

interface SuspectDebit {
  id: number
  event_type: string
  amount: number
  reference_id: string | null
  created_at: string
}

interface SummaryData {
  month: string
  switches: {
    promo_funding_source: string
    commission_budget_enabled: string
    pg_reserve_pct: string | null
    seller_promo_field_enabled: string
  }
  orders: { count: number; amount: number }
  affiliate_promo: { sum: number; count: number }
  experience_noncash?: { count: number; sum_amount: number; note: string }
  fee_breakdown: {
    count: number
    platform_sum: number
    promo_sum: number
    agency_sum: number
    owner_net_sum: number
  }
  invariant_44: {
    platform_revenue_credit_sum: number
    platform_revenue_credit_count: number
    platform_revenue_debit_sum: number
    platform_revenue_debit_count: number
    suspect_commission_debit_count: number
    suspect_commission_debits: SuspectDebit[]
    note: string
  }
}

interface OrderRow {
  order_id: number
  order_number: string | null
  seller_id: number | null
  status: string | null
  amount: number
  ownership: string | null
  platform: number
  agency: number
  platform_net: number
  promo: number
  supply: number
  owner_net: number
  created_at: string | null
}

interface OrdersData {
  month: string
  page: number
  limit: number
  total: number
  rows: OrderRow[]
}

/** 현재 월(YYYY-MM) — 서버 폴백(UTC)과 동일 기준. */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

/** YYYY-MM ± n개월. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map((v) => parseInt(v, 10))
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

/** 재원/게이트 스위치 상태 칩 — owner/ON=emerald, platform/OFF=gray (read-only). */
function SwitchChip({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
          on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </div>
  )
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center justify-between">
      <span>데이터를 불러오지 못했습니다.</span>
      <button
        onClick={onRetry}
        className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
      >
        다시 시도
      </button>
    </div>
  )
}

export default function AdminPromoLedgerPage() {
  const [month, setMonth] = useState<string>(currentMonth())
  const [page, setPage] = useState(1)
  const monthValid = MONTH_RE.test(month)

  const summaryQ = useApiQuery<SummaryData>(
    ['admin', 'promo-ledger', 'summary', month],
    '/api/admin/promo-ledger/summary',
    {
      params: { month },
      enabled: monthValid,
      select: (r) => (r as { data: SummaryData }).data,
    },
  )
  const ordersQ = useApiQuery<OrdersData>(
    ['admin', 'promo-ledger', 'orders', month, page],
    '/api/admin/promo-ledger/orders',
    {
      params: { month, page },
      enabled: monthValid,
      select: (r) => (r as { data: OrdersData }).data,
    },
  )

  const changeMonth = (next: string) => {
    if (!MONTH_RE.test(next)) return // 요청 전 YYYY-MM 검증 — 불일치 값은 state 에 안 들어감
    setMonth(next)
    setPage(1)
  }

  const s = summaryQ.data
  const sw = s?.switches
  const inv = s?.invariant_44
  const fundingOwner = sw?.promo_funding_source === 'owner'
  const budgetOn = sw?.commission_budget_enabled === 'true'
  const promoFieldOn = sw?.seller_promo_field_enabled === 'true'
  const pgReservePct = sw?.pg_reserve_pct
  const pgReserveSet = pgReservePct != null && pgReservePct !== ''
  const suspects = inv?.suspect_commission_debits || []
  const suspectCount = inv?.suspect_commission_debit_count || 0

  const orders = ordersQ.data
  const rows = orders?.rows || []
  const totalPages = Math.max(1, Math.ceil((orders?.total || 0) / (orders?.limit || 50)))

  return (
    <AdminLayout title="promo 재원 원장">
      <SEO title="promo 재원 원장 — Admin" />
      <DashboardPageHeader
        icon={<BookOpenCheck className="w-5 h-5" />}
        title="promo 재원 원장 감사 — 불변식 #44 콕핏"
        subtitle="원장 platform:revenue = 5% 전액 · 성장 커미션 debit 0 검증 (읽기 전용 — 돈 이동 없음)"
      />

      {/* ── 재원 스위치 패널 (read-only) ─────────────────────────────── */}
      <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SwitchChip
            label="promo 재원 (promo_funding_source)"
            value={sw?.promo_funding_source || 'platform'}
            on={fundingOwner}
          />
          <SwitchChip
            label="커미션 예산 아비터 (commission_budget_enabled)"
            value={budgetOn ? 'ON' : 'OFF'}
            on={budgetOn}
          />
          <SwitchChip
            label="PG 준비금 (pg_reserve_pct)"
            value={pgReserveSet ? `${pgReservePct}%` : '미설정'}
            on={pgReserveSet}
          />
          <SwitchChip
            label="셀러 promo 필드 (seller_promo_field_enabled)"
            value={promoFieldOn ? 'ON' : 'OFF'}
            on={promoFieldOn}
          />
        </div>
        <p className="mt-2 text-[11px] text-gray-500 flex items-center gap-1">
          <Settings className="w-3 h-3" />
          이 화면은 상태 표시 전용 — 전환은{' '}
          <Link to="/admin/platform-settings" className="text-blue-600 underline font-medium">
            플랫폼 설정
          </Link>
          에서 합니다.
        </p>
      </div>

      {/* ── 월 선택 ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => changeMonth(shiftMonth(month, -1))}
          className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          aria-label="이전 달"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="month"
          value={month}
          onChange={(e) => changeMonth(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 font-medium"
        />
        <button
          onClick={() => changeMonth(shiftMonth(month, 1))}
          className="p-2 bg-white border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          aria-label="다음 달"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {month !== currentMonth() && (
          <button
            onClick={() => changeMonth(currentMonth())}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 underline"
          >
            이번 달로
          </button>
        )}
      </div>

      {summaryQ.isError && <ErrorRetry onRetry={() => summaryQ.refetch()} />}
      {summaryQ.isLoading && <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>}

      {s && (
        <>
          {/* ── 월 집계 카드 ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <StatCard
              label={`${s.month} 결제 주문 (DONE/PAID/DELIVERED)`}
              value={formatWon(s.orders.amount)}
              sub={`${formatNumber(s.orders.count)}건`}
            />
            <StatCard
              label="어필리에이트 promo 적립 (holding/granted)"
              value={formatWon(s.affiliate_promo.sum)}
              sub={`${formatNumber(s.affiliate_promo.count)}건`}
            />
            <StatCard
              label="그림자 기록 (order_fee_breakdown)"
              value={`${formatNumber(s.fee_breakdown.count)}건`}
              sub="fee-resolver 계산 기록 — 실정산 아님"
            />
            <StatCard label="플랫폼 수수료 합 (platform)" value={formatWon(s.fee_breakdown.platform_sum)} />
            <StatCard label="promo 합" value={formatWon(s.fee_breakdown.promo_sum)} />
            <StatCard
              label="에이전시 합 / 주인 net 합"
              value={formatWon(s.fee_breakdown.agency_sum)}
              sub={`owner_net ${formatWon(s.fee_breakdown.owner_net_sum)}`}
            />
          </div>

          {/* ── 🎬 WP-A 비정산 마킹: 0원 체험권 발급 (매장 자기부담) ────────── */}
          {s.experience_noncash && s.experience_noncash.count > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-amber-800">
                  비정산 — 0원 체험권 발급 ({formatNumber(s.experience_noncash.count)}건)
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                  s.experience_noncash.sum_amount === 0
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-red-100 text-red-700 border-red-200'
                }`}>
                  결제액 합 {formatWon(s.experience_noncash.sum_amount)}
                  {s.experience_noncash.sum_amount === 0 ? ' ✓ 0원 정상' : ' ⚠︎ 회귀 의심'}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700">
                매장 자기부담 체험 제공 — 정산·커미션·유어딜 5% 무관(사용 시 원장/커미션 amount&gt;0 게이트로 자동 skip).
                QR 사용확인은 정상 기록됩니다.
              </p>
            </div>
          )}

          {/* ── 불변식 #44 패널 ────────────────────────────────────────── */}
          {inv && (
            <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-bold text-gray-800 mb-3">
                🔒 불변식 #44 — 원장 platform:revenue 대칭 (성장 커미션 debit 0)
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                  <p className="text-[11px] text-emerald-700 font-medium">credit (수수료 5% 유입)</p>
                  <p className="text-lg font-bold text-emerald-800">
                    {formatWon(inv.platform_revenue_credit_sum)}
                  </p>
                  <p className="text-[11px] text-emerald-600">
                    {formatNumber(inv.platform_revenue_credit_count)}건
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-[11px] text-gray-500 font-medium">debit (유출)</p>
                  <p className="text-lg font-bold text-gray-800">
                    {formatWon(inv.platform_revenue_debit_sum)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {formatNumber(inv.platform_revenue_debit_count)}건
                  </p>
                </div>
              </div>

              {/* 판정 — flip 전(platform)은 info, flip 후(owner)는 strict */}
              {!fundingOwner ? (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 text-blue-500" />
                  <span>
                    <strong>전환 전(promo_funding_source=platform)</strong> — 현행 모델에선 커미션이
                    플랫폼 재원(아래 목록은 <strong>예상된 현행 항목</strong>). 8월 flip(owner 전환) 후에는
                    이 목록이 0이어야 합니다.
                  </span>
                </div>
              ) : suspectCount === 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex gap-2 font-bold">
                  <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>✅ 불변식 #44 준수 — 성장 커미션 debit 0 (유어딜 5% 불가침 유지)</span>
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex gap-2">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-red-500" />
                  <span>
                    <strong>
                      🔴 불변식 #44 위반 — 성장 커미션이 platform:revenue 를 debit 중 ({formatNumber(suspectCount)}건)
                    </strong>
                    <br />
                    owner 재원 전환 후엔 어떤 커미션도 유어딜 5%를 건드리면 안 됩니다. 아래 항목을 확인하세요.
                  </span>
                </div>
              )}

              {/* 의심 debit 목록 */}
              {suspects.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-medium">event_type</th>
                        <th className="px-3 py-2 text-right font-medium">금액</th>
                        <th className="px-3 py-2 text-left font-medium">reference_id</th>
                        <th className="px-3 py-2 text-left font-medium">일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {suspects.map((d) => (
                        <tr key={d.id} className={fundingOwner ? 'bg-red-50/40' : ''}>
                          <td className="px-3 py-2 font-mono text-gray-700">{d.event_type}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {formatWon(d.amount)}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-500">{d.reference_id || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">
                            {d.created_at ? d.created_at.slice(0, 16).replace('T', ' ') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {suspectCount > suspects.length && (
                    <p className="mt-1 text-[10px] text-gray-400">
                      최근 {suspects.length}건 표시 (총 {formatNumber(suspectCount)}건)
                    </p>
                  )}
                </div>
              )}
              <p className="mt-2 text-[10px] text-gray-400 leading-tight">{inv.note}</p>
            </div>
          )}
        </>
      )}

      {/* ── 주문별 그림자 감사 표 ───────────────────────────────────────── */}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">
          주문별 수수료 분해 (order_fee_breakdown{orders ? ` — 총 ${formatNumber(orders.total)}건` : ''})
        </p>
        {orders && orders.total > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-1 bg-white border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              이전
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 bg-white border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {ordersQ.isError && <ErrorRetry onRetry={() => ordersQ.refetch()} />}
      {ordersQ.isLoading && <p className="text-sm text-gray-400 py-6 text-center">불러오는 중…</p>}

      {orders && rows.length === 0 && !ordersQ.isLoading && (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-gray-500">
          {s?.month || month} 의 그림자 기록이 없습니다. (FEE_RESOLVER_ENABLED 그림자 기록 또는{' '}
          <Link to="/admin/fee-breakdown" className="text-blue-600 underline">
            수수료 규칙 검증
          </Link>
          의 백필로 채워집니다.)
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left font-medium">주문</th>
                <th className="px-2 py-2 text-center font-medium">상태</th>
                <th className="px-3 py-2 text-right font-medium">결제액</th>
                <th className="px-3 py-2 text-right font-medium bg-gray-100">플랫폼</th>
                <th className="px-3 py-2 text-right font-medium">promo</th>
                <th className="px-3 py-2 text-right font-medium">에이전시</th>
                <th className="px-3 py-2 text-right font-medium">주인 net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.order_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-700">
                    {r.order_number || `#${r.order_id}`}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">
                      {r.status || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{formatWon(r.amount)}</td>
                  <td className="px-3 py-2 text-right text-gray-700 bg-gray-50/50">{formatWon(r.platform)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatWon(r.promo)}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{formatWon(r.agency)}</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">{formatWon(r.owner_net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <p className="mt-2 text-[10px] text-gray-400">
          그림자 기록은 fee-resolver 계산 전용 — 실제 정산과 별개(읽기 전용). 페이지당 {orders?.limit || 50}건.
        </p>
      )}
    </AdminLayout>
  )
}
