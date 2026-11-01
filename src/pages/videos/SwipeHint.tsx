import { useEffect, useRef, useState } from 'react'
import { ChevronUp } from 'lucide-react'

/**
 * 👆 유어쇼츠 뷰어 — 처음 온 사람에게 **딱 한 번** "위로 넘기면 다음 영상" (2026-10-19).
 *
 * 왜: 뷰어는 대표 지시(2026-09-08 *"3/3 이런거 안나오면 좋겠어 … 깔끔하게"*)로 번호·닫기·컨트롤을
 * 전부 걷어 냈다. 그래서 처음 온 사람은 **다음 영상이 있다는 것 자체**를 알 길이 없었다 — 한 편만
 * 보고 나간다. 번호를 되살리는 대신, 넘기는 법을 한 번 보여 주고 영영 안 보이게 한다.
 *
 * - 한 번 넘기면(처음 본 `idx` 에서 바뀌면) 즉시 사라진다. 전체 보기에서 `?v=` 로 중간 영상부터
 *   열어도 그 자리가 시작점이다. 안 넘겨도 3.5초 뒤 사라진다.
 * - 본 적이 있으면(`localStorage`) 다시 안 뜬다. 저장소가 막힌 브라우저면 매번 한 번 뜬다(무해).
 * - 마우스 기기(`hover:hover`)에는 안 뜬다 — 거기엔 위아래 버튼이 이미 보인다.
 * - `pointer-events-none` — 안내가 탭·스와이프를 가로채면 안 된다.
 */
const SEEN_KEY = 'ur_shorts_swipe_hint_v1'

export default function SwipeHint({ idx }: { idx: number }) {
  const startIdx = useRef(idx)
  const [show, setShow] = useState(() => {
    try { return localStorage.getItem(SEEN_KEY) !== '1' } catch { return true }
  })

  useEffect(() => {
    if (!show) return
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* 저장 불가 — 다음에도 한 번 뜬다 */ }
    const t = window.setTimeout(() => setShow(false), 3500)
    return () => window.clearTimeout(t)
  }, [show])

  if (!show || idx !== startIdx.current) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex justify-center [@media(hover:hover)_and_(pointer:fine)]:hidden">
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur">
        <ChevronUp size={22} className="animate-bounce" />
        <span className="text-[13px] font-medium">위로 넘기면 다음 영상</span>
      </div>
    </div>
  )
}
