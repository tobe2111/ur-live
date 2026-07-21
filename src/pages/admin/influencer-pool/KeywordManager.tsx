import { useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🔑 수집 키워드 관리 — 인플루언서 풀 페이지에서 추출(600줄 캡 준수).
 *   활성/후보 칩 토글 + 우선 카테고리 태깅 추가. 변경 시 onChanged(부모 loadMeta)로 재조회.
 */
export interface Keyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string; found_total?: number; saved_total?: number; last_saved?: number; last_run_at?: string | null }

// ⭐ 우선 커서(배치의 3/4)를 타는 카테고리 — influencer-auto-collect PRIORITY_CATEGORIES 와 동일해야 함.
export const PRIORITY_CATS = ['맛집', '푸드', '외식창업', '숙소', '네일', '뷰티']

export default function KeywordManager({ keywords, onChanged }: { keywords: Keyword[]; onChanged: () => Promise<void> }) {
  const [newKw, setNewKw] = useState('')
  const [newKwCat, setNewKwCat] = useState('맛집') // 신규 키워드 카테고리(우선 커서 태깅)
  const activeKw = keywords.filter(k => k.active)
  const candidateKw = keywords.filter(k => !k.active)

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
    try { await api.patch(`/api/admin/ads/influencer-pool/keywords/${k.id}`, { active: k.active ? 0 : 1 }); await onChanged() }
    catch { toast.error('변경 실패') }
  }

  return (
    <details className="mb-4 rounded-lg border border-gray-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
        수집 키워드 관리 (활성 {activeKw.length} · 후보 {candidateKw.length})
      </summary>
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={newKwCat} onChange={e => setNewKwCat(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" title="우선 카테고리로 태깅하면 우선 커서(배치 3/4)를 탑니다">
            {PRIORITY_CATS.map(cat => <option key={cat} value={cat}>⭐{cat}</option>)}
            <option value="일반">일반</option>
          </select>
          <input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="키워드 추가 (예: 방배 맛집)" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
          <button onClick={addKeyword} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">추가</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.map(k => (
            <button key={k.id} onClick={() => toggleKeyword(k)} title={`${k.category || '일반'} · ${k.source}${k.saved_total ? ` · 누적 ${k.saved_total}명(직전 ${k.last_saved || 0})` : ''}${k.last_run_at ? ` · ${k.last_run_at.slice(5, 16)}` : ''}${k.hits ? ` · ${k.hits}회 등장` : ''}`}
              className={`px-2.5 py-1 rounded-full text-xs border ${k.active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-300 line-through'}`}>
              {PRIORITY_CATS.includes(k.category || '') ? '⭐' : ''}{k.keyword}{k.source === 'auto' ? ' 🌱' : ''}{k.saved_total ? <span className={k.active ? 'text-emerald-300' : 'text-gray-400'}> · {formatNumber(k.saved_total)}</span> : ''}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">칩을 눌러 활성/비활성. ⭐ = 우선 카테고리(우선 커서 3/4). 🌱 = 해시태그 자동확장. 숫자 = 이 키워드로 모은 누적 인원(성과순 정렬 — 잘 무는 키워드가 위로).</p>
      </div>
    </details>
  )
}
