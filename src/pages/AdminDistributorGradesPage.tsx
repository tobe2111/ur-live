import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Layers, Save, Loader2, Search, Tag, Percent, Sparkles, Receipt, Plus, X } from 'lucide-react'
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
  const [proposals, setProposals] = useState<Array<{ id: number; distributor_seller_id: number; product_name: string; product_id: number; note: string | null }>>([])
  const [propBusy, setPropBusy] = useState(false)

  // 세금 집계
  const [taxMonth, setTaxMonth] = useState(new Date().toISOString().slice(0, 7))
  const [taxData, setTaxData] = useState<{ by_distributor: Array<Record<string, unknown>>; by_supplier: Array<Record<string, unknown>> } | null>(null)
  const [taxLoading, setTaxLoading] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    api.get('/api/admin/distributor/grades', h)
      .then(r => { if (r.data.success) setGrades(r.data.grades || []) })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setLoading(false))
  }, [])

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

  const loadProposals = useCallback(() => {
    api.get('/api/admin/distributor/proposals', h)
      .then(r => { if (r.data.success) setProposals(r.data.proposals || []) })
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
  }, [])
  useEffect(() => { loadProposals() }, [loadProposals])

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

  if (loading) return <AdminLayout title="유통사 등급"><DashboardLoading /></AdminLayout>

  return (
    <AdminLayout title="유통사 등급">
      <div className="ur-content-full px-4 lg:px-8 py-6 space-y-8">
        <DashboardPageHeader
          icon={<Layers className="w-5 h-5" />}
          title="유통사 등급 · 마진 설정"
          subtitle="유통스타트 도매몰 — 등급별 마진율과 유통사 배정을 관리합니다. (도매 카탈로그 가격에만 적용)"
        />

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
