import { useState, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardStatCard, DashboardLoading } from '@/components/dashboard'
import { BarChart2, Users, Package, Loader2, TrendingUp, Repeat, ArrowUpRight } from 'lucide-react'
import { formatNumber } from '@/utils/format'

// Recharts lazy load (377KB → 차트 영역만 지연 로드)
const SellerAnalyticsChart = lazy(() => import('@/components/charts/SellerAnalyticsChart'))

export default function SellerAnalyticsPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'revenue' | 'customers' | 'products'>('revenue')
  interface RevenueDataPoint { date: string; revenue: number; orders: number }
  interface CustomerData { total_customers: number; repeat_customers: number; top_customers: { name: string; order_count: number; total_spent: number }[] }
  interface ProductPerformanceItem { id: number; name: string; sold_count: number; order_count: number; revenue: number; avg_rating: number; review_count: number; stock: number }
  interface DetailedAnalytics { conversion_rate: number; repeat_purchase_rate: number; repeat_buyers: number; total_buyers: number }

  const [data, setData] = useState<RevenueDataPoint[] | CustomerData | ProductPerformanceItem[] | null>(null)
  const [detailedData, setDetailedData] = useState<DetailedAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })

  useEffect(() => { load() }, [tab, days])

  useEffect(() => {
    api.get('/api/seller/analytics/detailed', getAuthHeaders())
      .then(r => { if (r.data.success) setDetailedData(r.data.data) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])

  const load = () => {
    setLoading(true)
    const url = tab === 'revenue' ? `/api/seller/analytics/chart/revenue?days=${days}`
      : tab === 'customers' ? '/api/seller/analytics/customers'
      : '/api/seller/analytics/products/performance'
    api.get(url, getAuthHeaders()).then(r => { if (r.data.success) setData(r.data.data) }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }).finally(() => setLoading(false))
  }

  return (
    <SellerLayout title={t('seller.analyticsTitle')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 129: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.analyticsTitle')}
          subtitle={t('seller.analyticsSubtitle', { defaultValue: '매출, 고객, 상품 퍼포먼스 분석' })}
          icon={<BarChart2 className="h-5 w-5" />}
        />

        {/* KPI 카드 */}
        {detailedData && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <DashboardStatCard
              label={t('seller.conversionRate')}
              value={`${detailedData.conversion_rate}%`}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="blue"
            />
            <DashboardStatCard
              label={t('seller.repeatPurchaseRate')}
              value={`${detailedData.repeat_purchase_rate}%`}
              hint={`${detailedData.repeat_buyers}${t('seller.persons')} / ${detailedData.total_buyers}${t('seller.persons')}`}
              icon={<Repeat className="h-4 w-4" />}
              accent="green"
            />
            <DashboardStatCard
              label={t('seller.totalCustomersLabel')}
              value={`${detailedData.total_buyers}${t('seller.persons')}`}
              icon={<Users className="h-4 w-4" />}
              accent="violet"
            />
            <DashboardStatCard
              label={t('seller.repeatBuyers')}
              value={`${detailedData.repeat_buyers}${t('seller.persons')}`}
              icon={<ArrowUpRight className="h-4 w-4" />}
              accent="amber"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'revenue', label: t('seller.revenueChart'), icon: BarChart2 },
            { key: 'customers', label: t('seller.customerAnalysis'), icon: Users },
            { key: 'products', label: t('seller.productPerformance'), icon: Package },
          ].map(tabItem => (
            <button key={tabItem.key} onClick={() => setTab(tabItem.key as 'revenue' | 'customers' | 'products')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${tab === tabItem.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300'}`}>
              <tabItem.icon className="h-4 w-4" />{tabItem.label}
            </button>
          ))}
        </div>

        {loading ? <DashboardLoading /> : (
          <>
            {tab === 'revenue' && data && (
              <div>
                <div className="flex gap-2 mb-4">
                  {[
                    { d: 7, label: t('seller.daysFilter7') },
                    { d: 30, label: t('seller.daysFilter30') },
                    { d: 90, label: t('seller.daysFilter90') },
                  ].map(item => (
                    <button key={item.d} onClick={() => setDays(item.d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${days === item.d ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{item.label}</button>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600">{t('seller.totalRevenueLabel')}</p>
                      <p className="text-xl font-bold text-gray-900">{(data as RevenueDataPoint[]).reduce((s, d) => s + d.revenue, 0)}{t('common.won')}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600">{t('seller.totalOrdersLabel')}</p>
                      <p className="text-xl font-bold text-gray-900">{(data as RevenueDataPoint[]).reduce((s, d) => s + d.orders, 0)}{t('seller.ordersUnit')}</p>
                    </div>
                  </div>

                  {/* Recharts Line Chart for Revenue Trend */}
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-gray-900 mb-2">{t('seller.dailyRevenueTrend')}</h3>
                    {(data as RevenueDataPoint[]).length > 0 ? (
                      <Suspense fallback={<div className="flex items-center justify-center h-[240px]"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>}>
                        <SellerAnalyticsChart data={(data as RevenueDataPoint[]).slice(-30)} />
                      </Suspense>
                    ) : (
                      <p className="text-center text-gray-500 text-xs py-8">{t('seller.noRevenueData')}</p>
                    )}
                  </div>

                  {/* Bar chart fallback (existing) */}
                  <div className="flex items-end gap-1 overflow-x-auto scrollbar-hide" style={{ minHeight: 120 }}>
                    {(data as RevenueDataPoint[]).slice(-14).map((d) => {
                      const max = Math.max(...(data as RevenueDataPoint[]).map((x) => x.revenue)) || 1
                      return (
                        <div key={d.date} className="flex flex-col items-center flex-1 min-w-[28px]">
                          <span className="text-[9px] text-gray-500 mb-1">{(d.revenue / 10000).toFixed(0)}{t('seller.salesUnit')}</span>
                          <div className="w-full bg-gray-100 rounded-t" style={{ height: `${Math.max(4, (d.revenue / max) * 80)}px` }}>
                            <div className="w-full h-full bg-blue-500 rounded-t" />
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1">{d.date.slice(5)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === 'customers' && data && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">{t('seller.totalCustomersLabel')}</p>
                    <p className="text-2xl font-bold text-gray-900">{(data as CustomerData).total_customers}{t('seller.persons')}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">{t('seller.repeatBuyers')}</p>
                    <p className="text-2xl font-bold text-gray-900">{(data as CustomerData).repeat_customers}{t('seller.persons')}</p>
                    <p className="text-xs text-green-600">{(data as CustomerData).total_customers > 0 ? Math.round((data as CustomerData).repeat_customers / (data as CustomerData).total_customers * 100) : 0}%</p>
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
                  <div className="hidden md:grid grid-cols-7 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase">
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
                      <span className={p.stock < 5 ? 'text-red-500 font-medium' : ''}>{p.stock}{t('common.count')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SellerLayout>
  )
}
