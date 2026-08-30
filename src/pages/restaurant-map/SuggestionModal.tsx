/**
 * 🛡️ 2026-05-01: TD-018 1387줄 분할 — RestaurantMapPage 의 SuggestionModal 분리.
 *
 * 일반 맛집 (이용권 미출시) 클릭 시 표시. 출시 알림 받기 + 영입 신청 + 카카오맵 길찾기.
 *
 * 🚫 2026-08-26: 여기 있던 "사장님이신가요? 매장 등록하기" 버튼을 **뺐다**(대표 재차 지적).
 *   회색 핀이든 컬러 핀이든 어차피 카카오맵 데이터라, 사장님이 자기 가게를 찾으려고 이 지도를
 *   뒤질 이유가 없다 — 우연히 자기 핀을 눌러야만 발견된다. 그리고 이 모달을 여는 사람은 사실상
 *   전부 **손님**이라, 사장님 CTA 는 그들에겐 노이즈다. 매장 등록의 상시 문은 `/store/new` 다
 *   (마이페이지·푸터에서 진입). 거기 카카오맵 검색이 이미 있으므로 프리필의 이득도 작다.
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
    <div className="fixed inset-0 z-[10000] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose} role="presentation">
      <div className="bg-white dark:bg-[#0D0F12] rounded-t-2xl sm:rounded-2xl w-full max-w-[430px] p-5 space-y-4" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${place.place_name} 추천 보내기`}>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{place.category_name?.split('>').slice(-1)[0]?.trim() || '맛집'}</p>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{place.place_name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {place.road_address_name || place.address_name}
            {place.distance && <span className="ml-1 text-brand dark:text-[#EF6E85]">· {Math.round(Number(place.distance))}m</span>}
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
          ⓘ 이 매장은 <strong>아직 이용권이 출시되지 않았어요</strong>. 출시되면 알려드릴까요?
        </div>

        {done === 'notify' ? (
          <div className="text-center py-2 text-sm text-green-600 font-bold">✅ 출시 시 {phone} 로 알림드릴게요!</div>
        ) : done === 'invite' ? (
          <div className="text-center py-2 text-sm text-green-600 font-bold">✅ 영입 신청이 어드민에 전달됐어요!</div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-200">📨 출시 알림 받기 (선택)</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-[#3A3A3A] rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:text-gray-500 focus:border-brand focus:outline-none"
                />
                <button
                  onClick={() => submit('notify')}
                  disabled={submitting || !phone.trim()}
                  className="px-4 py-2.5 bg-brand text-white text-sm font-bold rounded-lg disabled:opacity-50"
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
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-[#1A1C21] text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium">닫기</button>
        </div>
      </div>

    </div>
  )
}
