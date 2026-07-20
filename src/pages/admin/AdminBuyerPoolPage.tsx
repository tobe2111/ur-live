import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🌐 2026-07-20 유통스타트 해외 수출 바이어 풀 (/admin/buyer-pool).
 *   격리 테이블 `overseas_buyer_leads` 열람/큐레이션 + 발굴 타깃(카테고리×국가) 관리 + 수동 수집 + CSV.
 *   API: /api/admin/buyer-pool/*. 게이트 OFF 면 수집 no-op(소스 미설정 시 found:0 정상).
 *   ⚠️ 공개 비즈니스 컨택만 수집 — 콜드 아웃리치는 국가별 규제(GDPR·CAN-SPAM) 별도(수집 ≠ 발송).
 */
interface Lead {
  id: number; source: string; company: string; country: string | null; category: string | null
  website: string | null; email: string | null; phone: string | null; contact_name: string | null
  description: string | null; source_keyword: string | null; status: string; memo: string | null
  contacted_at: string | null; follow_up_at: string | null; collected_at: string
}
interface Stats { total: number; with_contact: number; worked: number; recent7: number }
interface Dist { k: string; n: number }
interface Target { id: number; category: string; country: string; keyword: string | null; active: number; hits: number; found_total: number; saved_total: number; last_run_at: string | null }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-600' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  negotiating: { label: '협상', cls: 'bg-indigo-100 text-indigo-700' },
  contracted: { label: '계약', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '거절', cls: 'bg-gray-100 text-gray-400' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const STATUS_ORDER = ['new', 'contacted', 'interested', 'negotiating', 'contracted', 'rejected', 'hold']

export default function AdminBuyerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, with_contact: 0, worked: 0, recent7: 0 })
  const [byCountry, setByCountry] = useState<Dist[]>([])
  const [byCategory, setByCategory] = useState<Dist[]>([])
  const [meta, setMeta] = useState<{ enabled: boolean; provider: string | null; directories: number }>({ enabled: false, provider: null, directories: 0 })
  const [targets, setTargets] = useState<Target[]>([])
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')
  const [hasContact, setHasContact] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [showTargets, setShowTargets] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [newCountry, setNewCountry] = useState('')

  const loadStats = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/buyer-pool/stats')
      if (r.data?.success) {
        setStats(r.data.stats); setByCountry(r.data.byCountry || []); setByCategory(r.data.byCategory || [])
        setMeta({ enabled: !!r.data.enabled, provider: r.data.provider || null, directories: r.data.directories || 0 })
      }
    } catch { /* noop */ }
  }, [])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (country) params.set('country', country)
      if (hasContact) params.set('hasContact', '1')
      if (q.trim()) params.set('q', q.trim())
      const r = await api.get(`/api/admin/buyer-pool?${params.toString()}`)
      if (r.data?.success) setLeads(r.data.leads || [])
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [status, country, hasContact, q])

  const loadTargets = useCallback(async () => {
    try { const r = await api.get('/api/admin/buyer-pool/targets'); if (r.data?.success) setTargets(r.data.targets || []) } catch { /* noop */ }
  }, [])

  useEffect(() => { loadStats(); loadTargets() }, [loadStats, loadTargets])
  useEffect(() => { loadLeads() }, [loadLeads])

  const collect = async () => {
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/buyer-pool/collect')
      const res = r.data?.result
      if (res?.ran) toast.success(`수집 완료 — 발굴 ${res.found} · 신규 ${res.saved} (타깃: ${(res.targets || []).join(', ') || '없음'})`)
      else toast.info(`수집 안 함 (${res?.reason || '알 수 없음'})`)
      await Promise.all([loadStats(), loadLeads(), loadTargets()])
    } catch { toast.error('수집 실행 실패') } finally { setCollecting(false) }
  }

  const patch = async (id: number, body: Record<string, unknown>) => {
    try {
      const r = await api.patch(`/api/admin/buyer-pool/${id}`, body)
      if (r.data?.success) { setLeads(prev => prev.map(l => l.id === id ? { ...l, ...body } as Lead : l)); loadStats() }
      else toast.error(r.data?.error || '수정 실패')
    } catch { toast.error('수정 실패') }
  }

  const remove = async (id: number) => {
    if (!confirm('이 리드를 삭제할까요?')) return
    try { await api.delete(`/api/admin/buyer-pool/${id}`); setLeads(prev => prev.filter(l => l.id !== id)); loadStats() } catch { toast.error('삭제 실패') }
  }

  const addTarget = async () => {
    if (newCat.trim().length < 2 || newCountry.trim().length < 2) { toast.error('카테고리·국가를 입력하세요'); return }
    try {
      const r = await api.post('/api/admin/buyer-pool/targets', { category: newCat.trim(), country: newCountry.trim() })
      if (r.data?.success) { setNewCat(''); setNewCountry(''); loadTargets() } else toast.error(r.data?.error || '추가 실패')
    } catch { toast.error('추가 실패') }
  }
  const toggleTarget = async (t: Target) => {
    try { await api.patch(`/api/admin/buyer-pool/targets/${t.id}`, { active: !t.active }); loadTargets() } catch { toast.error('변경 실패') }
  }

  const exportCsv = () => { window.open('/api/admin/buyer-pool/export?format=csv', '_blank') }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="🌐 해외 바이어 풀" subtitle="유통스타트 수출 바이어 발굴 — 공개 디렉토리·공식 무역 데이터 수집" />

        {/* 게이트/소스 상태 */}
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>자동 수집: <b className={meta.enabled ? 'text-emerald-600' : 'text-gray-400'}>{meta.enabled ? 'ON' : 'OFF (BUYER_AUTO_COLLECT_ENABLED)'}</b></span>
          <span>공개 디렉토리: <b className="text-gray-800">{meta.directories}개</b></span>
          <span>유료 provider: <b className="text-gray-800">{meta.provider || '미설정'}</b></span>
          <span className="text-gray-400">· 수집 ≠ 발송 — 공개 비즈니스 컨택만</span>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[{ l: '전체 바이어', v: stats.total }, { l: '컨택 보유', v: stats.with_contact }, { l: '진행 중', v: stats.worked }, { l: '최근 7일', v: stats.recent7 }].map(s => (
            <div key={s.l} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{s.l}</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(s.v)}</div>
            </div>
          ))}
        </div>

        {/* 분포 */}
        {(byCountry.length > 0 || byCategory.length > 0) && (
          <div className="grid lg:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">국가별</div>
              <div className="flex flex-wrap gap-1.5">
                {byCountry.map(d => <button key={d.k} onClick={() => setCountry(country === d.k ? '' : d.k)} className={`px-2 py-1 rounded-full text-xs ${country === d.k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{d.k} {d.n}</button>)}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">카테고리별</div>
              <div className="flex flex-wrap gap-1.5">
                {byCategory.map(d => <span key={d.k} className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{d.k} {d.n}</span>)}
              </div>
            </div>
          </div>
        )}

        {/* 액션 바 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={collect} disabled={collecting} className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{collecting ? '수집 중…' : '지금 수집'}</button>
          <button onClick={() => setShowTargets(v => !v)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700">발굴 타깃 {showTargets ? '숨기기' : '관리'}</button>
          <button onClick={exportCsv} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700">CSV 내보내기</button>
          <div className="flex-1" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="회사/이메일 검색" className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 w-44" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-900">
            <option value="">전체 상태</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm text-gray-600"><input type="checkbox" checked={hasContact} onChange={e => setHasContact(e.target.checked)} /> 컨택만</label>
          {country && <button onClick={() => setCountry('')} className="text-xs text-gray-500 underline">국가필터 해제({country})</button>}
        </div>

        {/* 타깃 관리 */}
        {showTargets && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="카테고리(K-beauty)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 w-40" />
              <input value={newCountry} onChange={e => setNewCountry(e.target.value)} placeholder="국가(Vietnam)" className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 w-40" />
              <button onClick={addTarget} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm">타깃 추가</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targets.map(t => (
                <button key={t.id} onClick={() => toggleTarget(t)} title={`발굴 ${t.found_total} · 저장 ${t.saved_total}`}
                  className={`px-2 py-1 rounded-full text-xs ${t.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 line-through'}`}>
                  {t.category}·{t.country} {t.saved_total > 0 ? `(${t.saved_total})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 리스트 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">불러오는 중…</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              바이어가 없습니다. {meta.directories === 0 && !meta.provider ? '공개 디렉토리 URL(BUYER_DIRECTORY_URLS) 또는 provider 키를 등록한 뒤 「지금 수집」을 눌러주세요.' : '「지금 수집」을 눌러 발굴을 시작하세요.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {leads.map(l => (
                <div key={l.id} className="p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <div className="min-w-[180px] flex-1">
                    <div className="font-medium text-gray-900">{l.company}</div>
                    <div className="text-xs text-gray-500">{[l.country, l.category, l.source].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="min-w-[200px] text-xs text-gray-600">
                    {l.email && <div>✉ {l.email}</div>}
                    {l.phone && <div>☎ {l.phone}</div>}
                    {l.website && <a href={l.website.startsWith('http') ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">{l.website}</a>}
                    {!l.email && !l.phone && !l.website && <span className="text-gray-300">컨택 없음</span>}
                  </div>
                  <select value={l.status} onChange={e => patch(l.id, { status: e.target.value })}
                    className={`px-2 py-1 rounded-full text-xs border-0 ${STATUS_META[l.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                  <button onClick={() => remove(l.id)} className="text-xs text-gray-300 hover:text-red-500">삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          ⚠️ 수집된 이메일/연락처는 공개된 비즈니스 컨택입니다. 마케팅 발송(콜드 아웃리치)은 대상 국가 규제(EU GDPR·미국 CAN-SPAM·캐나다 CASL)를 따르세요 — 이 도구는 수집·정리까지만 담당합니다.
        </p>
      </div>
    </AdminLayout>
  )
}
