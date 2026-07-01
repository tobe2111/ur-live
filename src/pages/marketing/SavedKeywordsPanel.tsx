import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { downloadCsv } from '@/utils/csv-download'
import PanelError from './PanelError'

/**
 * 🆕 2026-06-30 유어애즈 — 키워드 포트폴리오(저장한 키워드·태그).
 *   연관키워드/자동완성에서 '저장'한 키워드를 태그로 묶어 재방문. 외부호출 0(순수 DB).
 */
interface SavedKeyword { id: number; keyword: string; tag: string | null; monthly_total: number | null; comp_idx: string | null; memo: string | null; created_at: string }
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}
const card = 'rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4'

export default function SavedKeywordsPanel() {
  const [items, setItems] = useState<SavedKeyword[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [tagEdit, setTagEdit] = useState<Record<number, string>>({})

  const load = useCallback(async (tag: string | null) => {
    setLoading(true); setErr(false)
    try {
      const r = await api.get(`/api/ads/keywords/saved${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`, { headers: authHeader() })
      if (r.data?.success) { setItems(r.data.items || []); setTags(r.data.tags || []) }
      else setErr(true)
    } catch { setErr(true) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(activeTag) }, [load, activeTag])

  async function saveTag(id: number) {
    const tag = (tagEdit[id] ?? '').trim()
    try {
      const r = await api.patch(`/api/ads/keywords/saved?id=${id}`, { tag }, { headers: authHeader() })
      if (r.data?.success) { setItems(r.data.items || []); setTagEdit(prev => { const n = { ...prev }; delete n[id]; return n }); toast.success('태그 저장'); load(activeTag) }
    } catch { toast.error('태그 저장 실패') }
  }

  async function remove(id: number) {
    try {
      const r = await api.delete(`/api/ads/keywords/saved?id=${id}`, { headers: authHeader() })
      if (r.data?.success) { setItems(r.data.items || []); load(activeTag) }
    } catch { toast.error('삭제 실패') }
  }

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">키워드 포트폴리오 {items.length > 0 && <span className="text-gray-400 dark:text-gray-500 font-medium">({items.length})</span>}</div>
          <p className="mt-0.5 text-[11.5px] text-gray-400 dark:text-gray-500">연관키워드에서 '저장'한 키워드를 태그로 묶어 관리하세요.</p>
        </div>
        {items.length > 0 && (
          <button onClick={() => downloadCsv('유어애즈_저장키워드.csv', ['키워드', '월검색량', '경쟁', '태그', '메모'],
            items.map(k => [k.keyword, k.monthly_total ?? '', k.comp_idx ?? '', k.tag ?? '', k.memo ?? '']))}
            className="shrink-0 rounded-lg border border-gray-200 dark:border-[#2A2A2A] px-2 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">CSV</button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button onClick={() => setActiveTag(null)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${activeTag === null ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0A0A0A]' : 'border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300'}`}>전체</button>
          {tags.map(t => (
            <button key={t} onClick={() => setActiveTag(t)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${activeTag === t ? 'bg-gray-900 dark:bg-white text-white dark:text-[#0A0A0A]' : 'border border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-300'}`}>{t}</button>
          ))}
        </div>
      )}

      {err ? (
        <PanelError onRetry={() => load(activeTag)} busy={loading} label="포트폴리오 조회 실패" />
      ) : loading ? (
        <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-[12px] text-gray-400 dark:text-gray-500">저장한 키워드가 없습니다. 위 '연관키워드 추천'에서 <b className="text-gray-600 dark:text-gray-300">저장</b>을 눌러 담아보세요.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-gray-400 dark:text-gray-500 text-left">
              <th className="py-1 pr-2">키워드</th><th className="py-1 pr-2 text-right">월검색량</th><th className="py-1 pr-2">경쟁</th><th className="py-1 pr-2">태그</th><th className="py-1"></th>
            </tr></thead>
            <tbody>
              {items.map(k => (
                <tr key={k.id} className="border-t border-gray-100 dark:border-[#1A1A1A] text-gray-700 dark:text-gray-300">
                  <td className="py-1.5 pr-2 font-medium text-gray-900 dark:text-white">{k.keyword}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{k.monthly_total != null ? formatNumber(k.monthly_total) : '-'}</td>
                  <td className="py-1.5 pr-2 text-gray-500 dark:text-gray-400">{k.comp_idx || '-'}</td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1">
                      <input value={tagEdit[k.id] ?? k.tag ?? ''} onChange={e => setTagEdit(prev => ({ ...prev, [k.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') saveTag(k.id) }} placeholder="태그"
                        className="w-20 h-6 rounded border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] px-1.5 text-[10.5px] text-gray-900 dark:text-white" />
                      {tagEdit[k.id] !== undefined && tagEdit[k.id] !== (k.tag ?? '') && (
                        <button onClick={() => saveTag(k.id)} className="text-[10px] text-blue-600 dark:text-blue-400">저장</button>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 text-right"><button onClick={() => remove(k.id)} className="text-[10.5px] text-gray-400 dark:text-gray-500 hover:text-red-500">삭제</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
