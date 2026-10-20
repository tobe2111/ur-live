/**
 * 혜택 목록 — "이 화면에서 무엇을 얻나" (2026-10-12 대표 *"각 페이지마다 어떤 이점을 얻을 수 있는지"*).
 *
 * ⚠️ **지금 실제로 켜져 있는 것만** 적는다. 시안을 만들 때 "팔리면 소개비"(담기 커미션 — 꺼져 있다)와
 *   친구 초대 1,000딜(2026-08-23 종료)을 넣었다가 뺐다. 꺼진 혜택을 약속하면 그건 혜택이 아니라 거짓말이다.
 *   혜택을 늘리기 전에 `docs/FEATURE_STATUS.md` 와 `docs/design/actor-benefit-map.md` 를 먼저 볼 것.
 */
import type { ReactNode } from 'react'
import { GUEST_CLS } from '@/shared/guest-page'

export interface GuestBenefit { icon: ReactNode; title: string; desc: string }

export default function GuestBenefits({ items }: { items: GuestBenefit[] }) {
  return (
    <ul className={GUEST_CLS.benefits}>
      {items.map((b) => (
        <li key={b.title} className={GUEST_CLS.benefit}>
          <span className={GUEST_CLS.benefitIcon}>
            {b.icon}
          </span>
          <span className={GUEST_CLS.benefitText}>
            <span className={GUEST_CLS.benefitTitle}>{b.title}</span>
            <span className={GUEST_CLS.benefitDesc}>{b.desc}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
