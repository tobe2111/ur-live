/**
 * 🤝 B2B 파트너(업체) 풀 어드민 — /admin/partner-pool (2026-07-21).
 *   격리 테이블 ad_company_leads 열람/큐레이션 + 수동입력(대표 방배 리드) + 아웃리치 상태머신 + CSV.
 *   라이트 테마(AdminLayout).
 *
 *   2026-07-27 대표 피드백 3건 반영:
 *     ① 통계 카드 = 필터(클릭) — 카드 수치와 목록 총건수가 같은 조건식이라 1:1 로 맞음.
 *     ② 버튼 정리 — 수집 5종 / 정리·보강 4종을 각각 드롭다운 1개로(상시 노출 11개 → 5개).
 *     ③ 페이지네이션 — 서버 offset/total 로 **끝까지** 넘겨봄 + 행 memo 로 렉 제거(기존: 500행 통째 렌더).
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatNumber } from '@/utils/format'
import ContactListPanel from './partner-pool/ContactListPanel'
import ReferralPanel from './partner-pool/ReferralPanel'
import StatusLines, { type Collect, type StoreInfo, type Commerce, type Franchise, type NtsSweep, type AgencyFunnel, type NpsInfo, type ReclassifyInfo, type Work24Info, type LocalDataInfo, type EnrichInfo, type EnrichRollupInfo, type KakaoSweepInfo, type RegistryMatchInfo } from './partner-pool/StatusLines'
import { STAT_PICK, fmtRun, runStamp, parseStamp } from './partner-pool/job-completion'

interface Lead {
  id: number; company_name: string; category: string | null; subcategory: string | null
  tier: number | null; region: string | null; website: string | null; email: string | null; phone: string | null
  address: string | null; status: string; active: number; contact_source: string | null; memo: string | null; contact_channel: string | null
  lead_type: string | null; classify_confidence: string | null; nps_members: number | null
  follow_up_at: string | null; source: string; source_keyword: string | null; collected_at: string
}
const SRC_LABEL: Record<string, string> = { govreg: '정부등록', kakao: '카카오', homepage: '홈페이지', naver: '네이버', commerce: '통신판매', franchise: '공정위', registry: '명부' }
/** 접촉 가치 축(company-classify SSOT 미러) — 업종(category)과 분리된 별개 축. */
const TYPE_META: Record<string, { label: string; cls: string }> = {
  partner: { label: '파트너', cls: 'bg-emerald-100 text-emerald-700' },
  store: { label: '매장', cls: 'bg-sky-100 text-sky-700' },
  org: { label: '기관', cls: 'bg-purple-100 text-purple-700' },
  unknown: { label: '분류 확인', cls: 'bg-gray-100 text-gray-500' },
}
interface Stats { total: number; with_contact: number; with_email: number; held_no_contact: number; active_pipeline: number; recent7: number; needs_review: number }
interface Meta { categories: Record<string, string[]>; statuses: string[]; channels: string[]; tier: { min: number; max: number }; leadTypes?: Array<{ k: string; label: string }> }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-700' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  contracted: { label: '계약', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-600' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const CHANNEL_LABEL: Record<string, string> = { call: '전화', email: '이메일', visit: '방문', sms: '문자', kakao: '카톡', other: '기타' }
const TIER_LABEL = (t: number | null) => t == null ? '—' : `${t}순위`
const EMPTY_ADD = { company_name: '', category: '', subcategory: '', tier: '', region: '', phone: '', email: '', website: '', address: '' }
const PAGE_SIZE = 100

/** 통계 카드 클릭 = 목록 필터(카드 = 필터 SSOT — 별도 '연락처' 셀렉트를 없애 중복 제거). */
type Quick = '' | 'contact' | 'email' | 'held' | 'pipeline' | 'recent7' | 'review'

export default function AdminPartnerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [collect, setCollect] = useState<Collect | null>(null)
  const [storeinfo, setStoreinfo] = useState<StoreInfo | null>(null)
  const [commerce, setCommerce] = useState<Commerce | null>(null)
  const [franchise, setFranchise] = useState<Franchise | null>(null)
  const [nts, setNts] = useState<NtsSweep | null>(null)
  const [agencyFunnel, setAgencyFunnel] = useState<AgencyFunnel | null>(null)
  const [npsInfo, setNpsInfo] = useState<NpsInfo | null>(null)
  const [reclassifyInfo, setReclassifyInfo] = useState<ReclassifyInfo | null>(null)
  const [work24Info, setWork24Info] = useState<Work24Info | null>(null)
  const [enrichInfo, setEnrichInfo] = useState<EnrichInfo | null>(null) // 📧 보강 레인 계측(적중률)
  // 🧮 하루 누적 — 스냅샷은 라운드마다 덮이므로 '모든 라운드가 죽는지 vs 마지막만 잘렸는지'를 이것으로 판정.
  const [enrichRollup, setEnrichRollup] = useState<EnrichRollupInfo | null>(null)
  // 📞 전화 스윕 — 백로그 소진 속도의 지표(체인 깊이 조정 판단용).
  const [kakaoSweep, setKakaoSweep] = useState<KakaoSweepInfo | null>(null)
  const [registryMatch, setRegistryMatch] = useState<RegistryMatchInfo | null>(null) // 🔗 원부 이메일 이식(크롤 0회)
  const [localdata, setLocaldata] = useState<LocalDataInfo | null>(null) // 🏪 매장 후보(인허가) — 공개면 데이터원
  // ⏳ 서버 백그라운드 실행 상태(2026-07-27 대표 "실행 중 다른 페이지로 이동하면?") — 페이지를 떠났다
  //   돌아와도 무엇이 돌고 있는지 보이게(잠금 하트비트 기반). 작업은 서버에서 계속되므로 표시만 복원.
  const [running, setRunning] = useState<{ runAll?: boolean; enrich?: boolean; reclassify?: boolean } | null>(null)
  const [busy, setBusy] = useState('')          // 실행 중인 액션 키(수집/보강/정리 공통)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [meta, setMeta] = useState<Meta | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [add, setAdd] = useState({ ...EMPTY_ADD })
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  // 필터
  const [fCategory, setFCategory] = useState('')
  const [fTier, setFTier] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fType, setFType] = useState('')
  const [quick, setQuick] = useState<Quick>('')
  // 🎯 서비스몰 주문 이행 딥링크(?q=지역) — 접수함 버튼이 프리필로 오픈(검색이 업체명·지역·키워드 커버).
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const qd = useDebouncedValue(q, 350) // 타이핑마다 조회 금지(한글 IME 조합 중 요청 폭주 + 응답 역전 방지)

  const loadMeta = useCallback(async () => {
    try { const r = await api.get('/api/admin/partner-pool/meta'); if (r.data?.success) setMeta(r.data) } catch { /* noop */ }
  }, [])
  const loadStats = useCallback(async (): Promise<Record<string, unknown> | null> => {
    try {
      const r = await api.get('/api/admin/partner-pool/stats')
      if (r.data?.success) { setStats(r.data.stats); setCollect(r.data.collect || null); setStoreinfo(r.data.storeinfo || null); setCommerce(r.data.commerce || null); setFranchise(r.data.franchise || null); setNts(r.data.nts || null); setAgencyFunnel(r.data.agencyEmailFunnel || null); setNpsInfo(r.data.nps || null); setReclassifyInfo(r.data.reclassify || null); setWork24Info(r.data.work24 || null); setLocaldata(r.data.localdata || null); setEnrichInfo(r.data.enrichLast || null); setEnrichRollup(r.data.enrichRollup || null); setKakaoSweep(r.data.kakaoSweep || null); setRegistryMatch(r.data.registryMatch || null); setRunning(r.data.running || null) }
      return r.data || null // 완료 감지 폴러가 원시 응답을 함께 사용
    } catch { return null }
  }, [])
  const loadLeads = useCallback(async () => {
    setLoading(true)
    setSelected(new Set()) // 목록 갱신 시 선택 초기화(스테일 방지)
    try {
      const p = new URLSearchParams()
      if (fCategory) p.set('category', fCategory)
      if (fTier) p.set('tier', fTier)
      if (fStatus) p.set('status', fStatus)
      if (fType) p.set('leadType', fType)
      // 카드 필터 — 통계 카드 정의와 **같은 조건**(서버 buildLeadWhere).
      if (quick === 'contact') p.set('hasContact', '1')
      else if (quick === 'email') p.set('hasEmail', '1')
      else if (quick === 'held') p.set('heldOnly', '1')
      else if (quick === 'pipeline') p.set('pipeline', '1')
      else if (quick === 'recent7') p.set('recentDays', '7')
      else if (quick === 'review') p.set('leadType', 'unknown')
      if (quick !== 'held') p.set('includeHeld', '1') // 기본: 보류 포함 전체
      if (qd.trim()) p.set('q', qd.trim())
      p.set('limit', String(PAGE_SIZE))
      p.set('offset', String(page * PAGE_SIZE))
      const r = await api.get(`/api/admin/partner-pool?${p.toString()}`)
      if (r.data?.success) { setLeads(r.data.leads || []); setTotal(Number(r.data.total) || 0) }
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [fCategory, fTier, fStatus, fType, quick, qd, page])

  useEffect(() => { loadMeta(); loadStats() }, [loadMeta, loadStats])
  useEffect(() => { loadLeads() }, [loadLeads])
  // 필터가 바뀌면 1페이지로(현재 페이지가 범위를 벗어나 빈 목록이 되는 것 방지).
  useEffect(() => { setPage(0) }, [fCategory, fTier, fStatus, fType, quick, qd])

  async function submitAdd() {
    if (add.company_name.trim().length < 2) { toast.error('업체명을 입력하세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/admin/partner-pool', { ...add, tier: add.tier || null })
      if (r.data?.success) { toast.success('추가되었습니다'); setAdd({ ...EMPTY_ADD }); setShowAdd(false); await Promise.all([loadLeads(), loadStats()]) }
      else toast.error('이미 등록된 업체이거나 저장에 실패했습니다')
    } catch { toast.error('저장 실패') } finally { setSaving(false) }
  }

  const patchLead = useCallback(async (id: number, patch: Record<string, unknown>) => {
    // 낙관적 갱신 후 서버 반영(실패 시 재조회로 정정).
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch } as Lead : l))
    try {
      const r = await api.patch(`/api/admin/partner-pool/${id}`, patch)
      if (!r.data?.success) { toast.error(r.data?.error || '저장 실패'); await loadLeads() }
      else await loadStats()
    } catch { toast.error('저장 실패'); await loadLeads() }
  }, [loadLeads, loadStats])

  const removeLead = useCallback(async (id: number) => {
    if (!window.confirm('이 업체 리드를 삭제할까요?')) return
    try {
      const r = await api.delete(`/api/admin/partner-pool/${id}`)
      if (r.data?.success) { setLeads(prev => prev.filter(l => l.id !== id)); setTotal(t => Math.max(0, t - 1)); await loadStats() }
      else toast.error('삭제 실패')
    } catch { toast.error('삭제 실패') }
  }, [loadStats])

  const bounceLead = useCallback(async (id: number, email: string) => {
    if (!confirm(`${email}\n반송된 주소로 기록할까요? 억제 목록에 올라가 재수집으로도 되살아나지 않습니다.`)) return
    try {
      const r = await api.post(`/api/admin/partner-pool/${id}/bounce`, {})
      if (r.data?.success) { toast.success('반송 기록됨 — 이 주소는 다시 수집되지 않습니다'); setLeads(prev => prev.map(l => l.id === id ? { ...l, email: null } : l)) }
      else toast.error(r.data?.error || '반송 기록 실패')
    } catch { toast.error('반송 기록 실패') }
  }, [])

  const toggleOne = useCallback((id: number, on: boolean) => {
    setSelected(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  }, [])

  async function submitImport() {
    if (importText.trim().length < 10) { toast.error('헤더(회사명 포함) 있는 표를 붙여넣으세요'); return }
    setImporting(true)
    try {
      const r = await api.post('/api/admin/partner-pool/import', { text: importText })
      if (r.data?.success) { toast.success(`${r.data.parsed}건 중 ${r.data.saved}건 저장`); setImportText(''); setShowImport(false); await Promise.all([loadLeads(), loadStats()]) }
      else toast.error(r.data?.error || '임포트 실패')
    } catch { toast.error('임포트 실패') } finally { setImporting(false) }
  }

  /** 수집/보강/정리 공통 실행기 — 위임 후 **완료를 감지해 결과값과 함께 알림**(2026-07-27 대표
   *  "버튼 누르면 완료되었다고 알람 + 결과값"). 각 작업이 platform_settings 에 남기는 결과 스탬프
   *  (last_run/at)가 클릭 시각 이후로 갱신되면 = 완료 → 결과 숫자를 토스트로. 페이지를 닫아도
   *  풀가동류는 어드민 알림벨에 결과가 남는다(서버측 배선). */
  const runAction = useCallback(async (path: string, label: string, maxPolls = 36) => {
    if (!collect?.adsBinding) { toast.error('ur-ads 서비스바인딩 미설정 — 자동 cron 만 동작합니다'); return }
    setBusy(path)
    const clickedAt = Date.now()
    try {
      const r = await api.post(`/api/admin/partner-pool/${path}`, {})
      if (!r.data?.success) { toast.error(r.data?.error || `${label} 위임 실패`); return }
      toast.success(`${label} 시작 — 완료되면 결과를 알려드립니다`, { duration: 3000 })
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(res => setTimeout(res, 5000))
        const d = await loadStats()
        const run = d ? STAT_PICK[path]?.(d) : null
        if (run && parseStamp(runStamp(run)) >= clickedAt - 20_000) {
          const summary = fmtRun(run)
          const err = (run as { diag?: { error?: string } }).diag?.error
          if (err) toast.error(`${label} 완료 — ⚠️ ${err}`, { duration: 12000 })
          else toast.success(`✅ ${label} 완료${summary ? ` — ${summary}` : ''}`, { duration: 10000 })
          await loadLeads()
          return
        }
      }
      toast.info(`⏳ ${label} 아직 진행 중 — 완료 결과는 알림벨/상태줄에 반영됩니다`, { duration: 8000 })
      await Promise.all([loadStats(), loadLeads()])
    } catch (e) {
      // 409(이중 실행 잠금) = 실패가 아니라 "이미 돌고 있음" — 서버 메시지 그대로 안내(2026-07-27 대표 신고).
      const ax = e as { response?: { status?: number; data?: { error?: string } } }
      if (ax.response?.status === 409) toast.info(ax.response.data?.error || `${label}이(가) 이미 진행 중입니다 — 완료되면 알림벨/상태줄에 반영됩니다`, { duration: 8000 })
      else toast.error(ax.response?.data?.error || `${label} 위임 실패`)
    } finally { setBusy('') }
  }, [collect?.adsBinding, loadLeads, loadStats])

  /** 🧭 분류 정리 풀가동 — 메인 워커 백그라운드 루프(최대 2.5만 행/클릭). 완료 감지 + 결과 토스트 동일. */
  const runReclassify = useCallback(async () => {
    setBusy('reclassify')
    const clickedAt = Date.now()
    try {
      const r = await api.post('/api/admin/partner-pool/reclassify', {})
      if (!r.data?.success) { toast.error(r.data?.error || '분류 정리 실패'); return }
      toast.success('분류 정리 풀가동 시작 — 완료되면 결과를 알려드립니다 (최대 2.5만 행, 수 분 소요)', { duration: 4000 })
      for (let i = 0; i < 60; i++) { // ≤5분(루프 자체가 200s 캡)
        await new Promise(res => setTimeout(res, 5000))
        const d = await loadStats()
        const run = d ? (d as { reclassifyBurst?: { at?: string; scanned?: number; done?: boolean } }).reclassifyBurst : null
        if (run?.at && parseStamp(run.at) >= clickedAt - 20_000) {
          const done = !!run.done
          toast.success(`✅ 분류 정리 완료 — ${fmtRun(run)}${done ? ' · 재검사 전량 소진' : ' · 잔여 있음(재클릭 또는 시간당 자동)'}`, { duration: 12000 })
          await loadLeads()
          return
        }
      }
      toast.info('⏳ 분류 정리 아직 진행 중 — 완료 결과는 알림벨/상태줄에 반영됩니다', { duration: 8000 })
      await Promise.all([loadStats(), loadLeads()])
    } catch (e) {
      // 409(이중 실행 잠금) = 이전 클릭이 이미 돌고 있음 — 실패 아님(2026-07-27 대표 "분류 실패도 뜨네?").
      const ax = e as { response?: { status?: number; data?: { error?: string } } }
      if (ax.response?.status === 409) toast.info(ax.response.data?.error || '분류 정리가 이미 진행 중입니다 — 완료되면 알림벨에 결과가 남습니다', { duration: 8000 })
      else toast.error(ax.response?.data?.error || '분류 정리 실패')
    } finally { setBusy('') }
  }, [loadLeads, loadStats])

  // ⬇ CSV — <a href> 직링크는 관리자 토큰이 안 실려 FORBIDDEN(2026-07-27 대표 신고) → 인증 axios blob 다운로드.
  async function downloadCsv(url: string, filename: string) {
    try {
      const r = await api.get(url, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(new Blob([r.data], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = blobUrl; a.download = filename; a.click()
      URL.revokeObjectURL(blobUrl)
    } catch { toast.error('내보내기 실패 — 관리자 세션 만료면 재로그인 후 시도') }
  }

  async function deleteSelected() {
    const ids = [...selected]
    if (!ids.length) return
    if (!confirm(`선택한 ${ids.length}개 업체를 삭제할까요? 되돌릴 수 없습니다.`)) return
    try {
      const r = await api.post('/api/admin/partner-pool/delete-bulk', { ids })
      if (r.data?.success) { toast.success(`${r.data.deleted}개 삭제됨`); setSelected(new Set()); await Promise.all([loadLeads(), loadStats()]) }
      else toast.error(r.data?.error || '삭제 실패')
    } catch { toast.error('삭제 실패') }
  }

  const subcats = meta && add.category ? (meta.categories[add.category] || []) : []
  const statCard = (key: Quick, label: string, val: number, hint?: string) => {
    const on = quick === key
    // 카드 클릭 시 **검색어를 비움** — 카드 숫자는 전체 기준이라, 검색어가 남아 AND 로 걸리면
    // "진행 중 1인데 목록 0" 처럼 보임(2026-07-27 대표 신고 2회). 카드 = 그 숫자 그대로 보여주기.
    return (
      <button type="button" onClick={() => { setQ(''); setQuick(on && key !== '' ? '' : key) }}
        className={`text-left rounded-xl border p-4 transition ${on ? 'border-gray-900 bg-gray-900 text-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-400'}`}
        title={`클릭하면 이 조건으로 목록을 거릅니다${hint ? ` (${hint})` : ''}`}>
        <div className={`text-xs ${on ? 'text-gray-300' : 'text-gray-500'}`}>{label}</div>
        <div className={`mt-1 text-2xl font-bold ${on ? 'text-white' : 'text-gray-900'}`}>{formatNumber(val)}</div>
        {hint && <div className={`mt-0.5 text-[11px] ${on ? 'text-gray-400' : 'text-gray-400'}`}>{hint}</div>}
      </button>
    )
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)

  return (
    <AdminLayout title="파트너 풀">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        <DashboardPageHeader title="🤝 파트너 풀" subtitle="유어딜 매장 입점을 대신 데려올 업체 DB — 수동입력·아웃리치 관리 (수집 ≠ 발송)" />

        {/* 📬 오늘의 컨택 — 이메일 우선(대표 지시), 미접촉만 */}
        <ContactListPanel />

        {/* 🤝 파트너 매장 소개 접수함(리퍼럴 — 지급 배선은 별도 세션) */}
        <ReferralPanel />

        {/* 통계 스트립 — 카드 클릭 = 필터 */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
          {statCard('', '전체', stats?.total || 0)}
          {statCard('contact', '연락처 보유', stats?.with_contact || 0, '전화 또는 이메일')}
          {statCard('email', '이메일 보유', stats?.with_email || 0)}
          {statCard('held', '연락처 보류', stats?.held_no_contact || 0, '연락처 없어 보강 대기')}
          {statCard('pipeline', '진행 중', stats?.active_pipeline || 0, '신규·거절 제외')}
          {statCard('recent7', '최근 7일', stats?.recent7 || 0)}
          {statCard('review', '분류 확인 필요', stats?.needs_review || 0, '근거 없이 키워드 추정')}
        </div>

        {/* 액션 바 — 수집 5종 / 정리·보강 4종을 드롭다운으로 묶음(상시 노출 축소) */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button onClick={() => setShowAdd(v => !v)} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium">{showAdd ? '입력 닫기' : '＋ 업체 추가'}</button>
          {/* 🚀 원클릭 전체 실행(2026-07-27 대표 "버튼이 너무 많달까?") — 수집 전 레인→보강→정리 한 사이클.
              개별 버튼(드롭다운)은 특정 레인 재실행/디버깅용으로 존치. */}
          <button onClick={() => runAction('run-all', '원클릭 전체 실행', 60)} disabled={busy !== ''}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            title="수집 전 레인(네이버·카카오·상가정보·통신판매·프랜차이즈·나라장터·고용24·국민연금·폐업·메일검증) → 연락처 보강 → 분류 정리를 순서대로 전부 실행 — 완료되면 통합 결과를 알림">
            {busy === 'run-all' || running?.runAll ? '⏳ 전체 실행 중…' : '🚀 전체 실행'}
          </button>
          <ActionMenu label="🔍 수집" busy={busy.startsWith('collect')} items={[
            { label: '네이버 지역·웹 검색', desc: '대행사 등 tier1 — 지도 + 자체 사이트', onClick: () => runAction('collect', '레인 A 수집') },
            { label: '공공 상가정보', desc: 'tier 2~5 업종 통째 + 전화 역조회', onClick: () => runAction('collect-storeinfo', '상가정보 수집') },
            { label: '통신판매사업자', desc: '공정위 — 대표자 이메일이 붙어 옴', onClick: () => runAction('collect-commerce', '통신판매 수집') },
            { label: '프랜차이즈 본사', desc: '공정위 가맹 정보공개서', onClick: () => runAction('collect-franchise', '프랜차이즈 수집') },
            { label: '나라장터 조달업체', desc: '정부 용역 수주 광고·마케팅사', onClick: () => runAction('collect-nara', '조달업체 수집') },
            { label: '💼 채용기업(고용24)', desc: '채용 중 = 성장 신호 — 광고·판촉·인쇄 계열만', onClick: () => runAction('collect-work24', '고용24 채용기업 수집') },
          ]} />
          <ActionMenu label="🧹 정리·보강" busy={['enrich', 'enrich-burst', 'reclassify', 'sweep-nts', 'sweep-mx', 'collect-nps', 'match-registry?passes=5'].includes(busy)} items={[
            { label: '📧 연락처 보강', desc: '홈페이지 크롤·네이버 발견으로 이메일 소급(허위 0)', onClick: () => runAction('enrich', '연락처 보강') },
            { label: '🔗 원부 이메일 이식', desc: '통신판매 원부의 이메일을 상호+주소 확신 매칭으로 이식 — 크롤 0회·요청한도 무관(허위 0)', onClick: () => runAction('match-registry?passes=5', '원부 이메일 이식') },
            { label: '🚀 보강 풀가동', desc: '연속 라운드로 몰아서 소진 — 잔여는 매시간 자동이 이어받음(중복 크롤 잠금)', onClick: () => runAction('enrich-burst', '이메일 보강 풀가동', 60) },
            { label: '🧭 분류 정리 풀가동', desc: '공고·기사제목·정부기관 제거 + 업종 재분류 — 클릭당 최대 2.5만 행 소진', onClick: runReclassify },
            { label: '🏛 폐업 정리', desc: '국세청 상태조회로 폐업 리드 정리', onClick: () => runAction('sweep-nts', '폐업 스윕') },
            { label: '📮 메일 재검증', desc: '죽은 도메인(반송 확정) 이메일만 비움', onClick: () => runAction('sweep-mx', '이메일 재검증') },
            { label: '👥 규모 조회(국민연금)', desc: '대행사 우선 — 직원수(가입자수)로 실조직/1인 구분. 엄격 매칭만 저장', onClick: () => runAction('collect-nps', '국민연금 규모 조회') },
          ]} />
          <button onClick={() => setShowImport(v => !v)} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium" title="공정위 프랜차이즈 정보공개서·상인회 명부 CSV/TSV 붙여넣기(레인 B·C)">{showImport ? '닫기' : '📋 명부 붙여넣기'}</button>
          <button onClick={() => downloadCsv('/api/admin/partner-pool/export?format=csv', `partner-leads-${new Date().toISOString().slice(0, 10)}.csv`)} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium" title="전체(보류 포함) 리드를 엑셀 호환 CSV 로 — 한글 깨짐 없음(BOM), 엑셀에서 바로 열림">⬇ CSV</button>
          {selected.size > 0 && (
            <button onClick={deleteSelected} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">🗑 선택 삭제 ({selected.size})</button>
          )}
          <div className="grow" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="업체명·지역·전화·이메일·주소 검색" title="여러 단어를 넣으면 모두 포함된 업체만 나옵니다" className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm w-60" />
        </div>

        {/* 수집·정리 상태줄 묶음(레인A/정리진행률/퍼널/통신판매/프랜차이즈/폐업/국민연금) */}
        {/* ⏳ 서버에서 도는 작업 표시 — 페이지를 떠났다 돌아와도 보임(작업은 브라우저와 무관하게 계속됨). */}
        {(running?.runAll || running?.enrich || running?.reclassify) && (
          <div className="mb-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ⏳ 백그라운드 실행 중: {[running.runAll && '전체 실행', running.enrich && '연락처 보강', running.reclassify && '분류 정리'].filter(Boolean).join(' · ')}
            <span className="text-emerald-600"> — 페이지를 닫거나 이동해도 계속됩니다. 완료되면 알림벨에 결과가 남습니다.</span>
          </div>
        )}
        <StatusLines enrichRollup={enrichRollup} kakaoSweep={kakaoSweep} collect={collect} storeinfo={storeinfo} commerce={commerce} franchise={franchise} nts={nts} npsInfo={npsInfo} reclassifyInfo={reclassifyInfo} agencyFunnel={agencyFunnel} work24={work24Info} localdata={localdata} enrichLast={enrichInfo} registryMatch={registryMatch} />

        {/* 명부 붙여넣기(레인 B·C) */}
        {showImport && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2">헤더(회사명·전화·주소·홈페이지·이메일·업종…) 있는 표를 붙여넣으세요. 공정위 정보공개서·상인회 명부 CSV/TSV 자동 인식. 회사명 컬럼 필수.</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} placeholder={'회사명\t전화\t주소\t홈페이지\nOO간판\t02-...\t서초구...\thttp://...'} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm font-mono" />
            <div className="flex justify-end mt-2">
              <button onClick={submitImport} disabled={importing} className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{importing ? '저장 중…' : '임포트'}</button>
            </div>
          </div>
        )}

        {/* 수동 입력 폼 */}
        {showAdd && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={add.company_name} onChange={e => setAdd({ ...add, company_name: e.target.value })} placeholder="업체명 *" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <select value={add.category} onChange={e => setAdd({ ...add, category: e.target.value, subcategory: '' })} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm">
              <option value="">분류 선택</option>
              {meta && Object.keys(meta.categories).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={add.subcategory} onChange={e => setAdd({ ...add, subcategory: e.target.value })} disabled={!subcats.length} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm disabled:bg-gray-50">
              <option value="">세부 업종</option>
              {subcats.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input value={add.region} onChange={e => setAdd({ ...add, region: e.target.value })} placeholder="지역 (예: 방배)" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <select value={add.tier} onChange={e => setAdd({ ...add, tier: e.target.value })} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm">
              <option value="">우선순위 없음</option>
              {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}순위</option>)}
            </select>
            <input value={add.phone} onChange={e => setAdd({ ...add, phone: e.target.value })} placeholder="전화" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <input value={add.email} onChange={e => setAdd({ ...add, email: e.target.value })} placeholder="이메일" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <input value={add.website} onChange={e => setAdd({ ...add, website: e.target.value })} placeholder="홈페이지" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <input value={add.address} onChange={e => setAdd({ ...add, address: e.target.value })} placeholder="주소" className="px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm" />
            <div className="md:col-span-3 flex justify-end">
              <button onClick={submitAdd} disabled={saving} className="px-5 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        )}

        {/* 필터 바 — 연락처 축은 위 통계 카드가 담당(셀렉트 중복 제거) */}
        <div className="flex flex-wrap gap-2 mb-3 text-sm">
          <select value={fType} onChange={e => setFType(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900" title="접촉 가치 축 — 업종과 별개">
            <option value="">전체 유형</option>
            {(meta?.leadTypes || []).map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
          </select>
          <select value={fCategory} onChange={e => setFCategory(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">전체 업종</option>
            {meta && Object.keys(meta.categories).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={fTier} onChange={e => setFTier(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">전체 순위</option>
            {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}순위</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-900">
            <option value="">전체 상태</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(quick || fType || fCategory || fTier || fStatus || q) && (
            <button onClick={() => { setQuick(''); setFType(''); setFCategory(''); setFTier(''); setFStatus(''); setQ('') }} className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-500">필터 초기화</button>
          )}
        </div>

        {/* 🏷️ 활성 필터 칩 — 카드+검색어가 **함께** 걸린 걸 안 보여줘서 "진행 중 1인데 목록 0" 혼란(2026-07-27 대표 신고).
            지금 목록에 적용 중인 모든 조건을 칩으로 노출 + ×로 개별 해제 → 카드 수치와 목록이 왜 다른지 즉시 보임. */}
        {(quick || fType || fCategory || fTier || fStatus || q.trim()) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs">
            <span className="text-gray-400">적용 중:</span>
            {quick && <FilterChip label={{ contact: '연락처 보유', email: '이메일 보유', held: '연락처 보류', pipeline: '진행 중', recent7: '최근 7일', review: '분류 확인 필요' }[quick] || quick} onClear={() => setQuick('')} />}
            {fType && <FilterChip label={`유형: ${(meta?.leadTypes || []).find(t => t.k === fType)?.label || fType}`} onClear={() => setFType('')} />}
            {fCategory && <FilterChip label={`업종: ${fCategory}`} onClear={() => setFCategory('')} />}
            {fTier && <FilterChip label={`${fTier}순위`} onClear={() => setFTier('')} />}
            {fStatus && <FilterChip label={`상태: ${STATUS_META[fStatus]?.label || fStatus}`} onClear={() => setFStatus('')} />}
            {q.trim() && <FilterChip label={`검색: "${q.trim()}"`} onClear={() => setQ('')} />}
          </div>
        )}

        {/* 목록 */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2 font-medium">
                  <input type="checkbox" aria-label="전체 선택" checked={leads.length > 0 && selected.size === leads.length}
                    onChange={e => setSelected(e.target.checked ? new Set(leads.map(l => l.id)) : new Set())} />
                </th>
                <th className="px-3 py-2 font-medium">순위</th>
                <th className="px-3 py-2 font-medium">업체 / 분류</th>
                <th className="px-3 py-2 font-medium">지역</th>
                <th className="px-3 py-2 font-medium">연락처</th>
                <th className="px-3 py-2 font-medium">상태</th>
                <th className="px-3 py-2 font-medium">채널</th>
                <th className="px-3 py-2 font-medium">팔로업</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">불러오는 중…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-10 text-center text-gray-400">
                  조건에 맞는 업체가 없습니다.
                  {(quick || fType || fCategory || fTier || fStatus || q.trim()) && (
                    <span> 위 &lsquo;적용 중&rsquo; 칩의 조건이 <b>모두 동시에</b> 걸려 있습니다 — <button onClick={() => { setQuick(''); setFType(''); setFCategory(''); setFTier(''); setFStatus(''); setQ('') }} className="text-blue-600 underline">전체 해제</button></span>
                  )}
                </td></tr>
              ) : leads.map(l => (
                <LeadRow key={l.id} lead={l} checked={selected.has(l.id)} onToggle={toggleOne} onPatch={patchLead} onRemove={removeLead} onBounce={bounceLead} />
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 — 총건수 기준으로 끝까지 이동 가능 */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{formatNumber(total)}건 중 {formatNumber(from)}–{formatNumber(to)} · {page + 1}/{formatNumber(pages)} 페이지</span>
          <div className="grow" />
          <button onClick={() => setPage(0)} disabled={page === 0} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">« 처음</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">‹ 이전</button>
          <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">다음 ›</button>
          <button onClick={() => setPage(pages - 1)} disabled={page >= pages - 1} className="px-2.5 py-1.5 rounded border border-gray-300 bg-white disabled:opacity-40">끝 »</button>
        </div>
        <div className="mt-1 text-xs text-gray-400">이 페이지 순위 분포 · <TierBreakdown leads={leads} /></div>
      </div>
    </AdminLayout>
  )
}

/** 활성 필터 칩 — 목록에 지금 적용 중인 조건 1개(× 로 개별 해제). */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-900 text-white">
      {label}
      <button onClick={onClear} aria-label={`${label} 해제`} className="text-gray-300 hover:text-white">×</button>
    </span>
  )
}

/** 액션 드롭다운 — 상시 노출 버튼 수를 줄이기 위한 묶음(수집 5종 / 정리·보강 4종). */
function ActionMenu({ label, items, busy }: { label: string; busy?: boolean; items: Array<{ label: string; desc?: string; onClick: () => void }> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} disabled={busy}
        className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50">
        {busy ? '실행 중…' : `${label} ▾`}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl border border-gray-200 bg-white shadow-lg p-1">
          {items.map(it => (
            <button key={it.label} onClick={() => { setOpen(false); it.onClick() }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50">
              <div className="text-sm text-gray-800">{it.label}</div>
              {it.desc && <div className="text-[11px] text-gray-400 mt-0.5">{it.desc}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** 행 — memo. 한 행만 바뀔 때 나머지 99행이 재조정되지 않도록(대표 신고 "렉 걸림"). */
const LeadRow = memo(function LeadRow({ lead: l, checked, onToggle, onPatch, onRemove, onBounce }: {
  lead: Lead; checked: boolean
  onToggle: (id: number, on: boolean) => void
  onPatch: (id: number, patch: Record<string, unknown>) => void
  onRemove: (id: number) => void
  onBounce: (id: number, email: string) => void
}) {
  const type = TYPE_META[l.lead_type || 'unknown'] || TYPE_META.unknown
  return (
    <tr className={`border-b border-gray-100 align-top ${checked ? 'bg-rose-50' : ''}`}>
      <td className="px-3 py-2">
        <input type="checkbox" aria-label={`${l.company_name} 선택`} checked={checked} onChange={e => onToggle(l.id, e.target.checked)} />
      </td>
      <td className="px-3 py-2">
        <select value={l.tier ?? ''} onChange={e => onPatch(l.id, { tier: e.target.value ? Number(e.target.value) : null })} className="rounded border border-gray-200 bg-white text-gray-900 text-xs px-1 py-1">
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900">
          {l.active === 0 && <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold" title="전화·이메일 미확보 — 주소로 수동 접촉 대상">연락처 미확보</span>}
          {l.company_name}
        </div>
        <div className="text-xs text-gray-400">
          <span className={`mr-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${type.cls}`} title={l.classify_confidence === 'registry' ? '정부 등록부 공식 업종' : l.classify_confidence === 'evidence' ? '업체 정보에 근거한 분류' : '검색 키워드로 추정한 분류 — 확인 필요'}>{type.label}</span>
          {[l.category, l.subcategory].filter(Boolean).join(' · ') || '—'}
          {l.nps_members != null && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-teal-50 text-teal-700 font-semibold" title="국민연금 가입자수(직원 규모) — 공개 가입내역 기반">👥 {l.nps_members}명</span>}
          {l.website && <> · <a href={l.website.startsWith('http') ? l.website : `https://${l.website}`} target="_blank" rel="noreferrer" className="text-blue-600">홈</a></>}
        </div>
        {l.memo && <div className="text-xs text-gray-500 mt-0.5">📝 {l.memo}</div>}
      </td>
      <td className="px-3 py-2 text-gray-700">{l.region || '—'}</td>
      <td className="px-3 py-2 text-gray-700">
        {l.phone ? <div>📞 {l.phone}</div> : null}
        {l.email ? <div className="text-xs text-gray-500">✉ {l.email} <button onClick={() => onBounce(l.id, l.email!)} className="ml-1 text-[10px] text-gray-300 hover:text-red-500" title="반송된 주소로 기록(억제 목록 — 재수집 차단)">반송</button></div> : null}
        {!l.phone && !l.email && <span className="text-gray-300">—</span>}
        {(l.phone || l.email) && l.contact_source && <div className="text-[10px] text-gray-400 mt-0.5" title="연락처 출처">출처: {SRC_LABEL[l.contact_source] || l.contact_source}</div>}
      </td>
      <td className="px-3 py-2">
        <select value={l.status} onChange={e => onPatch(l.id, { status: e.target.value })} className={`rounded px-2 py-1 text-xs font-medium border-0 ${STATUS_META[l.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select value={l.contact_channel ?? ''} onChange={e => onPatch(l.id, { contact_channel: e.target.value || null })} className="rounded border border-gray-200 bg-white text-gray-700 text-xs px-1 py-1">
          <option value="">—</option>
          {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <input type="date" value={l.follow_up_at ? l.follow_up_at.slice(0, 10) : ''} onChange={e => onPatch(l.id, { follow_up_at: e.target.value || null })} className="rounded border border-gray-200 bg-white text-gray-700 text-xs px-1 py-1" />
      </td>
      <td className="px-3 py-2 whitespace-nowrap text-right">
        <button onClick={() => { const m = window.prompt('메모', l.memo || ''); if (m !== null) onPatch(l.id, { memo: m }) }} className="text-gray-400 hover:text-gray-700 text-xs mr-2">메모</button>
        <button onClick={() => onRemove(l.id)} className="text-red-400 hover:text-red-600 text-xs">삭제</button>
      </td>
    </tr>
  )
})

function TierBreakdown({ leads }: { leads: Lead[] }) {
  const by = new Map<string, number>()
  for (const l of leads) { const k = TIER_LABEL(l.tier); by.set(k, (by.get(k) || 0) + 1) }
  return <>{[...by.entries()].map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}</>
}
