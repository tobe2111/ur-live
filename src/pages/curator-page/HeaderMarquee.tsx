/**
 * 🧱 2026-08-30 (file-size 래칫): CuratorHeader 에서 **그대로 추출** — 동작·마크업 불변.
 *
 *   이모지 글리프(✎ ⚙ ✓)를 lucide 아이콘으로 바꾸면서 파일이 604줄이 되어 cap(600)을
 *   넘겼다. CLAUDE.md 규칙대로 rebaseline 이 아니라 **분리**로 줄인다.
 *   자를 자리는 이 절(① 흐르는 마퀴 + 색상 조정)이 자기완결이라 골랐다 —
 *   부모의 나머지(배너 히어로 · 이름/핸들 · SNS)와 상태를 공유하지 않는다.
 */
import { Check, Pencil, X } from 'lucide-react'
import { ACCENT_PRESETS } from './accent-presets'

export default function HeaderMarquee({
  curator, isOwner, accentColor, accentText,
  editingHeadline, setEditingHeadline, headlineVal, setHeadlineVal,
  saveHeadline, saveAccent,
}: {
  curator: { headline?: string | null }
  isOwner: boolean
  accentColor: string
  accentText: string
  editingHeadline: boolean
  setEditingHeadline: (v: boolean) => void
  headlineVal: string
  setHeadlineVal: (v: string) => void
  saveHeadline: () => void
  saveAccent: (hex: string) => void
}) {
  // ① 흐르는 마퀴(헤드라인) — 최상단, 풀블리드
  return (
        <div className="max-w-3xl mx-auto">
          {editingHeadline ? (
            <div className="px-3 py-2 space-y-2" style={{ background: accentColor }}>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={headlineVal}
                  onChange={(e) => setHeadlineVal(e.target.value.slice(0, 80))}
                  onKeyDown={(e) => e.key === 'Enter' && saveHeadline()}
                  placeholder="흐르는 한 줄 공지 (예: 신상 입고 · 무료배송 이벤트)"
                  maxLength={80}
                  className="flex-1 min-w-0 bg-white/20 text-white placeholder:text-white/70 text-[12.5px] font-bold px-2.5 py-1.5 rounded-lg outline-none"
                />
                <button onClick={saveHeadline} aria-label="저장" className="shrink-0 p-1.5 bg-white rounded-lg active:scale-95" style={{ color: accentColor }}><Check className="w-4 h-4" /></button>
                <button onClick={() => { setEditingHeadline(false); setHeadlineVal(curator.headline || '') }} aria-label="취소" className="shrink-0 p-1.5 bg-white/20 rounded-lg text-white active:scale-95"><X className="w-4 h-4" /></button>
              </div>
              {/* 색상 조정 — 프리셋 스와치 + 커스텀 컬러 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-bold text-white/80 mr-0.5">색상</span>
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => saveAccent(c)}
                    aria-label={`색상 ${c}`}
                    className={`w-5 h-5 rounded-full border-2 ${accentColor.toLowerCase() === c.toLowerCase() ? 'border-white' : 'border-white/40'} active:scale-90`}
                    style={{ background: c }}
                  />
                ))}
                <label className="w-5 h-5 rounded-full border-2 border-white/40 overflow-hidden cursor-pointer relative ml-0.5" title="직접 선택" style={{ background: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' }}>
                  <input type="color" value={accentColor} onChange={(e) => saveAccent(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
              </div>
            </div>
          ) : curator.headline ? (
            <div className="relative overflow-hidden" style={{ background: accentColor, color: accentText }}>
              <div className="animate-marquee py-1.5">
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <span key={i} className="px-7 text-[12px] font-bold tracking-wide whitespace-nowrap">
                        {curator.headline}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              {isOwner && (
                <button
                  onClick={() => { setEditingHeadline(true); setHeadlineVal(curator.headline || '') }}
                  aria-label="헤드라인 편집"
                  className="absolute top-1/2 right-2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-black/25 backdrop-blur flex items-center justify-center active:scale-90"
                >
                  <Pencil className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ) : isOwner ? (
            <button
              onClick={() => { setEditingHeadline(true); setHeadlineVal('') }}
              className="w-full text-[11px] font-bold py-1.5 active:opacity-80"
              style={{ background: `${accentColor}1A`, color: accentColor }}
            >
              + 흐르는 헤드라인 추가
            </button>
          ) : null}
        </div>
  )
}
