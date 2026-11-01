/**
 * ❓ 랜딩 자주 묻는 질문 한 줄 — `/partners`(PartnerFaq) 와 `/influencer`(CreatorsPage) 가 같이 쓴다.
 *
 * - 답은 **접혀 있어도 DOM 에 있다.** 종전 `{open && <p>}` 는 접힌 답을 지워, JS 를 돌리는 크롤러가
 *   렌더해도 답이 없었다. 구조화 데이터(`FAQPage`)가 말하는 Q&A 가 화면에도 있어야 한다.
 * - 높이는 `ur-collapse`(grid 0fr→1fr, `motion.css`)로 부드럽게 연다 — 높이를 재지 않는다.
 *   이 부품은 `motion.tsx` 를 쓰는 랜딩 청크 안에서만 그려지므로 그 CSS 가 이미 실려 있다.
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-rule">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 lg:py-6 text-left">
        <span className="text-[15px] lg:text-[17px] font-bold text-ink">{q}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      <div className="ur-collapse" data-open={open ? 1 : 0} aria-hidden={!open}>
        <div>
          <p className="pb-5 pr-8 text-[13px] lg:text-[17px] leading-[1.8] text-gray-600 dark:text-gray-300 max-w-[44em]">{a}</p>
        </div>
      </div>
    </div>
  )
}
