/**
 * 🏬 2026-06-09 멀티-몰(Phase 2) — 어드민 도매 통합 현황 (cross-mall overview, v1, 검토 필요).
 *
 *   슈퍼-어드민(한 운영자가 식품/패션 등 카테고리별 도매몰 운영)의 랜딩 화면. ONE 화면에서
 *   전체 합산(totals strip) + 몰별(per-mall) 건강도를 본다. 읽기 전용.
 *   백엔드: GET /api/admin/wholesale-overview → { malls: row[], totals }.
 *
 *   라이트 고정 테마(대시보드 — dark: 없음). 모든 금액 NaN-safe(formatWon/formatNumber).
 *   대기 액션(입금확인>0 / 제안>0) 있는 몰은 배지 강조. 예치금 부채는 시각적으로 구분(부채).
 *   몰이 1개여도 동작(그 몰 + totals==그 몰) — 특수처리 불필요.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardStatCard } from '@/components/dashboard'
import { formatWon, formatNumber } from '@/utils/format'
import {
  LayoutDashboard, Loader2, Wallet, ShoppingBag, Users, Store, Package,
  Inbox, MessageSquare, Settings, ArrowUpRight, AlertCircle,
} from 'lucide-react'

interface MallRow {
  mall_id: number
  mall_name: string
  active: number
  distributors: number
  suppliers: number
  products: number
  gmv_month: number
  deposit_liability: number
  pending_charge_requests: number
  pending_proposals: number
  orders_month: number
}

interface Totals {
  malls: number
  distributors: number
  suppliers: number
  products: number
  gmv_month: number
  deposit_liability: number
  pending_charge_requests: number
  pending_proposals: number
  orders_month: number
}

interface OverviewResp {
  malls: MallRow[]
  totals: Totals
}

const EMPTY_TOTALS: Totals = {
  malls: 0, distributors: 0, suppliers: 0, products: 0,
  gmv_month: 0, deposit_liability: 0,
  pending_charge_requests: 0, pending_proposals: 0, orders_month: 0,
}

export default function AdminWholesaleOverviewPage() {
  const { t } = useTranslation()

  const { data, isLoading: loading } = useApiQuery<OverviewResp>(
    ['admin', 'wholesale-overview'], '/api/admin/wholesale-overview',
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      select: (r: any) => (r?.success ? { malls: (r.malls ?? []) as MallRow[], totals: (r.totals ?? EMPTY_TOTALS) as Totals } : { malls: [], totals: EMPTY_TOTALS }),
      staleTime: 2 * 60 * 1000,
    },
  )
  const malls = data?.malls ?? []
  const totals = data?.totals ?? EMPTY_TOTALS

  return (
    <AdminLayout title={t('admin.wsOverview.title', { defaultValue: '도매 통합 현황' })}>
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader
          icon={<LayoutDashboard className="w-5 h-5" />}
          title={t('admin.wsOverview.heading', { defaultValue: '도매 통합 현황' })}
          subtitle={t('admin.wsOverview.subtitle', { defaultValue: '카테고리별 도매몰(식품/패션 등)의 거래·예치금·대기 액션을 한눈에. 이번달 기준.' })}
        />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {/* ── Totals strip ───────────────────────────────────────────── */}
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <DashboardStatCard
                label={t('admin.wsOverview.totalGmv', { defaultValue: '전체 거래액 (이번달)' })}
                value={formatWon(totals.gmv_month)}
                icon={<ShoppingBag className="w-4 h-4" />}
                hint={t('admin.wsOverview.totalOrders', { defaultValue: '{{n}}건 결제', n: formatNumber(totals.orders_month) })}
                accent="blue"
              />
              <DashboardStatCard
                label={t('admin.wsOverview.totalLiability', { defaultValue: '예치금 부채 합' })}
                value={formatWon(totals.deposit_liability)}
                icon={<Wallet className="w-4 h-4" />}
                hint={t('admin.wsOverview.liabilityHint', { defaultValue: '유통사에 갚을 잔액' })}
                accent="rose"
              />
              <DashboardStatCard
                label={t('admin.wsOverview.totalPendingCharge', { defaultValue: '대기 입금확인' })}
                value={formatNumber(totals.pending_charge_requests)}
                icon={<Inbox className="w-4 h-4" />}
                hint={t('admin.wsOverview.pendingProposalsN', { defaultValue: '대기 제안 {{n}}건', n: formatNumber(totals.pending_proposals) })}
                accent={totals.pending_charge_requests > 0 ? 'amber' : 'gray'}
              />
              <DashboardStatCard
                label={t('admin.wsOverview.totalParticipants', { defaultValue: '유통사 · 제조사 · 상품' })}
                value={`${formatNumber(totals.distributors)} · ${formatNumber(totals.suppliers)} · ${formatNumber(totals.products)}`}
                icon={<Users className="w-4 h-4" />}
                hint={t('admin.wsOverview.mallCount', { defaultValue: '몰 {{n}}개', n: formatNumber(totals.malls) })}
                accent="violet"
              />
            </div>

            {/* ── Per-mall cards ─────────────────────────────────────────── */}
            <h2 className="mt-8 mb-3 text-sm font-bold text-gray-700">
              {t('admin.wsOverview.perMall', { defaultValue: '몰별 현황' })}
            </h2>

            {malls.length === 0 ? (
              <p className="text-center text-gray-400 py-16">{t('admin.wsOverview.empty', { defaultValue: '등록된 몰이 없습니다.' })}</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {malls.map((m) => {
                  const hasPending = m.pending_charge_requests > 0 || m.pending_proposals > 0
                  return (
                    <div
                      key={m.mall_id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${hasPending ? 'border-amber-300 ring-1 ring-amber-100' : 'border-gray-200'}`}
                    >
                      {/* 헤더: 몰 이름 + 상태 + 대기 배지 */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base font-bold text-gray-900 truncate">{m.mall_name}</span>
                          <span className="text-[11px] font-mono text-gray-400">#{m.mall_id}</span>
                          {m.mall_id === 1 && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{t('admin.wsOverview.defaultMall', { defaultValue: '기본' })}</span>}
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {m.active ? t('admin.wsOverview.active', { defaultValue: '활성' }) : t('admin.wsOverview.inactive', { defaultValue: '비활성' })}
                          </span>
                        </div>
                        {hasPending && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                            <AlertCircle className="w-3 h-3" />
                            {t('admin.wsOverview.actionNeeded', { defaultValue: '대기 액션' })}
                          </span>
                        )}
                      </div>

                      {/* 지표 그리드 */}
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                        <Metric icon={<ShoppingBag className="w-3.5 h-3.5" />} label={t('admin.wsOverview.gmvMonth', { defaultValue: '거래액(월)' })} value={formatWon(m.gmv_month)} />
                        <Metric icon={<ShoppingBag className="w-3.5 h-3.5" />} label={t('admin.wsOverview.ordersMonth', { defaultValue: '주문(월)' })} value={`${formatNumber(m.orders_month)}건`} />
                        {/* 예치금 부채 — 시각적으로 구분(rose) */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-[11px] text-rose-500">
                            <Wallet className="w-3.5 h-3.5" />
                            <span className="truncate">{t('admin.wsOverview.liability', { defaultValue: '예치금 부채' })}</span>
                          </div>
                          <p className="mt-0.5 text-sm font-bold text-rose-600">{formatWon(m.deposit_liability)}</p>
                        </div>
                        <Metric icon={<Users className="w-3.5 h-3.5" />} label={t('admin.wsOverview.distributors', { defaultValue: '유통사' })} value={`${formatNumber(m.distributors)}`} />
                        <Metric icon={<Store className="w-3.5 h-3.5" />} label={t('admin.wsOverview.suppliers', { defaultValue: '제조사' })} value={`${formatNumber(m.suppliers)}`} />
                        <Metric icon={<Package className="w-3.5 h-3.5" />} label={t('admin.wsOverview.products', { defaultValue: '상품' })} value={`${formatNumber(m.products)}`} />
                      </div>

                      {/* 대기 액션 라인 (강조) */}
                      {hasPending && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {m.pending_charge_requests > 0 && (
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800">
                              <Inbox className="w-3.5 h-3.5" />
                              {t('admin.wsOverview.pendingChargeN', { defaultValue: '입금확인 {{n}}건', n: formatNumber(m.pending_charge_requests) })}
                            </span>
                          )}
                          {m.pending_proposals > 0 && (
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700">
                              <MessageSquare className="w-3.5 h-3.5" />
                              {t('admin.wsOverview.pendingProposalN', { defaultValue: '제안 {{n}}건', n: formatNumber(m.pending_proposals) })}
                            </span>
                          )}
                        </div>
                      )}

                      {/* 퀵 링크 */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <QuickLink to="/admin/wholesale-deposits" icon={<Inbox className="w-3.5 h-3.5" />} label={t('admin.wsOverview.linkDeposits', { defaultValue: '입금확인' })} highlight={m.pending_charge_requests > 0} />
                        <QuickLink to="/admin/wholesale-proposals" icon={<MessageSquare className="w-3.5 h-3.5" />} label={t('admin.wsOverview.linkProposals', { defaultValue: '제안' })} highlight={m.pending_proposals > 0} />
                        <QuickLink to="/admin/wholesale-malls" icon={<Settings className="w-3.5 h-3.5" />} label={t('admin.wsOverview.linkMalls', { defaultValue: '몰 설정' })} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="mt-5 text-xs text-gray-400">
              {t('admin.wsOverview.footnote', { defaultValue: '거래액·주문은 이번달 PAID 기준. 예치금 부채는 플랫폼이 유통사에 갚아야 할 잔액 총합입니다. 입금확인/제안 처리는 모든 몰 공통 큐에서 이뤄집니다.' })}
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] text-gray-400">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 text-sm font-bold text-gray-900 truncate">{value}</p>
    </div>
  )
}

function QuickLink({ to, icon, label, highlight }: { to: string; icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-1 text-[12px] font-semibold transition-colors ${highlight ? 'text-amber-700 hover:text-amber-900' : 'text-gray-500 hover:text-gray-900'}`}
    >
      {icon}
      {label}
      <ArrowUpRight className="w-3 h-3 opacity-60" />
    </Link>
  )
}
