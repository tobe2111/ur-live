import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import DraftModal, { type OutreachDraftData } from './influencer-pool/DraftModal'
import FunnelCard from './influencer-pool/FunnelCard'
import { pickReach } from './influencer-pool/reach'
import KeywordManager, { type Keyword } from './influencer-pool/KeywordManager'
import SendQueueModal from './influencer-pool/SendQueueModal'
import ConsentedSendPanel from './influencer-pool/ConsentedSendPanel'
import { exportFilteredCsv } from './influencer-pool/export-csv'

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
  contacted_at?: string | null; follow_up_at?: string | null; contact_channel?: string | null
  outreach_draft?: string | null // JSON {subject,body,dm,generated_at} — ✍ 개인화 초안(생성만, 발송 없음)
  source?: string | null; consented_at?: string | null // 📥 inbound=신청(사전동의)
  recent_avg_views?: number | null; recent_avg_comments?: number | null; recent_posts_30d?: number | null // 📈 성과(YT 최근평균/네이버 30일 포스팅)
}
// 컨택 채널 — 서버 enum ↔ 한글 라벨.
const CHANNELS: Record<string, string> = { email: '이메일', dm: '인스타DM', note: '네이버쪽지', kakao: '카톡', call: '전화', other: '기타' }
function parseDraft(raw?: string | null): OutreachDraftData | null {
  if (!raw) return null
  try { const d = JSON.parse(raw) as OutreachDraftData; return d?.subject && d?.body ? d : null } catch { return null }
}
interface PoolStats { total?: number; youtube?: number; naver_blog?: number; naver_cafe?: number; with_contact?: number; with_email?: number; recent7?: number; today?: number; need_followup?: number; st_new?: number; st_contacted?: number; st_interested?: number; st_contracted?: number; st_rejected?: number; st_hold?: number; reached?: number; replied?: number; contacted7?: number; ch_email?: number; ch_dm?: number; ch_note?: number; ch_kakao?: number; ch_call?: number; ch_other?: number }

// 아웃리치 파이프라인 상태 — 라벨 + 색.
const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-600' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  contracted: { label: '계약', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '거절', cls: 'bg-gray-100 text-gray-400' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
interface PlatformDiag { configured: boolean; found: number; saved: number; error?: string }
interface RunStats { last_run?: string; last_saved?: number; total_saved?: number; total_runs?: number; promoted?: string[]; youtube_quota_hit?: boolean; bio_enriched?: number; perf_enriched?: number; diag?: { yt: PlatformDiag; naver: PlatformDiag }; yt_budget?: { used: number; total: number; day?: string } }
const PLATFORM_LABEL: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타', tiktok: '틱톡' }

export default function AdminInfluencerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<PoolStats>({})
  const [run, setRun] = useState<RunStats | null>(null)
  const [gate, setGate] = useState(false)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [platform, setPlatform] = useState('')
  const [hasContact, setHasContact] = useState(false)
  const [hasEmail, setHasEmail] = useState(false)
  const [hasInstagram, setHasInstagram] = useState(false)
  const [category, setCategory] = useState('')
  const [tier, setTier] = useState('')          // 규모 필터(nano/micro/mid/macro/sweet)
  const [sort, setSort] = useState('fit')        // 유어딜 핏순(기본)/구독자순/최근수집
  const [statusFilter, setStatusFilter] = useState('') // 아웃리치 상태 필터
  const [needFollowup, setNeedFollowup] = useState(false)
  const [hideNoise, setHideNoise] = useState(false)
  const [inboundOnly, setInboundOnly] = useState(false)
  const [merging, setMerging] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)   // 현재 필터의 전체 건수(페이지네이션)
  const [collecting, setCollecting] = useState(false)

  const PAGE = 200
  // 현재 필터 → 쿼리스트링(offset 만 페이지마다 다름).
  const buildParams = useCallback((offset: number) => {
    const params = new URLSearchParams()
    if (platform) params.set('platform', platform)
    if (hasContact) params.set('hasContact', '1')
    if (hasEmail) params.set('hasEmail', '1')
    if (hasInstagram) params.set('hasInstagram', '1')
    if (category) params.set('category', category)
    if (tier) params.set('tier', tier)
    if (sort) params.set('sort', sort)
    if (statusFilter) params.set('status', statusFilter)
    if (needFollowup) params.set('needFollowup', '1')
    if (hideNoise) params.set('hideNoise', '1')
    if (inboundOnly) params.set('source', 'inbound')
    if (q.trim()) params.set('q', q.trim())
    params.set('limit', String(PAGE)); params.set('offset', String(offset))
    return params
  }, [platform, hasContact, hasEmail, hasInstagram, category, tier, sort, statusFilter, needFollowup, hideNoise, inboundOnly, q])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/api/admin/ads/influencer-pool?${buildParams(0).toString()}`)
      if (r.data?.success) { setLeads(r.data.leads || []); setTotal(r.data.total ?? (r.data.leads?.length || 0)) }
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [buildParams])

  // 더 보기 — 현재 로드된 개수를 offset 으로 다음 페이지 append(필터 유지).
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const r = await api.get(`/api/admin/ads/influencer-pool?${buildParams(leads.length).toString()}`)
      if (r.data?.success) { setLeads(prev => [...prev, ...(r.data.leads || [])]); if (typeof r.data.total === 'number') setTotal(r.data.total) }
    } catch { toast.error('더 불러오지 못했습니다') } finally { setLoadingMore(false) }
  }, [buildParams, leads.length])

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

  // 수동 수집 — 백그라운드 실행(수십 초)이라 즉시 '시작됨' 안내 후 stats(last_run) 폴링으로 완료를 따라잡음.
  //   구 동기 대기는 브라우저 타임아웃→"실패" 오표시였음. started=false(폴백 동기)면 기존처럼 즉시 결과 반영.
  async function collectNow() {
    setCollecting(true)
    const prevRun = run?.last_run || ''
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/collect', {})
      if (!r.data?.success) { toast.error(r.data?.error || '수집 시작 실패'); setCollecting(false); return }
      if (r.data.started === false) { await Promise.all([loadLeads(), loadMeta()]); toast.success('수집 완료'); setCollecting(false); return }
      toast.success('수집을 시작했어요 — 백그라운드 진행 중, 결과가 자동 갱신됩니다')
      // last_run 이 갱신되면 완료. 최대 ~80초 폴링(수집이 그보다 길면 안내 후 종료 — 자동 갱신은 계속).
      let done = false
      for (let i = 0; i < 10 && !done; i++) {
        await new Promise(res => setTimeout(res, 8000))
        try {
          const s = await api.get('/api/admin/ads/influencer-pool/stats')
          if (!s.data?.success) continue
          setStats(s.data.stats || {}); setRun(s.data.run || null); setGate(!!s.data.gate)
          const lr = s.data.run?.last_run || ''
          if (lr && lr !== prevRun) {
            done = true
            const saved = s.data.run?.last_saved ?? 0
            toast.success(`수집 완료 — 신규 ${formatNumber(saved)}건`)
            await loadLeads()
          }
        } catch { /* 폴링 지속 */ }
      }
      if (!done) toast.info('수집이 계속 진행 중이에요. 잠시 후 새로고침하면 최신 결과가 보입니다')
    } catch { toast.error('수집 시작 실패') } finally { setCollecting(false) }
  }

  async function setStatus(id: number, status: string) {
    try { await api.patch(`/api/admin/ads/influencer-pool/${id}`, { status }); setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l)) }
    catch { toast.error('변경 실패') }
  }
  // 컨택 채널 기록(이메일/DM/쪽지…) — 값 있으면 첫 접촉으로 보고 신규→컨택함 동반 승격.
  async function setChannel(l: Lead, channel: string) {
    try {
      const promote = channel && l.status === 'new'
      await api.patch(`/api/admin/ads/influencer-pool/${l.id}`, { contact_channel: channel || null, ...(promote ? { status: 'contacted' } : {}) })
      setLeads(prev => prev.map(x => x.id === l.id ? { ...x, contact_channel: channel || null, ...(promote ? { status: 'contacted' } : {}) } : x))
    } catch { toast.error('변경 실패') }
  }
  async function editMemo(l: Lead) {
    const memo = window.prompt('메모(내부 관리용)', l.memo || '')
    if (memo === null) return
    try { await api.patch(`/api/admin/ads/influencer-pool/${l.id}`, { memo }); setLeads(prev => prev.map(x => x.id === l.id ? { ...x, memo } : x)) }
    catch { toast.error('메모 저장 실패') }
  }
  async function setFollowUp(l: Lead) {
    const cur = l.follow_up_at || ''
    const v = window.prompt('다음 팔로업 예정일 (YYYY-MM-DD, 비우면 해제)', cur)
    if (v === null) return
    const val = v.trim()
    if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) { toast.error('YYYY-MM-DD 형식으로 입력'); return }
    try { await api.patch(`/api/admin/ads/influencer-pool/${l.id}`, { follow_up_at: val || null }); setLeads(prev => prev.map(x => x.id === l.id ? { ...x, follow_up_at: val || null } : x)) }
    catch { toast.error('저장 실패') }
  }
  async function mergeDuplicates() {
    if (!window.confirm('중복 리드를 통합할까요?\n① 같은 이메일 ② 같은 인스타 핸들(이메일 없는 크로스플랫폼 동일인)\n상태·정보가 가장 앞선 1건만 남기고 나머지 삭제.')) return
    setMerging(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/merge-duplicates', {})
      if (r.data?.success) {
        const em = r.data.mergedEmail ?? 0, ig = r.data.mergedInsta ?? 0
        toast.success(`중복 통합 완료 — ${formatNumber(r.data.merged)}건 정리 (이메일 ${formatNumber(em)} · 인스타 ${formatNumber(ig)})`)
        await Promise.all([loadLeads(), loadMeta()])
      } else toast.error('통합 실패')
    } catch { toast.error('통합 실패') } finally { setMerging(false) }
  }
  // 🏷️ 카테고리 재분류(백필) — 채널 이름+소개글 신호로 기존 풀 교정(신호 있고 다를 때만 UPDATE).
  const [reclassifying, setReclassifying] = useState(false)
  async function reclassify() {
    if (!window.confirm('풀 전체를 채널 이름·소개글 기반으로 재분류할까요?\n(콘텐츠 신호가 있고 현재와 다를 때만 변경 — 멱등)')) return
    setReclassifying(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/reclassify', {})
      if (r.data?.success) { toast.success(`🏷️ ${formatNumber(r.data.scanned)}명 스캔 · ${formatNumber(r.data.changed)}명 재분류`); await loadLeads() }
      else toast.error('재분류 실패')
    } catch { toast.error('재분류 실패') } finally { setReclassifying(false) }
  }
  // 📊 구글시트 수동 동기화 — 결과(행수/설정 안내)를 그대로 토스트.
  const [sheetsSyncing, setSheetsSyncing] = useState(false)
  async function sheetsSync() {
    setSheetsSyncing(true)
    try {
      const r = await api.post('/api/admin/ads/influencer-pool/sheets-sync', {})
      if (r.data?.success) toast.success(`📊 구글시트에 ${formatNumber(r.data.rows)}행 반영 완료`)
      else toast.error(r.data?.error || '시트 동기화 실패')
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '시트 동기화 실패')
    } finally { setSheetsSyncing(false) }
  }
  function daysAgo(dt?: string | null): number | null { if (!dt) return null; const d = Math.floor((Date.now() - new Date(dt.replace(' ', 'T') + 'Z').getTime()) / 86400000); return Number.isFinite(d) ? d : null }
  // 🔗 유어딜 셀러 매칭(읽기 전용) — 선택 카테고리의 유어딜 승인 매장 목록(+지역 커버리지/필터).
  const [matchSellers, setMatchSellers] = useState<{ id: number; name: string; product_count: number; regions?: string | null }[] | null>(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchRegion, setMatchRegion] = useState('') // 지역(시/군구/동) 텍스트 필터 — 로컬 딜 근접 매칭
  async function loadSellerMatch() {
    if (!category) { toast.error('먼저 카테고리(맛집/뷰티/네일/숙소)를 선택하세요'); return }
    setMatchLoading(true)
    try {
      const rq = matchRegion.trim() ? `&region=${encodeURIComponent(matchRegion.trim())}` : ''
      const r = await api.get(`/api/admin/ads/seller-match?category=${encodeURIComponent(category)}${rq}`)
      if (r.data?.success) { setMatchSellers(r.data.sellers || []); if (!r.data.voucher_category) toast.info('이 카테고리는 유어딜 이용권과 직접 매칭되지 않아요') }
    } catch { toast.error('매칭 조회 실패') } finally { setMatchLoading(false) }
  }
  // 📨 "지금 연락" — 최적 채널(이메일→인스타DM→블로그 쪽지/댓글)을 열고, 이메일이 아니면 DM 초안을
  //   클립보드에 담아준다. 채널 기록 + 신규→컨택함 자동 승격. 이메일 없는 블로거도 원클릭 연락 가능.
  //   ⚖️ [LEGAL] 자동 발송 없음 — 링크만 열고 사람이 눈으로 확인 후 직접 보냄(정보통신망법 사전동의).
  function reachOut(l: Lead) {
    const plan = pickReach(l)
    if (!plan) { toast.error('열 수 있는 연락 채널이 없습니다 (이메일·인스타·URL 없음)'); return }
    if (plan.channel !== 'email') navigator.clipboard?.writeText(plan.clipboard).then(() => toast.success('DM/쪽지 초안이 복사됐어요 — 붙여넣어 직접 보내세요')).catch(() => {})
    window.open(plan.href, '_blank')
    setChannel(l, plan.channel) // 컨택 채널 기록 + 신규→컨택함 승격
  }

  // ✍ 개인화 초안 일괄 생성 — 선택 리드를 10명씩 묶어(서버=Claude 1회 호출 한도) 순차 생성 → 리드 행 저장.
  //   ⚖️ 생성만, 발송 없음 — 초안은 사람이 검토·수정 후 1건씩 직접 발송(정보통신망법). 대량 선택 OK(자동발송 X).
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [drafting, setDrafting] = useState(false)
  const [draftProgress, setDraftProgress] = useState('')
  const [draftView, setDraftView] = useState<{ lead: Lead; draft: OutreachDraftData } | null>(null)
  const [queueOpen, setQueueOpen] = useState(false) // 🚀 발송 모드(선택 있으면 선택만, 없으면 현재 필터 전체)
  function toggleSelect(id: number) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id))
  function toggleSelectAll() {
    setSelected(prev => { const n = new Set(prev); const on = leads.every(l => n.has(l.id)); leads.forEach(l => on ? n.delete(l.id) : n.add(l.id)); return n })
  }
  async function generateDrafts() {
    const ids = Array.from(selected)
    if (!ids.length) { toast.error('체크박스로 리드를 선택해주세요'); return }
    setDrafting(true)
    let generated = 0, failed = 0
    try {
      const chunks: number[][] = []
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))
      for (let ci = 0; ci < chunks.length; ci++) {
        if (chunks.length > 1) setDraftProgress(`${ci + 1}/${chunks.length} 묶음 생성 중… (${generated}건 완료)`)
        try {
          const r = await api.post('/api/admin/ads/influencer-pool/outreach-drafts', { ids: chunks[ci] })
          if (r.data?.success) {
            const drafts = (r.data.drafts || {}) as Record<string, OutreachDraftData>
            setLeads(prev => prev.map(l => drafts[l.id] ? { ...l, outreach_draft: JSON.stringify(drafts[l.id]) } : l))
            generated += r.data.generated || 0; failed += (r.data.failed || []).length
          } else { failed += chunks[ci].length; if (chunks.length === 1) toast.error(r.data?.error || '초안 생성 실패') }
        } catch { failed += chunks[ci].length }
      }
      setSelected(new Set())
      if (generated) toast.success(`초안 ${formatNumber(generated)}건 생성 완료${failed ? ` (${failed}건 실패 — 다시 시도)` : ''} — ✍ 버튼으로 검토하세요`)
      else toast.error('초안 생성에 실패했습니다. 잠시 후 다시 시도해주세요')
    } finally { setDrafting(false); setDraftProgress('') }
  }
  async function del(id: number) {
    if (!window.confirm('이 인플루언서를 풀에서 삭제할까요?')) return
    try { await api.delete(`/api/admin/ads/influencer-pool/${id}`); setLeads(prev => prev.filter(l => l.id !== id)) }
    catch { toast.error('삭제 실패') }
  }

  const [exporting, setExporting] = useState(false)
  async function exportExcel() {
    setExporting(true)
    try {
      // 서버 export — 화면 500개 제한 무관 풀 전체, 카테고리별 시트 분리(.xls)
      const r = await api.get('/api/admin/ads/influencer-pool/export?format=xls', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/vnd.ms-excel' }))
      const a = document.createElement('a'); a.href = url; a.download = `인플루언서풀-카테고리별-${new Date().toISOString().slice(0, 10)}.xls`; a.click(); URL.revokeObjectURL(url)
    } catch { toast.error('엑셀 내보내기 실패') } finally { setExporting(false) }
  }

  // 📤 CSV — 화면 로드분(200)만 나가던 결함 수리: 현재 필터 **전체**를 500개씩 끝까지 페치(공유 헬퍼, 22열).
  const [csvExporting, setCsvExporting] = useState(false)
  async function exportCsv() {
    setCsvExporting(true)
    try {
      const n = await exportFilteredCsv(async off => { const p = buildParams(off); p.set('limit', '500'); const r = await api.get(`/api/admin/ads/influencer-pool?${p.toString()}`); return r.data?.leads || [] })
      if (n) toast.success(`CSV ${formatNumber(n)}건 내보냄 (현재 필터 전체)`)
    } catch { toast.error('CSV 내보내기 실패') } finally { setCsvExporting(false) }
  }


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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          {[
            { label: '전체', value: stats.total },
            { label: '유튜브', value: stats.youtube },
            { label: '네이버블로그', value: stats.naver_blog },
            { label: '네이버카페', value: stats.naver_cafe },
            { label: '이메일 보유', value: stats.with_email },
            { label: '오늘 수집', value: stats.today },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(s.value)}</div>
            </div>
          ))}
        </div>

        {/* 📊 아웃리치 전환 퍼널 — '모은 게 성과로 이어지나' 측정(컨택 이력 있을 때만). */}
        <FunnelCard stats={stats} />

        {/* 아웃리치 파이프라인 — 상태별 카운트(클릭 시 필터). 발송 자동화 없음(메일은 리드별 직접 발송). */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-medium text-gray-500 mr-1">아웃리치:</span>
          {[
            { v: '', label: '전체', n: stats.total },
            { v: 'new', label: '신규', n: stats.st_new },
            { v: 'contacted', label: '컨택함', n: stats.st_contacted },
            { v: 'interested', label: '관심', n: stats.st_interested },
            { v: 'contracted', label: '계약', n: stats.st_contracted },
          ].map(s => (
            <button key={s.v || 'all'} onClick={() => { setStatusFilter(s.v); setNeedFollowup(false) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusFilter === s.v && !needFollowup ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {s.label} {s.n != null ? formatNumber(s.n) : ''}
            </button>
          ))}
          <button onClick={() => { setNeedFollowup(v => !v); setStatusFilter('') }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${needFollowup ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400'}`}>
            ⏰ 팔로업 필요 {stats.need_followup != null ? formatNumber(stats.need_followup) : ''}
          </button>
        </div>

        {run && (
          <div className="mb-4 text-xs text-gray-500">
            마지막 수집 {run.last_run || '—'} · 신규 {formatNumber(run.last_saved)}건 · 누적 {formatNumber(run.total_saved)}건 · 실행 {formatNumber(run.total_runs)}회{run.bio_enriched ? ` · 🔗 링크 컨택보강 ${formatNumber(run.bio_enriched)}건` : ''}
            {run.yt_budget ? <span className={run.yt_budget.used >= run.yt_budget.total ? 'text-amber-600 font-medium' : ''}>{` · 🎯 YT 검색 예산 ${formatNumber(run.yt_budget.used)}/${formatNumber(run.yt_budget.total)}`}{run.yt_budget.used >= run.yt_budget.total ? ' (오후 4~5시 리셋)' : ''}</span> : ''}
            {run.youtube_quota_hit ? ' · ⚠️ 유튜브 일일 한도 도달(네이버만 계속)' : ''}
            {run.promoted?.length ? ` · 자동확장 키워드 +${run.promoted.length}` : ''}
          </div>
        )}

        {/* 🔎 플랫폼별 진단 — 실제 문제(키없음/전건실패)면 빨강, 일시 부분실패(저장>0)면 앰버 참고, 완전정상이면 숨김 */}
        {run?.diag && (() => {
          // 플랫폼 상태: 키없음 or (에러 & 저장0)=hard, (에러 & 저장>0)=일시부분실패, 그 외 정상.
          const cls = (p: PlatformDiag) => !p.configured ? 'missing' : (p.error && p.saved === 0) ? 'failed' : (p.error && p.saved > 0) ? 'partial' : 'ok'
          const yt = cls(run.diag.yt), nv = cls(run.diag.naver)
          const hard = yt === 'missing' || yt === 'failed' || nv === 'missing' || nv === 'failed'
          const soft = yt === 'partial' || nv === 'partial'
          if (!hard && !soft) return null // 완전 정상이면 배너 숨김
          const line = (label: string, p: PlatformDiag, st: string) => (
            <div>{label} — {p.configured ? `발굴 ${formatNumber(p.found)} · 저장 ${formatNumber(p.saved)}` : '키 미설정'}
              {st === 'ok' ? ' · 정상' : st === 'partial' ? ' · 일부 키워드 일시 실패(다음 시간 자동 재시도)' : st === 'failed' ? ` · ⚠️ ${p.error}` : ''}</div>
          )
          return (
            <div className={`mb-4 rounded-lg border px-4 py-3 text-xs space-y-1 ${hard ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              <div className="font-medium">수집 진단 (마지막 실행){!hard && soft ? ' — 정상(일부 일시 실패)' : ''}</div>
              {line('유튜브', run.diag.yt, yt)}
              {line('네이버', run.diag.naver, nv)}
              {hard && <div className="text-red-500">키 미설정이면: Cloudflare → Workers & Pages → <b>ur-ads</b> → Settings → Variables and Secrets 에 해당 키 추가.</div>}
            </div>
          )
        })()}

        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={collectNow} disabled={collecting} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50">
            {collecting ? '수집 중…' : '지금 수집'}
          </button>
          <button onClick={exportExcel} disabled={exporting} className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-50">
            {exporting ? '내보내는 중…' : '📊 엑셀 다운로드 (카테고리별 시트)'}
          </button>
          <button onClick={exportCsv} disabled={csvExporting || !total} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium disabled:opacity-50" title="현재 필터 결과 전체(화면 로드분 아님)를 22열 CSV 로">{csvExporting ? 'CSV 내보내는 중…' : `CSV (필터 전체 ${formatNumber(total)}건)`}</button>
          <button onClick={mergeDuplicates} disabled={merging} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50" title="같은 이메일 중복 리드 통합">{merging ? '통합 중…' : '🧬 중복 통합'}</button>
          <button onClick={sheetsSync} disabled={sheetsSyncing} className="px-4 py-2 rounded-lg border border-green-300 bg-green-50 text-green-700 text-sm font-medium disabled:opacity-50" title="풀 전체를 구글 스프레드시트 pool 탭에 미러(서비스계정 설정 필요 — 매시간 자동 + 이 버튼 즉시)">{sheetsSyncing ? '시트 동기화 중…' : '📊 구글시트 동기화'}</button>
          <button onClick={reclassify} disabled={reclassifying} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-sm font-medium disabled:opacity-50" title="채널 이름·소개글 신호로 카테고리 재분류(키워드 상속 오분류 교정 — 1회성 백필, 멱등)">{reclassifying ? '재분류 중…' : '🏷️ 카테고리 재분류'}</button>
          <button onClick={generateDrafts} disabled={drafting || !selected.size} className="px-4 py-2 rounded-lg border border-violet-300 bg-violet-50 text-violet-700 text-sm font-medium disabled:opacity-50" title="선택 리드의 개인화 제안 초안을 AI 로 일괄 생성(10명씩 순차) — 발송은 사람이 검토 후 직접">
            {drafting ? (draftProgress || '초안 생성 중…') : `✍ 선택 초안 생성${selected.size ? ` (${selected.size})` : ''}`}
          </button>
          <button onClick={() => setQueueOpen(true)} disabled={!leads.length} className="px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium disabled:opacity-50" title="현재 필터의 리드를 한 명씩 넘기며 원클릭 발송(Enter) — 자동 발송 아님, 사람이 직접 보냄">
            🚀 발송 모드{selected.size ? ` (선택 ${selected.size})` : ` (${leads.length})`}
          </button>
          <ConsentedSendPanel />
        </div>

        <KeywordManager keywords={keywords} onChanged={loadMeta} />{/* 키워드 관리 — influencer-pool/ 추출(600줄 캡) */}

        {/* 필터 */}
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900">
            <option value="">전체 플랫폼</option>
            <option value="youtube">유튜브</option>
            <option value="naver_blog">네이버 블로그</option>
            <option value="naver_cafe">네이버 카페</option>
            <option value="tistory">티스토리</option>
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900">
            <option value="">전체 카테고리</option>
            {['맛집', '외식창업', '숙소', '네일', '뷰티', '푸드', '패션', '여행', '육아', '운동', '반려동물', '리빙', 'IT/재테크', '취미', '자동'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={tier} onChange={e => setTier(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" title="유어딜 딜엔 마이크로/중형(1만~50만)이 효율적">
            <option value="">전체 규모</option>
            <option value="sweet">⭐ 스위트스팟 (1만~50만)</option>
            <option value="nano">나노 (~1만)</option>
            <option value="micro">마이크로 (1만~10만)</option>
            <option value="mid">중형 (10만~50만)</option>
            <option value="macro">대형 (50만+)</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900">
            <option value="fit">유어딜 핏순</option>
            <option value="perf">📈 평균조회수순</option>
            <option value="subscribers">구독자순</option>
            <option value="recent">최근 수집순</option>
          </select>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white cursor-pointer">
            <input type="checkbox" checked={hasEmail} onChange={e => setHasEmail(e.target.checked)} /> ✉ 이메일 있음
          </label>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white cursor-pointer">
            <input type="checkbox" checked={hasInstagram} onChange={e => setHasInstagram(e.target.checked)} /> IG 인스타 있음
          </label>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white cursor-pointer">
            <input type="checkbox" checked={hasContact} onChange={e => setHasContact(e.target.checked)} /> 아무 연락처
          </label>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white cursor-pointer" title="뉴스·방송·기관·체험단모집·대행 등 노이즈 숨김">
            <input type="checkbox" checked={hideNoise} onChange={e => setHideNoise(e.target.checked)} /> 🧹 노이즈 숨김
          </label>
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-300 text-sm text-violet-700 bg-violet-50 cursor-pointer" title="스스로 신청한 리드(사전동의 — 자유 연락 가능)">
            <input type="checkbox" checked={inboundOnly} onChange={e => setInboundOnly(e.target.checked)} /> 📥 신청·동의
          </label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="이름·핸들·수집키워드 검색 (예: 방배)" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900" />
          <input value={matchRegion} onChange={e => setMatchRegion(e.target.value)} placeholder="지역(예: 강남·서울)" className="w-[140px] px-3 py-2 rounded-lg border border-indigo-200 text-sm text-gray-900" title="유어딜 매장 매칭 시 지역(시/군구/동) 필터" />
          <button onClick={loadSellerMatch} disabled={matchLoading} className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium disabled:opacity-50" title="선택 카테고리(+지역)의 유어딜 매장 목록(읽기 전용)">
            {matchLoading ? '조회 중…' : '🔗 유어딜 매장 매칭'}
          </button>
        </div>

        {/* 🔗 유어딜 셀러 매칭 결과(읽기 전용) */}
        {matchSellers && (
          <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-indigo-900">🔗 「{category}」{matchRegion.trim() ? ` · ${matchRegion.trim()}` : ''} 매칭 유어딜 매장 — {formatNumber(matchSellers.length)}곳</div>
              <button onClick={() => setMatchSellers(null)} className="text-xs text-gray-400 hover:text-gray-700">닫기</button>
            </div>
            {matchSellers.length === 0 ? (
              <div className="text-xs text-gray-500">해당 카테고리{matchRegion.trim() ? `·「${matchRegion.trim()}」 지역` : ''}의 승인된 유어딜 매장이 아직 없습니다. (매장이 늘면 이 인플루언서들을 연결 제안할 수 있어요)</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {matchSellers.map(s => (
                  <span key={s.id} className="px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-xs text-gray-700">{s.name} <span className="text-gray-400">· 상품 {s.product_count}{s.regions ? ` · ${s.regions}` : ''}</span></span>
                ))}
              </div>
            )}
            <div className="text-[11px] text-gray-400 mt-2">※ 읽기 전용 참고용 — 유어딜 매장 데이터는 변경되지 않습니다. 실제 매칭/컨택은 운영자가 판단.</div>
          </div>
        )}

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
                  <th className="px-2 py-2" title="전체 선택/해제 — 선택 리드는 10명씩 묶어 초안 일괄 생성"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="전체 선택" /></th>
                  <th className="text-left px-3 py-2 font-medium">인플루언서</th>
                  <th className="text-right px-3 py-2 font-medium">구독자</th>
                  <th className="text-left px-3 py-2 font-medium">✉ 이메일</th>
                  <th className="text-left px-3 py-2 font-medium">인스타 · 틱톡</th>
                  <th className="text-left px-3 py-2 font-medium">카테고리</th>
                  <th className="text-left px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {leads.map(l => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} aria-label={`${l.name} 초안 대상 선택`} />
                    </td>
                    <td className="px-3 py-2">
                      <a href={/^https?:\/\//i.test(l.url) ? l.url : `https://${(l.url || '').replace(/^\/+/, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-gray-900 hover:underline">{/* 🐛 스킴 없는 옛 URL(blog.naver.com/..) 도 절대경로로 — 상대경로 404 방지 */}
                        {l.thumbnail && <img src={l.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover" loading="lazy" />}
                        <span>
                          <span className="font-medium">{l.name}</span>
                          {l.source === 'inbound' && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-medium align-middle" title="스스로 신청 · 사전동의">📥 신청</span>}
                          <span className="ml-1.5 text-xs text-gray-400">{PLATFORM_LABEL[l.platform] || l.platform}{l.handle ? ` · ${l.handle}` : ''}</span>
                        </span>
                      </a>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {l.platform === 'naver_blog' ? <span className="text-gray-400">블로그{l.recent_posts_30d != null ? ` · 月${l.recent_posts_30d}글` : ''}</span> : l.platform === 'tistory' ? <span className="text-gray-400">티스토리 · 글{formatNumber(l.video_count)}</span> : l.platform === 'naver_cafe' ? <span className="text-gray-400">카페 · 글{formatNumber(l.video_count)}</span> : (
                        <span className="inline-flex flex-col items-end">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            {formatNumber(l.subscriber_count)}
                            {(() => { const s = l.subscriber_count; const b = s >= 500000 ? { t: '대형', c: 'bg-gray-100 text-gray-500' } : s >= 100000 ? { t: '중형', c: 'bg-emerald-100 text-emerald-700' } : s >= 10000 ? { t: '마이크로', c: 'bg-emerald-100 text-emerald-700' } : s > 0 ? { t: '나노', c: 'bg-gray-100 text-gray-500' } : null; return b ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${b.c}`}>{b.t}</span> : null })()}
                          </span>
                          {l.recent_avg_views != null && <span className="text-[11px] text-gray-400" title="최근 영상 ≤10개 평균(구독자수보다 정직한 협업 지표)">📈 평균 {formatNumber(l.recent_avg_views)}회{l.recent_avg_comments ? ` · 💬${formatNumber(l.recent_avg_comments)}` : ''}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {l.email
                        ? <button onClick={() => { navigator.clipboard?.writeText(l.email!).then(() => toast.success('이메일 복사됨')) }} title="클릭 시 복사" className="text-blue-600 hover:underline break-all text-left">{l.email}</button>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {l.instagram && <a href={`https://instagram.com/${l.instagram}`} target="_blank" rel="noreferrer" className="block text-pink-600 hover:underline">IG @{l.instagram}</a>}
                      {l.tiktok && <a href={`https://tiktok.com/@${l.tiktok}`} target="_blank" rel="noreferrer" className="block text-gray-700 hover:underline">TT @{l.tiktok}</a>}
                      {!l.instagram && !l.tiktok && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{l.category || '—'}</td>
                    <td className="px-3 py-2">
                      <select value={l.status} onChange={e => setStatus(l.id, e.target.value)} className={`px-2 py-1 rounded border-0 text-xs font-medium ${STATUS_META[l.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                        {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                      </select>
                      <select value={l.contact_channel || ''} onChange={e => setChannel(l, e.target.value)} className="mt-1 block px-1.5 py-0.5 rounded border border-gray-200 text-[11px] text-gray-600 bg-white" title="컨택 채널 — 선택하면 자동으로 '컨택함' 처리">
                        <option value="">채널…</option>
                        {Object.entries(CHANNELS).map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                      </select>
                      {l.contacted_at && (() => { const d = daysAgo(l.contacted_at); return d != null ? <div className="text-[11px] text-gray-400 mt-0.5">컨택 {d === 0 ? '오늘' : `${d}일 전`}</div> : null })()}
                      {l.follow_up_at && <div className={`text-[11px] mt-0.5 ${l.follow_up_at <= new Date().toISOString().slice(0, 10) ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>⏰ {l.follow_up_at}</div>}
                      {l.memo && <div className="text-[11px] text-gray-400 mt-0.5 max-w-[140px] truncate" title={l.memo}>📝 {l.memo}</div>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {(() => { const d = parseDraft(l.outreach_draft); return d ? <button onClick={() => setDraftView({ lead: l, draft: d })} className="text-xs text-violet-600 hover:underline mr-2" title="AI 개인화 초안 검토(발송은 직접)">✍ 초안</button> : null })()}
                      <button onClick={() => reachOut(l)} className="text-xs text-emerald-600 hover:underline mr-2" title={l.email ? '메일 초안 열기(직접 발송)' : '인스타 DM·블로그 열기 + 초안 복사(직접 발송)'}>{l.email ? '✉ 메일' : '💬 연락'}</button>
                      <button onClick={() => setFollowUp(l)} className="text-xs text-gray-400 hover:text-amber-600 mr-2" title="팔로업 예정일">⏰</button>
                      <button onClick={() => editMemo(l)} className="text-xs text-gray-400 hover:text-gray-700 mr-2">메모</button>
                      <button onClick={() => del(l.id)} className="text-xs text-gray-400 hover:text-red-500">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && leads.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            <span className="text-gray-400">{formatNumber(leads.length)} / {formatNumber(total)}명 표시</span>
            {leads.length < total && (
              <button onClick={loadMore} disabled={loadingMore} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium disabled:opacity-50">
                {loadingMore ? '불러오는 중…' : `더 보기 (+${formatNumber(Math.min(PAGE, total - leads.length))})`}
              </button>
            )}
          </div>
        )}

        <p className="mt-2 text-center text-[11px] text-gray-400">데이터 출처: YouTube Data API · 네이버 검색 API · 카카오(Daum) 검색 API — 공개 정보만 수집</p>

        {/* ✍ 초안 뷰어 — 검토·복사·메일 열기(발송 없음) */}
        {draftView && (
          <DraftModal
            name={draftView.lead.name}
            email={draftView.lead.email}
            draft={draftView.draft}
            onClose={() => setDraftView(null)}
            onOpenMail={() => { reachOut(draftView.lead); setDraftView(null) }}
          />
        )}
        {/* 🚀 발송 모드 — 한 명씩 원클릭(Enter) 발송 큐. 선택 있으면 선택만. */}
        {queueOpen && <SendQueueModal leads={selected.size ? leads.filter(l => selected.has(l.id)) : leads} onReach={reachOut} onClose={() => setQueueOpen(false)} />}
      </div>
    </AdminLayout>
  )
}
