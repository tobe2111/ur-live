/**
 * 🏠 생활 '무료로 견적 받기' → 업종 고르기 창 (2026-11-03 대표 안 5). `LifeHero` 가 누를 때만 lazy 로 받는다.
 * 묶음은 생활 첫 화면의 업종 그림과 같다(`LifePage` 의 GROUPS) — 고르면 그 업종 요청서로 간다.
 */
import { useNavigate } from 'react-router-dom'
import { categoryDef } from '@/shared/home-service'
import { Sheet } from './request/Sheet'
import { LifeTileIcon } from './life-tiles'
import type { LifeGroup } from './LifeHero'

export default function LifeCategoryPicker({ groups, onClose }: { groups: readonly LifeGroup[]; onClose: () => void }) {
  const navigate = useNavigate()
  return (
    <Sheet title="어떤 일인가요?" onClose={onClose}>
      <div className="space-y-5 pb-2">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="pb-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">{g.title}</p>
            <ul className="grid grid-cols-4 gap-x-1 gap-y-3">
              {g.keys.map((k) => (
                <li key={k}>
                  <button type="button" onClick={() => navigate(`/life/request/${k}`)} className="flex w-full flex-col items-center gap-2 active:opacity-70">
                    <span className="flex h-12 w-12 items-center justify-center"><LifeTileIcon category={k} size={40} /></span>
                    <span className="text-center text-[13px] leading-tight">{categoryDef(k)?.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
