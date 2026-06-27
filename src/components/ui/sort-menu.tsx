/**
 * 🏭 2026-06-05 (사용자 신고 — 정렬 버튼 디자인 깨짐 + 작동 불안정): 통일 정렬 드롭다운.
 *   교환권/쇼핑/공구 모두 동일 디자인 + 동일 동작. 네이티브 <select>(다크에서 깨짐) 대체.
 *   onChange 로 상위가 URL/state 갱신 → 재fetch 트리거 (배선은 상위 책임, 여기는 순수 UI).
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SortOptionItem<T extends string> {
  key: T
  label: string
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
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] px-3 py-1.5 text-[12px] font-bold text-gray-900 dark:text-white active:scale-[0.98] transition-transform"
      >
        {current?.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[10500]" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 z-[10501] min-w-[150px] rounded-xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-[#2A2A2A] shadow-xl py-1 overflow-hidden`}
          >
            {options.map((o) => {
              const selected = o.key === value
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => { onChange(o.key); setOpen(false) }}
                  className={`w-full text-left px-3.5 py-2.5 text-[13px] transition-colors ${
                    selected
                      ? 'font-extrabold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10'
                      : 'font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06]'
                  }`}
                >
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
