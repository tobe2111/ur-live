import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import SellerLayout from '@/components/SellerLayout'
import api from '@/lib/api'
import {
  Eye, Users, MessageCircle, ShoppingBag, TrendingUp,
  Heart, ArrowLeft, BarChart3, Clock, DollarSign,
  Play, ChevronRight
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useTranslation } from 'react-i18next'

// ── Types ──
interface StreamAnalytics {
  stream: {
    id: number; title: string; status: string
    youtube_video_id: string; created_at: string
  }
  views: {
    total_views: number; unique_viewers: number
    avg_watch_time: number; total_watch_time: number
  }
  chat: {
    total_messages: number; unique_chatters: number
    seller_messages: number
    timeline: Array<{ minute: string; count: number }>
  }
  orders: {
    total_orders: number; total_revenue: number
    unique_buyers: number; avg_order_value: number
    timeline: Array<{ minute: string; order_count: number; revenue: number }>
  }
  top_products: Array<{
    id: number; name: string; image_url: string
    total_sold: number; total_revenue: number
  }>
  donations: {
    total_donations: number; total_amount: number
    unique_donors: number
  }
}

interface StreamSummary {
  id: number; title: string; status: string
  youtube_video_id: string; created_at: string
  chat_count: number; order_count: number; revenue: number
}

interface SummaryData {
  period: string
  stats: {
    total_streams: number; total_orders: number
    total_revenue: number; total_chats: number
    avg_revenue_per_stream: number
  }
  streams: StreamSummary[]
}

function fmtPrice(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n || 0)
}

function fmtDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

// ── Summary View (list of all streams) ──
function AnalyticsSummary() {
  const { t } = useTranslation()
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    setLoading(true)
    api.get(`/api/seller/streams/analytics/summary?period=${period}`)
      .then(r => { if (r.data?.success) setData(r.data.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-center text-gray-500 py-20">{t('seller.cannotLoadData')}</p>
  }

  const { stats, streams } = data

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          {t('seller.liveAnalytics')}
        </h2>
        <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p === '7d' ? t('seller.period7d') : p === '30d' ? t('seller.period30d') : t('seller.period90d')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('seller.totalBroadcasts'), value: stats.total_streams, icon: <Play className="w-5 h-5" />, color: 'text-red-600', bg: 'bg-red-50' },
          { label: t('seller.totalOrders'), value: stats.total_orders, icon: <ShoppingBag className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('seller.totalSales'), value: fmtPrice(stats.total_revenue), icon: <DollarSign className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('seller.avgSalesPerStream'), value: fmtPrice(stats.avg_revenue_per_stream), icon: <TrendingUp className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <span className={card.color}>{card.icon}</span>
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Streams list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="text-sm font-semibold text-gray-900">{t('seller.streamPerformance')}</h3>
        </div>
        {streams.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">{t('seller.noStreamRecord')}</p>
        ) : (
          <div className="divide-y">
            {streams.map(stream => (
              <Link
                key={stream.id}
                to={`/seller/live-analytics/${stream.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                {/* Thumbnail */}
                <div className="w-16 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {stream.youtube_video_id ? (
                    <img
                      src={`https://img.youtube.com/vi/${stream.youtube_video_id}/mqdefault.jpg`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{stream.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      stream.status === 'live' ? 'bg-red-100 text-red-700' :
                      stream.status === 'ended' ? 'bg-gray-100 text-gray-600' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {stream.status === 'live' ? 'LIVE' : stream.status === 'ended' ? t('seller.endedLabel') : t('seller.scheduledStatus')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(stream.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{stream.chat_count}</p>
                    <p>{t('seller.chatLabel')}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{stream.order_count}</p>
                    <p>{t('seller.orderLabelAnalytics')}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{fmtPrice(stream.revenue)}</p>
                    <p>{t('seller.salesLabelAnalytics')}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Detail View (single stream analytics) ──
function StreamAnalyticsDetail({ streamId }: { streamId: string }) {
  const { t } = useTranslation()
  const [data, setData] = useState<StreamAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'orders' | 'products'>('overview')

  useEffect(() => {
    api.get(`/api/seller/streams/${streamId}/analytics`)
      .then(r => { if (r.data?.success) setData(r.data.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [streamId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-center text-gray-500 py-20">{t('seller.cannotLoadData')}</p>
  }

  const { stream, views, chat, orders, top_products, donations } = data

  // Merge chat + order timelines for combined chart
  const allMinutes = new Set([
    ...chat.timeline.map(t => t.minute),
    ...orders.timeline.map(t => t.minute),
  ])
  const combinedTimeline = Array.from(allMinutes).sort().map(minute => ({
    minute,
    chat: chat.timeline.find(t => t.minute === minute)?.count || 0,
    orders: orders.timeline.find(t => t.minute === minute)?.order_count || 0,
    revenue: orders.timeline.find(t => t.minute === minute)?.revenue || 0,
  }))

  const tabs = [
    { key: 'overview', label: t('seller.overviewTab') },
    { key: 'chat', label: t('seller.chatTab') },
    { key: 'orders', label: t('seller.orderSalesTab') },
    { key: 'products', label: t('seller.productsTab') },
  ] as const

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Link to="/seller/live-analytics" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{stream.title}</h2>
          <p className="text-xs text-gray-400">
            {new Date(stream.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
            {' · '}
            <span className={stream.status === 'live' ? 'text-red-500 font-bold' : 'text-gray-500'}>
              {stream.status === 'live' ? 'LIVE' : stream.status === 'ended' ? t('seller.endedStatus') : t('seller.scheduledStatus')}
            </span>
          </p>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: t('seller.uniqueViewers'), value: views.unique_viewers, icon: <Eye className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('seller.avgWatchTimeLabel'), value: fmtDuration(views.avg_watch_time), icon: <Clock className="w-4 h-4" />, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: t('seller.chatCountLabel'), value: chat.total_messages, icon: <MessageCircle className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: t('seller.orderLabelAnalytics'), value: orders.total_orders, icon: <ShoppingBag className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('seller.salesLabelAnalytics'), value: fmtPrice(orders.total_revenue), icon: <DollarSign className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className={`inline-flex p-1.5 rounded-lg ${card.bg} mb-2`}>
              <span className={card.color}>{card.icon}</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{card.value}</p>
            <p className="text-[11px] text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Combined timeline chart */}
          {combinedTimeline.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('seller.realtimeActivityTrend')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={combinedTimeline} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="minute" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} width={40} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="chat" stroke="#F97316" strokeWidth={2} name={t('seller.chatNameChart')} dot={false} />
                  <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} name={t('seller.ordersNameChart')} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Additional stats */}
          <div className="grid lg:grid-cols-2 gap-5">
            {/* Chat stats */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.chatAnalysis')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('seller.totalMessagesLabel')}</span>
                  <span className="text-sm font-bold">{chat.total_messages}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('seller.participantViewers')}</span>
                  <span className="text-sm font-bold">{chat.unique_chatters}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('seller.sellerMessagesLabel')}</span>
                  <span className="text-sm font-bold text-blue-600">{chat.seller_messages}</span>
                </div>
              </div>
            </div>

            {/* Donation stats */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.donationAnalysis')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('seller.totalDonationsLabel')}</span>
                  <span className="text-sm font-bold">{donations.total_donations}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('seller.donationAmountLabel')}</span>
                  <span className="text-sm font-bold text-emerald-600">{fmtPrice(donations.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">{t('seller.donorCountLabel')}</span>
                  <span className="text-sm font-bold">{donations.unique_donors}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('seller.chatPerMinute')}</h3>
          {chat.timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chat.timeline} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="minute" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} width={35} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} name={t('seller.chatCountChart')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-400 py-12 text-sm">{t('seller.noChatData')}</p>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('seller.orderSalesTrend')}</h3>
            {orders.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={orders.timeline} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="minute" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={35} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={60} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="order_count" fill="#10B981" radius={[4, 4, 0, 0]} name={t('seller.orderCountChart')} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} name={t('seller.salesLabelAnalytics')} dot={false} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-12 text-sm">{t('seller.noOrderData')}</p>
            )}
          </div>

          {/* Order summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t('seller.totalOrders'), value: orders.total_orders },
              { label: t('seller.buyerCount'), value: orders.unique_buyers },
              { label: t('seller.totalSales'), value: fmtPrice(orders.total_revenue) },
              { label: t('seller.avgOrderValue'), value: fmtPrice(orders.avg_order_value) },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-semibold text-gray-900">{t('seller.popularProducts')}</h3>
          </div>
          {top_products.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">{t('seller.noProductSalesData')}</p>
          ) : (
            <div className="divide-y">
              {top_products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                  <span className="w-6 text-center text-sm font-bold text-gray-400">{i + 1}</span>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{t('seller.unitsSold', { count: p.total_sold })}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{fmtPrice(p.total_revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page component ──
export default function SellerLiveAnalyticsPage() {
  const { streamId } = useParams<{ streamId: string }>()
  const { t } = useTranslation()

  return (
    <SellerLayout title={t('seller.liveAnalytics')}>
      {streamId ? (
        <StreamAnalyticsDetail streamId={streamId} />
      ) : (
        <AnalyticsSummary />
      )}
    </SellerLayout>
  )
}
