/**
 * 🗓️ 사장님 예약 화면 하나 — 시간 예약(식당·뷰티 등) + 숙소 예약 (2026-11-04)
 *
 * 대표 *"사장님 예약 관리 화면 … 합칠지"* → *"응 다 해줘 합쳐"*.
 * 종전엔 주문 탭 옆에 [예약]·[숙소 예약] 두 칸이 따로 있었다(`/seller/appointments` · `/seller/stays/bookings`).
 * 사장님에겐 둘 다 "손님이 잡은 예약" 이라 한 화면에서 위 구분 두 개로 고른다. 옛 주소는 이리로 보낸다(링크·알림 무회귀).
 *
 * ## 왜 목록 하나로 섞지 않나
 * 두 예약은 처리 동작이 다르다 — 시간 예약은 [이용 완료 · 노쇼], 숙소는 [체크인 · 체크아웃 · 노쇼] + 기간 지표. 한 줄에
 * 섞으면 줄마다 버튼이 달라 읽기 어렵다. 그래서 **한 화면 · 구분 두 개**이고, 각 구분 안은 종전 화면 그대로(동작 무변경).
 * 정한 구분은 주소(`?tab=stay`)에 남아 새로 고침·뒤로 가기에도 그대로다.
 */
import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import SellerLayout from '@/components/SellerLayout'
import BrandLoader from '@/components/brand/BrandLoader'

const SellerAppointmentsPage = lazy(() => import('./SellerAppointmentsPage'))
const SellerStaysBookingsPage = lazy(() => import('./SellerStaysBookingsPage'))

export type BookingsTab = 'time' | 'stay'
export const BOOKING_TABS: readonly { key: BookingsTab; label: string }[] = [
  { key: 'time', label: '시간 예약' },
  { key: 'stay', label: '숙소 예약' },
]

export default function SellerBookingsPage() {
  const [params, setParams] = useSearchParams()
  const tab: BookingsTab = params.get('tab') === 'stay' ? 'stay' : 'time'
  return (
    <SellerLayout title="예약 관리">
      <div className="mx-auto max-w-5xl mb-4 flex gap-2" role="tablist" aria-label="예약 종류">
        {BOOKING_TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            onClick={() => setParams(t.key === 'time' ? {} : { tab: t.key }, { replace: true })}
            className={`px-4 py-2 rounded-full text-[13px] font-medium ${tab === t.key ? 'bg-brand text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<BrandLoader />}>
        {tab === 'stay' ? <SellerStaysBookingsPage embedded /> : <SellerAppointmentsPage embedded />}
      </Suspense>
    </SellerLayout>
  )
}
