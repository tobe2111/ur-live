import { useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Sparkles, Eye, Heart, Video, ExternalLink } from 'lucide-react'

interface DiscoveryItem {
  seller_id: number
  seller_name: string | null
  video_count: number
  total_view_count: number
  total_like_count: number
  avg_view_count: number
  best_video_title: string | null
  best_video_views: number
  is_seller_active: number
  score: number
  recommendation: string
}

export default function AdminTikTokDiscoveryPage() {
  const [items, setItems] = useState<DiscoveryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'inactive' | 'active'>('all')

  async function fetchAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('admin_token')
      const r = await api.get('/api/admin/tiktok-discovery', { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) setItems(r.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = items.filter(i => {
    if (filter === 'inactive') return !i.is_seller_active
    if (filter === 'active') return i.is_seller_active
    return true
  })

  return (
    <AdminLayout title="TikTok 셀러 발굴">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="TikTok 셀러 발굴"
          subtitle="TikTok 비디오 데이터로 라이브 가능성 높은 셀러 식별. 라이브 미경험 + 비디오 조회수 높은 셀러 우선."
          icon={<Sparkles className="h-5 w-5" />}
        />

        <div className="flex items-center gap-2">
          {(['all', 'inactive', 'active'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                filter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              {f === 'all' ? '전체' : f === 'inactive' ? '🌱 라이브 미경험' : '🔴 라이브 활성'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-100">
            TikTok 비디오 캐시 데이터가 없습니다. 마이그레이션 0221 적용 + 셀러 TikTok 연동 필요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <div key={item.seller_id} className="bg-white rounded-xl p-4 border border-gray-100 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate">
                      {item.seller_name || `셀러 #${item.seller_id}`}
                    </h4>
                    <a
                      href={`/admin/sellers?id=${item.seller_id}`}
                      target="_blank" rel="noreferrer"
                      className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      셀러 상세 <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  {item.is_seller_active ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">활성</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-bold">미경험</span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Stat icon={<Video className="w-3 h-3" />} label="비디오" value={item.video_count} />
                  <Stat icon={<Eye className="w-3 h-3" />} label="조회수" value={Math.round(item.total_view_count / 1000) + 'K'} />
                  <Stat icon={<Heart className="w-3 h-3" />} label="좋아요" value={Math.round(item.total_like_count / 100) / 10 + 'K'} />
                </div>

                {item.best_video_title && (
                  <div className="text-xs text-gray-600 mb-2 p-2 bg-gray-50 rounded">
                    🎬 베스트: <strong>{item.best_video_title.slice(0, 40)}</strong>
                    <div className="text-[10px] text-gray-400 mt-0.5">{(item.best_video_views || 0).toLocaleString()} 조회</div>
                  </div>
                )}

                <div className="text-[11px] text-purple-700 bg-purple-50 p-2 rounded">
                  💡 {item.recommendation}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function Stat(props: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-[10px] text-gray-500 flex items-center gap-0.5">
        {props.icon} {props.label}
      </div>
      <div className="text-xs font-bold text-gray-900 mt-0.5">{props.value}</div>
    </div>
  )
}
