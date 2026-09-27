/**
 * 🗂️ 마이 판매 시트 셸 — 세 시트가 같은 모양을 쓰게 (2026-09-25, 설계 §19)
 *
 * 가게 전환·환불·분석·출금이 각자 시트 마크업을 쓰면 **반드시 갈린다**(이 레포가 반복해 당한 클래스).
 * 높이·z-index·닫기·스크롤 규약을 여기 한 곳에 둔다.
 *
 * ⚠️ 시트는 하단 네비(z 9999) **위**여야 한다 — 표준 스케일(`constants/z-index`)을 쓰는 이유.
 * ⚠️ 스크롤 영역은 `flex-1 min-h-0` 이어야 한다(그게 없으면 폰에서 아래가 잘린다 — CLAUDE.md 모바일 룰).
 *
 * ## 🖥️ PC 에서는 바텀 시트가 아니라 **가운데 다이얼로그** (2026-09-26)
 * 마이는 PC 에서 액자를 벗는다(`/user/profile` 은 `pc-fullbleed` 목록에 있다). 그래서 `inset-x-0`
 * 인 바텀 시트가 **브라우저 폭을 통째로** 가로질렀다 — 2560px 모니터에서 특히 그렇다.
 * lg+ 에서만 가운데로 모으고 폭에 상한을 준다. **폰(<lg)은 한 글자도 안 바뀐다** — 바텀 시트가
 * 맞고, 엄지가 닿는 자리에 머리와 바닥이 있어야 한다.
 * ⚠️ `tall` 과 보통 시트가 lg+ 에서 **같은 상자**가 된다(가운데 정렬 + `max-h`). 세로 위치를
 *   `top-1/2 -translate-y-1/2` 로 잡으므로 `bottom`/`top-6` 을 `lg:` 로 되돌려 줘야 한다.
 *
 * ## 📱 뒤로가기로 닫힌다 (2026-09-26)
 * 안드로이드에는 **시스템 뒤로가기**가 있고, 사람은 열린 것을 그걸로 닫는다. 히스토리에 한 칸을
 * 쌓아 두지 않으면 뒤로가기가 시트가 아니라 **마이를 통째로 닫는다** — 열어 본 사람 입장에선
 * 앱이 튕긴 것과 구분이 안 된다. 그래서 열릴 때 `pushState` 로 한 칸 쌓고 `popstate` 에서 닫는다.
 * ⚠️ X·배경·Escape 로 닫을 때는 **그 칸을 도로 빼야** 한다(안 빼면 뒤로가기를 한 번 먹는다).
 */
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { Z } from '@/constants/z-index'

export default function Sheet({ title, onClose, onBack, children, footer, tall = false }: {
  title: string
  onClose: () => void
  /**
   * ↩️ 시트 **안에서** 한 단계 들어갔을 때의 뒤로(2026-09-26). 없으면 버튼이 안 뜬다.
   *   ⚠️ X 와 다른 일이다 — X 는 시트를 닫고, 이건 시트 안에서 되돌아온다.
   *   ⚠️ 뒤로가기(`popstate`)는 **시트를 닫는다**(아래 참조). 히스토리 칸을 한 개만 쌓기 때문이다 —
   *      시트 안 이동까지 브라우저 히스토리에 쌓으면 뒤로가기를 몇 번 눌러야 마이로 나오는지
   *      아무도 예측할 수 없다. 안쪽 되돌아오기는 이 버튼이 맡는다.
   */
  onBack?: () => void
  children: ReactNode
  /** 주 행동 — 시트 바닥에 고정된다(스크롤해도 늘 보인다) */
  footer?: ReactNode
  /**
   * 📐 여러 단계짜리 폼(이용권 등록 위저드)처럼 **화면이 필요한** 시트. 85dvh 에 넣으면
   * 사진·지도 단계에서 스크롤이 두 겹이 된다. 배경을 조금 남겨 두는 건 "덮인 것" 을 알리기 위해서다.
   */
  tall?: boolean
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
        className={
          'fixed inset-x-0 bottom-0 flex flex-col rounded-t-2xl bg-surface'
          + (tall ? ' top-6 h-auto' : ' max-h-[85dvh]')
          // 🖥️ lg+ : 가운데 다이얼로그(위 머리말). 폰 값들을 여기서 되돌린다.
          + ' lg:inset-x-auto lg:left-1/2 lg:top-1/2 lg:bottom-auto lg:h-auto'
          + ' lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[min(900px,92vw)]'
          + ' lg:max-h-[86dvh] lg:rounded-2xl lg:shadow-2xl'
        }
        style={{ zIndex: Z.SHEET_BODY }}
      >
        <div className="flex items-center gap-1 px-4 h-14 border-b border-rule shrink-0">
          {onBack && (
            <button type="button" onClick={onBack} aria-label="뒤로" className="w-8 h-8 -ml-2 flex items-center justify-center shrink-0">
              <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            </button>
          )}
          <span className="flex-1 min-w-0 truncate text-[16px] font-extrabold text-gray-900 dark:text-white">{title}</span>
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
