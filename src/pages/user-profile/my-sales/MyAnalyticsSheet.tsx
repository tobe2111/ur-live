import { useState } from 'react'
import Sheet from '../seller-section/Sheet'
import SegmentedTabs from '@/components/ui/segmented-tabs'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatNumber, formatWon, safeNum } from '@/utils/format'
import type { IdleHoursReport, HourBlock } from '@/shared/idle-hours'
import { BigNumberCard, Card, PlateLoading, PlateRow } from './ui'

/**
 * 📊 마이 — **매출 분석** (시안 M4 판매 있음 · M5 아직 판매 없음). 2026-11-03 대표 확정 *"좋다 다 해줘"*.
 *
 * 숫자는 셀러 매출 분석 화면(`SellerAnalyticsPage`)과 **같은 요청·같은 캐시 키**다 — 매출 막대
 *   (`/api/seller/analytics/chart/revenue?days=`) · 고객·재구매(`/detailed`) · 빈 시간대(`/idle-hours`) ·
 *   누가 팔았나(`/agency-link/performance`). 계산을 새로 짓지 않는다(합계는 받은 점들의 합).
 * 깊은 화면(고객 목록·상품별·추천 수익·유입)은 **그 화면을 시트로** 연다(`onOpenPage`) — 두 벌을 만들지 않는다.
 * 모르는 값은 `—`, 사장님이 아니라 막힌 카드(누가 팔았나 403)는 **안 그린다**(0 으로 위장 금지).
 */
interface RevenuePoint { date: string; revenue: number; orders: number }
interface Detailed { conversion_rate: number; repeat_purchase_rate: number; repeat_buyers: number; total_buyers: number }
interface Metrics { sold: number; revenue: number }
interface Perf { rows: Array<Metrics & { kind: 'owner' | 'agency'; name: string }>; referrals: Array<Metrics & { name: string | null }> }
const ok = <T,>(r: unknown): T | null => ((r as { success?: boolean; data?: T })?.success ? (r as { data: T }).data : null)

export default function MyAnalyticsSheet({ onClose, onOpenPage, onNew }: {
  onClose: () => void
  onOpenPage: (path: string, title: string) => void
  onNew: () => void
}) {
  const [days, setDays] = useState(30)
  const revQ = useApiQuery<RevenuePoint[] | null>(['seller', 'analytics', 'revenue', days], `/api/seller/analytics/chart/revenue?days=${days}`, { select: ok })
  const detQ = useApiQuery<Detailed | null>(['seller', 'analytics-detailed'], '/api/seller/analytics/detailed', { select: ok })
  const everSold = !!detQ.data && detQ.data.total_buyers > 0
  const idleQ = useApiQuery<IdleHoursReport | null>(['seller', 'analytics', 'idle-hours'], '/api/seller/analytics/idle-hours', { select: ok, enabled: everSold })
  const perfQ = useApiQuery<Perf | null>(['seller', 'analytics', 'channel-performance', '30d'], '/api/seller/agency-link/performance?period=30d', { select: ok, enabled: everSold })

  const points = Array.isArray(revQ.data) ? revQ.data : []
  const revenue = points.reduce((s, p) => s + safeNum(p.revenue), 0)
  const orders = points.reduce((s, p) => s + safeNum(p.orders), 0)

  return (
    <Sheet title="매출 분석" onClose={onClose} tall>
      <div className="pb-8" data-testid="my-analytics-sheet">
        {detQ.isLoading ? <PlateLoading /> : !everSold ? (
          <NoSales onNew={onNew} />
        ) : (
          <>
            <div className="mx-3 mt-1">
              <SegmentedTabs<'30' | '90'> value={days === 90 ? '90' : '30'} onChange={(v) => setDays(v === '90' ? 90 : 30)}
                items={[{ id: '30', label: '최근 30일' }, { id: '90', label: '90일' }]} />
            </div>
            <BigNumberCard
              caption={`최근 ${days}일 매출`} testId="my-analytics-summary"
              value={revQ.isLoading ? '—' : formatWon(revenue)}
              sub={<Bars points={points} />}
              cells={[
                { label: '주문', value: revQ.isLoading ? '—' : `${formatNumber(orders)}건` },
                { label: '고객', value: `${formatNumber(detQ.data?.total_buyers ?? 0)}명` },
                { label: '재구매', value: `${Math.round(safeNum(detQ.data?.repeat_purchase_rate))}%` },
              ]}
            />
            {perfQ.data && <WhoSold perf={perfQ.data} />}
            {idleQ.data?.enough && idleQ.data.quietest && <IdleCard block={idleQ.data.quietest} onNew={onNew} />}
            <Card className="px-5 py-1">
              <PlateRow label="고객·상품별·추천 수익 더 보기" onClick={() => onOpenPage('/seller/analytics', '매출 분석')} />
            </Card>
          </>
        )}
      </div>
    </Sheet>
  )
}

/** 막대 — 점이 많으면(90일) 주 단위로 묶어 12개 안팎으로. 마지막(지금)만 진한 블루. */
function Bars({ points }: { points: RevenuePoint[] }) {
  if (points.length === 0) return null
  const step = Math.max(1, Math.ceil(points.length / 14))
  const buckets: number[] = []
  for (let i = 0; i < points.length; i += step) buckets.push(points.slice(i, i + step).reduce((s, p) => s + safeNum(p.revenue), 0))
  const max = Math.max(1, ...buckets)
  return (
    <div className="mt-5 flex items-end gap-1 h-20" aria-hidden="true" data-testid="my-analytics-bars">
      {buckets.map((v, i) => (
        <span key={i} className={`flex-1 rounded-md ${i === buckets.length - 1 ? 'bg-brand' : 'bg-brand-tint'}`} style={{ height: `${Math.max(4, Math.round((v / max) * 80))}px` }} />
      ))}
    </div>
  )
}

function WhoSold({ perf }: { perf: Perf }) {
  const rows = [
    ...perf.rows.filter((r) => r.sold > 0).map((r) => ({ label: r.kind === 'owner' ? '매장 직접' : r.name || '에이전시', m: r })),
    ...(perf.referrals.length > 0 ? [{ label: '소개 링크', m: perf.referrals.reduce((a, r) => ({ sold: a.sold + r.sold, revenue: a.revenue + r.revenue }), { sold: 0, revenue: 0 }) }] : []),
  ]
  if (rows.length === 0) return null
  return (
    <Card className="px-5 py-1" testId="my-analytics-who">
      <p className="pt-4 pb-1 text-[16px] font-semibold text-gray-900 dark:text-white">누가 팔았나</p>
      {rows.map((r) => <PlateRow key={r.label} label={r.label} value={`${formatNumber(r.m.sold)}건 · ${formatWon(r.m.revenue)}`} />)}
    </Card>
  )
}

function IdleCard({ block, onNew }: { block: HourBlock; onNew: () => void }) {
  const h = (x: number) => { const hh = ((x % 24) + 24) % 24; return `${hh < 12 ? '오전' : '오후'} ${hh % 12 === 0 ? 12 : hh % 12}시` }
  const day = block.dayType === 'weekday' ? '평일' : '주말'
  return (
    <Card className="px-5 py-4">
      <button type="button" onClick={onNew} className="w-full flex items-center gap-3 text-left active:opacity-70">
        <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-xl bg-brand-tint text-brand-text flex items-center justify-center text-[13px] font-medium tabular-nums">{((block.from % 12) || 12)}시</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-medium text-gray-900 dark:text-white">{day} {h(block.from)}~{h(block.to)}이 가장 한가해요</span>
          <span className="mt-1 block text-[13px] text-gray-500 dark:text-gray-400">그 시간 한정 이용권으로 빈자리를 채워 보세요</span>
        </span>
      </button>
    </Card>
  )
}

/** M5 — 아직 판매가 없을 때. 빈 흰 면 대신 '판매가 생기면 보이는 것' 을 미리 보여 준다. */
function NoSales({ onNew }: { onNew: () => void }) {
  return (
    <>
      <Card className="px-5 py-8 text-center" testId="my-analytics-empty">
        <p className="text-[28px] font-bold tabular-nums text-gray-900 dark:text-white">0원</p>
        <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">아직 판매가 없어요<br />첫 이용권이 팔리면 여기 숫자가 쌓여요</p>
        <button type="button" onClick={onNew} className="mt-5 ur-btn ur-btn-md ur-btn-primary">이용권 등록하기</button>
      </Card>
      <p className="px-5 pt-8 text-[13px] font-medium text-gray-500 dark:text-gray-400">판매가 생기면 보이는 것</p>
      <Card className="mt-2 px-5 py-1">
        {[['매출 추이', '하루·주별 매출 막대'], ['고객·재구매', '몇 명이 샀고 몇 명이 다시 샀는지'], ['누가 팔았나', '매장 직접·소개 링크'], ['빈 시간대', '가장 한가한 시간을 알려 드려요']].map(([a, b]) => (
          <div key={a} className="py-3 border-b border-rule last:border-b-0">
            <p className="text-[15px] font-medium text-gray-900 dark:text-white">{a}</p>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">{b}</p>
          </div>
        ))}
      </Card>
    </>
  )
}
