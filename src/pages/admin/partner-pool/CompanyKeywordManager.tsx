import { useState, useMemo } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber , kstShort } from '@/utils/format'

/**
 * 🔑 **업체(B2B) 수집 키워드 관리** — 대표 요구 2026-08-02:
 *   *"페이지에서 직접 수집하고자 하는 카테고리나 조건을 설정할 수 있는거지"*
 *
 * ## 왜 없었나
 * 인플루언서 풀은 `influencer-pool/KeywordManager` 로 키워드를 켜고 끄고 우선순위를 매길 수 있는데,
 * **업체 풀은 서버 API(`GET/POST /keywords`)만 있고 화면이 한 번도 안 붙었다.** 그래서 키워드
 * 4,546개(지역 × 업종 시드)가 코드 시드로만 굴러갔고 대표가 손댈 방법이 없었다 —
 * 네 축 중 **③ 필터링**이 한쪽 도메인에만 존재한 셈이다.
 *
 * ## 조작감은 인플루언서 쪽과 같게 맞춘다
 * 칩을 누르면 on/off, 상단에서 추가, 순위(tier)로 접근 우선순위. 두 도메인이 다르게 동작하면
 * 대표가 매번 다시 배워야 한다 — 화면이 둘인 것과 규칙이 둘인 것은 다른 문제다.
 *
 * ## ⚡ 성능 — 인플루언서 쪽에서 이미 겪은 렉을 미리 피한다
 * 그쪽은 키워드가 수백~1,000개로 자라 **열 때 프리즈**했다(2026-07-27 대표 신고). 여기는 시작부터
 * **4,546개**라 같은 방식으로 만들면 훨씬 심하다. 그래서 처음부터:
 *   ① 닫혀 있으면 본문 미렌더(`details` 게이트) ② 기본 상위 80개 + 검색 ③ 목록 `useMemo`
 *
 * ⚠️ **끄는 것은 '수집 대상'이지 이미 모인 리드가 아니다.** 꺼도 기존 업체는 안 지워진다 —
 *   그래서 되돌리기가 안전하고, 대표가 마음껏 시험해도 된다.
 */
export interface CompanyKeyword {
  id: number; keyword: string; category: string | null; subcategory: string | null
  region: string | null; tier: number | null; active: number
  found_total: number; saved_total: number; last_run_at: string | null
}

/** 기본 표시 상한 — 서버가 활성·순위·수확순으로 정렬해 주므로 상위가 곧 유의미한 것들이다. */
const PREVIEW = 80

/**
 * 🌾 저수확 표시 — 인플루언서 쪽 `lowYield` 와 같은 성격.
 *   `saved 0` 만 보면 "2건 찾아 0" (거의 안 해봄)과 "300건 찾아 0" (진짜 낭비)이 구분되지 않는다.
 *   ⚠️ 근거가 적을 때(30건 미만)는 **아무 말도 안 한다** — 표본이 없는데 낙인을 찍으면 멀쩡한
 *     키워드를 끄게 된다(이 화면의 조작은 되돌릴 수 있지만 오판은 수집 손실로 남는다).
 */
const EVIDENCE_MIN = 30
const OK_RATE = 0.02
function lowYield(k: CompanyKeyword): { pct: number; found: number } | null {
  const found = k.found_total || 0
  if (found < EVIDENCE_MIN) return null
  const rate = (k.saved_total || 0) / found
  return rate < OK_RATE ? { pct: Math.round(rate * 1000) / 10, found } : null
}

function Chip({ k, onToggle }: { k: CompanyKeyword; onToggle: (k: CompanyKeyword) => void }) {
  const ly = lowYield(k)
  const tip = [k.category, k.subcategory, k.region].filter(Boolean).join(' · ')
  return (
    <button onClick={() => onToggle(k)}
      title={`${tip || '미분류'}${k.tier ? ` · ${k.tier}순위` : ''}${k.saved_total ? ` · 누적 ${k.saved_total}곳` : ''}${k.last_run_at ? ` · ${kstShort(k.last_run_at)}` : ''}`}
      className={`px-2.5 py-1 rounded-full text-xs border ${k.active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-300 line-through'}`}>
      {k.tier === 1 ? '⭐' : ''}{k.keyword}
      {k.saved_total
        ? <span className={k.active ? 'text-emerald-300' : 'text-gray-400'}> · {formatNumber(k.saved_total)}</span>
        : (k.last_run_at ? <span className="text-red-400" title="여러 번 수집했지만 신규 0곳 — 비활성 검토">{' · 💤0'}</span> : '')}
      {ly && <span className="text-amber-400" title={`${formatNumber(ly.found)}건 찾아 ${formatNumber(k.saved_total || 0)}곳 저장 (수확률 ${ly.pct}%) — 검색 슬롯은 쓰는데 새 업체가 거의 안 남습니다. 이미 다 모았거나(고갈) 키워드가 안 맞는 경우입니다.`}> 🪫{ly.pct}%</span>}
    </button>
  )
}

export default function CompanyKeywordManager({ keywords, onChanged }: { keywords: CompanyKeyword[]; onChanged: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [newKw, setNewKw] = useState('')
  const [newCat, setNewCat] = useState('')
  const [newRegion, setNewRegion] = useState('')
  const [busy, setBusy] = useState(false)

  const active = useMemo(() => keywords.filter(k => k.active), [keywords])
  const paused = useMemo(() => keywords.filter(k => !k.active), [keywords])
  const filtered = useMemo(() => {
    const term = q.trim()
    const pool = term ? keywords.filter(k => k.keyword.includes(term) || (k.category || '').includes(term) || (k.region || '').includes(term)) : keywords
    return showAll || term ? pool : pool.slice(0, PREVIEW)
  }, [keywords, q, showAll])

  const toggle = async (k: CompanyKeyword) => {
    try {
      const r = await api.patch(`/api/admin/partner-pool/keywords/${k.id}`, { active: k.active ? 0 : 1 })
      // ⚠️ 서버가 `success:false` 를 주면(없는 id 등) 성공 토스트를 띄우지 않는다 —
      //   화면만 바뀌고 실제론 안 꺼진 상태가 이 레포에서 반복된 "조용한 부재" 다.
      if (!r.data?.success) { toast.error('키워드 상태를 바꾸지 못했습니다'); return }
      await onChanged()
      toast.success(k.active ? `⏸ '${k.keyword}' 수집 중지` : `▶️ '${k.keyword}' 수집 재개`)
    } catch { toast.error('키워드 상태를 바꾸지 못했습니다') }
  }

  const add = async () => {
    const kw = newKw.trim()
    if (kw.length < 2) { toast.error('키워드는 2자 이상'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/admin/partner-pool/keywords', { keyword: kw, category: newCat.trim() || undefined, region: newRegion.trim() || undefined })
      if (!r.data?.success) { toast.error('추가하지 못했습니다'); return }
      setNewKw('')
      await onChanged()
      toast.success(`➕ '${kw}' 추가 — 다음 수집 회차부터 반영`)
    } catch { toast.error('추가하지 못했습니다') } finally { setBusy(false) }
  }

  return (
    <details open={open} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-gray-200 bg-white">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-gray-800">
        🔑 수집 키워드 <span className="font-normal text-gray-500">— 수집 중 {formatNumber(active.length)} · 중지 {formatNumber(paused.length)}</span>
      </summary>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-gray-400">
            여기서 켜고 끄는 것은 <b>앞으로 수집할 대상</b>입니다. 꺼도 이미 모인 업체는 그대로 남습니다.
            변경은 <b>다음 수집 회차</b>부터 반영됩니다.
          </p>

          <div className="flex flex-wrap gap-2">
            <input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="새 키워드 (예: 부산 해운대 간판)" className="flex-1 min-w-[200px] rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm" />
            <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="분류(선택)" className="w-32 rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm" />
            <input value={newRegion} onChange={e => setNewRegion(e.target.value)} placeholder="지역(선택)" className="w-32 rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm" />
            <button onClick={add} disabled={busy} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">추가</button>
          </div>

          <div className="flex items-center gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="키워드·분류·지역 검색"
              className="flex-1 rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm" />
            {!q.trim() && keywords.length > PREVIEW && (
              <button onClick={() => setShowAll(v => !v)} className="text-xs text-gray-500 underline whitespace-nowrap">
                {showAll ? '상위만' : `모두 보기 (${formatNumber(keywords.length)})`}
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filtered.map(k => <Chip key={k.id} k={k} onToggle={toggle} />)}
            {filtered.length === 0 && <span className="text-xs text-gray-400">해당하는 키워드가 없습니다.</span>}
          </div>
          {!q.trim() && !showAll && keywords.length > PREVIEW && (
            <p className="text-[11px] text-gray-400">상위 {PREVIEW}개만 표시 중 — 검색하거나 '모두 보기'를 누르세요.</p>
          )}
        </div>
      )}
    </details>
  )
}
