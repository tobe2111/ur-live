import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatNumber } from '@/utils/format'
import DraftModal, { type OutreachDraftData } from './influencer-pool/DraftModal'
import FunnelCard, { type CategoryFunnelRow } from './influencer-pool/FunnelCard'
import CollectDiagPanel, { type RunStats, type MaintenanceRecord, type EnrichLaneRecord } from './influencer-pool/CollectDiagPanel'
import FulfillBanner from './influencer-pool/FulfillBanner'
import { pickReach } from './influencer-pool/reach'
import { useCollectRun } from './influencer-pool/useCollectRun'
import KeywordManager, { type Keyword } from './influencer-pool/KeywordManager'
import SendModeButtons from './influencer-pool/SendModeButtons'
import ConsentedSendPanel from './influencer-pool/ConsentedSendPanel'
import ColdSendPanel from './influencer-pool/ColdSendPanel'
import ExcelExportButtons from './influencer-pool/ExcelExportButtons'
import MarkContactedPanel from './influencer-pool/MarkContactedPanel'
import MaintenanceButtons from './influencer-pool/MaintenanceButtons'
import { exportFilteredCsv } from './influencer-pool/export-csv'
import TrackLinkButton from './influencer-pool/TrackLinkButton'
import RecruitButton from './influencer-pool/RecruitButton'
import { LeadNameCell } from './influencer-pool/LeadNameCell'
import PoolFilters from './influencer-pool/PoolFilters'

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
  median_long_views?: number | null; shorts_ratio?: number | null // 📈 롱폼 중앙값 + 쇼츠 비중(%) — 쇼츠 착시 배제 지표
  is_brand?: number | null; lead_score?: number | null            // 🏢 브랜드 공식 채널 추정 · 🏅 리드 점수(0~100)
  opted_out?: number | null                                       // 🚫 소개글에 제안 거부 명시 — 발송 큐 자동 제외
  last_post_at?: string | null // 📝 블로거 마지막 글 날짜(검색 postdate/RSS — 활동 신호)
  email_status?: string | null // 📬 Resend 웹훅(bounced/complained/opened) — 발송 큐 하드 필터에 사용
  category_source?: string | null // 🏷️ 'content'=본문·소개글로 확인 · 그 외=발굴 키워드 상속(미확인)
  perf_checked_at?: string | null // 📏 활동성 측정 시도 시각. NULL = 한 번도 안 잼(연락처·본문분류가 통째로 빔)
}
const CHANNELS: Record<string, string> = { email: '이메일', dm: '인스타DM', note: '네이버쪽지', kakao: '카톡', call: '전화', other: '기타' }
function parseDraft(raw?: string | null): OutreachDraftData | null {
  if (!raw) return null
  try { const d = JSON.parse(raw) as OutreachDraftData; return d?.subject && d?.body ? d : null } catch { return null }
}
interface PoolStats { total?: number; youtube?: number; naver_blog?: number; naver_cafe?: number; nb_unmeasured?: number; with_contact?: number; with_email?: number; yt_with_email?: number; yt_email_personal?: number; recent7?: number; today?: number; need_followup?: number; st_new?: number; st_contacted?: number; st_interested?: number; st_contracted?: number; st_rejected?: number; st_hold?: number; reached?: number; replied?: number; contacted7?: number; ch_email?: number; ch_dm?: number; ch_note?: number; ch_kakao?: number; ch_call?: number; ch_other?: number; opened?: number; bounced?: number; consented?: number; brand_tagged?: number; opted_out?: number; scored?: number; score_hot?: number; categorized?: number; cat_content?: number; cat_topic?: number; cat_keyword?: number; recruited?: number; recruit_converted?: number; joined?: number; first_sale?: number }

const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-gray-100 text-gray-600' },
  contacted: { label: '컨택함', cls: 'bg-blue-100 text-blue-700' },
  interested: { label: '관심', cls: 'bg-amber-100 text-amber-700' },
  contracted: { label: '계약', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '거절', cls: 'bg-gray-100 text-gray-400' },
  hold: { label: '보류', cls: 'bg-gray-100 text-gray-500' },
}
const PLATFORM_LABEL: Record<string, string> = { youtube: '유튜브', naver_blog: '네이버블로그', naver_cafe: '네이버카페', tistory: '티스토리', instagram: '인스타', tiktok: '틱톡' }
// 🏷️ 목록 필터 옵션. **서버가 분류하는 카테고리는 여기 다 있어야 한다** — 빠지면 그 축으로 수집된
//   사람들을 화면에서 고를 수 없다(수집은 되는데 안 보이는 반쪽 상태). 유닛이 우선축 누락을 막는다.
//   '공동구매' 는 2026-07-29 신설(대표 지시) — 이미 자기 팔로워에게 파는 층이라 링크샵 전환 1순위.
//   '카페' 도 2026-07-29 추가 — 분류기는 만드는데 여기 없어서 **4,675명(풀의 12%)이 화면에서 안 보였다**
//   (기존 유닛이 *우선 카테고리만* 검사해 놓친 자리 — 이제 분류기 전체 축을 검사한다).
export const POOL_CATEGORIES = ['공동구매', '맛집', '카페', '외식창업', '숙소', '네일', '뷰티', '골프', '푸드', '패션', '여행', '육아', '운동', '반려동물', '리빙', 'IT/재테크', '취미', '자동']
// 📊 매체별 엑셀 분리 다운로드 — 서버 EXPORT_PLATFORMS 화이트리스트와 같은 키(추가 시 양쪽 갱신).

export default function AdminInfluencerPoolPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<PoolStats>({})
  const [run, setRun] = useState<RunStats | null>(null)
  const [gate, setGate] = useState(false)
  // 📊 시트 동기화 상태(무음 실패 가시화) + 🚦 게이트 실값 — gate 가 '고장'과 '꺼짐'을 가른다(null=알 수 없음).
  const [sheets, setSheets] = useState<{ sync: { ok: boolean; at?: string; error?: string | null } | null; cron: { at?: string; ok?: boolean } | null; gate: boolean | null }>({ sync: null, cron: null, gate: null })
  const [maintenance, setMaintenance] = useState<MaintenanceRecord | null>(null)          // 🌙 야간 자동 정비 결과(03시)
  const [maintenanceRescan, setMaintenanceRescan] = useState<MaintenanceRecord | null>(null) // 🌙 야간 라이브 재보정(04시)
  const [enrichLane, setEnrichLane] = useState<EnrichLaneRecord | null>(null)             // 📝 보강 전용 레인(시간당 N라운드) 마지막 결과
  const [catFunnel, setCatFunnel] = useState<CategoryFunnelRow[]>([])                     // 📊 카테고리별 전환
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [platform, setPlatform] = useState('')
  const [hasContact, setHasContact] = useState(false)
  const [hasEmail, setHasEmail] = useState(false)
  const [hasInstagram, setHasInstagram] = useState(false)
  const [category, setCategory] = useState(() => { // 🎯 서비스몰 이행 딥링크(?q=지역&category=업종) 프리필
    const raw = new URLSearchParams(window.location.search).get('category') || ''
    return POOL_CATEGORIES.includes(raw) ? raw : (POOL_CATEGORIES.find(c => raw.includes(c)) || '')
  })
  // 📍 활동 지역 필터 — 수집 키워드 접두에서 캡처된 값(거주지 아님). 지역×업종으로 매칭 후보를 좁힌다.
  const [region, setRegion] = useState('')
  const [catSource, setCatSource] = useState('')   // 🏷️ 분류 신뢰도(content/keyword) — 대표 4축 ② 작업 대상 특정용
  const [measured, setMeasured] = useState('')     // 📏 측정 여부(1/0) — 대표 4축 ④ 백로그 가시화
  const [optedOutOnly, setOptedOutOnly] = useState(false) // 🚫 거부 표시된 리드만 — 자동 태깅 오탐 검수용
  const [tier, setTier] = useState('')          // 규모 필터(nano/micro/mid/macro/sweet)
  const [sort, setSort] = useState('fit')        // 유어딜 핏순(기본)/구독자순/최근수집
  const [statusFilter, setStatusFilter] = useState('') // 아웃리치 상태 필터
  const [needFollowup, setNeedFollowup] = useState(false)
  const [hideNoise, setHideNoise] = useState(false)
  const [brandOnly, setBrandOnly] = useState(false) // 🏢 브랜드 공식 채널 태깅 검수용
  const [inboundOnly, setInboundOnly] = useState(false)
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') || '')
  const dq = useDebouncedValue(q) // ⏱️ 서버 검색은 타이핑 멈춘 뒤 1회(키 입력마다 왕복 방지)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)   // 현재 필터의 전체 건수(페이지네이션)
  const [serverRunning, setServerRunning] = useState(false) // 🔒 서버 수집 lease(진행 중) — 화면 로컬 state 아님
  // 🔧 2026-07-28: 정비 lease — '전체 정비' 를 눌러도 진행 중인지 끝났는지 화면에서 알 수 없었다(대표 신고).
  //   수집과 달리 정비엔 진행 표시가 아예 없었다. 서버 lease 가 진실이라 새로고침·재진입해도 정확하다.
  const [maintainRunning, setMaintainRunning] = useState(false)

  const PAGE = 200
  const buildParams = useCallback((offset: number) => { // 현재 필터 → 쿼리스트링(offset 만 페이지마다 다름)
    const params = new URLSearchParams()
    if (platform) params.set('platform', platform)
    if (hasContact) params.set('hasContact', '1')
    if (hasEmail) params.set('hasEmail', '1')
    if (hasInstagram) params.set('hasInstagram', '1')
    if (category) params.set('category', category)
    if (region) params.set('region', region)
    if (catSource) params.set('catSource', catSource)
    if (measured) params.set('measured', measured)
    if (optedOutOnly) params.set('optedOutOnly', '1')
    if (tier) params.set('tier', tier)
    if (sort) params.set('sort', sort)
    if (statusFilter) params.set('status', statusFilter)
    if (needFollowup) params.set('needFollowup', '1')
    if (hideNoise) params.set('hideNoise', '1')
    if (brandOnly) params.set('brandOnly', '1')
    if (inboundOnly) params.set('source', 'inbound')
    if (dq.trim()) params.set('q', dq.trim())
    params.set('limit', String(PAGE)); params.set('offset', String(offset))
    return params
  }, [platform, hasContact, hasEmail, hasInstagram, category, region, catSource, measured, optedOutOnly, tier, sort, statusFilter, needFollowup, hideNoise, brandOnly, inboundOnly, dq])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get(`/api/admin/ads/influencer-pool?${buildParams(0).toString()}`)
      if (r.data?.success) { setLeads(r.data.leads || []); setTotal(r.data.total ?? (r.data.leads?.length || 0)) }
    } catch { toast.error('목록을 불러오지 못했습니다') } finally { setLoading(false) }
  }, [buildParams])

  const loadMore = useCallback(async () => { // 더 보기 — 로드된 개수를 offset 으로 append(필터 유지)
    setLoadingMore(true)
    try {
      const r = await api.get(`/api/admin/ads/influencer-pool?${buildParams(leads.length).toString()}`)
      if (r.data?.success) { setLeads(prev => [...prev, ...(r.data.leads || [])]); if (typeof r.data.total === 'number') setTotal(r.data.total) }
    } catch { toast.error('더 불러오지 못했습니다') } finally { setLoadingMore(false) }
  }, [buildParams, leads.length])

  // stats 응답 반영 SSOT — 최초 로드와 수집 폴링(useCollectRun)이 같은 함수를 쓴다(둘이 갈라지면 화면 불일치).
  const applyMeta = useCallback((d: Record<string, unknown>) => {
    const g = <T,>(k: string) => d[k] as T
    setStats(g<PoolStats>('stats') || {}); setRun(g<RunStats>('run') || null); setGate(!!d.gate); setSheets({ sync: g<{ ok: boolean; at?: string; error?: string | null }>('sheets_sync') || null, cron: g<{ at?: string; ok?: boolean }>('sheets_cron') || null, gate: typeof d.sheets_gate === 'boolean' ? d.sheets_gate : null })
    setServerRunning(!!d.collect_running) // 🔒 서버 lease — 페이지를 나갔다 와도 '진행 중'을 알 수 있다
    setMaintainRunning(!!d.maintain_running)
    setMaintenance(g<MaintenanceRecord>('maintenance') || null); setMaintenanceRescan(g<MaintenanceRecord>('maintenance_rescan') || null); setCatFunnel(g<CategoryFunnelRow[]>('category_funnel') || [])
    setEnrichLane(g<EnrichLaneRecord>('enrich_lane') || null)
  }, [])

  // 🔁 2026-07-28: 정비가 도는 동안만 10초 폴링 — 끝나면 스스로 멈추고 완료를 알린다.
  //   이게 없으면 '전체 정비' 를 눌러도 사용자가 수동 새로고침으로만 완료를 알 수 있었다(대표 신고).
  //   상시 폴링이 아니라 lease 가 잡힌 동안만이라 평소 부하 0.
  const wasMaintaining = useRef(false)
  useEffect(() => {
    if (!maintainRunning) {
      if (wasMaintaining.current) {
        wasMaintaining.current = false
        toast.success('🧰 정비가 끝났습니다 — 결과가 아래 「자동 정비」 줄에 반영됐어요')
      }
      return
    }
    wasMaintaining.current = true
    const t = setInterval(() => { void loadMeta() }, 10_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintainRunning])

  const loadMeta = useCallback(async () => {
    try {
      const [s, k] = await Promise.all([
        api.get('/api/admin/ads/influencer-pool/stats'),
        api.get('/api/admin/ads/influencer-pool/keywords'),
      ])
      if (s.data?.success) applyMeta(s.data)
      if (k.data?.success) setKeywords(k.data.keywords || [])
    } catch { /* soft */ }
  }, [applyMeta])

  useEffect(() => { loadMeta() }, [loadMeta])
  useEffect(() => { loadLeads() }, [loadLeads])

  // 🔥 통합 수집 = 오늘 YouTube 예산(하루 100회) 소진까지 백그라운드 연속 수집(self-chain).
  //   실행/폴링/이탈 처리는 useCollectRun 이 소유 — 페이지를 떠나면 폴링만 멈추고 서버 작업은 계속된다.
  const { starting, collectNow } = useCollectRun(applyMeta, loadLeads)
  const collecting = starting || serverRunning // 재진입해도 진행 중이면 잠금(서버 lease 가 진실)

  async function setStatus(id: number, status: string) {
    try { await api.patch(`/api/admin/ads/influencer-pool/${id}`, { status }); setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l)); toast.success(`✅ 상태 변경 → ${STATUS_META[status]?.label || status}`) }
    catch { toast.error('변경 실패') }
  }
  // 컨택 채널 기록(이메일/DM/쪽지…) — 값 있으면 첫 접촉으로 보고 신규→컨택함 동반 승격.
  async function setChannel(l: Lead, channel: string) {
    try {
      const promote = channel && l.status === 'new'
      await api.patch(`/api/admin/ads/influencer-pool/${l.id}`, { contact_channel: channel || null, ...(promote ? { status: 'contacted' } : {}) })
      setLeads(prev => prev.map(x => x.id === l.id ? { ...x, contact_channel: channel || null, ...(promote ? { status: 'contacted' } : {}) } : x))
      toast.success(channel ? `✅ 컨택 채널 기록됨${promote ? ' + 상태 → 컨택함' : ''}` : '컨택 채널 해제됨')
    } catch { toast.error('변경 실패') }
  }
  async function editMemo(l: Lead) {
    const memo = window.prompt('메모(내부 관리용)', l.memo || '')
    if (memo === null) return
    try { await api.patch(`/api/admin/ads/influencer-pool/${l.id}`, { memo }); setLeads(prev => prev.map(x => x.id === l.id ? { ...x, memo } : x)); toast.success('✅ 메모 저장 완료') }
    catch { toast.error('메모 저장 실패') }
  }
  async function setFollowUp(l: Lead) {
    const cur = l.follow_up_at || ''
    const v = window.prompt('다음 팔로업 예정일 (YYYY-MM-DD, 비우면 해제)', cur)
    if (v === null) return
    const val = v.trim()
    if (val && !/^\d{4}-\d{2}-\d{2}$/.test(val)) { toast.error('YYYY-MM-DD 형식으로 입력'); return }
    try { await api.patch(`/api/admin/ads/influencer-pool/${l.id}`, { follow_up_at: val || null }); setLeads(prev => prev.map(x => x.id === l.id ? { ...x, follow_up_at: val || null } : x)); toast.success(val ? `✅ 팔로업 저장 — ${val}` : '팔로업 해제됨') }
    catch { toast.error('저장 실패') }
  }
  const reloadAll = useCallback(async () => { await Promise.all([loadLeads(), loadMeta()]) }, [loadLeads, loadMeta])
  function daysAgo(dt?: string | null): number | null { if (!dt) return null; const d = Math.floor((Date.now() - new Date(dt.replace(' ', 'T') + 'Z').getTime()) / 86400000); return Number.isFinite(d) ? d : null }
  // 🕐 서버 저장 시각은 UTC(datetime('now')/toISOString) — 한국시간(KST)으로 표시.
  function fmtKST(dt?: string | null): string { if (!dt) return '—'; const d = new Date(dt.replace(' ', 'T') + 'Z'); return Number.isFinite(d.getTime()) ? d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : dt }
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
      if (r.data?.success) { setMatchSellers(r.data.sellers || []); toast.success(`🔗 매칭 매장 ${formatNumber((r.data.sellers || []).length)}곳 조회 완료`); if (!r.data.voucher_category) toast.info('이 카테고리는 유어딜 이용권과 직접 매칭되지 않아요') }
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
    try { await api.delete(`/api/admin/ads/influencer-pool/${id}`); setLeads(prev => prev.filter(l => l.id !== id)); toast.success('🗑️ 풀에서 삭제 완료') }
    catch { toast.error('삭제 실패') }
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
            자동 수집이 <b>꺼져 있음</b>. Cloudflare → Workers & Pages → <b>ur-ads</b> → Settings → Variables 에 <code className="font-mono">ADS_AUTO_COLLECT_ENABLED=true</code> 설정하면 매시간 자동 수집됩니다. (아래 "🔄 통합 수집"은 수동 즉시 실행 — YT 예산 소진까지)
          </div>
        )}

        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          {[
            { label: '전체', value: stats.total },
            { label: '유튜브', value: stats.youtube },
            { label: '네이버블로그', value: stats.naver_blog },
            { label: '🏘️ 커뮤니티(카페)', value: stats.naver_cafe },
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
        <FunnelCard stats={stats} categories={catFunnel} />

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
        {/* 📧 유튜브 이메일 확보율 — 유튜브는 About '이메일 버튼'(CAPTCHA, API 불가)이라 텍스트 공개분만 확보. 실제 커버리지 노출. */}
        {stats.youtube ? (
          <div className="text-[11px] text-gray-500 mt-1">
            📧 유튜브 이메일 확보 {formatNumber(stats.yt_with_email)}/{formatNumber(stats.youtube)} ({Math.round((Number(stats.yt_with_email) || 0) / Math.max(1, Number(stats.youtube)) * 100)}%)
            {stats.yt_with_email ? ` · 개인메일 ${formatNumber(stats.yt_email_personal)} · 대행사·기타 ${formatNumber((Number(stats.yt_with_email) || 0) - (Number(stats.yt_email_personal) || 0))}` : ''}
            <span className="text-gray-400"> — 나머지는 유튜브가 이메일을 CAPTCHA로 가려 API로 불가</span>
            {(Number(stats.opened) || 0) + (Number(stats.bounced) || 0) > 0 ? <span> · 📬 개봉 {formatNumber(stats.opened)} · 반송/신고 <span className={Number(stats.bounced) ? 'text-red-500' : ''}>{formatNumber(stats.bounced)}</span></span> : null}
          </div>
        ) : null}
        {(Number(stats.recruited) || 0) + (Number(stats.joined) || 0) > 0 ? <div className="text-[11px] text-gray-500 mt-0.5">🔗 퍼널: 📣 모집안내 {formatNumber(stats.recruited)} → 신청 {formatNumber(stats.recruit_converted)} ({Math.round((Number(stats.recruit_converted) || 0) / Math.max(1, Number(stats.recruited)) * 100)}%) → 가입 <b className="text-rose-600">{formatNumber(stats.joined)}</b> → 첫 판매 <b className="text-emerald-600">{formatNumber(stats.first_sale)}</b> <span className="text-gray-400">— 가입·첫 판매는 초대링크가 연결된 신청자 전체 기준(적립 원장)</span></div> : null}
        {Number(stats.categorized) > 0 ? (() => {
          const tot = Number(stats.total) || 1, cat = Number(stats.categorized) || 0, ver = (Number(stats.cat_content) || 0) + (Number(stats.cat_topic) || 0), inh = Number(stats.cat_keyword) || 0
          return <div className="text-[11px] text-gray-500 mt-0.5">🏷️ 카테고리 분류 {formatNumber(cat)}/{formatNumber(tot)} ({Math.round(cat / tot * 100)}%) · 근거 검증됨 {formatNumber(ver)} ({Math.round(ver / Math.max(1, cat) * 100)}%){inh > 0 ? <span className="text-amber-600"> · 키워드 상속 {formatNumber(inh)} — 야간 재보정이 실제 콘텐츠로 재검증 중</span> : null}</div>
        })() : null}

        <FulfillBanner />{/* 🎯 서비스몰 주문 이행 컨텍스트(?store=) — 명의·의뢰 병기 템플릿 복사 */}
        <CollectDiagPanel run={run} sheetsSync={sheets.sync} sheetsCron={sheets.cron} sheetsGate={sheets.gate} maintenance={maintenance} maintenanceRescan={maintenanceRescan} maintainRunning={maintainRunning}
          enrichLane={enrichLane} nbUnmeasured={Number(stats.nb_unmeasured) || 0} naverBlogTotal={Number(stats.naver_blog) || 0} />

        {/* 핵심 액션 — 항상 보임(수집 + 내보내기 + 서비스몰 바로가기). 나머지(정비·발송)는 아래 접이식으로 정리해 UI 단순화(대표 요청). */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button onClick={collectNow} disabled={collecting} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50" title="유튜브·네이버블로그·네이버카페 전 매체를 한 번에 수집 — YouTube 검색 예산 소진할 때까지 백그라운드로 연속 실행">{collecting ? '수집 중…' : '🔄 통합 수집'}</button>
          {collecting ? <span className="text-[11px] text-gray-500 self-center">백그라운드로 진행 중 — 페이지를 떠나도 계속됩니다</span> : null}
          <ExcelExportButtons variant="all" />
          <button onClick={exportCsv} disabled={csvExporting || !total} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium disabled:opacity-50" title="현재 필터 결과 전체(화면 로드분 아님)를 29열 CSV 로">{csvExporting ? 'CSV 내보내는 중…' : `CSV (필터 전체 ${formatNumber(total)}건)`}</button>
          {/* 🛍️ 최근 구현한 서비스 표면 바로가기 — 이 풀이 이행 재고인 서비스몰(광고주 주문 화면)과 주문 접수함 */}
          <a href="/ads/dashboard?tab=services" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium" title="광고주가 보는 유어애즈 대시보드(서비스몰 주문 화면) — 새 탭">🛍️ 서비스몰 (광고주 화면)</a>
          <a href="/admin/ads-services" className="px-4 py-2 rounded-lg border border-indigo-300 bg-white text-indigo-700 text-sm font-medium" title="서비스몰 주문 접수함 — 결제 확인 · 풀에서 이행 · 환불">📥 주문 접수함</a>
        </div>

        {/* 🛠️ 정비 도구 — 자주 안 쓰는 관리 작업. 접이식으로 감춰 기본 화면 단순화. */}
        <details className="mb-3 rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">🛠️ 정비 도구 (중복 통합 · 카테고리 재보정 · 연락처 재추출 · 라이브 재조회 · 구글시트)</summary>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            <MaintenanceButtons onChanged={reloadAll} canMerge={!!leads.length} />
          </div>
        </details>

        {/* 📨 발송 — 사람이 직접 검토·발송(정보통신망법: 동의 리드만 자동발송). 접이식. */}
        <details className="mb-4 rounded-lg border border-gray-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900">📨 발송 (초안 생성 · 발송 모드 · 동의 리드 일괄발송)</summary>
          <div className="px-4 pb-1 text-[11px] text-gray-400">운영 기준: 이메일·네이버 쪽지 우선 · 인스타 DM은 보조(단일 계정 대량 DM = 제재 리스크) · 명의는 유어애즈 + 의뢰 매장 병기</div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            <button onClick={generateDrafts} disabled={drafting || !selected.size} className="px-4 py-2 rounded-lg border border-violet-300 bg-violet-50 text-violet-700 text-sm font-medium disabled:opacity-50" title="선택 리드의 개인화 제안 초안을 AI 로 일괄 생성(10명씩 순차) — 발송은 사람이 검토 후 직접">
              {drafting ? (draftProgress || '초안 생성 중…') : `✍ 선택 초안 생성${selected.size ? ` (${selected.size})` : ''}`}
            </button>
            <SendModeButtons leads={leads} selectedIds={selected} platform={platform} onReach={l => reachOut(l as unknown as Lead)} />
            <ConsentedSendPanel />
            <ColdSendPanel />
            <ExcelExportButtons variant="contactable" />
            <MarkContactedPanel />
          </div>
        </details>

        <KeywordManager keywords={keywords} onChanged={loadMeta} />{/* 키워드 관리 — influencer-pool/ 추출(600줄 캡) */}

        {/* 필터 — 입력 UI 는 `influencer-pool/PoolFilters` 로 분리(페이지 600줄 캡). 상태는 여기 유지. */}
        <PoolFilters
          platform={platform} setPlatform={setPlatform}
          category={category} setCategory={setCategory}
          region={region} setRegion={setRegion}
          tier={tier} setTier={setTier}
          sort={sort} setSort={setSort}
          hasEmail={hasEmail} setHasEmail={setHasEmail}
          hasInstagram={hasInstagram} setHasInstagram={setHasInstagram}
          hasContact={hasContact} setHasContact={setHasContact}
          catSource={catSource} setCatSource={setCatSource}
          measured={measured} setMeasured={setMeasured}
          optedOutOnly={optedOutOnly} setOptedOutOnly={setOptedOutOnly}
          hideNoise={hideNoise} setHideNoise={setHideNoise}
          brandOnly={brandOnly} setBrandOnly={setBrandOnly}
          inboundOnly={inboundOnly} setInboundOnly={setInboundOnly}
          q={q} setQ={setQ}
          matchRegion={matchRegion} setMatchRegion={setMatchRegion}
          matchLoading={matchLoading} onSellerMatch={loadSellerMatch}
        />

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
                      <LeadNameCell lead={l} platformLabel={PLATFORM_LABEL} />
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700">
                      {l.platform === 'naver_blog' ? (
                        <span className="inline-flex flex-col items-end text-gray-400">
                          <span>{l.subscriber_count > 0 ? `이웃 ${formatNumber(l.subscriber_count)}` : '블로그'}{l.recent_posts_30d != null ? ` · 月${l.recent_posts_30d}글` : ''}</span>
                          {(() => { if (!l.last_post_at) return null; const d = Math.floor((Date.now() - new Date(l.last_post_at).getTime()) / 86400000); if (!Number.isFinite(d) || d < 0) return null; return <span className={`text-[11px] ${d <= 7 ? 'text-emerald-600' : d <= 30 ? 'text-gray-400' : 'text-gray-300'}`} title="마지막 글 날짜(검색/RSS 기준)">✍ {d === 0 ? '오늘' : `${d}일 전`} 글</span> })()}
                        </span>
                      ) : l.platform === 'tistory' ? <span className="text-gray-400">티스토리 · 글{formatNumber(l.video_count)}</span> : l.platform === 'naver_cafe' ? <span className="text-gray-400">카페 · 글{formatNumber(l.video_count)}</span> : (
                        <span className="inline-flex flex-col items-end">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            {formatNumber(l.subscriber_count)}
                            {(() => { const s = l.subscriber_count; const b = s >= 500000 ? { t: '대형', c: 'bg-gray-100 text-gray-500' } : s >= 100000 ? { t: '중형', c: 'bg-emerald-100 text-emerald-700' } : s >= 10000 ? { t: '마이크로', c: 'bg-emerald-100 text-emerald-700' } : s > 0 ? { t: '나노', c: 'bg-gray-100 text-gray-500' } : null; return b ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${b.c}`}>{b.t}</span> : null })()}
                          </span>
                          {l.median_long_views ? (
                            <span className="text-[11px] text-gray-400" title="최근 영상 중 롱폼(3분 초과)만의 중앙값 — 쇼츠 조회수 착시를 배제한 실제 도달력(협찬 단가 판단용)">📈 롱폼중앙 {formatNumber(l.median_long_views)}회{l.shorts_ratio ? <span className="text-gray-300"> · 쇼츠 {l.shorts_ratio}%</span> : null}</span>
                          ) : l.recent_avg_views != null ? (
                            <span className="text-[11px] text-gray-400" title="최근 영상 ≤10개 평균(쇼츠 포함 — 롱폼 중앙값은 다음 성과 측정에서 채워짐)">📈 평균 {formatNumber(l.recent_avg_views)}회{l.recent_avg_comments ? ` · 💬${formatNumber(l.recent_avg_comments)}` : ''}</span>
                          ) : null}
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
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {l.category || '—'}
                      {/* 🏷️ 값만 보여주면 그게 확인된 건지 물려받은 건지 알 수 없다 — 실측 84%가 상속값이다. */}
                      {l.category && l.category_source !== 'content' && (
                        <span className="ml-1 text-amber-600" title="발굴 키워드에서 물려받은 값 — 본문으로 확인되지 않았다">⚠️</span>
                      )}
                      {!l.perf_checked_at && (
                        <span className="ml-1 text-gray-400" title="아직 한 번도 측정하지 않음 — 연락처·본문분류가 비어 있는 게 정상이다">⏳</span>
                      )}
                    </td>
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
                      {!l.consented_at && <span className="mr-2"><RecruitButton leadId={l.id} name={l.name} hasEmail={!!l.email} /></span>}<span className="mr-2"><TrackLinkButton leadId={l.id} /></span><button onClick={() => setFollowUp(l)} className="text-xs text-gray-400 hover:text-amber-600 mr-2" title="팔로업 예정일">⏰</button>
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
      </div>
    </AdminLayout>
  )
}
