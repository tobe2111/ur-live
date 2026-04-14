import { useState, useEffect } from 'react'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { BarChart2, Users, Package, Loader2 } from 'lucide-react'

export default function SellerAnalyticsPage() {
  const [tab, setTab] = useState<'revenue' | 'customers' | 'products'>('revenue')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } }

  useEffect(() => { load() }, [tab, days])

  const load = () => {
    setLoading(true)
    const url = tab === 'revenue' ? `/api/seller/analytics/chart/revenue?days=${days}`
      : tab === 'customers' ? '/api/seller/analytics/customers'
      : '/api/seller/analytics/products/performance'
    api.get(url, h).then(r => { if (r.data.success) setData(r.data.data) }).catch(() => {}).finally(() => setLoading(false))
  }

  return (
    <SellerLayout title="매출 분석">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">매출 분석</h1>
        <div className="flex gap-2 mb-4">
          {[
            { key: 'revenue', label: '매출 차트', icon: BarChart2 },
            { key: 'customers', label: '고객 분석', icon: Users },
            { key: 'products', label: '상품 성과', icon: Package },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : (
          <>
            {tab === 'revenue' && data && (
              <div>
                <div className="flex gap-2 mb-4">
                  {[7, 30, 90].map(d => (
                    <button key={d} onClick={() => setDays(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${days === d ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{d}일</button>
                  ))}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600">총 매출</p>
                      <p className="text-xl font-bold text-gray-900">{(data as any[]).reduce((s: number, d: any) => s + d.revenue, 0).toLocaleString()}원</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600">총 주문</p>
                      <p className="text-xl font-bold text-gray-900">{(data as any[]).reduce((s: number, d: any) => s + d.orders, 0)}건</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {(data as any[]).slice(-14).map((d: any) => {
                      const max = Math.max(...(data as any[]).map((x: any) => x.revenue)) || 1
                      return (
                        <div key={d.date} className="flex items-center gap-2 text-xs">
                          <span className="w-16 text-gray-500 shrink-0">{d.date.slice(5)}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-4">
                            <div className="bg-blue-500 h-4 rounded-full" style={{ width: `${(d.revenue / max) * 100}%` }} />
                          </div>
                          <span className="w-20 text-right text-gray-700 font-medium">{d.revenue.toLocaleString()}</span>
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
                    <p className="text-xs text-gray-500">전체 고객</p>
                    <p className="text-2xl font-bold text-gray-900">{data.total_customers}명</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">재구매 고객</p>
                    <p className="text-2xl font-bold text-gray-900">{data.repeat_customers}명</p>
                    <p className="text-xs text-green-600">{data.total_customers > 0 ? Math.round(data.repeat_customers / data.total_customers * 100) : 0}%</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">상위 고객</h3></div>
                  {(data.top_customers || []).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.name || '고객'}</p>
                        <p className="text-xs text-gray-500">{c.order_count}건 주문</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{Number(c.total_spent).toLocaleString()}원</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'products' && data && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900">상품별 성과</h3></div>
                {(data as any[]).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        <span>판매 {p.sold_count}개</span>
                        <span>주문 {p.order_count}건</span>
                        {p.avg_rating > 0 && <span>★{Number(p.avg_rating).toFixed(1)} ({p.review_count})</span>}
                        <span>재고 {p.stock}개</span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-900 ml-3">{Number(p.revenue).toLocaleString()}원</p>
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
