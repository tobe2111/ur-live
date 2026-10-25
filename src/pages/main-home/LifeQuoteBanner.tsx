/**
 * 🏠 생활 칩을 고르면 피드 위에 한 장 — 가게 일은 견적으로 (2026-10-24 대표 "생활 서비스는 미소, 숨고처럼").
 * 생활 이용권(정찰가)은 그대로 아래 피드에 뜨고, 가격이 가게마다 다른 일은 견적 요청으로 보낸다.
 * 2026-10-25 대표 "이 파란색 배너 너무하다, 대충 만들어졌잖아" → 파란 띠 대신 흰 카드 + 업종 그림 셋.
 * 사장님 대상이라는 점을 문구가 말한다(이사·청소 일반 소비자 안내가 아니다).
 */
import { Link } from 'react-router-dom'
import { LifeTileIcon } from '@/pages/life/life-tiles'
import type { HomeServiceCategory } from '@/shared/home-service'

const PICKS: HomeServiceCategory[] = ['signage', 'store_pest', 'kitchen_hood']

export default function LifeQuoteBanner() {
  return (
    <Link to="/life" className="mx-4 mt-2 flex items-center gap-4 rounded-2xl bg-surface px-4 py-4 text-ink shadow-lift">
      <span className="flex shrink-0 -space-x-2">
        {PICKS.map((c) => (
          <span key={c} className="flex h-10 w-10 items-center justify-center rounded-full bg-warm ring-2 ring-[var(--surface)]">
            <LifeTileIcon category={c} size={24} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-bold">가게 일은 무료 견적으로</b>
        <span className="block text-[13px] text-gray-500 dark:text-gray-400">간판·방역·후드 청소, 근처 업체가 견적을 보내요</span>
      </span>
      <span className="shrink-0 text-[13px] font-medium text-brand-text">견적 받기 ›</span>
    </Link>
  )
}
