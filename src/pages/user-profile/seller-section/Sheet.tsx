/**
 * 🗂️ 마이 판매 시트 셸 — 세 시트가 같은 모양을 쓰게 (2026-09-25, 설계 §19)
 *
 * 가게 전환·환불·분석·출금이 각자 시트 마크업을 쓰면 **반드시 갈린다**(이 레포가 반복해 당한 클래스).
 * 높이·z-index·닫기·스크롤 규약을 여기 한 곳에 둔다.
 *
 * ⚠️ 시트는 하단 네비(z 9999) **위**여야 한다 — 표준 스케일(`constants/z-index`)을 쓰는 이유.
 * ⚠️ 스크롤 영역은 `flex-1 min-h-0` 이어야 한다(그게 없으면 폰에서 아래가 잘린다 — CLAUDE.md 모바일 룰).
 *
 * ## 📱 뒤로가기로 닫힌다 (2026-09-26)
 * 안드로이드에는 **시스템 뒤로가기**가 있고, 사람은 열린 것을 그걸로 닫는다. 히스토리에 한 칸을
 * 쌓아 두지 않으면 뒤로가기가 시트가 아니라 **마이를 통째로 닫는다** — 열어 본 사람 입장에선
 * 앱이 튕긴 것과 구분이 안 된다. 그래서 열릴 때 `pushState` 로 한 칸 쌓고 `popstate` 에서 닫는다.
 * ⚠️ X·배경·Escape 로 닫을 때는 **그 칸을 도로 빼야** 한다(안 빼면 뒤로가기를 한 번 먹는다).
 */
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Z } from '@/constants/z-index'

export default function Sheet({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: ReactNode
  /** 주 행동 — 시트 바닥에 고정된다(스크롤해도 늘 보인다) */
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 📱 뒤로가기 = 닫기. 열릴 때 한 칸 쌓고, 뒤로가기가 오면 닫는다.
  //   `popped` 는 "그 칸이 이미 소비됐는가" — 정리 단계에서 중복으로 빼지 않기 위해서다.
  useEffect(() => {
    let popped = false
    try { window.history.pushState({ urSheet: true }, '') } catch { return }
    const onPop = () => { popped = true; onClose() }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // X·배경·Escape 로 닫힌 경우 — 쌓아 둔 칸을 도로 뺀다(안 그러면 뒤로가기를 한 번 먹는다).
      if (!popped) { try { window.history.back() } catch { /* 히스토리 접근 불가 */ } }
    }
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 bg-black/45" style={{ zIndex: Z.SHEET_BACKDROP }} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 max-h-[85dvh] flex flex-col rounded-t-2xl bg-surface"
        style={{ zIndex: Z.SHEET_BODY }}
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-rule shrink-0">
          <span className="text-[16px] font-extrabold text-gray-900 dark:text-white">{title}</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-9 h-9 -mr-2 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-rule px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </div>
    </>
  )
}
