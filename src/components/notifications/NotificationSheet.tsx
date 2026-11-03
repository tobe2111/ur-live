/**
 * 🔔 알림 시트 — 모바일에서 **올라온다** (2026-10-11, 대표 지시).
 *
 * 대표: *"알림 버튼을 눌렀을 때 알림 페이지가 별도로 나오는게 아니라 위에서 올라오는 형태로?
 * 나타나면 좋을 것 같고"*
 *
 * ## 왜 페이지가 아니라 시트인가
 * 알림은 **보던 화면을 떠날 일이 아니다.** 종전엔 벨을 누르면 `/notifications` 로 떠나고,
 * 읽고 나면 뒤로가기로 돌아와야 했다 — 그 사이 보던 목록의 스크롤·필터가 날아간다.
 * PC 는 2026-07-18 에 이미 드롭다운으로 바꿨는데(대표 *"PC에서 알림 버튼 누르면 바로 보이게"*)
 * **모바일만 그대로였다.** 이제 같은 몸통(`NotificationPanel`)을 셸만 바꿔 쓴다.
 *
 * ## 집 안의 시트 관용구를 따른다
 * 치수·z-index·닫기 방식은 `StoreSwitchSheet` 와 같다(`Z.SHEET_*`, `max-h-[80dvh]`,
 * `rounded-t-2xl`, 바깥 탭·ESC 로 닫기). 새 관용구를 만들지 않는다 — 시트가 두 종류가 되면
 * 다음 시트는 어느 쪽을 베낄지 모른다.
 *
 * ⚠️ `max-h-[80dvh]` 는 `vh` 가 아니라 `dvh` 다 — 모바일 주소창 때문에 `vh` 는 실제 보이는 영역보다
 *   커서 바닥이 잘린다(CLAUDE.md 모바일 뷰포트 룰).
 */
import { useEffect } from 'react'
import { Z } from '@/constants/z-index'
import { NotificationPanelBody, NotificationPanelFooter, NotificationPanelHeader } from './NotificationPanel'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-03 16차 ⑩ — 종을 눌러 시트가 올라오면 알림 줄이 위에서부터 차례로 들어온다(첫 여덟 줄 · 이 시트에서만 — PC 드롭다운은 그대로).
injectMotionCss('ur-m-notifsheet', `@keyframes ur-ns-up { from { opacity: 0; transform: translateY(10px); } }.ur-ns-body > button:nth-child(-n+8) { animation: ur-ns-up .32s cubic-bezier(.2,.9,.3,1) .12s backwards; }.ur-ns-body > button:nth-child(2) { animation-delay: .17s; }.ur-ns-body > button:nth-child(3) { animation-delay: .22s; }.ur-ns-body > button:nth-child(4) { animation-delay: .27s; }.ur-ns-body > button:nth-child(5) { animation-delay: .32s; }.ur-ns-body > button:nth-child(6) { animation-delay: .37s; }.ur-ns-body > button:nth-child(7) { animation-delay: .42s; }.ur-ns-body > button:nth-child(8) { animation-delay: .47s; }@media (prefers-reduced-motion: reduce){.ur-ns-body > button{animation:none!important}}`)

export default function NotificationSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 ur-veil ur-sheet-veil" style={{ zIndex: Z.SHEET_BACKDROP }} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="알림"
        className="fixed inset-x-2 bottom-2 max-h-[80dvh] flex flex-col ur-pop-sheet ur-glass overflow-hidden ur-sheet-in"
        style={{ zIndex: Z.SHEET_BODY }}
      >
        <NotificationPanelHeader onClose={onClose} />
        <div className="ur-ns-body flex-1 min-h-0 overflow-y-auto">
          <NotificationPanelBody onClose={onClose} />
        </div>
        <div className="pb-[max(0px,env(safe-area-inset-bottom))] shrink-0">
          <NotificationPanelFooter onClose={onClose} />
        </div>
      </div>
    </>
  )
}
