import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Layers, Save, Loader2, Search, Tag, Percent, Sparkles, Receipt, Plus, X, Wallet, Snowflake, BadgeDollarSign } from 'lucide-react'
import { toast } from '@/hooks/useToast'

// 🏭 2026-06-01 유통스타트 도매몰 — 유통사 등급/마진 설정 (Phase 1b).
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

const ASSIGNABLE = ['A', 'B', 'C', 'D', 'OEM']

export default function AdminDistributorGradesPage() {
  const navigate = useNavigate()
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
  const [demoBusy, setDemoBusy] = useState(false)
  // 🛡️ 2026-06-03 Tier2(대시보드): proposals 리스트 → useApiQuery (grades/distributors 는 인라인 편집 명령형 유지).
  const proposalsQ = useApiQuery<Array<{ id: number; distributor_seller_id: number; product_name: string; product_id: number; note: string | null }>>(
    ['admin', 'distributor-proposals'], '/api/admin/distributor/proposals',
    { headers: h.headers, select: (r: any) => (r?.success ? r.proposals || [] : []) },
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
    { params: oemStatus ? { status: oemStatus } : {}, headers: h.headers, select: (r: any) => (r?.success ? r.requests || [] : []) },
  )
  const taxDocsQ = useApiQuery<Array<Record<string, any>>>(
    ['admin', 'dist-taxdocs', taxMonth], '/api/admin/distributor/tax-documents',
    { params: { month: taxMonth }, headers: h.headers, select: (r: any) => (r?.success ? r.documents || [] : []) },
  )
  const [issuing, setIssuing] = useState(false)
  // 유통채널 선정(product-access)
  const [accessProductId, setAccessProductId] = useState('')
  const [accessProductQuery, setAccessProductQuery] = useState('')
  const accessQ = useApiQuery<{ product: any; distributors: Array<Record<string, any>> } | null>(
    ['admin', 'dist-access', accessProductQuery], '/api/admin/distributor/product-access',
    { params: accessProductQuery ? { product_id: accessProductQuery } : {}, enabled: !!accessProductQuery, headers: h.headers, select: (r: any) => (r?.success ? { product: r.product, distributors: r.distributors || [] } : null) },
  )
  const [accessSeller, setAccessSeller] = useState('')
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

  // 🏭 BIZ-2 v1 여신/외상 관리 — 유통사 한도/미수금/동결 + 상환.
  const [creditSellerId, setCreditSellerId] = useState('')
  const [creditData, setCreditData] = useState<{ credit: CreditDetail; ledger: LedgerRow[] } | null>(null)
  const [creditBusy, setCreditBusy] = useState(false)
  const [creditLimitInput, setCreditLimitInput] = useState('')
  const [repayInput, setRepayInput] = useState('')
  const [repayMemo, setRepayMemo] = useState('')

  const loadCredit = useCallback((id: string) => {
    const sid = Number(id)
    if (!Number.isFinite(sid) || sid <= 0) { toast.error('유통사 ID를 입력하세요'); return }
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
    if (!Number.isFinite(sid) || sid <= 0) { toast.error('유통사 ID를 입력하세요'); return }
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
    if (!Number.isFinite(sid) || sid <= 0) { toast.error('유통사 ID를 입력하세요'); return }
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
  }, [])

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
        toast.success('유통사 등급 저장됨')
        setDistributors(prev => prev.map(x => x.id === d.id ? { ...x, distributor_grade: grade, special_discount_until: special } : x))
      } else toast.error(r.data.error || '저장 실패')
    } catch { toast.error('저장 중 오류') } finally { setSavingDist(null) }
  }

  const loadProposals = useCallback(() => { proposalsQ.refetch() }, [proposalsQ])

  async function createProposal() {
    const sid = Number(propSeller), pid = Number(propProduct)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(pid) || pid <= 0) { toast.error('유통사 ID와 상품 ID를 입력하세요'); return }
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
    if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(sid) || sid <= 0) { toast.error('상품 ID와 유통사 ID를 입력하세요'); return }
    try {
      await api.post('/api/admin/distributor/product-access', { product_id: pid, distributor_seller_id: sid }, h)
      toast.success('유통회원 선정됨'); setAccessProductQuery(String(pid)); setAccessSeller(''); accessQ.refetch()
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

  // 🏭 2026-06-04 도매몰 데모 상품 시드 — /wholesale 카탈로그에 바로 노출되는 공급상품 10개 생성/삭제.
  async function seedDemoProducts() {
    setDemoBusy(true)
    try {
      const r = await api.post('/api/admin/distributor/seed-demo-products', {}, h)
      if (r.data?.success) toast.success(r.data.seeded > 0 ? `데모 상품 ${r.data.seeded}개 생성 — /wholesale 에서 확인하세요` : (r.data.message || '이미 존재합니다'))
      else toast.error(r.data?.error || '생성 실패')
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '생성 중 오류') }
    finally { setDemoBusy(false) }
  }
  async function clearDemoProducts() {
    if (!(await confirmDialog({ message: '데모 상품을 모두 삭제할까요?', danger: true }))) return
    setDemoBusy(true)
    try {
      const r = await api.delete('/api/admin/distributor/seed-demo-products', h)
      if (r.data?.success) toast.success(`데모 상품 ${r.data.deleted}개 삭제`)
      else toast.error(r.data?.error || '삭제 실패')
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '삭제 중 오류') }
    finally { setDemoBusy(false) }
  }

  if (loading) return <AdminLayout title="유통사 등급"><DashboardLoading /></AdminLayout>

  return (
    <AdminLayout title="유통사 등급">
      <div className="ur-content-full px-4 lg:px-8 py-6 space-y-8">
        <DashboardPageHeader
          icon={<Layers className="w-5 h-5" />}
          title="유통사 등급 · 마진 설정"
          subtitle="유통스타트 도매몰 — 등급별 마진율과 유통사 배정을 관리합니다. (도매 카탈로그 가격에만 적용)"
        />

        {/* ── 데모 상품 (도매몰 미리보기용) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">도매몰 데모 상품</h2>
          <p className="text-sm text-gray-500 mb-3">
            제조사 입점 전 미리보기용 — <b>/wholesale 카탈로그에 바로 노출되는 공급상품 10개</b>를 생성합니다.
            (표시용 데모 데이터. 실제 운영 시작 시 삭제하세요.)
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={seedDemoProducts} disabled={demoBusy}
              className="px-4 h-10 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50">
              {demoBusy ? '처리 중…' : '데모 상품 10개 생성'}
            </button>
            <button onClick={clearDemoProducts} disabled={demoBusy}
              className="px-4 h-10 rounded-lg border border-gray-200 text-gray-700 text-sm font-bold disabled:opacity-50">
              데모 상품 전체 삭제
            </button>
          </div>
        </section>

        {/* ── 등급별 마진율 ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Percent className="w-4 h-4 text-gray-500" /> 등급별 마진율
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            유통사 공급가 = 제조사 공급가 × (1 + 마진율). 고등급(A)일수록 낮게, 특별할인은 기간 한정 최저가.
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

        {/* ── 유통사 등급 배정 ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Layers className="w-4 h-4 text-gray-500" /> 유통사 등급 배정
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            가입한 유통사(셀러)에 등급을 매기고, 필요 시 특별할인 종료일을 지정하면 그 기간엔 SPECIAL 등급가가 적용됩니다.
          </p>
          <form
            onSubmit={e => { e.preventDefault(); loadDistributors(search) }}
            className="flex gap-2 mb-4"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="유통사 검색 (아이디 / 이름 / 상호 / 이메일)"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-gray-900"
              />
            </div>
            <button type="submit" disabled={searching} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {searching ? '검색중…' : '검색'}
            </button>
            <button type="button" onClick={() => { setSearch(''); loadDistributors('', true) }} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              배정된 유통사
            </button>
          </form>

          {distributors.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">결과가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">유통사</th>
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

        {/* ── 여신/외상 관리 (BIZ-2 v1) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Wallet className="w-4 h-4 text-emerald-600" /> 여신 · 외상 관리
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            유통사에 <b>여신 한도</b>를 부여하면 도매 주문 시 선결제 대신 <b>외상(ON_CREDIT)</b>으로 주문할 수 있습니다.
            (가용 한도 = 한도 − 미수금. 연체 시 동결.) 한도 0 = 외상 불가(선결제 전용).
          </p>
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <input type="number" value={creditSellerId} onChange={e => setCreditSellerId(e.target.value)} placeholder="유통사 ID" className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={() => loadCredit(creditSellerId)} disabled={creditBusy} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">{creditBusy ? '처리중…' : '여신 조회'}</button>
          </div>

          {creditData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-xs text-gray-500">유통사</div>
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

        {/* ── 상품 제안 (어드민 → 유통사) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Sparkles className="w-4 h-4 text-amber-500" /> 상품 제안
          </h2>
          <p className="text-sm text-gray-500 mb-4">유통사에게 도매 상품을 추천합니다. 유통사 카탈로그 상단 &ldquo;추천 상품 제안&rdquo;에 노출됩니다.</p>
          <div className="flex flex-wrap items-end gap-2 mb-4">
            <input type="number" value={propSeller} onChange={e => setPropSeller(e.target.value)} placeholder="유통사 ID" className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
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
                  <span className="text-gray-700">유통사 #{p.distributor_seller_id} → <b className="text-gray-900">{p.product_name}</b> (상품#{p.product_id}){p.note ? ` · ${p.note}` : ''}</span>
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
          <p className="text-sm text-gray-500 mb-4">월별 거래액 집계. 유통스타트→유통사(매출) / 제조사→유통스타트(매입) 세금계산서를 수동 발행할 때 참고합니다.</p>
          <div className="flex items-end gap-2 mb-4">
            <input type="month" value={taxMonth} onChange={e => setTaxMonth(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={loadTax} disabled={taxLoading} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">{taxLoading ? '조회중…' : '조회'}</button>
          </div>
          {taxData && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">유통사별 매출 (→ 유통사 발행)</h3>
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
                        <td className="py-1.5">{d.direction === 'sales' ? '매출(→유통사)' : '매입(←제조사)'}</td>
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

        {/* ── 유통채널 선정 (유통스타트 유통채널 공급 상품 → 선정 유통회원) ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 mb-1">
            <Layers className="w-4 h-4 text-gray-500" /> 유통채널 선정 (선정 유통회원 관리)
          </h2>
          <p className="text-sm text-gray-500 mb-4">'승인한 유통채널 / 유통스타트 유통채널' 공급 상품은 여기서 선정한 유통회원에게만 노출·주문됩니다. (전체공급 상품은 선정 불필요)</p>
          <div className="flex flex-wrap items-end gap-2 mb-3">
            <input type="number" value={accessProductId} onChange={e => setAccessProductId(e.target.value)} placeholder="상품 ID" className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={() => setAccessProductQuery(accessProductId)} className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">조회</button>
            <input type="number" value={accessSeller} onChange={e => setAccessSeller(e.target.value)} placeholder="유통사 ID 선정" className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-gray-900" />
            <button onClick={grantAccess} className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> 선정</button>
          </div>
          {accessQ.data && (
            <div>
              <p className="text-xs text-gray-600 mb-2">상품 <b>{accessQ.data.product?.name}</b> · 공급범위 <b>{accessQ.data.product?.supply_visibility}</b> · 선정 {accessQ.data.distributors.length}곳</p>
              {accessQ.data.distributors.length === 0 ? (
                <p className="text-sm text-gray-400">선정된 유통회원이 없습니다.</p>
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
            특정 상품에 마진율을 고정하면 <b>등급(A/B/C/D) 무관 모든 유통사가 같은 공급가</b>로 구매합니다. 전략·특가 상품용. 비워서 해제하면 등급별 마진으로 복귀합니다.
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
                      <span className="text-xs text-gray-500">{r.distributor_business_name || r.distributor_name || `유통사#${r.distributor_seller_id}`}</span>
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
          {ASSIGNABLE.map(g => <option key={g} value={g}>{g}</option>)}
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
