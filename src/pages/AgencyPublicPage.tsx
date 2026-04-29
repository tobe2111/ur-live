import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '@/lib/api'
import { Users, TrendingUp, Calendar, Briefcase, ArrowRight } from 'lucide-react'

interface AgencyPublic {
  id: number
  name: string
  slug: string
  bio: string | null
  logo_url: string | null
  cover_url: string | null
  created_at: string
  stats: {
    total_sellers: number | null
    total_revenue: number | null
    years_active: number
  }
  top_sellers: Array<{ id: number; business_name: string; profile_image: string | null }>
}

export default function AgencyPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<AgencyPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    api.get(`/api/agency-public/${slug}`)
      .then((r) => {
        if (r.data.success) setData(r.data.data)
        else setError(r.data.error || '페이지를 찾을 수 없습니다.')
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          setError('해당 에이전시를 찾을 수 없습니다.')
        } else {
          setError('일시적 오류 — 잠시 후 다시 시도해주세요.')
        }
      })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-400 text-sm">불러오는 중...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="text-2xl mb-2">🤔</div>
        <p className="text-gray-700 font-medium mb-1">{error || '페이지 없음'}</p>
        <Link to="/" className="text-sm text-blue-600 underline mt-3">홈으로</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cover */}
      <div
        className="h-48 sm:h-64 bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400 relative"
        style={data.cover_url ? { backgroundImage: `url(${data.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-16 sm:-mt-20 relative z-10">
        {/* Logo + Name */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-100 border-4 border-white shadow flex-shrink-0 overflow-hidden">
              {data.logo_url ? (
                <img src={data.logo_url} alt={data.name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  <Briefcase className="w-10 h-10 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{data.name}</h1>
              {data.bio && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{data.bio}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            {data.stats.total_sellers !== null && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{data.stats.total_sellers}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> 소속 셀러
                </div>
              </div>
            )}
            {data.stats.total_revenue !== null && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {(data.stats.total_revenue / 10_000).toFixed(1)}만
                </div>
                <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                  <TrendingUp className="w-3 h-3" /> 누적 매출(딜)
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{data.stats.years_active}년+</div>
              <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3" /> 운영 기간
              </div>
            </div>
          </div>
        </div>

        {/* 셀러 영입 CTA */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white mb-6">
          <h2 className="text-xl font-bold mb-2">🎟️ {data.name} 와 함께 성장하세요</h2>
          <p className="text-sm text-white/90 mb-4">
            셀러 가입 신청을 보내고 본 에이전시의 운영 지원과 노출 부스팅을 받아보세요.
          </p>
          <Link
            to={`/seller/register?agency=${data.id}`}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white text-purple-600 font-bold rounded-lg hover:bg-gray-50"
          >
            셀러 가입 신청 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 소속 셀러 */}
        {data.top_sellers.length > 0 && (
          <div className="bg-white rounded-2xl p-6 mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">🌟 함께하는 셀러</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {data.top_sellers.map((s) => (
                <div key={s.id} className="text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 overflow-hidden mb-2">
                    {s.profile_image ? (
                      <img src={s.profile_image} alt={s.business_name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Users className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 truncate">{s.business_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 py-6">
          <Link to="/" className="hover:text-gray-600">유어딜 — 라이브 커머스 플랫폼</Link>
        </div>
      </div>
    </div>
  )
}
