/**
 * 🛡️ 2026-05-01: TD-018 1387줄 분할 — RestaurantMapPage 의 SuggestionModal 분리.
 *
 * 일반 맛집 (이용권 미출시) 클릭 시 표시. 출시 알림 받기 + 영입 신청 + 카카오맵 길찾기.
 *
 * 🏪 2026-08-26 (대표 — "메인서비스랑 셀러대시보드 간극이 크다. 당근처럼 바로 연결돼야"):
 *   **사장님 본인용 클레임 진입점**을 여기에 둔다. 전수조사에서 소비자 표면(지도·이용권 상세)의
 *   `사장님|입점|claim|/seller` 가 **0건**이었다 — 사장님이 자기 가게를 화면에서 보고 있어도
 *   가져갈 길이 그 자리에 없었고, 셀러 대시보드에 **먼저 들어가야** 비로소 카카오맵 검색이 나왔다.
 *
 *   ⚠️ **왜 하필 이 모달인가**: 회색 핀 = 이용권 미출시 = **아직 유어딜에 없는 매장**이다.
 *   이미 등록된 매장(이용권 상세)에 "이 매장 관리하기"를 띄우면 **주인이 있는 가게를 가져가라는**
 *   신호가 된다 — 그건 소유권 승계(store-operator-model 3단계) 문제이지 등록이 아니다.
 *
 *   기존 "🤝 셀러 영입 신청"은 **소비자→어드민 제보**다(남의 가게를 추천). 사장님 본인은
 *   제보할 게 아니라 **바로 등록**하면 된다 — 그래서 별개의 버튼이다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Navigation, Store } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { isLoggedInSync } from '@/utils/auth'
import StoreRegisterModal from '@/components/seller/StoreRegisterModal'
import { enterStoreSeat } from '@/utils/enter-store'
import type { KakaoPlace } from '../RestaurantMapPage'

interface Props {
  place: KakaoPlace
  onClose: () => void
}

export default function SuggestionModal({ place, onClose }: Props) {
  useEscapeKey(onClose)
  const navigate = useNavigate()
  const [claiming, setClaiming] = useState(false)
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'invite' | 'notify' | null>(null)

  /**
   * 🏪 등록 직후 **그 매장으로 들어가 준다** — 여기서 끊으면 사장님은 지도에 남겨진다.
   *
   * 🩸 처음엔 토스트만 띄우고 닫았다. 그러면 좌석 토큰이 없어 `/seller` 도 못 열고, 방금 만든
   *   자기 매장으로 갈 길을 스스로 찾아야 한다 — "바로 연결"이 아니라 막다른 길이다.
   *   좌석 전환 절차는 `enterStoreSeat` SSOT(세 경로가 같은 함수를 쓴다).
   *
   * 대시보드로 보내는 이유: 승인/대기에 따라 다음 할 일이 다른데(`pending` 이면 이용권을 아직 못
   * 올린다) 그 판단은 `MyStoresPanel` 이 이미 갖고 있다. 여기서 또 분기하면 두 곳이 갈린다.
   */
  async function enterNewStore(sellerId?: number) {
    await enterStoreSeat(sellerId)
    toast.success('매장이 등록됐어요 — 이제 이용권을 올릴 수 있어요')
    navigate('/seller')
  }

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
      <div className="bg-white dark:bg-[#0F151D] rounded-t-2xl sm:rounded-2xl w-full max-w-[430px] p-5 space-y-4" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${place.place_name} 추천 보내기`}>
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

            {/* 🏪 사장님 본인 경로 — 제보가 아니라 바로 등록. 지도에서 고른 매장 정보가 그대로 프리필된다. */}
            <button
              onClick={() => {
                // 등록은 로그인이 필요하다. 미로그인은 401 을 만나게 두지 말고 로그인으로 안내하되,
                // 돌아올 곳을 지금 보던 지도로 지정한다(고른 매장을 잃지 않게).
                if (!isLoggedInSync()) {
                  navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
                  return
                }
                setClaiming(true)
              }}
              className="w-full flex items-center justify-center gap-1.5 py-3 border border-gray-300 dark:border-[#3A3A3A] text-gray-700 dark:text-gray-200 text-sm font-bold rounded-xl"
            >
              <Store className="w-4 h-4" /> 이 가게 사장님이신가요? 매장 등록하기
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
          <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-[#1A2334] text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium">닫기</button>
        </div>
      </div>

      {claiming && (
        <StoreRegisterModal
          initialPlace={{
            id: place.id,
            name: place.place_name,
            address: place.road_address_name || place.address_name || '',
            phone: place.phone || '',
            category: place.category_name || '',
            place_url: place.place_url || (place.id ? `https://place.map.kakao.com/${place.id}` : undefined),
            lat: Number(place.y) || undefined,
            lng: Number(place.x) || undefined,
          }}
          onClose={() => setClaiming(false)}
          onDone={(sellerId) => { setClaiming(false); onClose(); void enterNewStore(sellerId) }}
        />
      )}
    </div>
  )
}
