/**
 * 🧭 SegmentedTabs — 한 줄짜리 상태 탭 (판매 중 / 판매 중지 / 종료 · 처리 대기 / 준비 중 …).
 *
 * ## 왜 부품인가 (2026-10-06 대표 신고)
 * *"판매 중지 0 이렇게 2줄짜리로 나뉘는거 너무 보기 안좋다 근본적으로 모두 해결해"*
 *
 * 같은 모양을 세 화면(이용권 관리 · 주문 · 매출 분석)이 각자 손으로 그리고 있었고, 셋 다
 * **칸을 똑같이 나누고(`flex-1`) 칸마다 좌우 여백을 고정**했다. 390px 폰에서 네 칸이면 한 칸이
 * 약 85px 인데 좌우 32px 를 빼면 글자 자리가 50px 남짓 — "판매 중지 0" 이 안 들어가 **두 줄로**
 * 접혔다. 한 화면을 고쳐도 다음 화면에서 또 난다. 그래서 규칙을 부품에 박는다:
 *
 *  ① **줄바꿈 금지** — `whitespace-nowrap`. 라벨과 숫자는 한 덩어리다.
 *  ② **글자 길이만큼 자리** — `flex: 1 0 auto`. 남는 폭은 나누되 **글자보다 좁아지지는 않는다**
 *     (똑같이 나누면 긴 라벨만 손해를 본다 — "판매 중지" 는 "종료" 보다 두 배 길다).
 *  ③ **그래도 넘치면 옆으로 민다** — 컨테이너 `overflow-x-auto`. 잘리거나 접히는 대신 스크롤.
 *
 * 📏 누르는 높이는 **40px 눈금**(`min-h-[40px]`, 2026-10-06 seller-rung-40 과 같은 기준) — 부품에 두면
 *    세 화면이 따로 키울 필요가 없다(같은 날 다른 세션이 주문 탭만 손으로 40px 로 키웠다가 이 부품과 합쳐졌다).
 *
 * 숫자는 `tabular-nums` 로 따로 감싼다 — 0 이 1 이 돼도 칸 폭이 흔들리지 않는다.
 * 숫자를 **안 보이게** 할지는 호출부 몫이다(`count` 를 안 넘기면 숫자 없이 라벨만).
 *
 * 🛡️ 가드: `segmented-tabs-2026-10-06.test.ts` — 세 화면이 이 부품을 쓰는가 + ①②③ 이 살아 있는가.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
// 🎬 2026-11-02 시안 9차 "주문 탭 전환"(대표 "다 해주고") — 파란 칸 하나가 고른 탭으로 미끄러지고, 탭 숫자가 바뀌면 새 숫자가 올라온다.
//   측정 전(첫 그림)엔 종전처럼 고른 탭이 스스로 파랗다 → 깜빡임 0.
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-seg', `@keyframes ur-seg-n { from { opacity: 0; transform: translateY(60%); } to { opacity: 1; transform: none; } }.ur-seg-pill { transition: transform .3s cubic-bezier(.2,1,.3,1), width .3s cubic-bezier(.2,1,.3,1); }.ur-seg-n { display: inline-block; animation: ur-seg-n .28s cubic-bezier(.2,1,.3,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-seg-pill{transition:none!important}.ur-seg-n{animation:none!important}}`)

export interface SegmentedTabItem<K extends string | number> {
  id: K
  label: ReactNode
  /** 라벨 옆 숫자. `undefined` 면 숫자 자리를 아예 안 그린다. */
  count?: number
}

export default function SegmentedTabs<K extends string | number>({
  items, value, onChange, className = '', ariaLabel,
}: {
  items: Array<SegmentedTabItem<K>>
  value: K
  onChange: (id: K) => void
  /** 바깥 상자에 덧붙일 클래스(폭 제한 `md:w-fit` 등). */
  className?: string
  ariaLabel?: string
}) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => { // 매 그림 뒤 재되 값이 같으면 안 바꾼다(라벨·숫자 폭이 바뀌면 따라간다)
    const el = rowRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    const next = el ? { x: el.offsetLeft, w: el.offsetWidth } : null
    setPill((p) => (p?.x === next?.x && p?.w === next?.w ? p : next))
  })
  const firstCounts = useRef(new Map(items.map((it) => [it.id, it.count])))
  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative flex gap-1 overflow-x-auto scrollbar-hide rounded-xl border border-rule bg-white p-1 ${className}`}
    >
      {pill && <span aria-hidden="true" className="ur-seg-pill absolute top-1 bottom-1 left-0 rounded-lg bg-brand pointer-events-none" style={{ width: pill.w, transform: `translateX(${pill.x}px)` }} />}
      {items.map((it) => {
        const on = it.id === value
        const moved = it.count != null && firstCounts.current.get(it.id) !== it.count
        return (
          <button
            key={String(it.id)}
            type="button"
            onClick={() => onChange(it.id)}
            aria-pressed={on}
            style={{ flex: '1 0 auto' }}
            className={`relative inline-flex min-h-[40px] items-center justify-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${on ? (!pill ? 'bg-brand text-white' : 'text-white') : 'text-gray-400 hover:text-gray-700'}`}
          >
            <span>{it.label}</span>
            {it.count != null && <span key={it.count} className={`tabular-nums${moved ? ' ur-seg-n' : ''}`}>{it.count.toLocaleString('ko-KR')}</span>}
          </button>
        )
      })}
    </div>
  )
}
