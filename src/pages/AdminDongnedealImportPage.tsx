import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Upload, Download, PackagePlus, CheckCircle2, AlertTriangle } from 'lucide-react'
import ManualDealForm from './admin-dongnedeal/ManualDealForm'
import DealList from './admin-dongnedeal/DealList'
import type { DealRow } from './admin-dongnedeal/types'
import { KOREA_REGIONS, findRegionByKey } from '@/shared/constants/korea-regions'

// 🧭 2026-06-17 (대표 요청 — 동네딜 채우기): 어드민 동네딜(오프라인 공동구매) 상품 CSV 일괄 등록 + 데모 시드.
//   백엔드 /api/admin/dongnedeal/{stats,seed-demo,bulk-import} — 즉시 노출(is_active=1, group_buy_status='active').
//   ⚠️ 숙소는 객실·날짜(product_stay_info)가 필요해 이 도구로 등록 불가 — 숙소 전용 등록 사용.

const TEMPLATE_HEADERS = ['상품명', '카테고리', '판매가', '정가', '매장명', '주소', '이미지URL', '설명']
const TEMPLATE_SAMPLE = '[강남] 한우 오마카세 2인,이용권,89000,140000,한우공방 강남점,서울 강남구 봉은사로,https://images.unsplash.com/photo-1,2인 한우 코스'

const CAT_LABEL: Record<string, string> = {
  meal_voucher: '맛집 이용권', beauty_voucher: '미용', etc_voucher: '기타', general: '일반 상품', stay_voucher: '숙소',
}

// 🎯 2026-07-03 (대표 "지역은 홈 필터 그대로 — 1차/2차로 세팅"): 소비자 홈 지역필터와 **동일 SSOT**(KOREA_REGIONS)
//   를 1차(시/도)·2차(동네그룹)로 사용. 선택값을 카카오가 지오코딩 가능한 검색어로 변환 → 그 동네 실매장 매칭.
function cleanSido(label: string): string {
  // '전주/전북' → '전주', '충남\n세종' → '충남', '서울' → '서울'
  return label.replace(/\n[\s\S]*/, '').split('/')[0].trim()
}
function buildRegionParam(sidoKey: string, districtKey: string): string {
  const region = findRegionByKey(sidoKey)
  if (!region) return ''
  const sido = cleanSido(region.label)
  if (districtKey) {
    const dg = region.districtGroups.find((g) => g.key === districtKey)
    if (dg && dg.keywords.length) return `${sido} ${dg.keywords[0]}`.trim()  // 예: "서울 강남", "경기 인계동"
  }
  return sido  // 동네그룹 미선택 = 시/도 전체
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
  // 🎯 2026-07-03 (대표): 데모 채우기 지역 — 홈 필터와 동일 1차(시/도)·2차(동네그룹).
  const [seedSido, setSeedSido] = useState('')       // 1차: KOREA_REGIONS key (예 '서울')
  const [seedDistrict, setSeedDistrict] = useState('') // 2차: districtGroup key (예 'gangnam')
  const [seedCategory, setSeedCategory] = useState('')
  // 🔁 2026-07-04 (대표 "계속 생성해야 하는데"): 한 번에 생성 개수(라운드 보충으로 정확히 채움).
  const [seedCount, setSeedCount] = useState(8)
  // 🎛️ 2026-07-04 (대표 "지원자 수 조절 + 기간 설정 — 데모"): 추첨 마감(N일 후) + 표시 지원자 수 범위.
  const [seedFcfsDays, setSeedFcfsDays] = useState(7)
  // 🏷️ 2026-07-05 (대표 "옵션으로 선택할 수 있게"): 실상품형 vs 오픈 예정·사전 응모형(리뷰 미부착·구매 대신 응모).
  const [seedMode, setSeedMode] = useState<'live' | 'prelaunch'>('live')
  const [seedApplicantsMin, setSeedApplicantsMin] = useState('')
  const [seedApplicantsMax, setSeedApplicantsMax] = useState('')
  const sidoRegion = findRegionByKey(seedSido)
  // 💰 2026-07-05 (대표 "최대한 이상적으로"): 업종별 가격 밴드 보정(배율) 편집기.
  const [bandsOpen, setBandsOpen] = useState(false)
  const [bands, setBands] = useState<Array<{ pq: string; cat: string; min: number; max: number; multiplier: number }>>([])
  const [bandsUpdatedAt, setBandsUpdatedAt] = useState<string | null>(null)
  const [bandsSaving, setBandsSaving] = useState(false)
  const openBands = async () => {
    if (bandsOpen) { setBandsOpen(false); return }
    setBandsOpen(true)
    try {
      const r = await api.get('/api/admin/dongnedeal/price-bands', h)
      if (r.data?.success) { setBands(r.data.data || []); setBandsUpdatedAt(r.data.updated_at || null) }
    } catch { toast.error('밴드 불러오기 실패') }
  }
  const saveBands = async () => {
    setBandsSaving(true)
    try {
      const multipliers: Record<string, number> = {}
      for (const b of bands) if (Math.abs(b.multiplier - 1) > 0.001) multipliers[b.pq] = b.multiplier
      const r = await api.put('/api/admin/dongnedeal/price-bands', { multipliers }, h)
      if (r.data?.success) { setBandsUpdatedAt(r.data.updated_at); toast.success('가격 밴드 보정 저장됨 — 다음 생성부터 적용') }
      else toast.error(r.data?.error || '저장 실패')
    } catch { toast.error('저장 실패') } finally { setBandsSaving(false) }
  }
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
      const r = await api.delete('/api/admin/dongnedeal/seed-demo', { ...h, timeout: 120000 })
      const retired = Number(r.data?.retired ?? 0)
      toast.success(`데모 상품 ${r.data?.deleted ?? 0}개 삭제${retired ? ` · ${retired}개는 주문 이력이 있어 비활성 처리` : ''}`)
      loadStats()
    } catch { toast.error('데모 정리 중 오류') } finally { setCleaning(false) }
  }
  const seedDemo = async () => {
    setCleaning(true)
    try {
      const regionParam = buildRegionParam(seedSido, seedDistrict)
      const aMin = parseInt(seedApplicantsMin, 10)
      const aMax = parseInt(seedApplicantsMax, 10)
      // 🚑 2026-07-04 (대표 "데모 생성 오류"): 기본 axios timeout 15s < 생성 소요 → 요청당 5분 명시.
      // 🧩 2026-07-05 (실측 — 24개 한 요청이면 realPhotos 0): Cloudflare 요청당 외부호출 한도(50)에
      //   걸려 사진 다운로드가 전멸 → **8개씩 나눠 순차 호출**(각 요청이 한도를 새로 받음). 실측 검증:
      //   24개 1요청 = 실사진 0/24, 8개×3요청 = 실사진 23/24.
      let seededSum = 0, photoSum = 0, placedSum = 0, skippedSum = 0
      const CHUNK = 8
      for (let done = 0; done < seedCount; done += CHUNK) {
        const r = await api.post('/api/admin/dongnedeal/seed-demo', {
          region: regionParam || undefined,
          category: seedCategory || undefined,
          count: Math.min(CHUNK, seedCount - done),
          mode: seedMode === 'prelaunch' ? 'prelaunch' : undefined,
          fcfsDays: seedFcfsDays,
          applicantsMin: Number.isFinite(aMin) && aMin > 0 ? aMin : undefined,
          applicantsMax: Number.isFinite(aMax) && aMax > 0 ? aMax : undefined,
        }, { ...h, timeout: 300000 })
        seededSum += Number(r.data?.seeded ?? 0)
        photoSum += Number(r.data?.realPhotos ?? 0)
        placedSum += Number(r.data?.placed ?? 0)
        skippedSum += Number(r.data?.skipped ?? 0)
      }
      if (seededSum > 0) {
        const parts = [`데모 상품 ${seededSum}개 생성`, `실사진 ${photoSum}`, `매장매칭 ${placedSum}`]
        if (skippedSum > 0) parts.push(`${skippedSum}개 건너뜀(실매장 미매칭)`)
        toast.success(parts.join(' · '))
      } else if (skippedSum > 0) {
        // 🎯 전부 카카오 실매장 매칭 실패 — 실제 매장만 데모로 만드는 규칙이 걸러낸 상태.
        toast.error(`생성된 상품 없음 — ${skippedSum}개 모두 실제 매장을 못 찾았습니다. 지역을 바꿔보세요`)
      } else {
        toast.success('생성된 상품이 없습니다')
      }
      loadStats(); setListNonce((n) => n + 1)
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
              <div className="flex items-center gap-2 flex-wrap">
                {stats.demo > 0 && (
                  <button onClick={clearDemo} disabled={cleaning} className="px-3 py-2 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">데모 {stats.demo}개 정리</button>
                )}
                {/* 🎯 2026-07-03 (대표 "지역은 홈 필터 그대로 — 1차/2차"): 소비자 홈과 동일 SSOT(KOREA_REGIONS).
                    1차 시/도 → 2차 동네그룹. 선택값을 카카오 지오코딩 → 그 동네 실매장 매칭. */}
                <select
                  value={seedSido}
                  onChange={(e) => { setSeedSido(e.target.value); setSeedDistrict('') }}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                  aria-label="시/도 선택"
                >
                  <option value="">시/도 (전체)</option>
                  {KOREA_REGIONS.map((r) => (
                    <option key={r.key} value={r.key}>{r.label.replace(/\n/g, ' ')}</option>
                  ))}
                </select>
                <select
                  value={seedDistrict}
                  onChange={(e) => setSeedDistrict(e.target.value)}
                  disabled={!sidoRegion || sidoRegion.districtGroups.length === 0}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white disabled:opacity-50 max-w-[220px]"
                  aria-label="동네 선택"
                >
                  <option value="">{sidoRegion ? `${cleanSido(sidoRegion.label)} 전체` : '동네 (시/도 먼저)'}</option>
                  {sidoRegion?.districtGroups.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
                <select
                  value={seedCategory}
                  onChange={(e) => setSeedCategory(e.target.value)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                >
                  <option value="">전체 카테고리</option>
                  <option value="meal_voucher">맛집 이용권</option>
                  <option value="beauty_voucher">미용</option>
                  <option value="etc_voucher">기타</option>
                  <option value="general">일반 상품</option>
                </select>
                {/* 🏷️ 데모 유형 — 실상품형(리뷰 포함) vs 오픈 예정형(사전 응모, 리뷰 없음) */}
                <select
                  value={seedMode}
                  onChange={(e) => setSeedMode(e.target.value as 'live' | 'prelaunch')}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                  aria-label="데모 유형"
                >
                  <option value="live">실상품형</option>
                  <option value="prelaunch">오픈 예정형</option>
                </select>
                <select
                  value={seedCount}
                  onChange={(e) => setSeedCount(Number(e.target.value))}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                  aria-label="생성 개수"
                >
                  <option value={8}>8개</option>
                  <option value={16}>16개</option>
                  <option value={24}>24개</option>
                </select>
                {/* 🎛️ 추첨 마감 + 표시 지원자 수 범위 (데모 시드 옵션) */}
                <select
                  value={seedFcfsDays}
                  onChange={(e) => setSeedFcfsDays(Number(e.target.value))}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white"
                  aria-label="추첨 마감 기간"
                >
                  <option value={3}>마감 3일</option>
                  <option value={7}>마감 7일</option>
                  <option value={14}>마감 14일</option>
                  <option value={30}>마감 30일</option>
                </select>
                <input value={seedApplicantsMin} onChange={(e) => setSeedApplicantsMin(e.target.value.replace(/\D/g, ''))} placeholder="지원자↓" maxLength={4} className="w-[70px] px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" title="표시 지원자 수 최소(비우면 기본)" />
                <input value={seedApplicantsMax} onChange={(e) => setSeedApplicantsMax(e.target.value.replace(/\D/g, ''))} placeholder="지원자↑" maxLength={4} className="w-[70px] px-2 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" title="표시 지원자 수 최대" />
                <button onClick={seedDemo} disabled={cleaning} className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50">{cleaning ? '생성 중…' : '데모 채우기'}</button>
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

        {/* 💰 업종별 가격 밴드 보정 — 시세 스냅샷 낡음 방지(물가 변동 시 배율로 보정) */}
        <div className={card}>
          <button onClick={openBands} className="w-full flex items-center justify-between text-left">
            <p className="text-sm font-bold text-gray-900">💰 데모 가격 밴드 보정 (업종별 배율)</p>
            <span className="text-[12px] text-gray-400">{bandsOpen ? '접기 ▲' : `펼치기 ▼${bandsUpdatedAt ? ` · 최종 보정 ${bandsUpdatedAt.slice(0, 10)}` : ''}`}</span>
          </button>
          {bandsOpen && (
            <div className="mt-3">
              <p className="text-[11px] text-gray-400 mb-2">기준 밴드는 시세 스냅샷(2026-07 캘리브레이션) — 물가가 바뀌면 배율(0.5~2.0)로 보정하세요. 다음 생성분부터 적용됩니다.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 max-h-72 overflow-y-auto pr-1">
                {bands.map((b, i) => (
                  <label key={b.pq} className="flex items-center justify-between gap-2 text-[12px] text-gray-600">
                    <span className="truncate">{b.pq} <span className="text-gray-400">({Math.round(b.min * b.multiplier / 1000)}~{Math.round(b.max * b.multiplier / 1000)}천원)</span></span>
                    <input
                      type="number" step="0.05" min="0.5" max="2"
                      value={b.multiplier}
                      onChange={(e) => { const v = Number(e.target.value); setBands((prev) => prev.map((x, j) => j === i ? { ...x, multiplier: Number.isFinite(v) ? v : 1 } : x)) }}
                      className="w-16 px-1.5 py-1 border border-gray-200 rounded text-[12px] text-gray-900 text-right shrink-0"
                    />
                  </label>
                ))}
              </div>
              <button onClick={saveBands} disabled={bandsSaving} className="mt-3 px-3 py-2 rounded-lg text-sm font-bold text-white bg-gray-900 hover:bg-black disabled:opacity-50">{bandsSaving ? '저장 중…' : '배율 저장'}</button>
            </div>
          )}
        </div>

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
