import { useState, useMemo } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🔑 수집 키워드 관리 — 인플루언서 풀 페이지에서 추출(600줄 캡 준수).
 *   활성/후보 칩 토글 + 우선 카테고리 태깅 추가. 변경 시 onChanged(부모 loadMeta)로 재조회.
 *   ⚡ 2026-07-27 렉 수리(대표 신고 "열면 심한 렉"): 후보 키워드(해시태그 자동확장)가 수백~1,000개로
 *   자라 칩 전부를 한 번에 렌더 → 열 때 프리즈 + 수집 폴링(12s)마다 재렌더. 3중 수리:
 *   ① 닫혀 있으면 본문 미렌더(details onToggle 게이트 — 폴링 재렌더 비용 0)
 *   ② 후보는 상위 60개만 기본 표시 + 검색 필터 + '모두 보기' 옵트인(활성은 ≤200이라 전체 표시)
 *   ③ 렌더 목록을 useMemo — 폴링으로 같은 내용이 와도 재계산 최소화.
 */
export interface Keyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string; found_total?: number; saved_total?: number; last_saved?: number; last_run_at?: string | null }

// ⭐ 우선 커서(배치의 3/4)를 타는 카테고리 — influencer-auto-collect PRIORITY_CATEGORIES 와 동일해야 함.
export const PRIORITY_CATS = ['맛집', '푸드', '외식창업', '숙소', '네일', '뷰티']

const CAND_PREVIEW = 60 // 후보 기본 표시 상한 — 성과순 정렬이라 상위가 곧 유의미한 것들

function Chip({ k, onToggle }: { k: Keyword; onToggle: (k: Keyword) => void | Promise<void> }) {
  return (
    <button onClick={() => onToggle(k)} title={`${k.category || '일반'} · ${k.source}${k.saved_total ? ` · 누적 ${k.saved_total}명(직전 ${k.last_saved || 0})` : ''}${k.last_run_at ? ` · ${k.last_run_at.slice(5, 16)}` : ''}${k.hits ? ` · ${k.hits}회 등장` : ''}`}
      className={`px-2.5 py-1 rounded-full text-xs border ${k.active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-300 line-through'}`}>
      {PRIORITY_CATS.includes(k.category || '') ? '⭐' : ''}{k.keyword}{k.source === 'auto' ? ' 🌱' : ''}{k.saved_total ? <span className={k.active ? 'text-emerald-300' : 'text-gray-400'}> · {formatNumber(k.saved_total)}</span> : (k.last_run_at ? <span className="text-red-400" title="이 키워드로 여러 번 수집했지만 신규 0명 — 비활성 검토">{' · 💤0'}</span> : '')}
    </button>
  )
}

export default function KeywordManager({ keywords, onChanged }: { keywords: Keyword[]; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false)         // ⚡ 닫힘 상태에선 본문(칩 수백 개) 미렌더
  const [newKw, setNewKw] = useState('')
  const [newKwCat, setNewKwCat] = useState('맛집') // 신규 키워드 카테고리(우선 커서 태깅)
  const [q, setQ] = useState('')                   // 칩 검색 필터
  const [showAllCand, setShowAllCand] = useState(false)
  const activeCount = useMemo(() => keywords.reduce((n, k) => n + (k.active ? 1 : 0), 0), [keywords])
  const candidateCount = keywords.length - activeCount
  const { activeKw, candShown, candHidden } = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (k: Keyword) => !needle || k.keyword.toLowerCase().includes(needle) || (k.category || '').toLowerCase().includes(needle)
    const act = keywords.filter(k => k.active && match(k))
    const cand = keywords.filter(k => !k.active && match(k))
    const shown = (showAllCand || needle) ? cand : cand.slice(0, CAND_PREVIEW) // 검색 중엔 매칭 전부(이미 좁혀짐)
    return { activeKw: act, candShown: shown, candHidden: cand.length - shown.length }
  }, [keywords, q, showAllCand])

  async function addKeyword() {
    const kw = newKw.trim()
    if (kw.length < 2) { toast.error('키워드는 2자 이상'); return }
    try {
      // category 를 우선 카테고리로 보내면 우선 커서(배치 3/4)를 탐 — 지역+업종 시딩용.
      const r = await api.post('/api/admin/ads/influencer-pool/keywords', { keyword: kw, category: newKwCat })
      if (r.data?.success) { setNewKw(''); toast.success(`키워드 추가 (${newKwCat})`); await onChanged() }
      else toast.error(r.data?.error || '추가 실패')
    } catch { toast.error('추가 실패') }
  }
  async function toggleKeyword(k: Keyword) {
    try { await api.patch(`/api/admin/ads/influencer-pool/keywords/${k.id}`, { active: k.active ? 0 : 1 }); await onChanged(); toast.success(k.active ? `⏸ '${k.keyword}' 수집 중지` : `▶️ '${k.keyword}' 수집 재개`) }
    catch { toast.error('변경 실패') }
  }

  return (
    <details className="mb-4 rounded-lg border border-gray-200 bg-white" onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
        수집 키워드 관리 (활성 {activeCount} · 후보 {candidateCount})
      </summary>
      {open && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <select value={newKwCat} onChange={e => setNewKwCat(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" title="우선 카테고리로 태깅하면 우선 커서(배치 3/4)를 탑니다">
              {PRIORITY_CATS.map(cat => <option key={cat} value={cat}>⭐{cat}</option>)}
              <option value="일반">일반</option>
            </select>
            <input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="키워드 추가 (예: 방배 맛집)" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
            <button onClick={addKeyword} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">추가</button>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 칩 검색 (키워드·카테고리)" className="w-[180px] px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
          </div>
          <div className="flex flex-wrap gap-2">
            {activeKw.map(k => <Chip key={k.id} k={k} onToggle={toggleKeyword} />)}
          </div>
          {candShown.length > 0 && (
            <>
              <div className="mt-3 mb-1 text-[11px] text-gray-400">후보(비활성) — 성과·등장순 상위{!showAllCand && !q.trim() && candidateCount > CAND_PREVIEW ? ` ${CAND_PREVIEW}개` : ''}</div>
              <div className="flex flex-wrap gap-2">
                {candShown.map(k => <Chip key={k.id} k={k} onToggle={toggleKeyword} />)}
              </div>
            </>
          )}
          {candHidden > 0 && (
            <button onClick={() => setShowAllCand(true)} className="mt-2 px-3 py-1.5 rounded-lg border border-gray-300 text-xs text-gray-500">
              후보 {formatNumber(candHidden)}개 더 보기 (많으면 느려질 수 있어요)
            </button>
          )}
          <p className="mt-2 text-xs text-gray-400">칩을 눌러 활성/비활성. ⭐ = 우선 카테고리(우선 커서 3/4). 🌱 = 해시태그 자동확장. 숫자 = 이 키워드로 모은 누적 인원(성과순 정렬 — 잘 무는 키워드가 위로). 💤0 = 수집했지만 0명(죽은 키워드 — 눌러서 비활성 권장).</p>
        </div>
      )}
    </details>
  )
}
