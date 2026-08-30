import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import PanelError from './PanelError'

/**
 * 🆕 2026-07-12 유어애즈 — 무료 단축 링크(/l/{code}) 패널.
 *   생성(URL·제목·커스텀 코드) + 목록(복사·클릭수·활성 토글·삭제) + 링크별 30일 일별 클릭.
 *   무료 기능(베타 액세스 코드 불요 — 서버 unlockExempt) · 계정당 100개 캡.
 */
const authHeader = () => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('ads_token') : null
  return t ? { Authorization: `Bearer ${t}` } : undefined
}

interface LinkRow { id: number; code: string; target_url: string; title: string | null; active: number; click_count: number; last_click_at: string | null; created_at: string }

const card = 'rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#1A1C21] p-4'
const input = 'h-10 rounded-lg border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#0D0F12] px-3 text-[13px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500'

const shortUrl = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : 'https://urdeal.kr'}/l/${code}`

export default function ShortLinksPanel() {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [target, setTarget] = useState('')
  const [customCode, setCustomCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const [openStats, setOpenStats] = useState<number | null>(null)
  const [daily, setDaily] = useState<Array<{ day: string; count: number }>>([])

  const load = useCallback(async () => {
    setErr(false)
    try {
      const r = await api.get('/api/ads/links', { headers: authHeader() })
      if (r.data?.success) setLinks(r.data.links || [])
    } catch { setErr(true) }
  }, [])
  useEffect(() => { load() }, [load])

  async function create() {
    if (!target.trim()) { toast.error('이동할 URL을 입력해주세요'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/ads/links', { target_url: target.trim(), custom_code: customCode.trim() || undefined }, { headers: authHeader() })
      if (r.data?.success) {
        setLinks(r.data.links || [])
        setTarget(''); setCustomCode('')
        const code = r.data.link?.code
        if (code) { await copy(shortUrl(code)); toast.success('생성 완료 — 단축 주소가 복사되었습니다') }
      } else toast.error(r.data?.error || '생성 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '생성 실패')
    } finally { setBusy(false) }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); } catch { /* http/권한 — 무시 */ }
  }

  async function toggleActive(l: LinkRow) {
    try {
      const r = await api.patch(`/api/ads/links/${l.id}`, { active: !l.active }, { headers: authHeader() })
      if (r.data?.success) { setLinks(prev => prev.map(x => x.id === l.id ? { ...x, active: l.active ? 0 : 1 } : x)); toast.success(l.active ? '비활성화됨 (접속 시 404)' : '활성화됨') }
      else toast.error(r.data?.error || '변경 실패')
    } catch { toast.error('변경 실패') }
  }

  async function remove(l: LinkRow) {
    const ok = await confirmDialog({ title: '링크 삭제', message: `/l/${l.code} 를 삭제할까요? 공유된 주소는 더 이상 동작하지 않습니다.`, confirmText: '삭제', danger: true })
    if (!ok) return
    try {
      const r = await api.delete(`/api/ads/links/${l.id}`, { headers: authHeader() })
      if (r.data?.success) { setLinks(prev => prev.filter(x => x.id !== l.id)); if (openStats === l.id) setOpenStats(null) }
      else toast.error(r.data?.error || '삭제 실패')
    } catch { toast.error('삭제 실패') }
  }

  async function showStats(l: LinkRow) {
    if (openStats === l.id) { setOpenStats(null); return }
    try {
      const r = await api.get(`/api/ads/links/${l.id}/stats`, { headers: authHeader() })
      if (r.data?.success) { setDaily(r.data.daily || []); setOpenStats(l.id) }
    } catch { toast.error('통계를 불러오지 못했습니다') }
  }

  const maxDaily = Math.max(1, ...daily.map(d => d.count))

  return (
    <div className={`mt-3 ${card}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">무료 단축 링크</h3>
          <p className="mt-0.5 text-[11.5px] text-gray-500 dark:text-gray-400">긴 URL을 <span className="font-semibold">{typeof window !== 'undefined' ? window.location.host : 'urdeal.kr'}/l/코드</span> 로 줄이고 클릭수를 추적하세요. 무료 · 100개까지.</p>
        </div>
      </div>

      {/* 생성 폼 — 2026-07-27 대표 "메모 필요없어": URL + (선택)커스텀 코드만 */}
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
        <input className={input} placeholder="https:// 이동할 전체 URL" value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create() }} />
        <input className={input} placeholder="커스텀 코드 (선택)" value={customCode} onChange={e => setCustomCode(e.target.value)} />
        <button onClick={create} disabled={busy} className="h-10 px-4 rounded-lg bg-gray-900 dark:bg-white text-[13px] font-bold text-white dark:text-[#0D0F12] disabled:opacity-50">{busy ? '생성 중…' : '단축하기'}</button>
      </div>

      {err && <PanelError onRetry={load} />}

      {/* 목록 */}
      <div className="mt-3 space-y-2">
        {links.length === 0 && !err && <p className="py-6 text-center text-[12.5px] text-gray-400 dark:text-gray-500">아직 만든 링크가 없습니다. 첫 링크를 단축해보세요.</p>}
        {links.map(l => (
          <div key={l.id} className="rounded-xl border border-gray-100 dark:border-[#1F2637] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <button onClick={() => { copy(shortUrl(l.code)); toast.success('복사됨') }} className={`text-[13px] font-bold ${l.active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 line-through'} hover:underline`} title="클릭하여 복사">/l/{l.code}</button>
                  {l.title && <span className="text-[11.5px] text-gray-500 dark:text-gray-400">{l.title}</span>}
                  {!l.active && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#1A2030] text-[10.5px] font-bold text-gray-500">비활성</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[420px]">{l.target_url}</div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 text-[12px]">
                {/* 2026-07-27 대표 "복사하기 버튼만 있으면 되잖아" — 숨은 텍스트 클릭 대신 명시 버튼 */}
                <button onClick={() => { copy(shortUrl(l.code)); toast.success(`복사됨 — ${shortUrl(l.code)}`) }}
                  className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11.5px] font-bold">📋 복사하기</button>
                <button onClick={() => showStats(l)} className="font-bold text-gray-900 dark:text-white tabular-nums hover:underline" title="일별 통계 보기">{formatNumber(l.click_count)} 클릭</button>
                <button onClick={() => toggleActive(l)} className="font-semibold text-gray-500 dark:text-gray-400 hover:underline">{l.active ? '끄기' : '켜기'}</button>
                <button onClick={() => remove(l)} className="font-semibold text-red-500 hover:underline">삭제</button>
              </div>
            </div>
            {openStats === l.id && (
              <div className="mt-2 border-t border-gray-100 dark:border-[#1F2637] pt-2">
                {daily.length === 0 ? (
                  <p className="text-[11.5px] text-gray-400 dark:text-gray-500">최근 30일 클릭 기록이 없습니다.</p>
                ) : (
                  <div className="flex items-end gap-[3px] h-16" aria-label="최근 30일 일별 클릭">
                    {daily.map(d => (
                      <div key={d.day} className="flex-1 min-w-[4px] rounded-t bg-blue-500/70 dark:bg-blue-400/70" style={{ height: `${Math.max(8, (d.count / maxDaily) * 100)}%` }} title={`${d.day} · ${d.count}클릭`} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
