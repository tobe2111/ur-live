/**
 * 🏭 2026-06-05 (사용자 신고 — 정렬 버튼 디자인 깨짐 + 작동 불안정): 통일 정렬 드롭다운.
 *   교환권/쇼핑/공구 모두 동일 디자인 + 동일 동작. 네이티브 <select>(다크에서 깨짐) 대체.
 *   onChange 로 상위가 URL/state 갱신 → 재fetch 트리거 (배선은 상위 책임, 여기는 순수 UI).
 */
import { useState } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

export interface SortOptionItem<T extends string> {
  key: T
  label: string
  /** 🖊️ 2026-08-30: 선택적 선 아이콘. 이전엔 라벨 문자열에 이모지를 붙여 썼는데
   *  (`'🔥 인기순'`), OS 마다 다른 그림이 나오고 같은 버튼의 `ChevronDown` 과 언어가
   *  갈렸다. 이 컴포넌트는 커스텀 드롭다운이라 SVG 를 넣을 수 있다 — 넣는다. */
  Icon?: LucideIcon
}

export function SortMenu<T extends string>({
  value,
  options,
  onChange,
  align = 'right',
}: {
  value: T
  options: ReadonlyArray<SortOptionItem<T>>
  onChange: (v: T) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.key === value) || options[0]

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1D1F29] px-3 py-1.5 text-[12px] font-bold text-gray-900 dark:text-white active:scale-[0.98] transition-transform"
      >
        {current?.Icon && <current.Icon className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />}
        {current?.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[10500]" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 z-[10501] min-w-[150px] rounded-xl bg-white dark:bg-[#1D1F29] border border-gray-100 dark:border-[#2C2F35] shadow-xl py-1 overflow-hidden`}
          >
            {options.map((o) => {
              const selected = o.key === value
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => { onChange(o.key); setOpen(false) }}
                  className={`w-full text-left px-3.5 py-2.5 text-[13px] inline-flex items-center gap-2 transition-colors ${
                    selected
                      ? 'font-extrabold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10'
                      : 'font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {o.Icon && <o.Icon className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />}
                  {o.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
