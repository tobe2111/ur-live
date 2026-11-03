/**
 * 1 · 2 · 3 단계 한 줄 — 아이콘 상자 + 제목 + 설명 목록(가장 흔한 템플릿 모양)을 대신한다(2026-11-03).
 * ⚠️ 꺼진 혜택을 단계에 넣지 말 것(소개비·초대 보상 — `guest-tabs-2026-10-12.test.tsx` ⑤).
 */
import { GUEST_CLS } from '@/shared/guest-page'

export default function GuestSteps({ steps }: { steps: ReadonlyArray<readonly [string, string]> }) {
  return (
    <ol className={GUEST_CLS.steps}>
      {steps.map(([a, b], i) => (
        <li key={i} className={GUEST_CLS.step}>
          <span className={GUEST_CLS.stepNum}>{i + 1}</span>
          <span className={GUEST_CLS.stepText}>{a}<br />{b}</span>
        </li>
      ))}
    </ol>
  )
}
