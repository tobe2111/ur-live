/**
 * 🏨 숙소 상세 — **이곳과 비슷한 스테이** (2026-09-24 대표 문서 ⑥).
 *
 * 대표: *"숙소소개 아래에 이곳과 비슷한 스테이 있었으면 좋겠음."*
 * 확인해 보니 숙소 상세는 객실·후기로 끝나고 추천이 없었다. 다만 **이용권 상세엔 같은 장치가
 * 이미 있다**(`OtherDealsRow` — 화면에 들어올 때만 불러오는 지연 로딩). 같은 방식으로 맞춘다.
 *
 * ## 자리
 * "숙소 소개 **아래**" 를 글자 그대로 소개 섹션 직후에 두면 **객실 선택(구매 행동)이 밀린다.**
 * 스테이폴리오도 이 줄은 페이지 맨 아래다 ⇒ 후기 다음, 좌측 콘텐츠 끝에 둔다.
 * (소개 바로 아래로 옮기는 건 렌더 한 줄 이동이다 — 대표가 원하면 그렇게.)
 *
 * ## '비슷한'의 정의
 * **같은 시도(`region_sido`)** 다. 가격대·타입으로 좁히면 49건짜리 재고에서 줄이 자주 비고,
 * 사람이 숙소를 고를 때 가장 먼저 좁히는 축이 지역이다. 지어낸 유사도 점수를 쓰지 않는다.
 *
 * ## 비용
 * 화면에 들어오기 전엔 **요청 0**(IntersectionObserver). 들어오면 한 번만 부르고, 2장이 안 되면
 * 줄 자체가 사라진다(한 장짜리 "비슷한 스테이"는 추천이 아니다).
 */
import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { StayCardRow } from '@/pages/stays/StayCurations'
import type { StaySearchItem } from '@/hooks/queries/useStaysSearch'

const MIN_SHOWN = 2
const MAX_SHOWN = 10

export default function SimilarStays({
  stayId, regionSido, checkIn, checkOut, guests,
}: { stayId: number; regionSido?: string | null; checkIn: string; checkOut: string; guests: number }) {
  const [items, setItems] = useState<StaySearchItem[]>([])
  const [inView, setInView] = useState(false)
  const sentinel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el || inView) return
    const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) { setInView(true); io.disconnect() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  useEffect(() => {
    if (!inView || !regionSido) return
    const qs = new URLSearchParams({ region: regionSido, check_in: checkIn, check_out: checkOut, guests: String(guests), limit: '12' })
    api.get(`/api/group-buy/stays/search?${qs.toString()}`)
      .then(r => {
        const rows = (r.data?.success ? (r.data.data || []) : []) as StaySearchItem[]
        setItems(rows.filter(s => s.id !== stayId).slice(0, MAX_SHOWN))
      })
      // 추천은 있으면 좋은 것이다 — 실패하면 조용히 없는 것으로 둔다(본문 예약 흐름을 막지 않는다).
      .catch(() => { /* noop */ })
  }, [inView, regionSido, checkIn, checkOut, guests, stayId])

  return (
    <>
      <div ref={sentinel} aria-hidden style={{ height: 1 }} />
      {items.length >= MIN_SHOWN && (
        <section className="mb-6">
          <h2 className="text-[17px] font-extrabold tracking-tight text-gray-900 dark:text-white">이곳과 비슷한 스테이</h2>
          <StayCardRow items={items} checkIn={checkIn} checkOut={checkOut} guests={guests} />
        </section>
      )}
    </>
  )
}
