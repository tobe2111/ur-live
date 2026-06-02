/**
 * 🛡️ 2026-05-18: 셀러 숙소 공구 목록 (PR 2/6).
 *
 * 숙소(stay_voucher) 상품 전용 — 공구 페이지(/seller/group-buy)와 분리.
 * 이유: 숙소는 객실 타입/날짜별 가격/캘린더 등 별도 모델.
 */
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Building2, Plus, MapPin, Star, Calendar, Users, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface StayListItem {
  id: number
  name: string
  image_url?: string
  is_active: number
  property_type?: string
  region_sido?: string
  region_sigungu?: string
  star_rating?: number | null
  room_count?: number
  active_bookings?: number
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  hotel: '호텔', motel: '모텔', pension: '펜션', guesthouse: '게스트하우스',
  resort: '리조트', glamping: '글램핑', house: '주택',
}

export default function SellerStaysPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  // 🛡️ 2026-06-01 Tier2(대시보드): 수동 페칭 → useApiQuery (인터셉터가 seller_token 자동 주입).
  const { data: stays = [], isLoading: loading } = useApiQuery<StayListItem[]>(
    ['seller', 'stays'], '/api/seller/stays',
    { select: (r: any) => (r?.success ? r.data || [] : []), enabled: !!token },
  )

  useEffect(() => {
    if (!token) navigate('/seller/login')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SellerLayout
      title={t('seller.stays.title', { defaultValue: '숙소 공구' })}
      headerRight={
        <Link
          to="/seller/stays/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('seller.stays.create', { defaultValue: '숙소 등록' })}
        </Link>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.stays.title', { defaultValue: '숙소 공구' })}
          subtitle={t('seller.stays.subtitle', { defaultValue: '펜션·호텔·모텔·게스트하우스 — 객실 + 날짜 기반 예약' })}
          icon={<Building2 className="h-5 w-5" />}
        />

        {loading ? (
          <DashboardLoading />
        ) : stays.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">
              {t('seller.stays.empty', { defaultValue: '등록된 숙소가 없습니다' })}
            </p>
            <Link
              to="/seller/stays/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              {t('seller.stays.createFirst', { defaultValue: '첫 숙소 등록하기' })}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stays.map((s) => (
              <Link
                key={s.id}
                to={`/seller/stays/${s.id}`}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="relative aspect-[16/10] bg-gray-100">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {!s.is_active && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-gray-900/80 text-white text-[10px] font-bold rounded">
                      비활성
                    </div>
                  )}
                  {s.property_type && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 text-gray-900 text-[10px] font-semibold rounded">
                      {PROPERTY_TYPE_LABELS[s.property_type] || s.property_type}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600">{s.name}</h3>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    {s.star_rating ? (
                      <>
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span>{s.star_rating}성</span>
                        <span className="text-gray-300">·</span>
                      </>
                    ) : null}
                    <MapPin className="w-3 h-3" />
                    <span className="line-clamp-1">{[s.region_sido, s.region_sigungu].filter(Boolean).join(' ') || '위치 미설정'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatNumber(s.room_count || 0)}객실
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        예약 {formatNumber(s.active_bookings || 0)}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
