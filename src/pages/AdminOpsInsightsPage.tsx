import { useTranslation } from 'react-i18next'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { useAdminOpsInsights } from '@/hooks/queries'
import { AlertTriangle, TrendingDown, UserX, Clock, Building2, ExternalLink } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface OpsInsightSummary {
  inactive_agencies: number
  dormant_new_sellers: number
  stuck_pending_orders: number
  dormant_sellers: number
  failed_webhooks_24h?: number
}

interface OpsInsight {
  inactive_agencies: Array<{ id: number; name: string; email: string; monthly_revenue: number; seller_count: number }>
  dormant_new_sellers: Array<{ id: number; business_name: string; email: string; created_at: string; last_login_at: string | null }>
  stuck_pending_orders: Array<{ id: number; order_number: string; total_amount: number; created_at: string }>
  dormant_sellers: Array<{ id: number; business_name: string; last_live: string | null; last_paid: string | null }>
  notifications_24h: Array<{ type: string; cnt: number }>
  failed_webhooks_24h?: Array<{ id: number; source: string; event_type: string; error_message: string; retry_count: number; created_at: string }>
}

export default function AdminOpsInsightsPage() {
  const { t } = useTranslation()
  // 🛡️ 2026-05-22 P1 영구 fix: React Query 마이그.
  //   서버 KV cache 5분 + 클라이언트 staleTime 5분 → admin 페이지 전환 시 cache hit.
  //   같은 admin 가 다시 진입해도 서버 호출 0 (5분 내).
  const { data: insightsData, isLoading: loading } = useAdminOpsInsights()
  const data: OpsInsight | null = (insightsData as OpsInsight) ?? null
  const summary: OpsInsightSummary | null = data ? {
    inactive_agencies: data.inactive_agencies?.length ?? 0,
    dormant_new_sellers: data.dormant_new_sellers?.length ?? 0,
    stuck_pending_orders: data.stuck_pending_orders?.length ?? 0,
    dormant_sellers: data.dormant_sellers?.length ?? 0,
    failed_webhooks_24h: data.failed_webhooks_24h?.length ?? 0,
  } : null

  return (
    <AdminLayout title={t('admin.opsInsights.title', { defaultValue: '운영 인사이트' })}>
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title={t('admin.opsInsights.title', { defaultValue: '운영 인사이트' })}
          subtitle={t('admin.opsInsights.subtitle', { defaultValue: '부진 에이전시 / 미접속 셀러 / 결제 이상 통합 모니터링' })}
          icon={<AlertTriangle className="h-5 w-5" />}
        />

        {/* 요약 카드 */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label={t('admin.opsInsights.cardInactiveAgencies', { defaultValue: '부진 에이전시' })} value={summary.inactive_agencies} icon={Building2} color="amber" />
            <SummaryCard label={t('admin.opsInsights.cardDormantNewSellers', { defaultValue: '미접속 신규셀러' })} value={summary.dormant_new_sellers} icon={UserX} color="orange" />
            <SummaryCard label={t('admin.opsInsights.cardStuckPending', { defaultValue: '결제 PENDING 24h+' })} value={summary.stuck_pending_orders} icon={Clock} color="red" />
            <SummaryCard label={t('admin.opsInsights.cardDormantSellers', { defaultValue: '휴면 셀러 (30일)' })} value={summary.dormant_sellers} icon={TrendingDown} color="gray" />
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-8">{t('admin.opsInsights.loading', { defaultValue: '불러오는 중...' })}</div>
        ) : data ? (
          <>
            {/* 부진 에이전시 */}
            <Section title="🔴 부진 에이전시 (이번 달 매출 0)" count={data.inactive_agencies.length}>
              {data.inactive_agencies.length === 0 ? (
                <Empty />
              ) : (
                <Table headers={['에이전시', '이메일', '소속 셀러', '월 매출']}>
                  {data.inactive_agencies.map(a => (
                    <tr key={a.id} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-sm">
                        <a href={`/admin/agencies?id=${a.id}`} className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
                          {a.name} <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-500">{a.email}</td>
                      <td className="py-2 px-3 text-sm text-center">{a.seller_count}</td>
                      <td className="py-2 px-3 text-sm text-right">{(a.monthly_revenue / 10_000).toFixed(0)}만</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>

            {/* 신규 가입 후 미접속 셀러 */}
            <Section title="🟡 신규 가입 후 7일 미접속 셀러" count={data.dormant_new_sellers.length}>
              {data.dormant_new_sellers.length === 0 ? (
                <Empty />
              ) : (
                <Table headers={['셀러', '이메일', '가입일', '마지막 접속']}>
                  {data.dormant_new_sellers.map(s => (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-sm">{s.business_name}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{s.email}</td>
                      <td className="py-2 px-3 text-xs text-gray-600">{s.created_at?.slice(0, 10)}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{s.last_login_at?.slice(0, 10) || t('admin.opsInsights.none', { defaultValue: '없음' })}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>

            {/* 결제 PENDING 24h+ */}
            <Section title="🔴 결제 PENDING (24시간 이상 — 수동 검토 필요)" count={data.stuck_pending_orders.length}>
              {data.stuck_pending_orders.length === 0 ? (
                <Empty />
              ) : (
                <Table headers={['주문번호', '금액', '생성일']}>
                  {data.stuck_pending_orders.map(o => (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-sm font-mono">{o.order_number}</td>
                      <td className="py-2 px-3 text-sm text-right">{formatNumber(o.total_amount)}원</td>
                      <td className="py-2 px-3 text-xs text-gray-600">{o.created_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>

            {/* 휴면 셀러 */}
            <Section title="⚪ 휴면 셀러 (30일+ 무라이브 + 무매출)" count={data.dormant_sellers.length}>
              {data.dormant_sellers.length === 0 ? (
                <Empty />
              ) : (
                <Table headers={['셀러', '마지막 라이브', '마지막 매출']}>
                  {data.dormant_sellers.slice(0, 30).map(s => (
                    <tr key={s.id} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-sm">{s.business_name}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{s.last_live?.slice(0, 10) || t('admin.opsInsights.none', { defaultValue: '없음' })}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{s.last_paid?.slice(0, 10) || t('admin.opsInsights.none', { defaultValue: '없음' })}</td>
                    </tr>
                  ))}
                  {data.dormant_sellers.length > 30 && (
                    <tr><td colSpan={3} className="text-xs text-gray-400 text-center py-2">... {t('admin.opsInsights.andMore', { defaultValue: '외 {{count}}명', count: data.dormant_sellers.length - 30 })}</td></tr>
                  )}
                </Table>
              )}
            </Section>

            {/* Webhook 실패 (TD-009) */}
            {data.failed_webhooks_24h && data.failed_webhooks_24h.length > 0 && (
              <Section title="🔴 Webhook 실패 (24h)" count={data.failed_webhooks_24h.length}>
                <Table headers={['Source', 'Event', '오류', 'Retry', '시각']}>
                  {data.failed_webhooks_24h.map(w => (
                    <tr key={w.id} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-sm">{w.source}</td>
                      <td className="py-2 px-3 text-xs text-gray-700">{w.event_type}</td>
                      <td className="py-2 px-3 text-xs text-red-600 max-w-md truncate" title={w.error_message}>{w.error_message}</td>
                      <td className="py-2 px-3 text-xs text-center">{w.retry_count}</td>
                      <td className="py-2 px-3 text-xs text-gray-500">{w.created_at?.slice(0, 16)}</td>
                    </tr>
                  ))}
                </Table>
              </Section>
            )}

            {/* 24h 알림 통계 */}
            {data.notifications_24h.length > 0 && (
              <Section title="📊 24시간 알림 통계" count={data.notifications_24h.length}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3">
                  {data.notifications_24h.map(n => (
                    <div key={n.type} className="bg-gray-50 rounded p-2 text-xs">
                      <div className="text-gray-500">{n.type}</div>
                      <div className="font-bold text-gray-900">{n.cnt}건</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        ) : null}
      </div>
    </AdminLayout>
  )
}

function SummaryCard(props: { label: string; value: number; icon: React.ElementType; color: string }) {
  const Icon = props.icon
  const colors: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  }
  return (
    <div className={`rounded-xl p-4 border ${colors[props.color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs">{props.label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="text-2xl font-bold">{props.value}</div>
    </div>
  )
}

function Section(props: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{props.title}</h3>
        <span className="text-xs text-gray-500">{props.count}건</span>
      </div>
      {props.children}
    </div>
  )
}

function Table(props: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50">
          <tr>
            {props.headers.map(h => (
              <th key={h} className="py-2 px-3 text-[10px] font-bold uppercase text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  )
}

function Empty() {
  return <div className="p-6 text-center text-xs text-gray-400">✅ 검출된 항목 없음</div>
}
