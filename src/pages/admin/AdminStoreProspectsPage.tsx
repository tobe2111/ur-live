import { useCallback, useEffect, useState } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatNumber, kstShort } from '@/utils/format'
import OpeningWelcomePanel from './store-prospects/OpeningWelcomePanel'
import TradePanel, { type TradeRow } from './partner-pool/TradePanel'
import CollectConfigPanel from './store-prospects/CollectConfigPanel'

/** 매장 업태 → 공용 패널 행. 업태 1행이 **전 지역**을 뜻하므로 kw/active_kw 는 1/0 이다
 *  (파트너는 업종 1행이 235지역을 묶은 것이라 개수가 실수치다 — 그 차이를 여기서만 흡수한다). */
const adaptStoreTrades = (raw: unknown[]): TradeRow[] => (raw as Array<{
  kw: string; category: string; block: string; active: number; found_total: number; saved_total: number; last_run_at: string | null
}>).map(t => ({
  trade: t.kw, category: `${t.block === 'voucher' ? '우선업종' : '무인'} · ${t.category}`,
  kw: 1, active_kw: t.active ? 1 : 0,
  found: t.found_total || 0, saved: t.saved_total || 0, last_run_at: t.last_run_at,
}))

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
interface RunInfo {
  last_run?: string; day?: string; found?: number; saved?: number; new_open?: number; closed?: number; office?: string; total_saved?: number
  /** 🏪 카카오 로컬 레인 전용 — 블록(우선업종/무인)별 수확. 어느 축이 실제로 도는지 한 줄로 판정. */
  blocks?: Record<string, { kw: number; found: number }>
  diag?: {
    error?: string
    /** 🔬 지금 쓰는 요청 형태 + 실패한 실제 요청(키는 서버에서 가려서 온다) + 후보 시도 이력. */
    variant?: string
    fail_probe?: { url?: string; endpoint?: string; day?: string; page?: number; msg?: string }
    probe?: { at?: string; winner?: string | null; attempts?: { id: string; ok: boolean; rows: number; msg?: string }[] }
  }
}
interface Collect { gate: boolean; adsBinding: boolean; run: RunInfo | null }
interface SubSource { gate: boolean; run: RunInfo | null }
/** 📧 연락처 보강 레인 스냅샷 — API 는 계속 주고 있었는데 **화면에 없어서** 아무도 못 봤다(2026-07-29). */
interface EnrichRun {
  last_run?: string; processed?: number; email_found?: number; phone_found?: number; site_found?: number
  remaining_no_email?: number; spent?: number; budget_total?: number; deadline_hit?: boolean; limit_hit?: boolean
  elapsed_ms?: number; pass2_reason?: Record<string, number>; crawl_reason?: Record<string, number>
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택함', cls: 'bg-tone-info-bg text-tone-info' },
  interested: { label: '관심', cls: 'bg-tone-warn-bg text-tone-warn' },
  onboarded: { label: '입점', cls: 'bg-tone-ok-bg text-tone-ok' },
  rejected: { label: '거절', cls: 'bg-tone-bad-bg text-tone-bad' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const STATUSES = ['new', 'contacted', 'interested', 'onboarded', 'rejected', 'hold']
const PAGE_SIZE = 100

export default function AdminStoreProspectsPage() {
  const [rows, setRows] = useState<Prospect[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  /** 📊 수집 루트별 도달 수율 — 총계만 보면 "5만 건 모았다"로 읽힌다(실측은 학원 95% · 이메일 8건). */
  const [bySource, setBySource] = useState<Array<{ source: string; n: number; with_phone: number; with_email: number }>>([])
  const [collect, setCollect] = useState<Collect | null>(null)
  /** 🩺 수확 0 이 지속되는 레인 — 하트비트는 초록인데 한 건도 못 캐는 상태를 화면이 먼저 말해 준다. */
  const [laneHealth, setLaneHealth] = useState<Array<{ lane: string; message: string; severity: string }>>([])
  const [collecting, setCollecting] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [busySub, setBusySub] = useState('') // 'neis' | 'hira' | 'store-kakao' | ''
  const [neis, setNeis] = useState<SubSource | null>(null)
  const [hira, setHira] = useState<SubSource | null>(null)
  const [kakao, setKakao] = useState<SubSource | null>(null)
  const [enrichRun, setEnrichRun] = useState<EnrichRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [fCategory, setFCategory] = useState('')
  const [fRegion, setFRegion] = useState('')
  const [fView, setFView] = useState('') // '' | 'newOpen' | 'closed' | 'phone'
  const [q, setQ] = useState('')
  const dq = useDebouncedValue(q) // ⏱️ 서버 검색은 타이핑 멈춘 뒤 1회(키 입력마다 왕복 방지)

  const loadStats = useCallback(async () => {
    try { const r = await api.get('/api/admin/store-prospects/stats'); if (r.data?.success) { setStats(r.data.stats); setBySource(r.data.bySource || []); setCollect(r.data.collect || null); setNeis(r.data.neis || null); setHira(r.data.hira || null); setKakao(r.data.storeKakao || null); setEnrichRun(r.data.enrich?.run || null); setLaneHealth(r.data.laneHealth || []) } } catch { /* noop */ }
  }, [])
  /**
   * 🔗 **목록과 내보내기가 같은 조건을 쓴다** (2026-08-03 — 내보내기가 필터를 무시하던 것 수리).
   *   실측상 이 풀은 **95%가 학원**이라, 필터가 파일까지 안 이어지면 대표 우선업종(음식점·카페·미용·숙박)은
   *   내보내기로 **도달 자체가 불가능**했다. 조립을 두 벌로 두면 반드시 갈라진다 — 한 곳에 둔다.
   *   ⚠️ limit/offset 은 넣지 않는다(내보내기엔 페이지가 없다).
   */
  const buildQuery = useCallback((): URLSearchParams => {
    const p = new URLSearchParams()
    if (fCategory) p.set('category', fCategory)
    if (fRegion.trim()) p.set('region', fRegion.trim())
    if (fView === 'newOpen') p.set('newOpen', '1')
    if (fView === 'closed') p.set('includeClosed', '1')
    if (fView === 'phone') p.set('hasPhone', '1')
    if (fView === 'email') p.set('hasEmail', '1')
    if (dq.trim()) p.set('q', dq.trim())
    return p
  }, [fCategory, fRegion, fView, dq])

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const p = buildQuery()
      p.set('limit', String(PAGE_SIZE))
      p.set('offset', String(page * PAGE_SIZE))
      const r = await api.get(`/api/admin/store-prospects?${p.toString()}`)
      if (r.data?.success) { setRows(r.data.prospects || []); setTotal(Number(r.data.total) || 0) }
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [buildQuery, page])

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

  const SUB_LABEL: Record<string, string> = {
    neis: '학원 수집 시작(교육청 순환) — 잠시 후 반영',
    hira: '병원 수집 시작(전화+홈페이지) — 잠시 후 반영',
    // 🎯 이 레인은 자동으로 ~5회차에 한 번만 돈다 — 조건을 바꾼 뒤 효과를 지금 보려면 이 버튼이 유일한 길이다.
    'store-kakao': '카카오 매장 수집 시작(음식점·카페·미용·숙박 + 무인) — 잠시 후 반영',
  }

  async function runCollectSub(kind: 'neis' | 'hira' | 'store-kakao') {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작합니다'); return }
    setBusySub(kind)
    try {
      const r = await api.post(`/api/admin/store-prospects/collect-${kind}`, {})
      if (r.data?.success) {
        toast.success(SUB_LABEL[kind] || '수집 시작 — 잠시 후 반영')
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

        {/* 🎉 개업 웰컴 — 최근 개업 큐 + 개업 컨설팅 브리핑(상권 수치·멘트) */}
        <OpeningWelcomePanel onStatusChange={(id, status) => patchStatus(id, status)} />

        {laneHealth.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <div className="text-sm font-semibold text-amber-800">⚠️ 수확이 없는 수집 레인</div>
            <ul className="mt-1 space-y-0.5">
              {laneHealth.map(h => (
                <li key={h.lane} className="text-xs text-amber-900">
                  <span className="font-mono font-semibold">{h.lane}</span> — {h.message}
                </li>
              ))}
            </ul>
            {/* 끄는 판단은 사람이 한다 — 외부 API 의 일시 장애와 영구 장애를 이 신호만으로는 못 가른다. */}
            <div className="mt-1.5 text-[11px] text-amber-700">계속 이 상태면 해당 레인의 게이트를 끄는 것을 검토하세요 — 죽은 레인도 같은 도메인의 다른 레인과 회차 순번을 나눠 갖습니다.</div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          {statCard('전체', stats?.total || 0)}
          {statCard('영업중', stats?.operating || 0)}
          {statCard('🆕 신규 개업', stats?.new_open || 0, '최근 인허가 · 전환율 최고', 'text-rose-600')}
          {statCard('전화 보유', stats?.with_phone || 0)}
          {statCard('📧 이메일 보유', stats?.with_email || 0, '홈페이지 게시분', 'text-indigo-600')}
          {statCard('입점 완료', stats?.onboarded || 0, undefined, 'text-green-600')}
          {statCard('폐업', stats?.closed || 0, '자동 정리됨', 'text-gray-400')}
        </div>
        {bySource.length > 0 && (
          /* 📊 루트별 수율 — "어디에 예산을 더 쓸까" 는 총계로는 답이 안 나온다.
             실측(2026-08-03): neis_academy 49,315건에 이메일 7 · 전화 27,831 / 우선업종은 0건. */
          <div className="mt-3 mb-5 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">수집 루트별 도달 수율 <span className="font-normal text-gray-400">— 총계가 아니라 “연락 가능한 수”로 본다</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-gray-700">
                <thead><tr className="text-gray-500 text-left"><th className="py-1 pr-3">루트</th><th className="py-1 pr-3 text-right">건수</th><th className="py-1 pr-3 text-right">📞 전화</th><th className="py-1 pr-3 text-right">📧 이메일</th><th className="py-1 text-right">도달률</th></tr></thead>
                <tbody>
                  {bySource.map(r => {
                    const reach = r.n > 0 ? Math.round(((r.with_phone + r.with_email > 0 ? Math.max(r.with_phone, r.with_email) : 0) / r.n) * 100) : 0
                    return (
                      <tr key={r.source} className="border-t border-gray-100">
                        <td className="py-1 pr-3 font-medium">{r.source}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{formatNumber(r.n)}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{formatNumber(r.with_phone)}</td>
                        <td className={`py-1 pr-3 text-right tabular-nums ${r.with_email === 0 ? 'text-gray-300' : ''}`}>{formatNumber(r.with_email)}</td>
                        <td className={`py-1 text-right tabular-nums ${reach < 10 ? 'text-rose-600 font-semibold' : 'text-gray-500'}`}>{reach}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[11px] text-gray-500">📞 이 풀의 도달 채널은 <b>전화</b>입니다(이메일은 홈페이지 게시분만). 내보내기 전에 <b>‘전화 보유’</b>로 좁히세요.</div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={runCollect} disabled={collecting || !collect?.adsBinding} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50" title="지방행정 인허가 전일 변동분 1회 수집(일반음식점·휴게음식점·미용업·숙박업·동물미용업)">{collecting ? '수집 중…' : '🏪 인허가 수집'}</button>
          <button onClick={runEnrich} disabled={enriching || !collect?.adsBinding} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50" title="이메일 우선 연락처 보강 — 홈페이지 크롤 + 네이버 링크발견(게시된 것만, 추측 0)">{enriching ? '보강 중…' : '📧 이메일 보강'}</button>
          <button onClick={() => runCollectSub('neis')} disabled={busySub !== '' || !collect?.adsBinding} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50" title="나이스(NEIS) 학원·교습소 — 인허가에 없는 학원 갭 커버(교육청 17곳 순환). NEIS_API_KEY 필요">{busySub === 'neis' ? '수집 중…' : '🎓 학원 수집'}</button>
          <button onClick={() => runCollectSub('hira')} disabled={busySub !== '' || !collect?.adsBinding} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50" title="심평원 병원정보 — 전국 병·의원 전화+홈페이지 직접 제공(이메일 크롤 관문)">{busySub === 'hira' ? '수집 중…' : '🏥 병원 수집'}</button>
          <button onClick={() => runCollectSub('store-kakao')} disabled={busySub !== '' || !collect?.adsBinding} className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50" title="카카오 로컬로 음식점·카페·미용실·숙박 + 무인매장을 캅니다(전화가 함께 옵니다). 자동으로는 약 5회차에 한 번만 도는 레인 — 아래 조건을 바꾼 뒤 지금 확인하려면 이 버튼">{busySub === 'store-kakao' ? '수집 중…' : '🍽️ 카카오 매장 수집'}</button>
          <button onClick={async () => { try { const r = await api.get(`/api/admin/store-prospects/export?${buildQuery().toString()}`, { responseType: 'blob' }); const u = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = u; a.download = `store-prospects-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(u) } catch { toast.error('내보내기 실패 — 재로그인 후 시도') } }} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium" title="⬇ 지금 화면 필터 그대로 CSV 로(한글 BOM). 📞 이 풀의 도달 채널은 전화입니다 — '전화 보유'로 좁혀 내보내세요">⬇ CSV</button>
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="매장명·지역·전화·이메일·주소 검색" title="여러 단어를 넣으면 모두 포함된 매장만 나옵니다" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-56" />
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
            {/* 🏪 인허가가 500 으로 죽어 있는 동안 **매장 풀을 실제로 늘리는 유일한 레인**인데 화면에 없었다.
                블록별 수확을 같이 보여야 "우선업종(음식점·카페·미용·숙박)이 도는가"를 묻지 않고 판정한다. */}
            {kakao?.run && (
              <><span className="mx-2 text-gray-300">|</span>🏪 카카오 <span className={kakao.gate ? 'text-green-600 font-semibold' : 'text-gray-400'}>{kakao.gate ? 'ON' : 'OFF'}</span>
                {kakao.run.diag?.error ? <span className="text-amber-600"> · {kakao.run.diag.error}</span>
                  : <span> · 최근 {kstShort(kakao.run.last_run)} · 저장 {kakao.run.saved ?? 0} (누적 {kakao.run.total_saved ?? 0})
                    {kakao.run.blocks ? ` · ${Object.entries(kakao.run.blocks).map(([k, v]) => `${k === 'voucher' ? '우선업종' : '무인'} ${v.kw}kw/${v.found}`).join(' · ')}` : ''}</span>}</>
            )}
          </div>
        )}

        <CollectConfigPanel lastRun={kakao?.run as never} />
        <TradePanel endpoint="/api/admin/store-prospects/trades" title="🎛️ 매장 수집 업태 설정" unit="블록" adapt={adaptStoreTrades} />

        {/* 📧 보강 레인 — 매장 3.5만 중 **이메일 1건**이던 것을 판정 가능하게. 이 스냅샷은 API 가 계속
            주고 있었는데 화면에 없어서 아무도 못 봤다. `pass2_reason` 이 "왜 0인가"를 처방 단위로 가른다:
            사이트 못 찾음 → 발견 경로 확대 / 찾았는데 이메일 없음 → 이 경로는 수율이 낮다 / 크롤 막힘 → 크롤러 수리. */}
        {enrichRun && (
          <div className="mb-3 text-xs text-gray-500">
            📧 연락처 보강 · 최근 {kstShort(enrichRun.last_run)} · 처리 {formatNumber(enrichRun.processed ?? 0)} ·
            <b className="text-indigo-600"> 이메일 +{formatNumber(enrichRun.email_found ?? 0)}</b> ·
            사이트 +{formatNumber(enrichRun.site_found ?? 0)} · 전화 +{formatNumber(enrichRun.phone_found ?? 0)} ·
            남은 이메일없음 {formatNumber(enrichRun.remaining_no_email ?? 0)}
            <span className="text-gray-400"> · 예산 {enrichRun.spent ?? 0}/{enrichRun.budget_total ?? 0}
              {enrichRun.deadline_hit ? ' · ⏱️ 시간초과' : ''}{enrichRun.limit_hit ? ' · ⛔ 요청한도' : ''}</span>
            {enrichRun.pass2_reason && Object.keys(enrichRun.pass2_reason).length > 0 && (
              <div className="mt-0.5 text-[11px] text-gray-400">
                사유 {Object.entries(enrichRun.pass2_reason).map(([k, v]) => `${k}:${v}`).join(' · ')}
              </div>
            )}
          </div>
        )}

        {/* 🔬 인허가가 실패했을 때 **무엇을 보냈고 무엇을 시도했는지** — 추측 대신 증거를 그대로 보여준다.
            (서비스키는 서버에서 가려서 온다. 이 화면이 없으면 500 의 원인을 물어볼 곳이 없다.) */}
        {collect?.run?.diag?.error && (collect.run.diag.fail_probe || collect.run.diag.probe) && (
          <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 break-all">
            <span className="font-semibold">요청 형태</span> {collect.run.diag.variant || 'v1'}
            {collect.run.diag.probe && (
              <> · <span className="font-semibold">후보 탐색</span>{' '}
                {collect.run.diag.probe.winner
                  ? <>→ <b>{collect.run.diag.probe.winner}</b> 로 자동 전환</>
                  : <>전 후보 실패 = <b>형태 문제가 아님</b>(키·활용신청·기관 장애 쪽)</>}
                {' '}[{(collect.run.diag.probe.attempts || []).map(a => `${a.id}:${a.ok ? `${a.rows}행` : '실패'}`).join(' ')}]
              </>
            )}
            {collect.run.diag.fail_probe?.url && (
              <div className="mt-1 text-amber-700">실패 요청 · {collect.run.diag.fail_probe.endpoint} p{collect.run.diag.fail_probe.page} — {collect.run.diag.fail_probe.url}</div>
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
