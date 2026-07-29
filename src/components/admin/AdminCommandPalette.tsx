/**
 * ⌘K 2026-07-20 (대표 "자주 쓰는 페이지 빠르게"의 짝): 어드민 커맨드 팔레트.
 *   ⌘K / Ctrl+K 로 열고, 메뉴 이름을 타이핑하면 60여 개 어드민 페이지로 즉시 점프.
 *   즐겨찾기(고정)가 "자주 쓰는 것 상단"이라면, 팔레트는 "가끔 쓰는 것도 2초 만에".
 *   역할별로 보이는 항목만 대상(AdminLayout 의 roleNavGroups 를 flat 으로 받음).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, CornerDownLeft, type LucideIcon } from 'lucide-react'
import { Z } from '@/constants/z-index'

export interface CommandItem {
  path: string
  label: string
  icon: LucideIcon
  group: string
}

interface Props {
  items: CommandItem[]
  open: boolean
  onClose: () => void
}

export default function AdminCommandPalette({ items, open, onClose }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 열 때마다 초기화 + 입력 포커스.
  useEffect(() => {
    if (!open) return
    setQ('')
    setSel(0)
    const id = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(id)
  }, [open])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items.slice(0, 50)
    return items
      .map((it) => {
        const label = it.label.toLowerCase()
        let score = -1
        if (label.startsWith(query)) score = 3
        else if (label.includes(query)) score = 2
        else if (it.group.toLowerCase().includes(query)) score = 1
        return { it, score }
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it)
      .slice(0, 50)
  }, [q, items])

  useEffect(() => { setSel(0) }, [q])

  // 키보드: ↑↓ 이동 / Enter 이동 / Esc 닫기.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const it = results[sel]
        if (it) { navigate(it.path); onClose() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, sel, navigate, onClose])

  // 선택 항목을 뷰포트 안으로.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[14vh] px-4"
      style={{ zIndex: Z.MODAL_BACKDROP }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="메뉴 빠른 이동"
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="메뉴 검색 — 페이지 이름 입력 후 Enter"
            aria-label="메뉴 검색"
            className="flex-1 bg-transparent text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <kbd className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-gray-400">검색 결과가 없어요</div>
          ) : (
            results.map((it, i) => {
              const Icon = it.icon
              const active = i === sel
              return (
                <button
                  key={it.path}
                  data-idx={i}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => { navigate(it.path); onClose() }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-gray-100' : ''}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-gray-900' : 'text-gray-400'}`} strokeWidth={2} />
                  <span className="flex-1 text-[13px] font-semibold text-gray-900 truncate">{it.label}</span>
                  <span className="text-[11px] text-gray-400 truncate max-w-[38%]">{it.group}</span>
                  {active && <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
