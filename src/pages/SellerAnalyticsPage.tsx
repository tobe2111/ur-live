/**
 * 📊 셀러 매출 분석 — **안 C** (2026-09-15 대표 확정 "안 C로 가자").
 *
 * 시안 갤러리 `/design/variants?set=seller-analytics` 에서 세 안을 나란히 놓고 고른 결과다.
 * 고른 근거는 실측이었다: 내용이 나오기 전에 질문이 셋(탭 6 → 기간 3)이고 **그 답이 전부 0** 으로 갔다.
 *
 * ## 안 C 가 하는 일
 *   · 전 기간 판매가 0 이면 → **재는 도구를 안 그린다**(`NoSalesEver`). 지금 할 수 있는 일 하나만.
 *   · 이 기간에만 0 이면 → 기간을 넓히라고 한다(`AnalyticsOverview` 안). 온보딩 문구를 쓰면 틀린 말이 된다.
 *   · 판매가 있으면 → 안 B 구조(`AnalyticsOverview`): 기간 하나 → 큰 숫자 하나 → 목록의 줄.
 *
 * ## 기능은 하나도 안 줄었다
 *   종전 탭 6개는 전부 남아 있고, **버튼 줄이 아니라 목록의 줄**로 들어간다(자주 안 쓰는 셋은 `더 보기` 뒤).
 *   안쪽 화면에서는 ← 로 요약으로 돌아온다.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SellerLayout from '@/components/SellerLayout'
import { DashboardLoading } from '@/components/dashboard'
import { ChevronLeft } from 'lucide-react'
import { formatNumber, formatWon } from '@/utils/format'
import AnalyticsOverview, { type RevenuePoint, type SubView } from './seller-analytics/AnalyticsOverview'
import { NoSalesEver } from './seller-analytics/NoSalesYet'

export default function SellerAnalyticsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'revenue' | 'customers' | 'products' | 'commission' | 'monthly' | 'funnel'>('revenue')
  interface RevenueDataPoint { date: string; revenue: number; orders: number }
  interface CustomerData { total_customers: number; repeat_customers: number; top_customers: { name: string; order_count: number; total_spent: number }[] }
  interface ProductPerformanceItem { id: number; name: string; sold_count: number; order_count: number; revenue: number; avg_rating: number; review_count: number; stock: number }
  interface DetailedAnalytics { conversion_rate: number; repeat_purchase_rate: number; repeat_buyers: number; total_buyers: number }

  interface CommissionSummary { summary: { total_granted: number; total_pending: number; total_paid_out: number; referred_users_count: number }; top_referred: { source_user_id: string; order_count: number; total_commission: number }[] }
  interface MonthlyTrend { month: string; new_products: number; new_vouchers: number }
  interface FunnelKpi { days: number; clicks_total: number; unique_visitors: number; orders: number; commission_total: number; conversion_rate: number }

  const [days, setDays] = useState(30)
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (tab/days별 캐시).
  const analyticsUrl = tab === 'revenue' ? `/api/seller/analytics/chart/revenue?days=${days}`
    : tab === 'customers' ? '/api/seller/analytics/customers'
    : tab === 'products' ? '/api/seller/analytics/products/performance'
    : tab === 'commission' ? '/api/seller/analytics/referral-commissions/summary'
    : tab === 'funnel' ? '/api/seller/funnel-kpi?days=30'
    : '/api/seller/analytics/products/monthly-trend'
  const { data = null, isLoading: loading, isError } = useApiQuery<RevenueDataPoint[] | CustomerData | ProductPerformanceItem[] | CommissionSummary | MonthlyTrend[] | FunnelKpi | null>(
    ['seller', 'analytics', tab, days], analyticsUrl, { select: (r: any) => (r?.success ? r.data : null) },
  )
  const { data: detailedData = null } = useApiQuery<DetailedAnalytics | null>(
    ['seller', 'analytics-detailed'], '/api/seller/analytics/detailed', { select: (r: any) => (r?.success ? r.data : null) },
  )

  const [showMore, setShowMore] = useState(false)
  const points: RevenuePoint[] = tab === 'revenue' && Array.isArray(data) ? (data as RevenuePoint[]) : []
  const windowRevenue = points.reduce((sum, d) => sum + d.revenue, 0)
  const windowOrders = points.reduce((sum, d) => sum + d.orders, 0)
  // ⚠️ `total_buyers` 는 **전 기간** 집계다(`/analytics/detailed` 는 날짜 필터가 없다). 그래서
  //   "한 번도 판 적 없음" 의 근거로 쓸 수 있다 — 기간 합계로 판정하면 60일 전에 판 사람에게 거짓말을 한다.
  const everSold = !!detailedData && detailedData.total_buyers > 0

  return (
    <SellerLayout title={t('seller.analyticsTitle')}>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 안쪽 화면에서 돌아오는 길 — 탭 버튼 줄이 없어진 자리를 대신한다. */}
        {tab !== 'revenue' && (
          <button type="button" onClick={() => setTab('revenue')}
            className="inline-flex items-center gap-1 text-[13px] font-bold text-gray-500 hover:text-gray-900">
            <ChevronLeft className="h-4 w-4" />{t('seller.analyticsView.back', { defaultValue: '매출 요약으로' })}
          </button>
        )}

        {loading ? <DashboardLoading /> : (
          <>
            {tab === 'revenue' && (
              !everSold ? <NoSalesEver /> : (
                <AnalyticsOverview
                  days={days} onDays={setDays}
                  points={points} revenue={windowRevenue} orders={windowOrders}
                  buyers={detailedData?.total_buyers ?? 0}
                  repeatRate={detailedData?.repeat_purchase_rate ?? 0}
                  conversionRate={detailedData?.conversion_rate ?? 0}
                  showMore={showMore} onShowMore={() => setShowMore(true)}
                  onOpen={(v: SubView) => setTab(v)}
                />
              )
            )}

            {tab === 'customers' && data && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">{t('seller.totalCustomersLabel')}</p>
                    <p className="dash-num text-[length:var(--dash-stat,24px)] font-extrabold leading-tight tracking-tight text-gray-900">{(data as CustomerData).total_customers}{t('seller.persons')}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">{t('seller.repeatBuyers')}</p>
                    <p className="dash-num text-[length:var(--dash-stat,24px)] font-extrabold leading-tight tracking-tight text-gray-900">{(data as CustomerData).repeat_customers}{t('seller.persons')}</p>
                    <p className="text-xs text-tone-ok">{(data as CustomerData).total_customers > 0 ? Math.round((data as CustomerData).repeat_customers / (data as CustomerData).total_customers * 100) : 0}%</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">{t('seller.topCustomers')}</h3></div>
                  {((data as CustomerData).top_customers || []).length === 0 && (
                    <p className="text-center text-gray-500 text-xs py-6">{t('seller.noCustomerData')}</p>
                  )}
                  {((data as CustomerData).top_customers || []).map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.name || t('seller.totalCustomersLabel')}</p>
                        <p className="text-xs text-gray-500">{c.order_count}{t('seller.ordersUnit')} {t('seller.orderCount')}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{formatNumber(c.total_spent)}{t('common.won')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'products' && data && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900">{t('seller.productPerformance')}</h3>
                </div>
                {(data as ProductPerformanceItem[]).length === 0 && (
                  <p className="text-center text-gray-500 text-xs py-6">{t('seller.noProductData')}</p>
                )}
                {/* Table header */}
                {(data as ProductPerformanceItem[]).length > 0 && (
         <div className="hidden md:grid grid-cols-7 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500">
                    <span className="col-span-2">{t('seller.productName')}</span>
                    <span className="text-right">{t('seller.unitsSold')}</span>
                    <span className="text-right">{t('seller.orderCount')}</span>
                    <span className="text-right">{t('seller.revenueLabel')}</span>
                    <span className="text-right">{t('seller.avgRating')}</span>
                    <span className="text-right">{t('seller.stockLabel')}</span>
                  </div>
                )}
                {(data as ProductPerformanceItem[]).map((p) => (
                  <div key={p.id} className="grid grid-cols-1 md:grid-cols-7 gap-1 md:gap-2 items-center px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                    <div className="md:col-span-2 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    </div>
                    <div className="flex md:block md:text-right gap-3 text-xs text-gray-500">
                      <span className="md:hidden font-medium text-gray-400">{t('seller.unitsSold')}:</span>
                      <span>{p.sold_count}{t('common.count')}</span>
                    </div>
                    <div className="flex md:block md:text-right gap-3 text-xs text-gray-500">
                      <span className="md:hidden font-medium text-gray-400">{t('seller.orderCount')}:</span>
                      <span>{p.order_count}{t('seller.ordersUnit')}</span>
                    </div>
                    <div className="flex md:block md:text-right gap-3 text-xs">
                      <span className="md:hidden font-medium text-gray-400">{t('seller.revenueLabel')}:</span>
                      <span className="font-bold text-gray-900">{formatNumber(p.revenue)}{t('common.won')}</span>
                    </div>
                    <div className="flex md:block md:text-right gap-3 text-xs text-gray-500">
                      <span className="md:hidden font-medium text-gray-400">{t('seller.avgRating')}:</span>
                      <span>{p.avg_rating > 0 ? `★${Number(p.avg_rating).toFixed(1)} (${p.review_count})` : '-'}</span>
                    </div>
                    <div className="flex md:block md:text-right gap-3 text-xs text-gray-500">
                      <span className="md:hidden font-medium text-gray-400">{t('seller.stockLabel')}:</span>
                      <span className={p.stock < 5 ? 'text-tone-bad font-medium' : ''}>{p.stock}{t('common.count')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'commission' && data && (() => {
              const cd = data as CommissionSummary
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">출금 가능</p>
                      <p className="text-xl font-bold text-gray-900">{formatWon(cd.summary.total_granted)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">대기 중</p>
                      <p className="text-xl font-bold text-tone-warn">{formatWon(cd.summary.total_pending)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">누적 출금</p>
                      <p className="text-xl font-bold text-tone-ok">{formatWon(cd.summary.total_paid_out)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">추천한 고객수</p>
                      <p className="text-xl font-bold text-gray-900">{cd.summary.referred_users_count}명</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">상위 추천 고객</h3>
                      <a href="/my-commissions" className="text-xs text-brand-text hover:underline">출금 신청 →</a>
                    </div>
                    {cd.top_referred.length === 0 ? (
                      <p className="text-center text-gray-500 text-xs py-6">아직 추천 commission 이 없습니다.</p>
                    ) : (
                      cd.top_referred.map((r, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                          <div>
                            <p className="text-sm font-mono text-gray-700">{r.source_user_id}</p>
                            <p className="text-xs text-gray-500">주문 {r.order_count}건</p>
                          </div>
                          <p className="text-sm font-bold text-gray-900">{formatWon(r.total_commission)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })()}

            {tab === 'monthly' && data && (() => {
              const months = data as MonthlyTrend[]
              const max = Math.max(1, ...months.map(m => m.new_products))
              return (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">최근 12개월 신규 등록 상품</h3>
                  {months.length === 0 ? (
                    <p className="text-center text-gray-500 text-xs py-8">데이터가 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {months.map(m => (
                        <div key={m.month} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-700 w-16">{m.month}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden relative">
                            <div className="bg-brand h-full rounded-full" style={{ width: `${(m.new_products / max) * 100}%` }} />
                            <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-900">
                              {m.new_products}개 (이용권 {m.new_vouchers}개)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {tab === 'funnel' && data && (() => {
              const k = data as FunnelKpi
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">총 클릭</p>
                      <p className="dash-num text-[length:var(--dash-stat,24px)] font-extrabold leading-tight tracking-tight text-gray-900">{k.clicks_total.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 mt-1">최근 {k.days}일</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">고유 방문자</p>
                      <p className="dash-num text-[length:var(--dash-stat,24px)] font-extrabold leading-tight tracking-tight text-gray-900">{k.unique_visitors.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 mt-1">IP + UA 기준</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">결제 발생</p>
                      <p className="dash-num text-[length:var(--dash-stat,24px)] font-extrabold leading-tight tracking-tight text-gray-900">{k.orders.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 mt-1">commission 기준</p>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="text-xs text-gray-500">전환율</p>
                      <p className="dash-num text-[length:var(--dash-stat,24px)] font-extrabold leading-tight tracking-tight text-gray-900">{k.conversion_rate}%</p>
                      <p className="text-[10px] text-gray-400 mt-1">클릭 → 결제</p>
                    </div>
                  </div>
                  <div className="bg-white border border-rule rounded-xl p-4">
                    <p className="text-sm font-bold text-gray-700">누적 commission ({k.days}일): {formatWon(k.commission_total)}</p>
                    <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                      • 클릭 → 결제 전환율이 1% 미만이면 콘텐츠/상품 매력 점검<br />
                      • 클릭 vs 고유 방문자 비율로 같은 사람 재방문 측정 가능<br />
                      • 실시간 ledger: <a href="/seller/ledger" className="underline">/seller/ledger</a>
                    </p>
                  </div>
                </div>
              )
            })()}
            {/* 🛡️ 2026-07-20 (셀러 감사): 퍼널 탭도 다른 탭처럼 빈/오류 상태 표시(기존엔 data 없으면 무표시 → 빈 화면). */}
            {tab === 'funnel' && !loading && !data && (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
                {isError ? '데이터를 불러오지 못했습니다' : '표시할 데이터가 없습니다'}
              </div>
            )}
          </>
        )}
      </div>
    </SellerLayout>
  )
}
