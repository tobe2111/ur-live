import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Upload, Download, PackagePlus, CheckCircle2, AlertTriangle } from 'lucide-react'
import ManualDealForm from './admin-dongnedeal/ManualDealForm'
import DealList from './admin-dongnedeal/DealList'
import type { DealRow } from './admin-dongnedeal/types'

// 🧭 2026-06-17 (대표 요청 — 동네딜 채우기): 어드민 동네딜(오프라인 공동구매) 상품 CSV 일괄 등록 + 데모 시드.
//   백엔드 /api/admin/dongnedeal/{stats,seed-demo,bulk-import} — 즉시 노출(is_active=1, group_buy_status='active').
//   ⚠️ 숙소는 객실·날짜(product_stay_info)가 필요해 이 도구로 등록 불가 — 숙소 전용 등록 사용.

const TEMPLATE_HEADERS = ['상품명', '카테고리', '판매가', '정가', '매장명', '주소', '이미지URL', '설명']
const TEMPLATE_SAMPLE = '[강남] 한우 오마카세 2인,이용권,89000,140000,한우공방 강남점,서울 강남구 봉은사로,https://images.unsplash.com/photo-1,2인 한우 코스'

const CAT_LABEL: Record<string, string> = {
  meal_voucher: '맛집 이용권', beauty_voucher: '미용', etc_voucher: '기타', general: '일반 상품', stay_voucher: '숙소',
}

interface ImportRow { row: number; name?: string; status: 'ok' | 'error'; reason?: string }
interface ImportResult { summary: { total: number; created: number; failed: number }; results: ImportRow[] }
interface DealStats { total: number; active: number; demo: number; by_category: { category: string; c: number }[] }

export default function AdminDongnedealImportPage() {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [stats, setStats] = useState<DealStats | null>(null)
  const [cleaning, setCleaning] = useState(false)
  // 🖊️ 2026-07-01 (대표 — 수정/삭제): 편집 대상 + 목록 새로고침 nonce.
  const [editing, setEditing] = useState<DealRow | null>(null)
  const [listNonce, setListNonce] = useState(0)

  const loadStats = () => {
    api.get('/api/admin/dongnedeal/stats', h)
      .then(r => { if (r.data?.success) setStats(r.data as DealStats) })
      .catch(() => { /* 현황 실패는 무시 */ })
  }
  useEffect(() => { loadStats(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const clearDemo = async () => {
    if (!confirm('데모 동네딜 상품(demo-deal-*)을 모두 삭제할까요? 실제 등록 상품은 영향받지 않습니다.')) return
    setCleaning(true)
    try {
      const r = await api.delete('/api/admin/dongnedeal/seed-demo', h)
      toast.success(`데모 상품 ${r.data?.deleted ?? 0}개 삭제`)
      loadStats()
    } catch { toast.error('데모 정리 중 오류') } finally { setCleaning(false) }
  }
  const seedDemo = async () => {
    setCleaning(true)
    try {
      const r = await api.post('/api/admin/dongnedeal/seed-demo', {}, h)
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
    a.download = 'dongnedeal-import-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const submit = async () => {
    if (!csv.trim()) { toast.error('CSV를 붙여넣거나 파일을 업로드해주세요'); return }
    setBusy(true); setResult(null)
    try {
      const r = await api.post('/api/admin/dongnedeal/bulk-import', { csv }, h)
      if (r.data?.success) {
        setResult(r.data as ImportResult)
        toast.success(`${r.data.summary?.created ?? 0}개 등록 완료`)
        loadStats()
      } else {
        toast.error(r.data?.error || '등록 실패')
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '등록 중 오류')
    } finally { setBusy(false) }
  }

  const card = 'bg-white rounded-2xl border border-gray-200 p-5'
  const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm'

  return (
    <AdminLayout title="동네딜 상품 일괄 등록">
      <div className="ur-content-wide px-4 lg:px-6 py-5 space-y-5">
        <DashboardPageHeader title="동네딜 상품 일괄 등록" subtitle="CSV로 동네딜(오프라인 공동구매) 상품을 한 번에 등록 — 즉시 동네딜에 노출됩니다." />

        {stats && (
          <div className={card}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-5 flex-wrap">
                <div><p className="text-[11px] text-gray-400">전체 동네딜 상품</p><p className="text-xl font-bold text-gray-900">{stats.total.toLocaleString()}</p></div>
                <div><p className="text-[11px] text-gray-400">노출중(활성)</p><p className="text-xl font-bold text-emerald-600">{stats.active.toLocaleString()}</p></div>
                <div><p className="text-[11px] text-gray-400">데모</p><p className="text-xl font-bold text-amber-500">{stats.demo.toLocaleString()}</p></div>
              </div>
              <div className="flex items-center gap-2">
                {stats.demo > 0 && (
                  <button onClick={clearDemo} disabled={cleaning} className="px-3 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">데모 {stats.demo}개 정리</button>
                )}
                <button onClick={seedDemo} disabled={cleaning} className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">데모 채우기</button>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-3">
              {['meal_voucher', 'beauty_voucher', 'etc_voucher', 'general'].map(cat => {
                const found = stats.by_category.find(b => b.category === cat)
                return <span key={cat} className="text-[12px] text-gray-500">{CAT_LABEL[cat]} <b className="text-gray-800">{found?.c ?? 0}</b></span>
              })}
            </div>
            {stats.demo > 0 && <p className="text-[11px] text-amber-600 mt-2">⚠️ 데모 상품 {stats.demo}개가 동네딜에 섞여 있습니다 — 실상품 등록 전 정리를 권장합니다.</p>}
          </div>
        )}

        {/* 🗺️ 2026-07-01 (대표 — 수기로 진짜 매장 등록): 카카오 검색 자동완성 직접 입력 폼(+수정 모드) */}
        <ManualDealForm
          editDeal={editing}
          onCancelEdit={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadStats(); setListNonce((n) => n + 1) }}
        />

        {/* 🖊️ 등록된 동네딜 목록 — 노출토글 / 수정 / 삭제 */}
        <DealList
          nonce={listNonce}
          onEdit={(d) => { setEditing(d); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          onChanged={() => { loadStats(); setListNonce((n) => n + 1) }}
        />

        <div className={card}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-gray-600">① 템플릿을 받아 채운 뒤, ② CSV를 붙여넣거나 파일로 올려 등록하세요. 등록 즉시 동네딜에 노출됩니다.</p>
            <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
              <Download className="w-4 h-4" /> CSV 템플릿 받기
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">헤더(필수): <b>상품명, 카테고리, 판매가</b>. 선택: 정가(취소선 표시), 매장명, 주소, 이미지URL, 설명.</p>
          <p className="text-[11px] text-gray-400 mt-1">카테고리는 <b>이용권 / 미용 / 기타 / 일반</b> 중 하나로 입력. <b className="text-amber-600">숙소는 객실·날짜 등록이 필요해 이 도구로 등록 불가</b>(숙소 전용 등록 사용).</p>
        </div>

        <div className={card}>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">CSV 파일 업로드</label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 cursor-pointer hover:bg-gray-50">
                <Upload className="w-4 h-4" /> .csv 선택
                <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
              </label>
              <p className="text-[11px] text-gray-400 mt-1">또는 오른쪽/아래에 직접 붙여넣기 (UTF-8).</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">CSV 내용</label>
            <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8}
              placeholder={TEMPLATE_HEADERS.join(',') + '\n' + TEMPLATE_SAMPLE}
              className={`${input} font-mono text-[12px] leading-relaxed`} />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-gray-900 hover:bg-black disabled:opacity-50">
              <PackagePlus className="w-4 h-4" /> {busy ? '등록 중…' : '동네딜에 일괄 등록'}
            </button>
            <span className="text-[11px] text-gray-400">등록 즉시 동네딜 노출(활성 공구 상태).</span>
          </div>
        </div>

        {result && (
          <div className={card}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm font-bold text-gray-900">
                등록 완료 — 총 {result.summary.total}행 중 <span className="text-emerald-600">{result.summary.created}개 성공</span>
                {result.summary.failed > 0 && <span className="text-red-600"> · {result.summary.failed}개 실패</span>}
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
            <a href="/group-buy" target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm font-semibold text-pink-600 hover:underline">동네딜에서 확인 →</a>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
