/**
 * 🏠 생활 칩을 고르면 피드 위에 한 장 — 가게 일은 견적으로 (2026-10-24 대표 "생활 서비스는 미소, 숨고처럼").
 * 생활 이용권(정찰가)은 그대로 아래 피드에 뜨고, 가격이 가게마다 다른 일은 견적 요청으로 보낸다.
 * 2026-10-25 대표 "이 파란색 배너 너무하다, 대충 만들어졌잖아" → 파란 띠 대신 흰 카드 + 업종 그림 셋.
 * 사장님 대상이라는 점을 문구가 말한다(이사·청소 일반 소비자 안내가 아니다).
 * 2026-10-31 대표 *"직관적으로 … 가게 사장님들을 위한 생활 견적 서비스 이런 식으로"* — 제목이 서비스 이름을 먼저 말한다.
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { LifeTileIcon } from '@/pages/life/life-tiles'
import type { HomeServiceCategory } from '@/shared/home-service'
import { lifeSubcatDef, type LifeSubcat } from '@/shared/life-deal-subcat'

const PICKS: HomeServiceCategory[] = ['signage', 'store_pest', 'kitchen_hood']

// 2026-10-25 대표 "간격도 없이 붙어있고" — 아래 피드와 띄우고(mb-5), 오른쪽 글자 버튼을 화살표로 줄여
//   제목이 두 줄로 꺾이지 않게 한다(390px 에서 "가게 일은 무료 / 견적으로" 로 갈라졌다).
// 2026-10-25 업종 칩(안 A) — 칩을 고르면 문구가 그 업종 견적으로 바뀌고, 요청서가 하나뿐인 업종은 바로 그 요청서로 간다.
export default function LifeQuoteBanner({ sub = 'all' }: { sub?: 'all' | LifeSubcat }) {
  const d = sub === 'all' ? undefined : lifeSubcatDef(sub)
  return (
    <Link to={d?.request ? `/life/request/${d.request}` : '/life'} className="mb-5 mt-2 flex items-center gap-3 rounded-2xl px-4 py-4 text-ink active:opacity-80">
      <span className="flex shrink-0 -space-x-3">
        {PICKS.map((c) => (
          <span key={c} className="flex h-9 w-9 items-center justify-center rounded-full bg-warm ring-2 ring-[var(--surface)]">
            <LifeTileIcon category={c} size={22} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-bold">{d?.bannerTitle ?? '사장님 생활 견적 서비스'}</b>
        <span className="mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400">{d?.bannerSub ?? '간판·방역·후드 청소, 근처 업체 견적 무료 비교'}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" aria-label="견적 받기" />
    </Link>
  )
}
