/**
 * 🧷 아래 고정 카카오 버튼 (2026-11-03 대표 "제안대로 다 해줘" — 시안 `docs/design/guest-tabs-v2-2026-11-03.md`).
 *
 * 종전엔 버튼이 화면 중간에 있어 스크롤하면 사라졌고, 유어샵 탭에선 첫 화면에 아예 안 보였다.
 * 이제 하단 탭 바로 위에 붙어 **언제나** 보인다. 모양은 `GUEST_CLS.dock`(서버 첫 화면과 같은 값).
 */
import GuestKakaoButton from './GuestKakaoButton'
import { GUEST_CLS } from '@/shared/guest-page'

export default function GuestDock({ returnPath, note }: { returnPath: string; note?: string }) {
  return (
    <div className={GUEST_CLS.dock} data-guest-dock="">
      <GuestKakaoButton returnPath={returnPath} />
      {note && <p className={GUEST_CLS.dockNote}>{note}</p>}
    </div>
  )
}
