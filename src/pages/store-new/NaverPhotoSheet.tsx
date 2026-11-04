/**
 * 🖼️ 네이버에서 찾은 사진 고르기 — 아래에서 올라오는 창(2026-11-03 대표 확정 시안 ④-1).
 * 여러 장 골라 한 번에 추가한다. 검색어를 바꾸거나(대표 메뉴 이름 등) 매장 사진·메뉴·가게 안으로 좁힌다.
 * ⚠️ 이 사진들은 **남의 블로그 사진일 수 있다** — 고르기 전에 그 사실을 화면에 적는다(자동으로 넣지 않는 이유).
 */
import { useEffect, useState } from 'react'
import { X, Search } from 'lucide-react'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { searchNaverPhotos } from './upload-photo'

const SUFFIX = [
  { key: '', label: '매장 사진' },
  { key: '메뉴', label: '메뉴' },
  { key: '내부', label: '가게 안' },
] as const

interface Props { baseQuery: string; room: number; onClose: () => void; onAdd: (urls: string[]) => void }

export default function NaverPhotoSheet({ baseQuery, room, onClose, onAdd }: Props) {
  const [suffix, setSuffix] = useState('')
  const [custom, setCustom] = useState('')
  const [items, setItems] = useState<string[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const query = custom.trim() ? `${baseQuery} ${custom.trim()}` : [baseQuery, suffix].filter(Boolean).join(' ')

  useEffect(() => {
    let alive = true
    setItems(null)
    const id = setTimeout(() => { searchNaverPhotos(query, 12).then((u) => { if (alive) setItems(u) }) }, custom ? 400 : 0)
    return () => { alive = false; clearTimeout(id) }
  }, [query, custom])

  const toggle = (u: string) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length >= room ? p : [...p, u]))

  return (
    <div className="fixed inset-0 z-[10500] flex items-end justify-center ur-veil p-2" onClick={onClose} role="dialog" aria-modal="true" aria-label="네이버에서 찾은 사진">
      <div className="ur-glass-solid ur-pop-sheet w-full max-w-[480px] h-[85dvh] text-gray-900 dark:text-white flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-2"><span className="w-9 h-1 rounded-full bg-line" /></div>
        <div className="px-5 pt-4 flex items-start justify-between">
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold">네이버에서 찾은 사진</h2>
            <p className="mt-1 text-[13px] text-ink-soft truncate">'{query}' 로 찾았어요</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="w-10 h-10 -mr-2 -mt-2 flex items-center justify-center"><X size={20} strokeWidth={1.6} /></button>
        </div>
        <label className="mx-5 mt-5 h-11 rounded-xl border-[1.5px] border-line focus-within:border-brand flex items-center gap-2 px-3">
          <Search size={18} strokeWidth={1.6} className="text-ink-soft" aria-hidden="true" />
          <span className="sr-only">다른 검색어</span>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="다른 검색어 (예: 대표 메뉴 이름)"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-[15px] text-gray-900 dark:text-white placeholder:text-ink-faint" />
        </label>
        {!custom && (
          <div className="mx-5 mt-3 flex gap-2">
            {SUFFIX.map((s) => (
              <button key={s.label} type="button" onClick={() => setSuffix(s.key)} aria-pressed={suffix === s.key}
                className={`h-8 px-3 rounded-full text-[13px] font-medium ${suffix === s.key ? 'bg-brand-tint text-brand-text' : 'border border-line'}`}>{s.label}</button>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-4">
          {items === null ? (
            <p className="text-[13px] text-ink-soft">찾는 중…</p>
          ) : items.length === 0 ? (
            <p className="text-[15px] text-ink-soft">찾은 사진이 없어요. 검색어를 바꿔 보세요.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map((u) => {
                const n = picked.indexOf(u) + 1
                return (
                  <button key={u} type="button" onClick={() => toggle(u)} aria-pressed={n > 0}
                    className={`relative aspect-square rounded-xl overflow-hidden bg-wash ${n > 0 ? 'ring-[3px] ring-brand' : ''}`}>
                    <img src={cfImage(u, { width: 240 })} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, u)} />
                    <span className={`absolute right-1 top-1 w-6 h-6 rounded-full border-2 border-white text-[13px] font-medium text-white leading-5 text-center ${n > 0 ? 'bg-brand' : 'bg-black/30'}`}>{n > 0 ? n : ''}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <p className="px-5 pt-3 text-[12px] leading-relaxed text-ink-soft">
          네이버 이미지 검색 결과예요. 블로그 등 다른 사람이 찍은 사진일 수 있으니, <b className="font-medium text-gray-900 dark:text-white">우리 가게 사진인지 확인하고</b> 골라 주세요.
        </p>
        <div className="px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
          <button type="button" disabled={picked.length === 0} onClick={() => onAdd(picked)} className="ur-btn ur-btn-lg ur-btn-primary w-full disabled:opacity-40">
            {picked.length ? `${picked.length}장 추가하기` : '사진을 골라 주세요'}
          </button>
        </div>
      </div>
    </div>
  )
}
