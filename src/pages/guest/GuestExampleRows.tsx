/**
 * 🧪 예시 이용권 줄 — 로그인 전 이용권·유어샵 탭이 **같은 부품**으로 그린다(2026-11-03 대표 확정).
 * 실제 상품이 아니라 `GUEST_EXAMPLE_PASSES` 고정 예시다 — 누를 수 없고(`to` 없음) 사진은 **AI 로 만든 예시 사진**이다
 * (2026-11-03 대표 *"캔바가 안되면 피그마라도 써 캔바에서 확보한 사진도 넣고"* — 브런치는 Canva, 네일·파스타는 Figma AI).
 * 실제 가게 사진이 아니다 — 남의 가게 사진을 예시로 쓰지 않는다.
 * 줄 모양은 진짜 유어샵·홈과 같은 `DealRow`(평면) — 예시가 실제와 다르게 생기면 "이렇게 된다" 가 거짓말이 된다.
 */
import DealRow from '@/components/deal/DealRow'
import brunchImg from '@/assets/guest/example-brunch.webp'
import nailImg from '@/assets/guest/example-nail.webp'
import pastaImg from '@/assets/guest/example-pasta.webp'
import { GUEST_EXAMPLE_PASSES } from '@/shared/guest-page'

const KIND_IMG = { cafe: brunchImg, beauty: nailImg, meal: pastaImg } as const

/** `motion` — 유어샵 탭의 차례 등장 모션(`ur-gs-*`, CSS 는 GuestUrShopPage) 표식을 붙인다. */
export default function GuestExampleRows({ numbered = false, motion = false }: { numbered?: boolean; motion?: boolean }) {
  return (
    <div className={`divide-y divide-rule${motion ? ' ur-gs-rows' : ''}`} data-guest-example="">
      {GUEST_EXAMPLE_PASSES.map((p, i) => {
        return (
        <DealRow
          key={p.name}
          surface="plain"
          thumb={<img src={KIND_IMG[p.kind]} alt="" width={256} height={256} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
          eyebrow={p.store}
          title={p.name}
          price={p.price}
          discountPct={p.pct}
          leading={numbered ? (
            <span className="ur-gs-n shrink-0 w-6 h-6 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[12px] font-medium flex items-center justify-center">{i + 1}</span>
          ) : undefined}
        />
        )
      })}
    </div>
  )
}
