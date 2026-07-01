/**
 * 🎯 2026-06-20 (대표 — 추첨 응모 상품 관리): 어드민에서 특정 공구 상품에 추첨 설정 + 응모자 조회 + 선정.
 *   백엔드: src/features/group-buy/api/fcfs.routes.ts (PUT 설정 / GET applicants / POST select).
 *   라이트 테마 고정(AdminLayout) — 다크 variant 미사용.
 */
import { useState } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

interface Applicant {
  id: number
  user_id: string
  status: string
  created_at: string
  selected_at: string | null
  user_name?: string
  user_phone?: string
}

export default function AdminFcfsPage() {
  const [productId, setProductId] = useState('')
  const [loading, setLoading] = useState(false)
  const [cfg, setCfg] = useState({ enabled: false, spots: 5, appliedSeed: 100, deadline: '' })
  const [realApplied, setRealApplied] = useState(0)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [randomCount, setRandomCount] = useState('')

  const pid = parseInt(productId, 10)
  const valid = Number.isFinite(pid) && pid > 0

  async function load() {
    if (!valid) { toast.error('상품 ID를 입력하세요'); return }
    setLoading(true)
    try {
      const [cfgRes, appRes] = await Promise.all([
        api.get(`/api/fcfs/${pid}`),
        api.get(`/api/admin/fcfs/${pid}/applicants`),
      ])
      const d = cfgRes.data?.data
      if (d) setCfg({ enabled: !!d.enabled, spots: d.spots || 0, appliedSeed: d.appliedSeed || 0, deadline: d.deadline || '' })
      setRealApplied(d?.realApplied || 0)
      setApplicants(appRes.data?.data || [])
      setChecked(new Set())
    } catch {
      toast.error('불러오기 실패')
    } finally { setLoading(false) }
  }

  async function saveConfig() {
    if (!valid) return
    setLoading(true)
    try {
      await api.put(`/api/admin/fcfs/${pid}`, {
        enabled: cfg.enabled,
        spots: cfg.spots,
        appliedSeed: cfg.appliedSeed,
        deadline: cfg.deadline || null,
      })
      toast.success('추첨 설정 저장됨')
    } catch {
      toast.error('저장 실패')
    } finally { setLoading(false) }
  }

  async function select(payload: { winners?: string[]; count?: number }) {
    if (!valid) return
    setLoading(true)
    try {
      const res = await api.post(`/api/admin/fcfs/${pid}/select`, payload)
      toast.success(`${res.data?.data?.selected || 0}명 선정 + 알림 발송`)
      await load()
    } catch {
      toast.error('선정 실패')
    } finally { setLoading(false) }
  }

  const displayApplied = cfg.appliedSeed + realApplied
  const inputCls = 'w-full px-3 h-10 rounded-lg border border-gray-300 text-sm text-gray-900 outline-none focus:border-gray-500'

  return (
    <AdminLayout title="추첨 응모 관리">
      <div className="max-w-3xl mx-auto p-4 space-y-5">
        {/* 상품 로드 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-bold text-gray-900 mb-2">공구 상품 ID</p>
          <div className="flex gap-2">
            <input value={productId} onChange={(e) => setProductId(e.target.value.replace(/[^0-9]/g, ''))} placeholder="예: 1234" className={inputCls} />
            <button onClick={load} disabled={loading} className="shrink-0 px-5 h-10 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50">불러오기</button>
          </div>
          <p className="text-[12px] text-gray-500 mt-2">기존 공구 상품의 ID를 입력해 추첨으로 지정합니다. (그 상품만 추첨 적용)</p>
        </div>

        {valid && (
          <>
            {/* 설정 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">추첨 설정 (상품 #{pid})</p>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="w-4 h-4" />
                  추첨 활성
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[12px] font-semibold text-gray-600 mb-1">모집 정원 (M)</p>
                  <input type="number" value={cfg.spots} onChange={(e) => setCfg({ ...cfg, spots: Math.max(0, parseInt(e.target.value, 10) || 0) })} className={inputCls} />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-gray-600 mb-1">응모수 시드 (표시 부풀림)</p>
                  <input type="number" value={cfg.appliedSeed} onChange={(e) => setCfg({ ...cfg, appliedSeed: Math.max(0, parseInt(e.target.value, 10) || 0) })} className={inputCls} />
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold text-gray-600 mb-1">마감 (선택, ISO 또는 YYYY-MM-DD)</p>
                <input value={cfg.deadline} onChange={(e) => setCfg({ ...cfg, deadline: e.target.value })} placeholder="2026-07-01" className={inputCls} />
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[13px] text-gray-700">표시: <b className="text-gray-900">추첨 {formatNumber(displayApplied)}/{formatNumber(cfg.spots)}명</b> <span className="text-gray-400">(실제 응모 {realApplied})</span></p>
                <button onClick={saveConfig} disabled={loading} className="px-5 h-10 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50">설정 저장</button>
              </div>
            </div>

            {/* 지원자 + 선정 */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900">응모자 ({applicants.length})</p>
                <div className="flex items-center gap-2">
                  <input value={randomCount} onChange={(e) => setRandomCount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="랜덤 N명" className="w-24 px-2 h-9 rounded-lg border border-gray-300 text-sm text-gray-900" />
                  <button onClick={() => select({ count: parseInt(randomCount, 10) || 0 })} disabled={loading || !randomCount} className="px-3 h-9 rounded-lg bg-gray-100 text-gray-900 text-[13px] font-bold disabled:opacity-50">랜덤 선정</button>
                  <button onClick={() => select({ winners: [...checked] })} disabled={loading || checked.size === 0} className="px-3 h-9 rounded-lg bg-gray-900 text-white text-[13px] font-bold disabled:opacity-50">선택 {checked.size}명 선정</button>
                </div>
              </div>
              {applicants.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">아직 응모자가 없습니다</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {applicants.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 py-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked.has(a.user_id)}
                        disabled={a.status === 'selected'}
                        onChange={(e) => { const n = new Set(checked); if (e.target.checked) n.add(a.user_id); else n.delete(a.user_id); setChecked(n) }}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.user_name || a.user_id} {a.user_phone ? <span className="text-gray-400 font-normal">· {a.user_phone}</span> : null}</p>
                        <p className="text-[11px] text-gray-400">{a.created_at}</p>
                      </div>
                      {a.status === 'selected'
                        ? <span className="text-[11px] font-bold text-white bg-gray-900 px-2 py-0.5 rounded-full shrink-0">선정됨</span>
                        : <span className="text-[11px] text-gray-400 shrink-0">응모</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
