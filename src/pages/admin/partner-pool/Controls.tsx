/**
 * 🎛 업체 풀 공용 컨트롤 — `AdminPartnerPoolPage` 에서 추출(600줄 캡 준수).
 *   ⚠️ **동작은 byte-동일**하다. 옮기기만 했고 로직/클래스명은 하나도 안 바꿨다
 *     — 자리를 만들려고 뺀 것이지 고치려고 뺀 게 아니다(두 가지를 한 커밋에 섞으면 회귀를 못 가른다).
 */
import { useState, useRef, useEffect } from 'react'

export function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900 text-white">
      {label}
      <button onClick={onClear} aria-label={`${label} 해제`} className="text-gray-300 hover:text-white">×</button>
    </span>
  )
}

/** 액션 드롭다운 — 상시 노출 버튼 수를 줄이기 위한 묶음(수집 5종 / 정리·보강 4종). */
export function ActionMenu({ label, items, busy }: { label: string; busy?: boolean; items: Array<{ label: string; desc?: string; onClick: () => void }> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} disabled={busy}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50">
        {busy ? '실행 중…' : `${label} ▾`}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-1">
          {items.map(it => (
            <button key={it.label} onClick={() => { setOpen(false); it.onClick() }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">
              <div className="text-sm text-gray-800">{it.label}</div>
              {it.desc && <div className="text-[11px] text-gray-400 mt-0.5">{it.desc}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
