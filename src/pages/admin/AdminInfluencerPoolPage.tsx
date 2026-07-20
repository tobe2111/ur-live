import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🎯 2026-07-20 유어애즈 인플루언서 공용 풀 (/admin/influencer-pool).
 *   ur-ads cron 이 무료 공식 API(YouTube·네이버)로 자동 수집한 공용 풀(account_id=0) 열람/큐레이션
 *   + 수집 키워드 관리 + 수동 수집 트리거. API: /api/admin/ads/influencer-pool/*.
 *   ⚠️ 수집은 공개 데이터/공식 API 만 — 실제 마케팅 발송은 사전동의 별도(정보통신망법).
 */
interface Lead {
  id: number; platform: string; handle: string | null; name: string; url: string
  subscriber_count: number; video_count: number; thumbnail: string | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  status: string; memo: string | null; category: string | null; source_keyword: string | null; collected_at: string
}
interface PoolStats { total?: number; youtube?: number; naver_blog?: number; with_contact?: number; recent7?: number }
interface PlatformDiag { configured: boolean; found: number; saved: number; error?: string }
interface RunStats { last_run?: string; last_saved?: number; total_saved?: number; total_runs?: number; promoted?: string[]; youtube_quota_hit?: boolean; diag?: { yt: PlatformDiag; naver: PlatformDiag } }
interface Keyword { id: number; keyword: string; category: string | null; active: number; hits: number; source: string }

const PLATFORM_LABEL: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버', instagram: '인스타', tiktok: '틱톡' }

export default function AdminInfluencerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<PoolStats>({})
  const [run, setRun] = useState<RunStats | null>(null)
  const [gate, setGate] = useState(false)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [platform, setPlatform] = useState('')
  const [hasContact, setHasContact] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [newKw, setNewKw] = useState('')

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (platform) params.set('platform', platform)
      if (hasContact) params.set('hasContact', '1')
      if (q.trim()) params.set('q', q.trim())
      const r = await api.get(`/api/admin/ads/influencer-pool?${params.toString()}`)
      if (r.data?.success) setLeads(r.data.leads || [])
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [platform, hasContact, q])

  const loadMeta = useCallback(async () => {
    try {
      const [s, k] = await Promise.all([
        api.get('/api/admin/ads/influencer-pool/stats'),
        api.get('/api/admin/ads/influencer-pool/keywords'),
      ])
      if (s.data?.success) { setStats(s.data.stats || {}); setRun(s.data.run || null); setGate(!!s.data.gate) }
      if (k.data?.success) setKeywords(k.data.keywords || [])
    } catch { /* soft */ }
  }, [])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { loadLeads() }, [loadLeads])

  async function collectNow() {
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/collect', {})
      if (r.data?.success) {
        const st = r.data.stats || {}
        const saved = st.last_saved ?? 0
        const d = st.diag
        if (saved > 0) toast.success(`수집 완료 — 신규 ${formatNumber(saved)}건`)
        else {
          // 0건이면 플랫폼별 사유를 그대로 보여줌(진단 — 아래 배너에도 상세 표시).
          const why = d ? [d.yt.error && `유튜브: ${d.yt.error}`, d.naver.error && `네이버: ${d.naver.error}`].filter(Boolean).join(' / ') : ''
          const foundDup = d && (d.yt.found + d.naver.found) > 0
          toast.error(foundDup ? `발굴 ${formatNumber(d.yt.found + d.naver.found)}건 전부 기존과 중복(신규 0)` : `신규 0건 — ${why || '원인 미상(아래 진단 참고)'}`)
        }
        await Promise.all([loadLeads(), loadMeta()])
      } else toast.error(r.data?.error || '수집 실패')
    } catch { toast.error('수집 실행 실패') } finally { setCollecting(false) }
  }

  async function addKeyword() {
    const kw = newKw.trim()
    if (kw.length < 2) { toast.error('키워드는 2자 이상'); return }
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/keywords', { keyword: kw })
      if (r.data?.success) { setNewKw(''); toast.success('키워드 추가'); await loadMeta() }
      else toast.error(r.data?.error || '추가 실패')
    } catch { toast.error('추가 실패') }
  }
  async function toggleKeyword(k: Keyword) {
    try { await api.patch(`/api/admin/ads/influencer-pool/keywords/${k.id}`, { active: k.active ? 0 : 1 }); await loadMeta() }
    catch { toast.error('변경 실패') }
  }
  async function setStatus(id: number, status: string) {
    try { await api.patch(`/api/admin/ads/influencer-pool/${id}`, { status }); setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l)) }
    catch { toast.error('변경 실패') }
  }
  async function del(id: number) {
    if (!window.confirm('이 인플루언서를 풀에서 삭제할까요?')) return
    try { await api.delete(`/api/admin/ads/influencer-pool/${id}`); setLeads(prev => prev.filter(l => l.id !== id)) }
    catch { toast.error('삭제 실패') }
  }

  function exportCsv() {
    const esc = (v: unknown) => { const s = String(v ?? ''); return /^[=+\-@]/.test(s) ? `'${s}` : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const head = ['플랫폼', '이름', '핸들', 'URL', '구독자', '이메일', '인스타', '틱톡', '링크', '카테고리', '키워드', '상태']
    const body = leads.map(l => [PLATFORM_LABEL[l.platform] || l.platform, l.name, l.handle, l.url, l.subscriber_count, l.email, l.instagram, l.tiktok, l.links, l.category, l.source_keyword, l.status].map(esc).join(','))
    const csv = '﻿' + [head.join(','), ...body].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `influencer-pool-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const activeKw = keywords.filter(k => k.active)
  const candidateKw = keywords.filter(k => !k.active)

  return (
    <AdminLayout title="인플루언서 풀">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <DashboardPageHeader title="인플루언서 공용 풀" subtitle="무료 공식 API(YouTube·네이버)로 자동 수집한 인플루언서 DB — 열람·큐레이션·키워드 관리" />

        {/* 상태 배너 */}
        {!gate && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            자동 수집이 <b>꺼져 있음</b>. Cloudflare(ur-live) → Settings → Variables 에 <code className="font-mono">ADS_AUTO_COLLECT_ENABLED=true</code> 설정 후 재배포하면 매일 자동 수집됩니다. (아래 "지금 수집"은 즉시 1회 실행)
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          {[
            { label: '전체', value: stats.total },
            { label: '유튜브', value: stats.youtube },
            { label: '네이버', value: stats.naver_blog },
            { label: '연락처 보유', value: stats.with_contact },
            { label: '최근 7일', value: stats.recent7 },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(s.value)}</div>
            </div>
          ))}
        </div>

        {run && (
          <div className="mb-4 text-xs text-gray-500">
            마지막 수집 {run.last_run || '—'} · 신규 {formatNumber(run.last_saved)}건 · 누적 {formatNumber(run.total_saved)}건 · 실행 {formatNumber(run.total_runs)}회
            {run.youtube_quota_hit ? ' · ⚠️ 유튜브 일일 한도 도달(네이버만 계속)' : ''}
            {run.promoted?.length ? ` · 자동확장 키워드 +${run.promoted.length}` : ''}
          </div>
        )}

        {/* 🔎 플랫폼별 진단 — 문제(에러/미설정) 있을 때만 노출 */}
        {run?.diag && (run.diag.yt.error || run.diag.naver.error) && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
            <div className="font-medium">수집 진단 (마지막 실행)</div>
            <div>유튜브 — {run.diag.yt.configured ? `발굴 ${formatNumber(run.diag.yt.found)} · 저장 ${formatNumber(run.diag.yt.saved)}` : '키 미설정'}{run.diag.yt.error ? ` · ⚠️ ${run.diag.yt.error}` : ' · 정상'}</div>
            <div>네이버 — {run.diag.naver.configured ? `발굴 ${formatNumber(run.diag.naver.found)} · 저장 ${formatNumber(run.diag.naver.saved)}` : '키 미설정'}{run.diag.naver.error ? ` · ⚠️ ${run.diag.naver.error}` : ' · 정상'}</div>
            <div className="text-red-500">키 미설정이면: Cloudflare → Workers & Pages → <b>ur-ads</b> → Settings → Variables and Secrets 에 해당 키 추가.</div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={collectNow} disabled={collecting} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
            {collecting ? '수집 중…' : '지금 수집'}
          </button>
          <button onClick={exportCsv} disabled={!leads.length} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium disabled:opacity-50">CSV 내보내기</button>
        </div>

        {/* 키워드 관리 */}
        <details className="mb-4 rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">
            수집 키워드 관리 (활성 {activeKw.length} · 후보 {candidateKw.length})
          </summary>
          <div className="px-4 pb-4">
            <div className="flex gap-2 mb-3">
              <input value={newKw} onChange={e => setNewKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="키워드 추가 (예: 캠핑 유튜버)" className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
              <button onClick={addKeyword} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm">추가</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.map(k => (
                <button key={k.id} onClick={() => toggleKeyword(k)} title={`${k.source}${k.hits ? ` · ${k.hits}회 등장` : ''}`}
                  className={`px-2.5 py-1 rounded-full text-xs border ${k.active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-300 line-through'}`}>
                  {k.keyword}{k.source === 'auto' ? ' 🌱' : ''}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">칩을 눌러 활성/비활성. 🌱 = 수집물 해시태그에서 자동확장된 키워드.</p>
          </div>
        </details>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900">
            <option value="">전체 플랫폼</option>
            <option value="youtube">유튜브</option>
            <option value="naver_blog">네이버 블로그</option>
          </select>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white cursor-pointer">
            <input type="checkbox" checked={hasContact} onChange={e => setHasContact(e.target.checked)} /> 연락처 있음
          </label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름/핸들 검색" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
        </div>

        {/* 목록 */}
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">불러오는 중…</div>
        ) : !leads.length ? (
          <div className="py-16 text-center text-gray-400 text-sm">수집된 인플루언서가 없습니다. "지금 수집"을 눌러 시작하세요.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">인플루언서</th>
                  <th className="text-right px-3 py-2 font-medium">구독자</th>
                  <th className="text-left px-3 py-2 font-medium">연락처</th>
                  <th className="text-left px-3 py-2 font-medium">카테고리</th>
                  <th className="text-left px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      <a href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-gray-900 hover:underline">
                        {l.thumbnail && <img src={l.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" />}
                        <span>
                          <span className="font-medium">{l.name}</span>
                          <span className="ml-1.5 text-xs text-gray-400">{PLATFORM_LABEL[l.platform] || l.platform}{l.handle ? ` · ${l.handle}` : ''}</span>
                        </span>
                      </a>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">{l.platform === 'naver_blog' ? '—' : formatNumber(l.subscriber_count)}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {l.email && <div>✉ {l.email}</div>}
                      {l.instagram && <div>IG @{l.instagram}</div>}
                      {l.tiktok && <div>TT @{l.tiktok}</div>}
                      {!l.email && !l.instagram && !l.tiktok && !l.links && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{l.category || '—'}</td>
                    <td className="px-3 py-2">
                      <select value={l.status} onChange={e => setStatus(l.id, e.target.value)} className="px-2 py-1 rounded border border-gray-200 text-xs text-gray-900">
                        <option value="new">신규</option>
                        <option value="contacted">컨택함</option>
                        <option value="rejected">보류</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => del(l.id)} className="text-xs text-gray-400 hover:text-red-500">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
