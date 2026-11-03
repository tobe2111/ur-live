/**
 * 🧪 예시 이용권 줄 — 로그인 전 이용권·유어샵 탭이 **같은 부품**으로 그린다(2026-11-03 대표 확정).
 * 실제 상품이 아니라 `GUEST_EXAMPLE_PASSES` 고정 예시다 — 누를 수 없고(`to` 없음) 사진 대신 카테고리 그림이다.
 * 줄 모양은 진짜 유어샵·홈과 같은 `DealRow`(평면) — 예시가 실제와 다르게 생기면 "이렇게 된다" 가 거짓말이 된다.
 */
import DealRow from '@/components/deal/DealRow'
import { CafeIcon, BeautyIcon, MealIcon } from '@/components/icons/category-icons'
import { GUEST_EXAMPLE_PASSES } from '@/shared/guest-page'

const KIND_ICON = { cafe: CafeIcon, beauty: BeautyIcon, meal: MealIcon } as const

export default function GuestExampleRows({ numbered = false }: { numbered?: boolean }) {
  return (
    <div className="divide-y divide-rule" data-guest-example="">
      {GUEST_EXAMPLE_PASSES.map((p, i) => {
        const Icon = KIND_ICON[p.kind]
        return (
        <DealRow
          key={p.name}
          surface="plain"
          thumb={<span className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-white/5" aria-hidden="true"><Icon size={44} /></span>}
          eyebrow={p.store}
          title={p.name}
          price={p.price}
          discountPct={p.pct}
          leading={numbered ? (
            <span className="shrink-0 w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-medium flex items-center justify-center">{i + 1}</span>
          ) : undefined}
        />
        )
      })}
    </div>
  )
}
