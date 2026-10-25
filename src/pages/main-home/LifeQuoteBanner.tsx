/**
 * 🏠 생활 칩을 고르면 피드 위에 한 줄 — "이사·청소는 견적으로" (2026-10-24 대표 "생활 서비스는 미소, 숨고처럼").
 * 생활 이용권(정찰가)은 그대로 아래 피드에 뜨고, 가격이 집마다 다른 일은 견적 요청으로 보낸다.
 */
import { Link } from 'react-router-dom'

export default function LifeQuoteBanner() {
  return (
    <Link to="/life" className="mx-4 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-3 text-white">
      <span className="text-[13px] leading-snug">
        <b className="block text-[15px]">이사·청소는 무료 견적으로</b>
        요청서를 올리면 근처 사장님이 견적을 보내요
      </span>
      <span className="shrink-0 text-[13px] font-medium">견적 받기 →</span>
    </Link>
  )
}
