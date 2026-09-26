/**
 * 🏨 숙소 — 마이 안에서 (2026-09-26, 설계 §21)
 *   대표: *"이용권 등록, 숙소까지 해줘"*
 *
 * ## 무엇이 여기 있고 무엇이 없나
 * **목록 · 상태 · 객실/예약 수**는 여기서 본다. **달력과 객실 편집은 전체화면**이다 —
 * 한 달 달력은 가로 폭을 요구하고, 시트 폭에서 그리면 날짜 칸이 손가락보다 작아진다.
 * ⇒ 시트는 "무엇이 있고 무엇이 문제인가" 를 보여 주고, 고치는 일은 그 화면으로 보낸다
 *   (그 화면 맨 위에는 `BackToMyBar` 가 "마이로 돌아가기" 를 띄운다).
 *
 * ## ⚠️ 라이브에서 **셀러 소유 숙소는 0개**다 (2026-09-26 실측)
 * 숙소 상품 77개는 전부 `seller_id IS NULL`(플랫폼·데모)이다. 그래서 이 시트는 대부분의
 * 사장님에게 **빈 목록**으로 보인다 — 그 상태를 "고장" 으로 읽히지 않게 화면이 직접 말한다.
 * 이 사실은 문서에도 적어 뒀다(쿠폰과 같은 상태라, 넣고 빼는 판단은 대표 몫이다).
 *
 * ## 🪑 좌석
 * `GET /api/seller/stays` 는 좌석 토큰으로 스코프된다 — 어긋나면 **부르지 않는다**.
 * 이 시트는 **읽기만 한다**(쓰기 0) — 그래서 `assertSeat` 이 없다.
 */
import { useEffect, useRef, useState } from 'react'
import { Building2, ChevronRight, Loader2, Plus } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { currentSeatId } from '@/lib/seller-seat'
import Sheet from './Sheet'

const TYPE_LABEL: Record<string, string> = {
  hotel: '호텔', motel: '모텔', pension: '펜션', guesthouse: '게스트하우스',
  resort: '리조트', glamping: '글램핑', house: '주택',
}

interface Stay {
  id: number
  name: string
  isActive: boolean
  type: string
  region: string
  rooms: number
  bookings: number
}

export default function StaysSheet({ sellerId, onClose, onOpen }: {
  sellerId: number
  onClose: () => void
  /** 전체화면으로 보낸다 — 호출부가 좌석을 확인하고 귀환 표시를 붙인다. */
  onOpen: (path: string) => void
}) {
  const [stays, setStays] = useState<Stay[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  useEffect(() => {
    if (currentSeatId() !== sellerId) { setFailed(true); setLoading(false); return }
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/stays'))
      .then((r) => {
        if (!alive.current) return
        if (!r.data?.success) { setFailed(true); return }
        setStays(((r.data.data || []) as Record<string, unknown>[]).map((s) => ({
          id: Number(s.id),
          name: String(s.name ?? ''),
          isActive: s.is_active === undefined ? true : !!Number(s.is_active),
          type: TYPE_LABEL[String(s.property_type ?? '')] || '',
          region: [s.region_sido, s.region_sigungu].filter(Boolean).join(' '),
          rooms: Number(s.room_count) || 0,
          bookings: Number(s.active_bookings) || 0,
        })))
        setFailed(false)
      })
      .catch(() => { if (alive.current) setFailed(true) })
      .finally(() => { if (alive.current) setLoading(false) })
  }, [sellerId])

  return (
    <Sheet
      title="숙소"
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => onOpen('/seller/stays/new')}
          className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          숙소 등록
        </button>
      }
    >
      <div className="px-4 py-3">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
          </div>
        )}

        {!loading && failed && (
          <p className="py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
            지금은 불러올 수 없어요. 잠시 후 다시 열어 주세요.
          </p>
        )}

        {!loading && !failed && stays.length === 0 && (
          <div className="py-8 text-center">
            <Building2 className="w-7 h-7 mx-auto text-gray-300 dark:text-gray-600" aria-hidden="true" />
            <p className="mt-2.5 text-[14px] font-bold text-gray-900 dark:text-white">아직 등록한 숙소가 없어요</p>
            <p className="mt-1 text-[12.5px] leading-[1.6] text-gray-500 dark:text-gray-400">
              숙소는 객실과 날짜별 재고가 있어서 이용권과 따로 관리해요.<br />
              아래에서 등록하면 여기 목록에 나타나요.
            </p>
          </div>
        )}

        {stays.length > 0 && (
          <>
            <p className="px-1 pb-2 text-[12px] text-gray-500 dark:text-gray-400 tabular-nums">
              {formatNumber(stays.length)}곳
            </p>
            <div className="rounded-xl bg-surface shadow-lift overflow-hidden">
              {stays.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpen(`/seller/stays/${s.id}`)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-rule last:border-b-0 active:opacity-70 ${s.isActive ? '' : 'opacity-55'}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-gray-900 dark:text-white truncate">{s.name}</span>
                    <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate tabular-nums">
                      {[s.type, s.region].filter(Boolean).join(' · ')}
                      {s.rooms > 0 ? ` · 객실 ${formatNumber(s.rooms)}` : ''}
                      {s.bookings > 0 ? ` · 예약 ${formatNumber(s.bookings)}` : ''}
                      {s.isActive ? '' : ' · 중지됨'}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onOpen('/seller/stays/bookings')}
              className="w-full flex items-center gap-2 mt-2 px-1 py-3 text-left active:opacity-70"
            >
              <span className="flex-1 text-[13px] font-semibold text-gray-500 dark:text-gray-400">예약 전체 보기</span>
              <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
            </button>
          </>
        )}

        <p className="mt-3 px-1 text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400">
          달력(날짜별 재고)과 객실 편집은 넓은 화면에서 열려요. 돌아올 때는 맨 위 <b className="font-semibold text-gray-900 dark:text-white">마이로 돌아가기</b> 를 누르세요.
        </p>
      </div>
    </Sheet>
  )
}
