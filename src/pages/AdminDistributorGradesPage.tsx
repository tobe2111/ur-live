import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Layers, Save, Loader2, Search, Tag, Percent, Sparkles, Receipt, Plus, X, Wallet, Snowflake, BadgeDollarSign, TrendingUp, Play, RotateCcw } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon, formatNumber } from '@/utils/format'
import { SUPPLY_CHANNELS, DEFAULT_SUPPLY_CHANNEL_THRESHOLDS, type SupplyChannelThresholds } from '@/shared/supply-channels'
import { GRADE_NAME } from '@/pages/wholesale/wholesale-theme'
import AdminDistributorApprovalPage from '@/pages/admin/AdminDistributorApprovalPage'

// 🏅 등급 코드(A/B/C…) + 친화 라벨(Premium/Standard/Basic) 동시 표기 — 운영자 혼동 방지.
const gradeLabel = (g: string) => { const n = GRADE_NAME[g]; return n && n !== g ? `${g} · ${n}` : g }

// 🏭 2026-06-01 유통스타트 도매몰 — 판매사 등급/마진 설정 (Phase 1b).
// 도매몰 한정: distributor_grade 는 도매 카탈로그 가격 계산에서만 쓰임.

interface GradeRow {
  grade: string
  label: string | null
  margin_pct: number
  sort_order: number
  is_special: number
  active: number
}
interface DistributorRow {
  id: number
  username: string | null
  name: string | null
  business_name: string | null
  email: string | null
  seller_type: string | null
  distributor_grade: string | null
  special_discount_until: string | null
}

// 🏭 BIZ-2 v1 여신/외상.
interface CreditDetail {
  id: number; business_name: string | null; name: string | null; username: string | null; status: string | null
  limit: number; outstanding: number; available: number; frozen: number
}
interface LedgerRow {
  id: number; order_id: number | null; type: string; amount: number; balance_after: number; memo: string | null; created_at: string
}

// 🏭 BIZ-7 자동등급 임계값 — GMV 가 min_gmv 이상이면 그 등급으로 승급(promote-only).
interface AutoGradeThreshold { grade: string; min_gmv: number }
const AUTO_GRADE_GRADES = ['A', 'B', 'C', 'D']

const ASSIGNABLE = ['A', 'B', 'C', 'D', 'OEM']

// 🗂️ 2026-06-17: 1,170줄 단일 페이지를 4개 탭(딥링크 라우트)으로 분리 — 머니 로직 무변경(섹션 그룹만 탭 조건부 렌더).
//   각 탭은 자기 데이터만 로드(useApiQuery enabled 게이트) → 가벼워짐. 사이드바 4개 항목 → 각 탭 라우트.
// 🏭 2026-06-29 (대표 — 판매사 승인 통합): 승인을 '판매사 관리' 첫 탭으로 흡수(별도 nav 항목 제거).
type DistTab = 'approval' | 'grades' | 'credit' | 'tax' | 'supply'
const DIST_TABS: { key: DistTab; path: string; label: string }[] = [
  { key: 'approval', path: '/admin/distributor-approval', label: '승인' },
  { key: 'grades', path: '/admin/distributor-grades', label: '등급·마진' },
  { key: 'credit', path: '/admin/distributor-credit', label: '여신·외상' },
  { key: 'tax', path: '/admin/distributor-tax', label: '제안·세금' },
  { key: 'supply', path: '/admin/distributor-supply', label: '공급가·채널·OEM' },
]
function tabFromPath(p: string): DistTab {
  if (p.includes('distributor-approval')) return 'approval'
  if (p.includes('distributor-credit')) return 'credit'
  if (p.includes('distributor-tax')) return 'tax'
  if (p.includes('distributor-supply')) return 'supply'
  return 'grades'
}

export default function AdminDistributorGradesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tab = tabFromPath(location.pathname)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const [grades, setGrades] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingGrade, setSavingGrade] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [distributors, setDistributors] = useState<DistributorRow[]>([])
  const [searching, setSearching] = useState(false)
  const [savingDist, setSavingDist] = useState<number | null>(null)

  // 상품제안
  const [propSeller, setPropSeller] = useState('')
  const [propProduct, setPropProduct] = useState('')
  const [propNote, setPropNote] = useState('')
  const [propBusy, setPropBusy] = useState(false)
  // 🛡️ 2026-06-03 Tier2(대시보드): proposals 리스트 → useApiQuery (grades/distributors 는 인라인 편집 명령형 유지).
  const proposalsQ = useApiQuery<Array<{ id: number; distributor_seller_id: number; product_name: string; product_id: number; note: string | null }>>(
    ['admin', 'distributor-proposals'], '/api/admin/distributor/proposals',
    { enabled: tab === 'tax', headers: h.headers, select: (r: any) => (r?.success ? r.proposals || [] : []) },
  )
  const proposals = proposalsQ.data ?? []

  // 세금 집계
  const [taxMonth, setTaxMonth] = useState(new Date().toISOString().slice(0, 7))
  const [taxData, setTaxData] = useState<{ by_distributor: Array<Record<string, unknown>>; by_supplier: Array<Record<string, unknown>> } | null>(null)
  const [taxLoading, setTaxLoading] = useState(false)

  // 🛡️ 2026-06-03 OEM/ODM 신청 관리 + 세금계산서 발행 + 유통채널 선정.
  const [oemStatus, setOemStatus] = useState('')
  const oemQ = useApiQuery<Array<Record<string, any>>>(
    ['admin', 'dist-oem', oemStatus], '/api/admin/distributor/oem-requests',
    { enabled: tab === 'supply', params: oemStatus ? { status: oemStatus } : {}, headers: h.headers, select: (r: any) => (r?.success ? r.requests || [] : []) },
  )
  const taxDocsQ = useApiQuery<Array<Record<string, any>>>(
    ['admin', 'dist-taxdocs', taxMonth], '/api/admin/distributor/tax-documents',
    { enabled: tab === 'tax', params: { month: taxMonth }, headers: h.headers, select: (r: any) => (r?.success ? r.documents || [] : []) },
  )
  const [issuing, setIssuing] = useState(false)
  // 유통채널 선정(product-access)
  const [accessProductId, setAccessProductId] = useState('')
  const [accessProductQuery, setAccessProductQuery] = useState('')
  const accessQ = useApiQuery<{ product: any; distributors: Array<Record<string, any>>; visible_grades: string[]; all_grades: Array<{ grade: string; label: string | null }> } | null>(
    ['admin', 'dist-access', accessProductQuery], '/api/admin/distributor/product-access',
    { params: accessProductQuery ? { product_id: accessProductQuery } : {}, enabled: !!accessProductQuery && tab === 'supply', headers: h.headers, select: (r: any) => (r?.success ? { product: r.product, distributors: r.distributors || [], visible_grades: r.visible_grades || [], all_grades: r.all_grades || [] } : null) },
  )
  const [accessSeller, setAccessSeller] = useState('')
  // 🏷️ 2026-06-18 상품별 노출 등급 — 조회 결과 visible_grades 를 편집 후 저장(빈 = 전체 노출).
  const [editGrades, setEditGrades] = useState<string[] | null>(null)
  const effGrades = editGrades ?? accessQ.data?.visible_grades ?? []
  const toggleGrade = (g: string) => setEditGrades(prev => {
    const base = prev ?? accessQ.data?.visible_grades ?? []
    return base.includes(g) ? base.filter(x => x !== g) : [...base, g]
  })
  const saveVisibleGrades = async () => {
    const pid = Number(accessQ.data?.product?.id || accessProductQuery)
    if (!Number.isFinite(pid) || pid <= 0) return
    try {
      const r = await api.patch(`/api/admin/distributor/products/${pid}/visible-grades`, { visible_grades: effGrades }, h)
      if (r.data?.success) { toast.success(effGrades.length ? `노출 등급: ${effGrades.join(', ')}` : '전체 노출로 변경'); setEditGrades(null); accessQ.refetch() }
      else toast.error('노출 등급 저장 실패')
    } catch { toast.error('노출 등급 저장 실패') }
  }
  // 🏭 2026-06-04 상품별 등급마진 override(특가) — 설정 시 등급 무관 동일가.
  const [marginProductId, setMarginProductId] = useState('')
  const [marginPct, setMarginPct] = useState('')
  const [marginBusy, setMarginBusy] = useState(false)
  // 🏭 2026-06-04 수량 구간 할인(volume tier) — "수량:할인%" 쌍.
  const [tierText, setTierText] = useState('')
  const [tierBusy, setTierBusy] = useState(false)
  // 🏭 2026-06-04 플랫폼 사업자정보(전자세금계산서 발행 전제) — platform_settings.
  const [company, setCompany] = useState<Record<string, string>>({})
  const [companyBusy, setCompanyBusy] = useState(false)

  // 🏭 BIZ-2 v1 여신/외상 관리 — 판매사 한도/미수금/동결 + 상환.
  const [creditSellerId, setCreditSellerId] = useState('')
  const [creditData, setCreditData] = useState<{ credit: CreditDetail; ledger: LedgerRow[] } | null>(null)
  const [creditBusy, setCreditBusy] = useState(false)
  const [creditLimitInput, setCreditLimitInput] = useState('')
  const [repayInput, setRepayInput] = useState('')
  const [repayMemo, setRepayMemo] = useState('')

  // 🏭 BIZ-7 (2026-06-08) 등급 자동화 (GMV 기반 auto-grade) — cron(wholesale-grade-eval) 설정 + 수동 실행.
  const [agEnabled, setAgEnabled] = useState(false)
  const [agThresholds, setAgThresholds] = useState<AutoGradeThreshold[]>([])
  const [agWindowDays, setAgWindowDays] = useState(90)
  // 🏅 프로 멤버십 연 구독료(원) — 판매사가 예치금에서 결제(PG 미사용).
  const [agPlusFee, setAgPlusFee] = useState(1000000)
  // 🆕 2026-06-16 플랫폼 수수료율(%) — 공급가에 포함된 플랫폼 마진. 제조사=공급가×(1−이값)(원가 하한).
  const [agCommPct, setAgCommPct] = useState(10)
  const [agLastRun, setAgLastRun] = useState<string | null>(null)
  const [agLoading, setAgLoading] = useState(true)
  const [agSaving, setAgSaving] = useState(false)
  const [agRunning, setAgRunning] = useState(false)

  const loadAutoGrade = useCallback(() => {
    setAgLoading(true)
    api.get('/api/admin/distributor/auto-grade/settings', h)
      .then(r => {
        if (r.data?.success) {
          setAgEnabled(!!r.data.enabled)
          setAgThresholds(Array.isArray(r.data.thresholds) ? r.data.thresholds : [])
          setAgWindowDays(Number(r.data.window_days) || 90)
          setAgPlusFee(Number(r.data.plus_annual_fee) || 1000000)
          setAgCommPct(Number.isFinite(Number(r.data.platform_commission_pct)) ? Number(r.data.platform_commission_pct) : 10)
          setAgLastRun(r.data.last_run ?? null)
        }
      })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setAgLoading(false))
  }, [])

  const loadCredit = useCallback((id: string) => {
    const sid = Number(id)
    if (!Number.isFinite(sid) || sid <= 0) { toast.error('판매사 ID를 입력하세요'); return }
    setCreditData(null) // 🛡️ 2026-06-25: 새 ID 재조회 전 이전 판매사 데이터 초기화 — 조회 실패 시 잔존(ID 불일치) 방지.
    setCreditBusy(true)
    api.get(`/api/admin/distributor/distributors/${sid}/credit`, h)
      .then(r => {
        if (r.data?.success) {
          setCreditData({ credit: r.data.credit, ledger: r.data.ledger || [] })
          setCreditLimitInput(String(r.data.credit.limit ?? 0))
        } else toast.error(r.data?.error || '조회 실패')
      })
      .catch((e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '조회 실패'))
      .finally(() => setCreditBusy(false))
  }, [])

  async function saveCreditLimit() {
    const sid = Number(creditSellerId)
    const lim = Number(creditLimitInput)
    if (!Number.isFinite(sid) || sid <= 0) { toast.error('판매사 ID를 입력하세요'); return }
    if (!Number.isFinite(lim) || lim < 0) { toast.error('여신 한도는 0 이상이어야 합니다'); return }
    setCreditBusy(true)
    try {
      const r = await api.patch(`/api/admin/distributor/distributors/${sid}/credit`, { distributor_credit_limit: Math.floor(lim) }, h)
      if (r.data?.success) { toast.success(`여신 한도 ${Math.floor(lim).toLocaleString('ko-KR')}원 저장`); loadCredit(creditSellerId) }
      else toast.error(r.data?.error || '저장 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장 실패') } finally { setCreditBusy(false) }
  }
  async function toggleFreeze(frozen: boolean) {
    const sid = Number(creditSellerId)
    if (!Number.isFinite(sid) || sid <= 0) return
    setCreditBusy(true)
    try {
      const r = await api.patch(`/api/admin/distributor/distributors/${sid}/credit`, { credit_frozen: frozen }, h)
      if (r.data?.success) { toast.success(frozen ? '여신 동결됨' : '여신 동결 해제됨'); loadCredit(creditSellerId) }
      else toast.error(r.data?.error || '처리 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '처리 실패') } finally { setCreditBusy(false) }
  }
  async function recordRepayment() {
    const sid = Number(creditSellerId)
    const amt = Number(repayInput)
    if (!Number.isFinite(sid) || sid <= 0) { toast.error('판매사 ID를 입력하세요'); return }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('상환 금액을 입력하세요'); return }
    setCreditBusy(true)
    try {
      const r = await api.post(`/api/admin/distributor/distributors/${sid}/credit-repayment`, { amount: Math.floor(amt), memo: repayMemo }, h)
      if (r.data?.success) { toast.success(`상환 ${Number(r.data.repaid).toLocaleString('ko-KR')}원 기록 — 미수금 ${Number(r.data.outstanding).toLocaleString('ko-KR')}원`); setRepayInput(''); setRepayMemo(''); loadCredit(creditSellerId) }
      else toast.error(r.data?.error || '상환 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '상환 실패') } finally { setCreditBusy(false) }
  }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    api.get('/api/admin/distributor/grades', h)
      .then(r => { if (r.data.success) setGrades(r.data.grades || []) })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setLoading(false))
    api.get('/api/admin/distributor/company-info', h)
      .then(r => { if (r.data.success) setCompany(r.data.company || {}) })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
    loadAutoGrade()
  }, [loadAutoGrade])

  // 🏭 BIZ-7 자동등급 핸들러 ──────────────────────────────────────────────────
  function updateThreshold(idx: number, field: 'grade' | 'min_gmv', value: string) {
    setAgThresholds(prev => prev.map((t, i) => i === idx
      ? { ...t, [field]: field === 'min_gmv' ? Math.max(0, Math.floor(Number(value) || 0)) : value }
      : t))
  }
  function addThreshold() {
    const used = new Set(agThresholds.map(t => t.grade))
    const next = AUTO_GRADE_GRADES.find(g => !used.has(g)) || 'A'
    setAgThresholds(prev => [...prev, { grade: next, min_gmv: 0 }])
  }
  function removeThreshold(idx: number) {
    setAgThresholds(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveAutoGrade() {
    // 클라 1차 검증 — 중복 등급 / 빈 임계값 방지 (서버도 재검증).
    const seen = new Set<string>()
    for (const t of agThresholds) {
      if (!AUTO_GRADE_GRADES.includes(t.grade)) { toast.error('등급은 A/B/C/D 만 가능합니다'); return }
      if (seen.has(t.grade)) { toast.error(`등급 ${t.grade} 가 중복되었습니다`); return }
      if (!Number.isFinite(t.min_gmv) || t.min_gmv < 0) { toast.error(`${t.grade}등급 최소 GMV 값이 올바르지 않습니다`); return }
      seen.add(t.grade)
    }
    if (agThresholds.length === 0) { toast.error('최소 1개 이상의 등급 임계값이 필요합니다'); return }
    if (!Number.isFinite(agWindowDays) || agWindowDays < 1 || agWindowDays > 365) { toast.error('집계 기간은 1~365일이어야 합니다'); return }
    if (!Number.isFinite(agPlusFee) || agPlusFee < 1000 || agPlusFee > 10_000_000) { toast.error('프로 연 구독료는 1,000원 ~ 1,000만원이어야 합니다'); return }
    if (!Number.isFinite(agCommPct) || agCommPct < 0 || agCommPct > 90) { toast.error('플랫폼 수수료율은 0~90% 사이여야 합니다'); return }
    setAgSaving(true)
    try {
      const r = await api.patch('/api/admin/distributor/auto-grade/settings', {
        enabled: agEnabled,
        thresholds: agThresholds,
        window_days: agWindowDays,
        plus_annual_fee: agPlusFee,
        platform_commission_pct: agCommPct,
      }, h)
      if (r.data?.success) { toast.success('자동등급 설정 저장됨'); loadAutoGrade() }
      else toast.error(r.data?.error || '저장 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장 실패')
    } finally { setAgSaving(false) }
  }

  async function runAutoGradeNow() {
    if (!(await confirmDialog({ message: '지금 전체 판매사 등급을 평가하시겠습니까? (승급만 적용 — 강등 없음)' }))) return
    setAgRunning(true)
    try {
      const r = await api.post('/api/admin/distributor/auto-grade/run', {}, h)
      if (r.data?.success) {
        toast.success(`평가 완료 — ${formatNumber(r.data.evaluated)}곳 평가, ${formatNumber(r.data.promoted)}곳 승급`)
        loadAutoGrade()
      } else toast.error(r.data?.error || '실행 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '실행 실패')
    } finally { setAgRunning(false) }
  }

  async function saveCompany() {
    setCompanyBusy(true)
    try {
      const r = await api.put('/api/admin/distributor/company-info', company, h)
      if (r.data?.success) toast.success('사업자정보 저장됨 — 전자세금계산서 발행에 사용됩니다')
      else toast.error('저장 실패')
    } catch { toast.error('저장 중 오류') } finally { setCompanyBusy(false) }
  }

  const loadDistributors = useCallback((q: string, assignedOnly = false) => {
    setSearching(true)
    const params = new URLSearchParams()
    if (q) params.set('search', q)
    if (assignedOnly) params.set('assigned', '1')
    api.get(`/api/admin/distributor/distributors?${params.toString()}`, h)
      .then(r => { if (r.data.success) setDistributors(r.data.distributors || []) })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setSearching(false))
  }, [])

  useEffect(() => { loadDistributors('', true) }, [loadDistributors])

  function updateGradeField(grade: string, field: 'margin_pct' | 'label' | 'active', value: number | string | boolean) {
    setGrades(prev => prev.map(g => g.grade === grade ? { ...g, [field]: field === 'active' ? (value ? 1 : 0) : value } as GradeRow : g))
  }

  async function saveGrade(g: GradeRow) {
    if (!Number.isFinite(g.margin_pct) || g.margin_pct < 0 || g.margin_pct > 100) {
      toast.error('마진율은 0~100% 사이여야 합니다'); return
    }
    setSavingGrade(g.grade)
    try {
      const r = await api.put(`/api/admin/distributor/grades/${g.grade}`, {
        margin_pct: g.margin_pct, label: g.label, active: g.active === 1,
      }, h)
      if (r.data.success) toast.success(`${g.grade} 등급 저장됨`)
      else toast.error(r.data.error || '저장 실패')
    } catch { toast.error('저장 중 오류') } finally { setSavingGrade(null) }
  }

  async function saveDistributor(d: DistributorRow, grade: string | null, special: string | null) {
    setSavingDist(d.id)
    try {
      const r = await api.patch(`/api/admin/distributor/distributors/${d.id}`, {
        distributor_grade: grade, special_discount_until: special,
      }, h)
      if (r.data.success) {
        toast.success('판매사 등급 저장됨')
        setDistributors(prev => prev.map(x => x.id === d.id ? { ...x, distributor_grade: grade, special_discount_until: special } : x))
      } else toast.error(r.data.error || '저장 실패')
    } catch { toast.error('저장 중 오류') } finally { setSavingDist(null) }
  }

  const loadProposals = useCallback(() => { proposalsQ.refetch() }, [proposalsQ])

  async function createProposal() {
    const sid = Number(propSeller), pid = Number(propProduct)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(pid) || pid <= 0) { toast.error('판매사 ID와 상품 ID를 입력하세요'); return }
    setPropBusy(true)
    try {
      const r = await api.post('/api/admin/distributor/proposals', { distributor_seller_id: sid, product_id: pid, note: propNote }, h)
      if (r.data.success) { toast.success('제안 생성됨'); setPropProduct(''); setPropNote(''); loadProposals() }
      else toast.error(r.data.error || '실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류') } finally { setPropBusy(false) }
  }
  async function withdrawProposal(id: number) {
    try { await api.delete(`/api/admin/distributor/proposals/${id}`, h); loadProposals() } catch { toast.error('철회 실패') }
  }
  function loadTax() {
    setTaxLoading(true)
    api.get(`/api/admin/distributor/tax-summary?month=${taxMonth}`, h)
      .then(r => { if (r.data.success) setTaxData({ by_distributor: r.data.by_distributor || [], by_supplier: r.data.by_supplier || [] }) })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setTaxLoading(false))
  }

  async function updateOem(id: number, patch: Record<string, unknown>) {
    try { await api.patch(`/api/admin/distributor/oem-requests/${id}`, patch, h); oemQ.refetch() }
    catch { toast.error('처리 실패') }
  }
  async function issueTaxDocs(docType: 'tax_invoice' | 'transaction_statement') {
    setIssuing(true)
    try {
      const r = await api.post('/api/admin/distributor/tax-documents/issue', { month: taxMonth, doc_type: docType }, h)
      if (r.data?.success) { toast.success(`${r.data.issued}건 발행됨`); taxDocsQ.refetch() }
      else toast.error(r.data?.error || '발행 실패')
    } catch { toast.error('발행 실패') } finally { setIssuing(false) }
  }
  async function issueNts(id: number) {
    try {
      const r = await api.post(`/api/admin/distributor/tax-documents/${id}/issue-nts`, {}, h)
      if (r.data?.success) { toast.success(r.data.already ? '이미 발행됨' : `전자세금계산서 발행 완료 (승인번호 ${r.data.nts_confirm_num || '-'})`); taxDocsQ.refetch() }
      else toast.error(r.data?.error || '발행 실패')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; needs_config?: boolean } } }
      toast.error(err?.response?.data?.error || '전자세금계산서 발행 실패')
    }
  }
  function openTaxDoc(id: number) {
    const token = localStorage.getItem('admin_token')
    // 인증 헤더로 HTML 받아 새 창에 렌더(직접 링크는 토큰 미첨부).
    fetch(`/api/admin/distributor/tax-documents/${id}/html`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.ok ? res.text() : Promise.reject(new Error('문서 로드 실패')))
      .then(html => { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() } })
      .catch(() => toast.error('문서를 열 수 없습니다'))
  }
  async function grantAccess() {
    const pid = Number(accessProductId), sid = Number(accessSeller)
    if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(sid) || sid <= 0) { toast.error('상품 ID와 판매사 ID를 입력하세요'); return }
    try {
      await api.post('/api/admin/distributor/product-access', { product_id: pid, distributor_seller_id: sid }, h)
      toast.success('판매사 선정됨'); setAccessProductQuery(String(pid)); setAccessSeller(''); accessQ.refetch()
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '선정 실패') }
  }
  async function revokeAccess(id: number) {
    try { await api.delete(`/api/admin/distributor/product-access/${id}`, h); accessQ.refetch() } catch { toast.error('해제 실패') }
  }
  async function setMarginOverride(clear: boolean) {
    const pid = Number(marginProductId)
    if (!Number.isFinite(pid) || pid <= 0) { toast.error('상품 ID를 입력하세요'); return }
    let pct: number | null = null
    if (!clear) {
      pct = Number(marginPct)
      if (!Number.isFinite(pct) || pct < 0 || pct > 500) { toast.error('마진율은 0~500(%) 사이여야 합니다'); return }
    }
    setMarginBusy(true)
    try {
      const r = await api.patch(`/api/admin/distributor/products/${pid}/margin-override`, { margin_pct: clear ? null : pct }, h)
      if (r.data?.success) { toast.success(clear ? `상품#${pid} 특가 해제 (등급마진 복귀)` : `상품#${pid} 마진 ${pct}% 고정`); if (clear) setMarginPct('') }
      else toast.error(r.data?.error || '설정 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '설정 실패') } finally { setMarginBusy(false) }
  }
  async function saveTiers(clear: boolean) {
    const pid = Number(marginProductId)
    if (!Number.isFinite(pid) || pid <= 0) { toast.error('상품 ID를 입력하세요'); return }
    const tiers: { min_qty: number; discount_pct: number }[] = []
    if (!clear) {
      for (const part of tierText.split(',').map(s => s.trim()).filter(Boolean)) {
        const [mqS, dpS] = part.split(':')
        const mq = Number((mqS || '').trim()), dp = Number((dpS || '').trim())
        if (!Number.isFinite(mq) || !Number.isFinite(dp)) { toast.error('형식: 수량:할인%  예) 100:5, 500:10'); return }
        tiers.push({ min_qty: mq, discount_pct: dp })
      }
    }
    setTierBusy(true)
    try {
      const r = await api.put(`/api/admin/distributor/products/${pid}/qty-tiers`, { tiers }, h)
      if (r.data?.success) { toast.success(tiers.length ? `상품#${pid} 수량구간 ${tiers.length}개 저장` : `상품#${pid} 수량구간 해제`); if (clear) setTierText('') }
      else toast.error(r.data?.error || '저장 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '저장 실패') } finally { setTierBusy(false) }
  }
  function exportProducts() {
    const token = localStorage.getItem('admin_token')
    fetch('/api/admin/distributor/products/export', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(res => res.ok ? res.blob() : Promise.reject(new Error('다운로드 실패')))
      .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `supply-products-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); URL.revokeObjectURL(url) })
      .catch(() => toast.error('상품 내보내기 실패'))
  }

  // 🗂️ 2026-06-17: 데모 상품 시딩 함수는 '상품 일괄 등록'(AdminWholesaleImportPage)으로 일원화 — 여기서 제거(중복).

  if (loading) return <AdminLayout title="판매사 관리"><DashboardLoading /></AdminLayout>

  return (
    <AdminLayout title="판매사 관리">
      <div className="ur-content-full px-4 lg:px-8 py-6 space-y-8">
        <DashboardPageHeader
          icon={<Layers className="w-5 h-5" />}
          title={`판매사 · ${DIST_TABS.find(t => t.key === tab)?.label ?? '등급·마진'}`}
          subtitle="유통스타트 도매몰 — 등급/여신/세금/공급가를 탭으로 나눠 관리합니다. (도매 카탈로그 가격에만 적용)"
        />

        {/* 🗂️ 2026-06-17 데모 상품 시딩은 '상품 일괄 등록'(/admin/wholesale-import)으로 일원화(중복 제거). */}

        {/* 🗂️ 탭 — 딥링크 라우트로 분리 (사이드바 4개 항목과 정합) */}
        <div className="flex flex-wrap gap-1.5 border-b border-gray-200">
          {DIST_TABS.map((tb) => (
            <button key={tb.key} type="button" onClick={() => navigate(tb.path)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg -mb-px border-b-2 transition-colors ${tab === tb.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
              {tb.label}
            </button>
          ))}
        </div>

        {/* 🏭 2026-06-29 (대표 — 승인 통합): '승인' 탭 = 판매사 가입 승인 패널(embedded — 자체 AdminLayout 생략). */}
        {tab === 'approval' && <div className="pt-5"><AdminDistributorApprovalPage embedded /></div>}

        {tab === 'grades' && (<>
        {/* ── 등급별 마진율 ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Percent className="w-4 h-4 text-gray-500" /> 등급별 마진율
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            판매사 공급가 = max(제조사 원가, 판매가 × (1 − 보장마진율)). 마진율 = <b>판매가 대비</b> 보장마진(고등급일수록 큼 = 더 낮은 공급가). 원가가 하한, 특별할인은 기간 한정 최고마진.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">등급</th>
                  <th className="py-2 pr-4 font-medium">라벨</th>
                  <th className="py-2 pr-4 font-medium">마진율 (%)</th>
                  <th className="py-2 pr-4 font-medium">예시(공급가 10,000원)</th>
                  <th className="py-2 pr-4 font-medium">활성</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {grades.map(g => (
                  <tr key={g.grade} className="border-b border-gray-50">
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${g.is_special ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-700'}`}>
                        <Tag className="w-3 h-3" />{g.grade}
                      </span>
                      {GRADE_NAME[g.grade] && GRADE_NAME[g.grade] !== g.grade && (
                        <span className="ml-1.5 text-[11px] text-gray-400">{GRADE_NAME[g.grade]}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="text" value={g.label ?? ''} maxLength={40}
                        onChange={e => updateGradeField(g.grade, 'label', e.target.value)}
                        className="w-32 px-2 py-1 border border-gray-200 rounded text-gray-900"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="number" min={0} max={100} step={0.1} value={g.margin_pct}
                        onChange={e => updateGradeField(g.grade, 'margin_pct', Number(e.target.value))}
                        className="w-24 px-2 py-1 border border-gray-200 rounded text-gray-900"
                      />
                    </td>
                    <td className="py-2 pr-4 text-gray-600 tabular-nums">
                      {Math.round(10000 * (1 + (g.margin_pct || 0) / 100)).toLocaleString('ko-KR')}원
                      <span className="text-gray-400"> (+{Math.round(10000 * (g.margin_pct || 0) / 100).toLocaleString('ko-KR')})</span>
                    </td>
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox" checked={g.active === 1}
                        onChange={e => updateGradeField(g.grade, 'active', e.target.checked)}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => saveGrade(g)} disabled={savingGrade === g.grade}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
                      >
                        {savingGrade === g.grade ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        저장
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 🏭 2026-06-12 (영업단 제안): 공급 채널 안내 기준 ── */}
        <ChannelThresholdsSection />

        {/* ── 🏭 BIZ-7 등급 자동화 (GMV 기반 auto-grade) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <TrendingUp className="w-4 h-4 text-indigo-600" /> 등급 자동화 (거래액 기반 자동 승급)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            판매사의 최근 거래액(GMV)이 임계값을 넘으면 매주 자동으로 <b>상위 등급으로 승급</b>합니다.
            안전을 위해 <b>승급만</b> 자동 적용되고, 강등은 위 &ldquo;판매사 등급 배정&rdquo;에서 수동으로만 가능합니다.
            (가격 산식은 변경되지 않고, 등급만 자동 설정됩니다.)
          </p>

          {agLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> 설정 불러오는 중…</div>
          ) : (
            <div className="space-y-5">
              {/* enable 토글 + 마지막 실행 */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={agEnabled} onChange={e => setAgEnabled(e.target.checked)} className="w-4 h-4" />
                  <span className="text-sm font-semibold text-gray-900">자동 승급 활성화</span>
                </label>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${agEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {agEnabled ? 'ON — 매주 월요일 자동 평가' : 'OFF — 자동 평가 안 함'}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  마지막 실행: <b className="text-gray-600">{agLastRun ? agLastRun.slice(0, 16).replace('T', ' ') : '없음'}</b>
                </span>
              </div>

              {/* 집계 기간 + 🏅 프로 연 구독료 */}
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">집계 기간 (최근 N일 거래액)</label>
                  <div className="relative">
                    <input type="number" min={1} max={365} value={agWindowDays}
                      onChange={e => setAgWindowDays(Math.max(1, Math.min(365, Math.floor(Number(e.target.value) || 0))))}
                      className="w-28 pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-gray-900" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">일</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">🏅 프로 연 구독료 (예치금 결제)</label>
                  <div className="relative">
                    <input type="number" min={1000} max={10000000} step={1000} value={agPlusFee}
                      onChange={e => setAgPlusFee(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className="w-40 pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-gray-900" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">💰 기본 플랫폼 마진율 (제조사가 위에 가산)</label>
                  <div className="relative">
                    <input type="number" min={0} max={90} step={0.5} value={agCommPct}
                      onChange={e => setAgCommPct(Math.max(0, Math.min(90, Number(e.target.value) || 0)))}
                      className="w-28 pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-gray-900" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">Standard(B)는 판매사가 연 구독료를 <b>예치금에서 결제</b>해 1년간 적용(PG 미사용). Premium(A)은 위 매출 임계 자동 승급. Basic(C)은 가입 승인 기본.</p>
              <p className="text-xs text-gray-400">💰 <b>기본 플랫폼 마진율</b>: 제조사가 받을 금액(공급원가) <b>위에</b> 붙이는 기본 마진(%). 공급가 = 공급원가 × (1 + 이 값), 제조사 정산 = 공급원가 전액, 플랫폼 = 공급가 − 공급원가. 예) 마진 10% · 공급원가 10,000 → 공급가 11,000 / 제조사 10,000 / 플랫폼 1,000. <b>상품별로</b> 다르게(스프레드 큰 상품은 더 높게) 설정 가능하며, 고등급(Standard/Premium) 판매사는 마진을 낮춰 더 싸게 공급합니다.</p>

              {/* 임계값 테이블 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">등급별 최소 거래액 (GMV)</h3>
                  <button onClick={addThreshold} className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 text-gray-700 rounded text-xs font-medium hover:bg-gray-50">
                    <Plus className="w-3.5 h-3.5" /> 구간 추가
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-2">최근 {formatNumber(agWindowDays)}일 거래액이 해당 금액 이상이면 그 등급으로 승급됩니다. (D등급은 보통 0원 = 기본)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="py-2 pr-4 font-medium">등급</th>
                        <th className="py-2 pr-4 font-medium">최소 거래액 (원)</th>
                        <th className="py-2 pr-4 font-medium">표시</th>
                        <th className="py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {agThresholds.length === 0 ? (
                        <tr><td colSpan={4} className="py-3 text-gray-400 text-center">구간이 없습니다. &ldquo;구간 추가&rdquo;로 등록하세요.</td></tr>
                      ) : agThresholds.map((t, idx) => (
                        <tr key={idx} className="border-b border-gray-50">
                          <td className="py-2 pr-4">
                            <select value={t.grade} onChange={e => updateThreshold(idx, 'grade', e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-gray-900">
                              {AUTO_GRADE_GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            <input type="number" min={0} step={1000000} value={t.min_gmv}
                              onChange={e => updateThreshold(idx, 'min_gmv', e.target.value)}
                              className="w-40 px-2 py-1 border border-gray-200 rounded text-gray-900 tabular-nums" />
                          </td>
                          <td className="py-2 pr-4 text-gray-600 tabular-nums">{formatWon(t.min_gmv)}</td>
                          <td className="py-2">
                            <button onClick={() => removeThreshold(idx)} className="text-gray-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 액션 */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                <button onClick={saveAutoGrade} disabled={agSaving} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {agSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 설정 저장
                </button>
                <button onClick={runAutoGradeNow} disabled={agRunning} className="inline-flex items-center gap-1 px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50">
                  {agRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 지금 평가 실행
                </button>
                <button onClick={loadAutoGrade} disabled={agLoading} className="inline-flex items-center gap-1 px-3 py-2 text-gray-500 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                  <RotateCcw className="w-4 h-4" /> 새로고침
                </button>
                <span className="text-[11px] text-gray-400 ml-auto">&ldquo;지금 실행&rdquo;은 활성화 OFF 여도 강제 평가합니다 (승급만).</span>
              </div>
            </div>
          )}
        </section>

        {/* ── 판매사 등급 배정 ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Layers className="w-4 h-4 text-gray-500" /> 판매사 등급 배정
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            가입한 판매사(셀러)에 등급을 매기고, 필요 시 특별할인 종료일을 지정하면 그 기간엔 SPECIAL 등급가가 적용됩니다.
          </p>
          <form
            onSubmit={e => { e.preventDefault(); loadDistributors(search) }}
            className="flex gap-2 mb-4"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="판매사 검색 (아이디 / 이름 / 상호 / 이메일)"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-gray-900"
              />
            </div>
            <button type="submit" disabled={searching} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {searching ? '검색중…' : '검색'}
            </button>
            <button type="button" onClick={() => { setSearch(''); loadDistributors('', true) }} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              배정된 판매사
            </button>
          </form>

          {distributors.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">결과가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">판매사</th>
                    <th className="py-2 pr-4 font-medium">등급</th>
                    <th className="py-2 pr-4 font-medium">특별할인 종료일</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {distributors.map(d => (
                    <DistributorRowEditor key={d.id} row={d} saving={savingDist === d.id} onSave={saveDistributor} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>)}

        {tab === 'credit' && (<>
        {/* ── 여신/외상 관리 (BIZ-2 v1) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Wallet className="w-4 h-4 text-emerald-600" /> 여신 · 외상 관리
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            판매사에 <b>여신 한도</b>를 부여하면 도매 주문 시 선결제 대신 <b>외상(ON_CREDIT)</b>으로 주문할 수 있습니다.
            (가용 한도 = 한도 − 미수금. 연체 시 동결.) 한도 0 = 외상 불가(선결제 전용).
          </p>
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <input type="number" value={creditSellerId} onChange={e => setCreditSellerId(e.target.value)} placeholder="판매사 ID" className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={() => loadCredit(creditSellerId)} disabled={creditBusy} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">{creditBusy ? '처리중…' : '여신 조회'}</button>
          </div>

          {creditData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">판매사</div>
                  <div className="text-sm font-semibold text-gray-900 truncate">{creditData.credit.business_name || creditData.credit.name || `#${creditData.credit.id}`}</div>
                  <div className="text-[11px] text-gray-400">{creditData.credit.status || '-'}</div>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">여신 한도</div>
                  <div className="text-sm font-bold text-gray-900 tabular-nums">{Number(creditData.credit.limit).toLocaleString('ko-KR')}원</div>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">미수금</div>
                  <div className="text-sm font-bold text-rose-600 tabular-nums">{Number(creditData.credit.outstanding).toLocaleString('ko-KR')}원</div>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">가용 한도</div>
                  <div className="text-sm font-bold text-emerald-700 tabular-nums">{Number(creditData.credit.available).toLocaleString('ko-KR')}원</div>
                  {creditData.credit.frozen === 1 && <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-sky-700"><Snowflake className="w-3 h-3" />동결됨</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">여신 한도 설정</label>
                  <input type="number" min={0} value={creditLimitInput} onChange={e => setCreditLimitInput(e.target.value)} placeholder="한도(원)" className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
                </div>
                <button onClick={saveCreditLimit} disabled={creditBusy} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  <Save className="w-4 h-4" /> 한도 저장
                </button>
                {creditData.credit.frozen === 1 ? (
                  <button onClick={() => toggleFreeze(false)} disabled={creditBusy} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50">동결 해제</button>
                ) : (
                  <button onClick={() => toggleFreeze(true)} disabled={creditBusy} className="inline-flex items-center gap-1 px-4 py-2 border border-sky-300 text-sky-700 rounded-lg text-sm font-medium disabled:opacity-50">
                    <Snowflake className="w-4 h-4" /> 여신 동결
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">미수금 상환 기록</label>
                  <input type="number" min={0} value={repayInput} onChange={e => setRepayInput(e.target.value)} placeholder="상환액(원)" className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
                </div>
                <input type="text" value={repayMemo} onChange={e => setRepayMemo(e.target.value)} placeholder="메모(선택)" maxLength={200} className="flex-1 min-w-[160px] px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
                <button onClick={recordRepayment} disabled={creditBusy} className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  <BadgeDollarSign className="w-4 h-4" /> 상환 기록
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">미수금 원장 (최근 100건)</h3>
                {creditData.ledger.length === 0 ? (
                  <p className="text-sm text-gray-400">원장 내역이 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-gray-500 border-b border-gray-100"><th className="py-2">일시</th><th>유형</th><th>주문</th><th className="text-right">금액</th><th className="text-right">잔액</th><th>메모</th></tr></thead>
                      <tbody>
                        {creditData.ledger.map((l) => (
                          <tr key={l.id} className="border-b border-gray-50">
                            <td className="py-1.5 text-gray-600 whitespace-nowrap">{(l.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                            <td className={l.type === 'repayment' ? 'text-emerald-700 font-medium' : l.type === 'charge' ? 'text-rose-600 font-medium' : 'text-gray-600'}>
                              {l.type === 'charge' ? '청구(외상)' : l.type === 'repayment' ? '상환' : '조정'}
                            </td>
                            <td className="text-gray-500">{l.order_id ? `#${l.order_id}` : '-'}</td>
                            <td className="text-right tabular-nums">{l.type === 'repayment' ? '−' : '+'}{Number(l.amount).toLocaleString('ko-KR')}</td>
                            <td className="text-right tabular-nums text-gray-900 font-medium">{Number(l.balance_after).toLocaleString('ko-KR')}</td>
                            <td className="text-gray-500 truncate max-w-[160px]">{l.memo || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        </>)}

        {tab === 'tax' && (<>
        {/* ── 상품 제안 (어드민 → 판매사) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Sparkles className="w-4 h-4 text-amber-500" /> 상품 제안
          </h2>
          <p className="text-sm text-gray-500 mb-4">판매사에게 도매 상품을 추천합니다. 판매사 카탈로그 상단 &ldquo;추천 상품 제안&rdquo;에 노출됩니다.</p>
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <input type="number" value={propSeller} onChange={e => setPropSeller(e.target.value)} placeholder="판매사 ID" className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <input type="number" value={propProduct} onChange={e => setPropProduct(e.target.value)} placeholder="상품 ID" className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <input type="text" value={propNote} onChange={e => setPropNote(e.target.value)} placeholder="메모(선택)" maxLength={200} className="flex-1 min-w-[160px] px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={createProposal} disabled={propBusy} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {propBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 제안
            </button>
          </div>
          {proposals.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">등록된 제안이 없습니다.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {proposals.map(p => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-700">판매사 #{p.distributor_seller_id} → <b className="text-gray-900">{p.product_name}</b> (상품#{p.product_id}){p.note ? ` · ${p.note}` : ''}</span>
                  <button onClick={() => withdrawProposal(p.id)} className="text-gray-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── 세금계산서 집계 (1차 수동 발행 참고) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Receipt className="w-4 h-4 text-gray-500" /> 세금계산서 집계
          </h2>
          <p className="text-sm text-gray-500 mb-4">월별 거래액 집계. 유통스타트→판매사(매출) / 제조사→유통스타트(매입) 세금계산서를 수동 발행할 때 참고합니다.</p>
          <div className="flex items-end gap-2 mb-4">
            <input type="month" value={taxMonth} onChange={e => setTaxMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={loadTax} disabled={taxLoading} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">{taxLoading ? '조회중…' : '조회'}</button>
          </div>
          {taxData && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">판매사별 매출 (→ 판매사 발행)</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {taxData.by_distributor.length === 0 ? <tr><td className="text-gray-400 py-2">없음</td></tr> : taxData.by_distributor.map((d, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-700">{String(d.business_name || d.name || `#${d.seller_id}`)}</td>
                        <td className="py-1.5 text-right font-medium text-gray-900">{Number(d.sales_total || 0).toLocaleString('ko-KR')}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">제조사별 매입 (← 제조사 수취)</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {taxData.by_supplier.length === 0 ? <tr><td className="text-gray-400 py-2">없음</td></tr> : taxData.by_supplier.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-700">{String(s.business_name || `#${s.supplier_id}`)}</td>
                        <td className="py-1.5 text-right font-medium text-gray-900">{Number(s.purchase_total || 0).toLocaleString('ko-KR')}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 플랫폼 사업자정보 (전자세금계산서 발행 전제 — 바로빌 + platform_settings) */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">플랫폼 사업자정보 <span className="text-xs font-normal text-gray-400">(국세청 전자세금계산서 발행에 사용)</span></h3>
            <p className="text-xs text-gray-500 mb-3">아래 정보 + Cloudflare 환경변수 <code className="text-gray-700">BAROBILL_PROD_API_KEY</code> 가 모두 설정되면 &ldquo;국세청발행&rdquo; 버튼이 활성화됩니다.</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              {([
                ['company_name', '상호(법인명)'], ['company_business_number', '사업자등록번호'],
                ['company_ceo', '대표자'], ['company_address', '사업장 주소'],
                ['company_biz_type', '업태'], ['company_biz_class', '종목'],
                ['company_email', '이메일'], ['company_tel', '전화'],
              ] as const).map(([k, label]) => (
                <input key={k} value={company[k] || ''} onChange={e => setCompany(c => ({ ...c, [k]: e.target.value }))}
                  placeholder={label} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              ))}
            </div>
            <button onClick={saveCompany} disabled={companyBusy} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {companyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 사업자정보 저장
            </button>
          </div>

          {/* 세금계산서/거래명세서 발행 (내부 발행 + 인쇄) */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <h3 className="text-sm font-semibold text-gray-700">세금계산서 / 거래명세서 발행</h3>
              <button onClick={() => issueTaxDocs('tax_invoice')} disabled={issuing} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold disabled:opacity-50">
                {taxMonth} 세금계산서 발행
              </button>
              <button onClick={() => issueTaxDocs('transaction_statement')} disabled={issuing} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold disabled:opacity-50">
                거래명세서 발행
              </button>
              <button onClick={exportProducts} className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium">
                <Receipt className="w-3.5 h-3.5" /> 상품정보 엑셀(A/B/C)
              </button>
            </div>
            {(taxDocsQ.data || []).length === 0 ? (
              <p className="text-xs text-gray-400">발행된 문서가 없습니다. 위 버튼으로 {taxMonth} 분을 발행하세요.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-gray-500 border-b border-gray-100"><th className="py-2">구분</th><th>유형</th><th>상대처</th><th className="text-right">공급가액</th><th className="text-right">부가세</th><th className="text-right">합계</th><th></th></tr></thead>
                  <tbody>
                    {(taxDocsQ.data || []).map((d) => (
                      <tr key={d.id} className="border-b border-gray-50">
                        <td className="py-1.5">{d.direction === 'sales' ? '매출(→판매사)' : '매입(←제조사)'}</td>
                        <td className="text-gray-600">{d.doc_type === 'tax_invoice' ? '세금계산서' : '거래명세서'}</td>
                        <td className="text-gray-900">{d.party_name}</td>
                        <td className="text-right">{Number(d.supply_amount || 0).toLocaleString('ko-KR')}</td>
                        <td className="text-right text-gray-500">{Number(d.vat_amount || 0).toLocaleString('ko-KR')}</td>
                        <td className="text-right font-bold">{Number(d.total_amount || 0).toLocaleString('ko-KR')}</td>
                        <td className="whitespace-nowrap">
                          <button onClick={() => openTaxDoc(d.id)} className="px-2 py-1 bg-gray-100 rounded font-medium">인쇄</button>
                          {d.direction === 'sales' && (
                            d.nts_confirm_num
                              ? <span className="ml-1 text-[10px] text-emerald-600 font-medium">국세청✓</span>
                              : <button onClick={() => issueNts(d.id)} className="ml-1 px-2 py-1 bg-gray-900 text-white rounded font-medium">국세청발행</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
        </>)}

        {tab === 'supply' && (<>
        {/* ── 유통채널 선정 (유통스타트 유통채널 공급 상품 → 선정 판매사) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Layers className="w-4 h-4 text-gray-500" /> 유통채널 선정 (선정 판매사 관리)
          </h2>
          <p className="text-sm text-gray-500 mb-4">'승인한 유통채널 / 유통스타트 유통채널' 공급 상품은 여기서 선정한 판매사에게만 노출·주문됩니다. (전체공급 상품은 선정 불필요)</p>
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <input type="number" value={accessProductId} onChange={e => setAccessProductId(e.target.value)} placeholder="상품 ID" className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={() => { setEditGrades(null); setAccessProductQuery(accessProductId) }} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">조회</button>
            <input type="number" value={accessSeller} onChange={e => setAccessSeller(e.target.value)} placeholder="판매사 ID 선정" className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={grantAccess} className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> 선정</button>
          </div>
          {accessQ.data && (
            <div>
              <p className="text-xs text-gray-600 mb-2">상품 <b>{accessQ.data.product?.name}</b> · 공급범위 <b>{accessQ.data.product?.supply_visibility}</b> · 선정 {accessQ.data.distributors.length}곳</p>
              {/* 🏷️ 2026-06-18 등급별 노출 — 체크한 등급의 판매사에게만 이 상품 노출(주문/내보내기 포함). 아무것도 안 체크 = 전체 노출. */}
              <div className="mb-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-2">노출 등급 <span className="text-gray-400 font-normal">— 체크한 등급의 판매사에게만 노출 (전부 해제 = 전체 노출)</span></p>
                <div className="flex flex-wrap items-center gap-2">
                  {(accessQ.data.all_grades || []).map((g) => {
                    const on = effGrades.includes(g.grade)
                    return (
                      <button key={g.grade} type="button" onClick={() => toggleGrade(g.grade)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {g.grade}{g.label ? ` ${g.label}` : ''}
                      </button>
                    )
                  })}
                  {editGrades !== null && (
                    <button type="button" onClick={saveVisibleGrades} className="ml-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white">저장</button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">현재: {effGrades.length ? effGrades.join(', ') : '전체 노출(제한 없음)'}</p>
              </div>
              {accessQ.data.distributors.length === 0 ? (
                <p className="text-sm text-gray-400">선정된 판매사가 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {accessQ.data.distributors.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-700">{d.business_name || d.seller_name || `#${d.distributor_seller_id}`} <span className="text-gray-400 text-xs">{d.distributor_grade || '미배정(C)'}</span></span>
                      <button onClick={() => revokeAccess(d.id)} className="text-gray-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* ── 상품별 마진(특가) 설정 ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Percent className="w-4 h-4 text-rose-500" /> 상품별 마진 (특가/전략상품)
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            특정 상품에 마진율을 고정하면 <b>등급(A/B/C/D) 무관 모든 판매사가 같은 공급가</b>로 구매합니다. 전략·특가 상품용. 비워서 해제하면 등급별 마진으로 복귀합니다.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <input type="number" value={marginProductId} onChange={e => setMarginProductId(e.target.value)} placeholder="상품 ID" className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <div className="relative">
              <input type="number" min={0} max={500} step={0.1} value={marginPct} onChange={e => setMarginPct(e.target.value)} placeholder="마진율" className="w-28 pl-3 pr-7 py-2 border border-gray-200 rounded-lg text-gray-900" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
            <button onClick={() => setMarginOverride(false)} disabled={marginBusy} className="inline-flex items-center gap-1 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {marginBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />} 특가 적용
            </button>
            <button onClick={() => setMarginOverride(true)} disabled={marginBusy} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50">
              해제
            </button>
            {marginProductId && Number(marginPct) > 0 && (
              <span className="text-xs text-gray-500 self-center">예: 공급가 10,000원 → <b className="text-gray-900 tabular-nums">{Math.round(10000 * (1 + (Number(marginPct) || 0) / 100)).toLocaleString('ko-KR')}원</b></span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">상품 ID는 위 &ldquo;상품정보 엑셀&rdquo; 다운로드(product_id 컬럼)에서 확인할 수 있습니다.</p>

          {/* 수량 구간 할인 (volume tier) — 같은 상품 ID 기준 */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-1">
              <Percent className="w-4 h-4 text-gray-500" /> 수량 구간 할인 (많이 살수록 ↓)
            </h3>
            <p className="text-sm text-gray-500 mb-3">위 상품 ID 기준. 등급가 위에 <b>구매 수량별 추가 할인</b>을 적용합니다. <code className="text-gray-700">수량:할인%</code> 쌍을 쉼표로 — 예: <code className="text-gray-700">100:5, 500:10</code> (100개↑ 5%, 500개↑ 10%).</p>
            <div className="flex flex-wrap items-end gap-2">
              <input value={tierText} onChange={e => setTierText(e.target.value)} placeholder="100:5, 500:10" className="flex-1 min-w-[200px] px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
              <button onClick={() => saveTiers(false)} disabled={tierBusy} className="inline-flex items-center gap-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {tierBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 구간 저장
              </button>
              <button onClick={() => saveTiers(true)} disabled={tierBusy} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-50">해제</button>
            </div>
          </div>
        </section>

        {/* ── OEM/ODM 신청 관리 ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Sparkles className="w-4 h-4 text-amber-500" /> OEM / ODM 신청 관리
            </h2>
            <select value={oemStatus} onChange={e => setOemStatus(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900">
              <option value="">전체</option><option value="open">접수</option><option value="matching">매칭중</option>
              <option value="matched">매칭완료</option><option value="closed">종료</option><option value="rejected">반려</option>
            </select>
          </div>
          {(oemQ.data || []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4">신청 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {(oemQ.data || []).map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-900 text-white">{r.kind}</span>
                      <span className="font-semibold text-gray-900 text-sm">{r.product_name}</span>
                      <span className="text-xs text-gray-500">{r.distributor_business_name || r.distributor_name || `판매사#${r.distributor_seller_id}`}</span>
                    </div>
                    <select value={r.status} onChange={e => updateOem(r.id, { status: e.target.value })} className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-900">
                      {['open', 'matching', 'matched', 'closed', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500">
                    {r.category && `${r.category} · `}{r.target_qty ? `${Number(r.target_qty).toLocaleString('ko-KR')}개 · ` : ''}{r.target_price ? `희망 ₩${Number(r.target_price).toLocaleString('ko-KR')}` : ''}
                  </p>
                  {r.note && <p className="text-xs text-gray-600 mt-1">{r.note}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <input defaultValue={r.matched_supplier_id || ''} placeholder="매칭 제조사 ID" type="number"
                      className="w-32 px-2 py-1 border border-gray-200 rounded text-xs text-gray-900"
                      onBlur={e => { const v = e.target.value.trim(); if (v !== String(r.matched_supplier_id || '')) updateOem(r.id, { matched_supplier_id: v ? Number(v) : null }) }} />
                    <input defaultValue={r.admin_memo || ''} placeholder="관리자 메모(저장: Enter)"
                      className="flex-1 px-2 py-1 border border-gray-200 rounded text-xs text-gray-900"
                      onKeyDown={e => { if (e.key === 'Enter') updateOem(r.id, { admin_memo: (e.target as HTMLInputElement).value }) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </>)}
      </div>
    </AdminLayout>
  )
}

function DistributorRowEditor({
  row, saving, onSave,
}: {
  row: DistributorRow
  saving: boolean
  onSave: (d: DistributorRow, grade: string | null, special: string | null) => void
}) {
  const [grade, setGrade] = useState<string>(row.distributor_grade ?? '')
  const [special, setSpecial] = useState<string>(row.special_discount_until ? row.special_discount_until.slice(0, 10) : '')

  return (
    <tr className="border-b border-gray-50">
      <td className="py-2 pr-4">
        <div className="font-medium text-gray-900">{row.business_name || row.name || row.username || `#${row.id}`}</div>
        <div className="text-xs text-gray-400">{row.username ? `@${row.username}` : ''} {row.email || ''}</div>
      </td>
      <td className="py-2 pr-4">
        <select value={grade} onChange={e => setGrade(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-gray-900">
          <option value="">미배정</option>
          {ASSIGNABLE.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
        </select>
      </td>
      <td className="py-2 pr-4">
        <input type="date" value={special} onChange={e => setSpecial(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-gray-900" />
      </td>
      <td className="py-2">
        <button
          onClick={() => onSave(row, grade || null, special ? new Date(special + 'T23:59:59').toISOString() : null)}
          disabled={saving}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          저장
        </button>
      </td>
    </tr>
  )
}

// 🏭 2026-06-12 (영업단 제안): 공급 채널 안내 기준 — 채널별 임계 공급률(%) 편집.
//   제조사 상품 등록 폼의 "제안 가능 유통채널" 안내가 이 값을 읽음 (표시 전용 —
//   결제가/등급가/visibility 게이트 무영향). 기준 숫자는 영업단이 결정해 입력.
function ChannelThresholdsSection() {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [values, setValues] = useState<SupplyChannelThresholds>(DEFAULT_SUPPLY_CHANNEL_THRESHOLDS)
  const [isDefault, setIsDefault] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/api/admin/distributor/channel-thresholds', h)
      .then(r => {
        if (r.data?.success && r.data.thresholds) {
          setValues(r.data.thresholds)
          setIsDefault(!!r.data.is_default)
        }
      })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    for (const ch of SUPPLY_CHANNELS) {
      const v = Number(values[ch.key])
      if (!Number.isFinite(v) || v < 1 || v > 100) { toast.error(`${ch.label} 임계 공급률은 1~100 사이여야 합니다`); return }
    }
    setSaving(true)
    try {
      const r = await api.put('/api/admin/distributor/channel-thresholds', values, h)
      if (r.data?.success) { toast.success('채널 기준이 저장되었습니다'); setIsDefault(false) }
      else toast.error(r.data?.error || '저장 실패')
    } catch {
      toast.error('저장 실패')
    } finally { setSaving(false) }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
        <TrendingUp className="w-4 h-4 text-gray-500" /> 공급 채널 안내 기준 (공급률 %)
      </h2>
      <p className="text-sm text-gray-500 mb-1">
        공급률 = 공급가 ÷ 권장 소비자가 × 100. 제조사 상품 등록 폼이 이 기준으로 "제안 가능 유통채널" 을 실시간 안내합니다
        — 공급가를 낮출수록 더 많은 채널이 열리는 잠금해제 안내(표시 전용, 결제가·노출에는 영향 없음).
      </p>
      {isDefault && !loading && (
        <p className="text-xs text-amber-600 mb-3">⚠️ 아직 기본값입니다 — 영업단 확정 기준으로 저장해주세요.</p>
      )}
      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin text-gray-300 mx-auto" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SUPPLY_CHANNELS.map(ch => (
              <div key={ch.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{ch.emoji} {ch.label} — 이하일 때 제안 가능</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number" min={1} max={100} step={0.5}
                    value={values[ch.key]}
                    onChange={e => setValues(v => ({ ...v, [ch.key]: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm text-gray-900"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-400">예: 폐쇄몰 70% = 권장 소비자가 10,000원 상품은 공급가 7,000원 이하일 때 폐쇄몰 제안 가능으로 표시.</p>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 저장
            </button>
          </div>
        </>
      )}
    </section>
  )
}
