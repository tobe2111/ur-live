/**
 * 🛡️ 2026-05-01: TD-018 1387줄 분할 — RestaurantMapPage 의 SuggestionModal 분리.
 *
 * 일반 맛집 (식사권 미출시) 클릭 시 표시. 출시 알림 받기 + 영입 신청 + 카카오맵 길찾기.
 */
import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import type { KakaoPlace } from '../RestaurantMapPage'

interface Props {
  place: KakaoPlace
  onClose: () => void
}

export default function SuggestionModal({ place, onClose }: Props) {
  useEscapeKey(onClose)
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'invite' | 'notify' | null>(null)

  async function submit(kind: 'invite' | 'notify') {
    if (kind === 'notify' && !/^010-?\d{3,4}-?\d{4}$/.test(phone.replace(/-/g, ''))) {
      toast.error('전화번호 형식: 010-0000-0000')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/api/restaurant-suggestions', {
        kakao_place_id: place.id,
        place_name: place.place_name,
        category_name: place.category_name,
        road_address: place.road_address_name || place.address_name,
        phone: place.phone,
        lat: Number(place.y),
        lng: Number(place.x),
        kind,
        user_phone: kind === 'notify' ? phone.replace(/-/g, '') : undefined,
      })
      if (res.data?.success) {
        setDone(kind)
        toast.success(kind === 'notify' ? '출시 시 알림드릴게요!' : '영입 신청 완료!')
      } else {
        toast.error(res.data?.error || '신청 실패')
      }
    } catch {
      toast.error('네트워크 오류')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} role="presentation">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-[430px] p-5 space-y-4" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${place.place_name} 추천 보내기`}>
        <div>
          <p className="text-xs text-gray-500">{place.category_name?.split('>').slice(-1)[0]?.trim() || '맛집'}</p>
          <h3 className="text-lg font-bold text-gray-900">{place.place_name}</h3>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {place.road_address_name || place.address_name}
            {place.distance && <span className="ml-1 text-pink-500">· {Math.round(Number(place.distance))}m</span>}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
          ⓘ 이 매장은 <strong>아직 식사권이 출시되지 않았어요</strong>. 출시되면 알려드릴까요?
        </div>

        {done === 'notify' ? (
          <div className="text-center py-2 text-sm text-green-600 font-bold">✅ 출시 시 {phone} 로 알림드릴게요!</div>
        ) : done === 'invite' ? (
          <div className="text-center py-2 text-sm text-green-600 font-bold">✅ 영입 신청이 어드민에 전달됐어요!</div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">📨 출시 알림 받기 (선택)</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-pink-400 focus:outline-none"
                />
                <button
                  onClick={() => submit('notify')}
                  disabled={submitting || !phone.trim()}
                  className="px-4 py-2.5 bg-pink-500 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                >알림</button>
              </div>
            </div>

            <button
              onClick={() => submit('invite')}
              disabled={submitting}
              className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl disabled:opacity-50"
            >
              🤝 이 매장 셀러 영입 신청
            </button>
          </>
        )}

        <div className="flex gap-2 pt-1">
          <a
            href={`https://map.kakao.com/link/to/${encodeURIComponent(place.place_name)},${place.y},${place.x}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-xl text-sm font-bold"
          >
            <Navigation className="w-4 h-4" /> 카카오맵 길찾기
          </a>
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium">닫기</button>
        </div>
      </div>
    </div>
  )
}
