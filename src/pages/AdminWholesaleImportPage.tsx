import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Upload, Download, PackagePlus, CheckCircle2, AlertTriangle } from 'lucide-react'

// 🏭 2026-06-16 (대표 요청 — 도매몰 채우기): 어드민 공급상품 CSV 일괄 등록.
//   백엔드 POST /api/admin/distributor/supply-bulk-import — 즉시 노출(is_active=1, approved).
//   포맷은 제조사 self-serve bulk 와 동일(한글 헤더). 라이트 대시보드 테마.

const TEMPLATE_HEADERS = ['상품명', '공급가', '권장소비자가', '재고', '카테고리', '바코드', '최소주문수량', '썸네일 이미지URL', '설명']
const TEMPLATE_SAMPLE = '친환경 텀블러,5000,9900,120,lifestyle,,1,https://images.unsplash.com/photo-1,스테인리스 텀블러 500ml'

interface Supplier { id: number; business_name: string }
interface ImportResult {
  supplier_id: number
  summary: { total: number; created: number; failed: number }
  results: { row: number; name?: string; status: 'ok' | 'error'; reason?: string }[]
}
interface SupplyStats { total: number; demo: number; real: number; active: number; suppliers: number }

export default function AdminWholesaleImportPage() {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierId, setSupplierId] = useState('') // '' = 직매입 자동 생성
  const [supplierName, setSupplierName] = useState('유통스타트 직매입')
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [stats, setStats] = useState<SupplyStats | null>(null)
  const [cleaning, setCleaning] = useState(false)

  const loadStats = () => {
    api.get('/api/admin/distributor/supply-stats', h)
      .then(r => { if (r.data?.success) setStats(r.data as SupplyStats) })
      .catch(() => { /* 현황 실패는 무시 */ })
  }

  useEffect(() => {
    api.get('/api/admin/suppliers?status=approved&limit=200', h)
      .then(r => {
        const items = (r.data?.data?.items ?? r.data?.suppliers ?? []) as Supplier[]
        setSuppliers(items.filter(s => s && s.id).map(s => ({ id: s.id, business_name: s.business_name || `제조사 #${s.id}` })))
      })
      .catch(() => { /* 목록 실패해도 직매입 자동 생성으로 진행 가능 */ })
    loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearDemo = async () => {
    if (!confirm('데모 상품(demo-wholesale-*)을 모두 삭제할까요? 실제 임포트 상품은 영향받지 않습니다.')) return
    setCleaning(true)
    try {
      const r = await api.delete('/api/admin/distributor/seed-demo-products', h)
      toast.success(`데모 상품 ${r.data?.deleted ?? 0}개 삭제`)
      loadStats()
    } catch { toast.error('데모 정리 중 오류') } finally { setCleaning(false) }
  }
  const seedDemo = async () => {
    setCleaning(true)
    try {
      const r = await api.post('/api/admin/distributor/seed-demo-products', {}, h)
      toast.success(r.data?.seeded ? `데모 상품 ${r.data.seeded}개 생성` : (r.data?.message || '이미 데모 상품이 있습니다'))
      loadStats()
    } catch { toast.error('데모 생성 중 오류') } finally { setCleaning(false) }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const rd = new FileReader()
    rd.onload = () => setCsv(String(rd.result || ''))
    rd.readAsText(f, 'utf-8')
  }

  const downloadTemplate = () => {
    const body = '﻿' + TEMPLATE_HEADERS.join(',') + '\n' + TEMPLATE_SAMPLE + '\n'
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wholesale-import-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const submit = async () => {
    if (!csv.trim()) { toast.error('CSV를 붙여넣거나 파일을 업로드해주세요'); return }
    setBusy(true); setResult(null)
    try {
      const r = await api.post('/api/admin/distributor/supply-bulk-import', {
        csv,
        supplier_id: supplierId ? Number(supplierId) : undefined,
        supplier_name: supplierId ? undefined : supplierName,
      }, h)
      if (r.data?.success) {
        setResult(r.data as ImportResult)
        toast.success(`${r.data.summary?.created ?? 0}개 등록 완료`)
        loadStats()
      } else {
        toast.error(r.data?.error || '등록 실패')
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '등록 중 오류')
    } finally {
      setBusy(false)
    }
  }

  const card = 'bg-white rounded-2xl border border-gray-200 p-5'
  const label = 'block text-xs font-semibold text-gray-500 mb-1.5'
  const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm'

  return (
    <AdminLayout title="도매 상품 일괄 등록">
      <div className="ur-content-wide px-4 lg:px-6 py-5 space-y-5">
        <DashboardPageHeader title="도매 상품 일괄 등록" subtitle="CSV로 공급상품을 한 번에 등록 — 즉시 도매몰 카탈로그에 노출됩니다." />

        {stats && (
          <div className={card}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-5 flex-wrap">
                <div><p className="text-[11px] text-gray-400">전체 공급상품</p><p className="text-xl font-bold text-gray-900">{stats.total.toLocaleString()}</p></div>
                <div><p className="text-[11px] text-gray-400">실상품</p><p className="text-xl font-bold text-emerald-600">{stats.real.toLocaleString()}</p></div>
                <div><p className="text-[11px] text-gray-400">데모</p><p className="text-xl font-bold text-amber-500">{stats.demo.toLocaleString()}</p></div>
                <div><p className="text-[11px] text-gray-400">노출중</p><p className="text-xl font-bold text-gray-700">{stats.active.toLocaleString()}</p></div>
                <div><p className="text-[11px] text-gray-400">승인 제조사</p><p className="text-xl font-bold text-gray-700">{stats.suppliers.toLocaleString()}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {stats.demo > 0 && (
                  <button onClick={clearDemo} disabled={cleaning} className="px-3 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">데모 {stats.demo}개 정리</button>
                )}
                <button onClick={seedDemo} disabled={cleaning} className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">데모 채우기</button>
              </div>
            </div>
            {stats.demo > 0 && <p className="text-[11px] text-amber-600 mt-2">⚠️ 데모 상품 {stats.demo}개가 카탈로그에 섞여 있습니다 — 실상품 등록 전 정리를 권장합니다.</p>}
          </div>
        )}

        <div className={card}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-600">① 템플릿을 받아 채운 뒤, ② 제조사를 고르고, ③ CSV를 붙여넣어 등록하세요.</p>
            <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
              <Download className="w-4 h-4" /> CSV 템플릿 받기
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">헤더(필수): <b>상품명, 공급가</b>. 선택: 권장소비자가(미입력 시 공급가×1.6 자동), 재고, 카테고리, 바코드, 최소주문수량, 썸네일 이미지URL, 설명.</p>
        </div>

        <div className={card}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>제조사 (공급자)</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={input}>
                <option value="">+ 직매입 제조사 자동 생성</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.business_name} (#{s.id})</option>)}
              </select>
              {!supplierId && (
                <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="직매입 제조사명" className={`${input} mt-2`} />
              )}
              <p className="text-[11px] text-gray-400 mt-1">제조사가 없으면 빈 채로 두세요 — 입력한 이름으로 직매입 제조사를 자동 생성합니다.</p>
            </div>
            <div>
              <label className={label}>CSV 파일 업로드</label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" /> .csv 선택
                <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
              </label>
              <p className="text-[11px] text-gray-400 mt-1">또는 아래에 직접 붙여넣기 (UTF-8).</p>
            </div>
          </div>

          <div className="mt-4">
            <label className={label}>CSV 내용</label>
            <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8}
              placeholder={TEMPLATE_HEADERS.join(',') + '\n' + TEMPLATE_SAMPLE}
              className={`${input} font-mono text-[12px] leading-relaxed`} />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-[#0C2454] hover:bg-[#0a1d44] disabled:opacity-50">
              <PackagePlus className="w-4 h-4" /> {busy ? '등록 중…' : '도매몰에 일괄 등록'}
            </button>
            <span className="text-[11px] text-gray-400">등록 즉시 카탈로그 노출(승인 완료 상태). 가격은 등급별 보장마진으로 자동 계산.</span>
          </div>
        </div>

        {result && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-bold text-gray-900">
                등록 완료 — 총 {result.summary.total}행 중 <span className="text-emerald-600">{result.summary.created}개 성공</span>
                {result.summary.failed > 0 && <span className="text-red-600"> · {result.summary.failed}개 실패</span>}
                <span className="text-gray-400 font-normal"> (제조사 #{result.supplier_id})</span>
              </p>
            </div>
            {result.results.some(r => r.status === 'error') && (
              <div className="max-h-64 overflow-auto rounded-lg border border-gray-100">
                <table className="w-full text-[12px]">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr><th className="text-left px-3 py-2">행</th><th className="text-left px-3 py-2">상품명</th><th className="text-left px-3 py-2">사유</th></tr>
                  </thead>
                  <tbody>
                    {result.results.filter(r => r.status === 'error').map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-500">{r.row}</td>
                        <td className="px-3 py-1.5 text-gray-700">{r.name || '-'}</td>
                        <td className="px-3 py-1.5 text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <a href="/wholesale" target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-semibold text-[#FC5424] hover:underline">도매몰에서 확인 →</a>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
