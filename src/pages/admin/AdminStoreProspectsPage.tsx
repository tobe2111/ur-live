import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatNumber, kstShort } from '@/utils/format'

interface Prospect {
  id: number; biz_name: string; category: string | null; uptae: string | null
  addr_road: string | null; addr_lot: string | null; phone: string | null; region: string | null
  email: string | null; website: string | null; contact_source: string | null
  trd_state: string | null; trd_state_nm: string | null; apv_perm_ymd: string | null
  status: string; active: number; is_new_open: number; memo: string | null
  contact_channel: string | null; follow_up_at: string | null
}
interface Stats { total: number; operating: number; new_open: number; closed: number; with_phone: number; with_email: number; onboarded: number }
const SRC_LABEL: Record<string, string> = { govreg: '인허가', kakao: '카카오', naver: '네이버', homepage: '홈페이지' }
interface RunInfo { last_run?: string; day?: string; found?: number; saved?: number; new_open?: number; closed?: number; office?: string; total_saved?: number; diag?: { error?: string } }
interface Collect { gate: boolean; adsBinding: boolean; run: RunInfo | null }
interface SubSource { gate: boolean; run: RunInfo | null }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  onboarded: { label: '입점', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-600' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const STATUSES = ['new', 'contacted', 'interested', 'onboarded', 'rejected', 'hold']
const PAGE_SIZE = 100

export default function AdminStoreProspectsPage() {
  const [rows, setRows] = useState<Prospect[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [collect, setCollect] = useState<Collect | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [busySub, setBusySub] = useState('') // 'neis' | 'hira' | ''
  const [neis, setNeis] = useState<SubSource | null>(null)
  const [hira, setHira] = useState<SubSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [fCategory, setFCategory] = useState('')
  const [fRegion, setFRegion] = useState('')
  const [fView, setFView] = useState('') // '' | 'newOpen' | 'closed' | 'phone'
  const [q, setQ] = useState('')
  const dq = useDebouncedValue(q) // ⏱️ 서버 검색은 타이핑 멈춘 뒤 1회(키 입력마다 왕복 방지)

  const loadStats = useCallback(async () => {
    try { const r = await api.get('/api/admin/store-prospects/stats'); if (r.data?.success) { setStats(r.data.stats); setCollect(r.data.collect || null); setNeis(r.data.neis || null); setHira(r.data.hira || null) } } catch { /* noop */ }
  }, [])
  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (fCategory) p.set('category', fCategory)
      if (fRegion.trim()) p.set('region', fRegion.trim())
      if (fView === 'newOpen') p.set('newOpen', '1')
      if (fView === 'closed') p.set('includeClosed', '1')
      if (fView === 'phone') p.set('hasPhone', '1')
      if (fView === 'email') p.set('hasEmail', '1')
      if (dq.trim()) p.set('q', dq.trim())
      p.set('limit', String(PAGE_SIZE))
      p.set('offset', String(page * PAGE_SIZE))
      const r = await api.get(`/api/admin/store-prospects?${p.toString()}`)
      if (r.data?.success) { setRows(r.data.prospects || []); setTotal(Number(r.data.total) || 0) }
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [fCategory, fRegion, fView, dq, page])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadRows() }, [loadRows])
  useEffect(() => { setPage(0) }, [fCategory, fRegion, fView, q]) // 필터 변경 시 1페이지로

  async function runCollect() {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작합니다'); return }
    setCollecting(true)
    try {
      const r = await api.post('/api/admin/store-prospects/collect', {})
      if (r.data?.success) {
        toast.success('인허가 변동분 수집 시작 — 잠시 후 반영됩니다')
        for (let i = 0; i < 3; i++) { await new Promise(res => setTimeout(res, 5000)); await Promise.all([loadStats(), loadRows()]) }
      } else toast.error(r.data?.error || '수집 위임 실패')
    } catch { toast.error('수집 위임 실패') } finally { setCollecting(false) }
  }

  async function runCollectSub(kind: 'neis' | 'hira') {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작합니다'); return }
    setBusySub(kind)
    try {
      const r = await api.post(`/api/admin/store-prospects/collect-${kind}`, {})
      if (r.data?.success) {
        toast.success(kind === 'neis' ? '학원 수집 시작(교육청 순환) — 잠시 후 반영' : '병원 수집 시작(전화+홈페이지) — 잠시 후 반영')
        for (let i = 0; i < 3; i++) { await new Promise(res => setTimeout(res, 6000)); await Promise.all([loadStats(), loadRows()]) }
      } else toast.error(r.data?.error || '수집 위임 실패')
    } catch { toast.error('수집 위임 실패') } finally { setBusySub('') }
  }

  async function runEnrich() {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작합니다'); return }
    setEnriching(true)
    try {
      const r = await api.post('/api/admin/store-prospects/enrich-contacts', {})
      if (r.data?.success) {
        toast.success('이메일 보강 시작 — 홈페이지 크롤/네이버 링크발견 (게시된 것만)')
        for (let i = 0; i < 3; i++) { await new Promise(res => setTimeout(res, 6000)); await Promise.all([loadStats(), loadRows()]) }
      } else toast.error(r.data?.error || '보강 위임 실패')
    } catch { toast.error('보강 위임 실패') } finally { setEnriching(false) }
  }

  async function patchStatus(id: number, status: string) {
    try {
      const r = await api.patch(`/api/admin/store-prospects/${id}`, { status })
      if (r.data?.success) { setRows(rs => rs.map(x => x.id === id ? { ...x, status } : x)); loadStats() }
      else toast.error(r.data?.error || '변경 실패')
    } catch { toast.error('변경 실패') }
  }

  const statCard = (label: string, val: number, hint?: string, accent?: string) => (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent || 'text-gray-900'}`}>{formatNumber(val)}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-400">{hint}</div>}
    </div>
  )

  return (
    <AdminLayout title="매장 후보">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="🏪 매장 후보" subtitle="지방행정 인허가로 발굴한 유어딜 입점 대상 매장 — 발굴·개업감지·폐업정리 (수집 ≠ 발송)" />

        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-5">
          {statCard('전체', stats?.total || 0)}
          {statCard('영업중', stats?.operating || 0)}
          {statCard('🆕 신규 개업', stats?.new_open || 0, '최근 인허가 · 전환율 최고', 'text-rose-600')}
          {statCard('전화 보유', stats?.with_phone || 0)}
          {statCard('📧 이메일 보유', stats?.with_email || 0, '홈페이지 게시분', 'text-indigo-600')}
          {statCard('입점 완료', stats?.onboarded || 0, undefined, 'text-green-600')}
          {statCard('폐업', stats?.closed || 0, '자동 정리됨', 'text-gray-400')}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={runCollect} disabled={collecting || !collect?.adsBinding} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50" title="지방행정 인허가 전일 변동분 1회 수집(일반음식점·휴게음식점·미용업·숙박업·동물미용업)">{collecting ? '수집 중…' : '🏪 인허가 수집'}</button>
          <button onClick={runEnrich} disabled={enriching || !collect?.adsBinding} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50" title="이메일 우선 연락처 보강 — 홈페이지 크롤 + 네이버 링크발견(게시된 것만, 추측 0)">{enriching ? '보강 중…' : '📧 이메일 보강'}</button>
          <button onClick={() => runCollectSub('neis')} disabled={busySub !== '' || !collect?.adsBinding} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50" title="나이스(NEIS) 학원·교습소 — 인허가에 없는 학원 갭 커버(교육청 17곳 순환). NEIS_API_KEY 필요">{busySub === 'neis' ? '수집 중…' : '🎓 학원 수집'}</button>
          <button onClick={() => runCollectSub('hira')} disabled={busySub !== '' || !collect?.adsBinding} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50" title="심평원 병원정보 — 전국 병·의원 전화+홈페이지 직접 제공(이메일 크롤 관문)">{busySub === 'hira' ? '수집 중…' : '🏥 병원 수집'}</button>
          <button onClick={async () => { try { const r = await api.get('/api/admin/store-prospects/export', { responseType: 'blob' }); const u = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = u; a.download = `store-prospects-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(u) } catch { toast.error('내보내기 실패 — 재로그인 후 시도') } }} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium" title="영업중 매장 후보를 엑셀 호환 CSV 로(한글 BOM) — 인증 다운로드">⬇ CSV</button>
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="매장명·지역·전화 검색" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-56" />
        </div>

        {collect && (
          <div className="mb-3 text-xs text-gray-500">
            인허가 자동수집 <span className={collect.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{collect.gate ? 'ON · 매일 KST 05시' : 'OFF'}</span>
            {collect.run?.diag?.error ? <span className="text-amber-600"> · {collect.run.diag.error}</span>
              : collect.run?.last_run ? <span> · 최근 {kstShort(collect.run.last_run)} · {collect.run.day} 변동분 발굴 {collect.run.found ?? 0} / 저장 {collect.run.saved ?? 0}</span>
                : <span className="text-gray-400"> · 아직 실행 안 됨</span>}
            {neis?.run && (
              <><span className="mx-2 text-gray-300">|</span>🎓 학원 <span className={neis.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{neis.gate ? 'ON' : 'OFF'}</span>
                {neis.run.diag?.error ? <span className="text-amber-600"> · {neis.run.diag.error}</span>
                  : <span> · 최근 {kstShort(neis.run.last_run)} · {neis.run.office || ''} 저장 {neis.run.saved ?? 0} (누적 {neis.run.total_saved ?? 0})</span>}</>
            )}
            {hira?.run && (
              <><span className="mx-2 text-gray-300">|</span>🏥 병원 <span className={hira.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{hira.gate ? 'ON' : 'OFF'}</span>
                {hira.run.diag?.error ? <span className="text-amber-600"> · {hira.run.diag.error}</span>
                  : <span> · 최근 {kstShort(hira.run.last_run)} · 저장 {hira.run.saved ?? 0} (누적 {hira.run.total_saved ?? 0})</span>}</>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">업종 전체</option>
            <option value="일반음식점">일반음식점</option>
            <option value="휴게음식점">휴게음식점</option>
            <option value="미용업">미용업</option>
            <option value="숙박업">숙박업</option>
            <option value="동물미용업">동물미용업</option>
            <option value="약국">약국</option>
            <option value="병원">병원</option>
            <option value="이용업">이용업</option>
            <option value="목욕장업">목욕장업</option>
            <option value="동물병원">동물병원</option>
            <option value="동물약국">동물약국</option>
            <option value="체력단련장">체력단련장(헬스)</option>
            <option value="체육도장">체육도장</option>
            <option value="당구장">당구장</option>
            <option value="골프연습장">골프연습장</option>
            <option value="노래연습장">노래연습장</option>
            <option value="학원">학원</option>
          </select>
          <input value={fRegion} onChange={e => setFRegion(e.target.value)} placeholder="지역(예: 서초)" className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900 w-32" />
          <select value={fView} onChange={e => setFView(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">영업중</option>
            <option value="newOpen">🆕 신규 개업만</option>
            <option value="phone">전화 보유만</option>
            <option value="email">📧 이메일 보유만</option>
            <option value="closed">폐업 포함</option>
          </select>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">매장명</th>
                  <th className="text-left px-3 py-2 font-medium">업종</th>
                  <th className="text-left px-3 py-2 font-medium">지역</th>
                  <th className="text-left px-3 py-2 font-medium">전화</th>
                  <th className="text-left px-3 py-2 font-medium">📧 이메일</th>
                  <th className="text-left px-3 py-2 font-medium">인허가일</th>
                  <th className="text-left px-3 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">불러오는 중…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">후보가 없습니다. '인허가 수집'을 눌러 발굴하세요.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className={r.active ? '' : 'opacity-50'}>
                    <td className="px-3 py-2 text-gray-900">
                      {r.is_new_open === 1 && <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-semibold">개업</span>}
                      {r.biz_name}
                      {r.addr_road && <div className="text-[11px] text-gray-400">{r.addr_road}</div>}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.category || '—'}{r.uptae && <span className="text-gray-400"> · {r.uptae}</span>}</td>
                    <td className="px-3 py-2 text-gray-600">{r.region || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{r.phone || <span className="text-gray-300">없음</span>}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {r.email ? (
                        <span className="inline-flex items-center gap-1">
                          <a href={`mailto:${r.email}`} className="text-indigo-600 hover:underline break-all">{r.email}</a>
                          {r.contact_source && <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">{SRC_LABEL[r.contact_source] || r.contact_source}</span>}
                        </span>
                      ) : <span className="text-gray-300">없음</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.apv_perm_ymd ? `${r.apv_perm_ymd.slice(0, 4)}.${r.apv_perm_ymd.slice(4, 6)}.${r.apv_perm_ymd.slice(6, 8)}` : '—'}</td>
                    <td className="px-3 py-2">
                      <select value={r.status} onChange={e => patchStatus(r.id, e.target.value)} className={`text-xs rounded px-2 py-1 border-0 ${STATUS_META[r.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 페이지네이션 — 총건수 기준으로 끝까지 이동(대표 "목록이 끝까지 안 나와") */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{total.toLocaleString()}건 중 {(total === 0 ? 0 : page * PAGE_SIZE + 1).toLocaleString()}–{Math.min(total, (page + 1) * PAGE_SIZE).toLocaleString()} · {page + 1}/{Math.max(1, Math.ceil(total / PAGE_SIZE)).toLocaleString()} 페이지</span>
          <div className="grow" />
          <button onClick={() => setPage(0)} disabled={page === 0} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">« 처음</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">‹ 이전</button>
          <button onClick={() => setPage(p => Math.min(Math.ceil(total / PAGE_SIZE) - 1, p + 1))} disabled={(page + 1) * PAGE_SIZE >= total} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">다음 ›</button>
          <button onClick={() => setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1))} disabled={(page + 1) * PAGE_SIZE >= total} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">끝 »</button>
        </div>
      </div>
    </AdminLayout>
  )
}
