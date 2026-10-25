/**
 * 🏠 생활 칩을 고르면 피드 위에 한 장 — 가게 일은 견적으로 (2026-10-24 대표 "생활 서비스는 미소, 숨고처럼").
 * 생활 이용권(정찰가)은 그대로 아래 피드에 뜨고, 가격이 가게마다 다른 일은 견적 요청으로 보낸다.
 * 2026-10-25 대표 "이 파란색 배너 너무하다, 대충 만들어졌잖아" → 파란 띠 대신 흰 카드 + 업종 그림 셋.
 * 사장님 대상이라는 점을 문구가 말한다(이사·청소 일반 소비자 안내가 아니다).
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { LifeTileIcon } from '@/pages/life/life-tiles'
import type { HomeServiceCategory } from '@/shared/home-service'

const PICKS: HomeServiceCategory[] = ['signage', 'store_pest', 'kitchen_hood']

// 2026-10-25 대표 "간격도 없이 붙어있고" — 아래 피드와 띄우고(mb-5), 오른쪽 글자 버튼을 화살표로 줄여
//   제목이 두 줄로 꺾이지 않게 한다(390px 에서 "가게 일은 무료 / 견적으로" 로 갈라졌다).
export default function LifeQuoteBanner() {
  return (
    <Link to="/life" className="mx-4 mb-5 mt-2 flex items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-ink shadow-lift active:opacity-80">
      <span className="flex shrink-0 -space-x-3">
        {PICKS.map((c) => (
          <span key={c} className="flex h-9 w-9 items-center justify-center rounded-full bg-warm ring-2 ring-[var(--surface)]">
            <LifeTileIcon category={c} size={22} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-bold">가게 일은 무료 견적으로</b>
        <span className="mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400">간판·방역·후드 청소 견적 비교</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" aria-label="견적 받기" />
    </Link>
  )
}
