/**
 * 🏙️ 2026-07-05 상권 방문 리워드 캠페인 관리 (B2G 상권 패키지 — 실행계획 "첫 구매 시 무상 딜 지급").
 *
 * 캠페인(대상 상권·기간·지급액·총액 캡) 생성/종료 + 지급 건수·소진액 현황.
 * 지급 로직 SSOT 는 worker/utils/visit-reward.ts — 첫 구매 트리거 · 1인 1회 멱등 ·
 * 캡 도달 자동 종료 · 무상 딜(free 버킷) 태깅 · 환불 회수. 여기는 운영 화면만.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { Gift, RefreshCw, Plus, StopCircle, Play } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'

interface Campaign {
  id: number
  name: string
  region_code: string
  reward_amount: number
  total_budget: number
  starts_at: string | null
  ends_at: string | null
  status: 'active' | 'ended'
  created_at: string
  spent: number
  granted_count: number
  revoked_count: number
}

const PRESETS: Array<{ label: string; code: string }> = [
  { label: '서초구', code: '11650' },
  { label: '강남구', code: '11680' },
  { label: '송파구', code: '11710' },
  { label: '마포구', code: '11440' },
]

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token')}` })

export default function AdminVisitRewardsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', region_code: '11650', reward_amount: '2000', total_budget: '1000000', starts_at: '', ends_at: '',
  })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/api/admin/region/visit-rewards', { headers: authHeaders() })
      if (res.data?.success) setCampaigns(res.data.data || [])
      else setError(res.data?.error || '불러오기 실패')
    } catch {
      setError('캠페인 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    const reward = parseInt(form.reward_amount, 10)
    const budget = parseInt(form.total_budget, 10)
    if (!form.name.trim()) { toast.error('캠페인 이름을 입력하세요'); return }
    if (!/^\d{5,12}$/.test(form.region_code)) { toast.error('지역코드는 숫자 5~12자리 (예: 서초구 11650)'); return }
    if (!Number.isFinite(reward) || reward < 100) { toast.error('지급액은 100딜 이상'); return }
    if (!Number.isFinite(budget) || budget < reward) { toast.error('총액 캡은 지급액 이상'); return }
    setSaving(true)
    try {
      const res = await api.post('/api/admin/region/visit-rewards', {
        name: form.name.trim(),
        region_code: form.region_code,
        reward_amount: reward,
        total_budget: budget,
        starts_at: form.starts_at || undefined,
        ends_at: form.ends_at || undefined,
      }, { headers: authHeaders() })
      if (res.data?.success) {
        toast.success('캠페인이 생성됐습니다')
        setShowForm(false)
        setForm({ name: '', region_code: '11650', reward_amount: '2000', total_budget: '1000000', starts_at: '', ends_at: '' })
        load()
      } else toast.error(res.data?.error || '생성 실패')
    } catch {
      toast.error('생성 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (camp: Campaign, status: 'active' | 'ended') => {
    const msg = status === 'ended'
      ? `"${camp.name}" 캠페인을 종료할까요? 이후 신규 지급이 멈춥니다.`
      : `"${camp.name}" 캠페인을 재활성화할까요? 남은 예산 한도 안에서 지급이 재개됩니다.`
    if (!(await confirmDialog({ message: msg }))) return
    try {
      const res = await api.patch(`/api/admin/region/visit-rewards/${camp.id}`, { status }, { headers: authHeaders() })
      if (res.data?.success) { toast.success('변경됐습니다'); load() }
      else toast.error(res.data?.error || '변경 실패')
    } catch {
      toast.error('변경 중 오류가 발생했습니다')
    }
  }

  return (
    <AdminLayout title="상권 방문 리워드">
      <div className="p-4 lg:p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-gray-700" />
            <h1 className="text-lg font-extrabold text-gray-900">상권 방문 리워드</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" title="새로고침">
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            <button
              type="button"
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
            >
              <Plus className="w-4 h-4" /> 캠페인 만들기
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          캠페인 상권(지역코드 prefix) 매장 상품을 기간 내 <b>처음 구매 확정</b>한 유저에게 무상 딜을 <b>1인 1회</b> 지급합니다.
          총액 캡 도달 시 자동 종료되고, 트리거 주문이 환불되면 리워드도 회수됩니다. 지급 딜은 무상(출금 불가) 버킷입니다.
        </p>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
            <h2 className="text-sm font-bold text-gray-900 mb-3">새 캠페인</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-gray-500">캠페인 이름</span>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="서초 상권 첫구매 리워드 (8월)"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">상권 지역코드 (시군구 5자리 / 행정동 10자리)</span>
                <div className="mt-1 flex gap-1.5">
                  <input value={form.region_code} onChange={e => setForm(f => ({ ...f, region_code: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
                  {PRESETS.map(p => (
                    <button key={p.code} type="button" onClick={() => setForm(f => ({ ...f, region_code: p.code }))}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${form.region_code === p.code ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">지급액 (딜/인)</span>
                <input inputMode="numeric" value={form.reward_amount} onChange={e => setForm(f => ({ ...f, reward_amount: e.target.value.replace(/\D/g, '') }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">총액 캡 (딜) — 도달 시 자동 종료</span>
                <input inputMode="numeric" value={form.total_budget} onChange={e => setForm(f => ({ ...f, total_budget: e.target.value.replace(/\D/g, '') }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">시작일 (선택, YYYY-MM-DD)</span>
                <input type="date" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">종료일 (선택, YYYY-MM-DD)</span>
                <input type="date" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900" />
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50">취소</button>
              <button type="button" onClick={create} disabled={saving}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-50">
                {saving ? '생성 중…' : '생성'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={load} className="text-xs font-bold underline underline-offset-2">다시 시도</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : campaigns.length === 0 && !error ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">
            아직 캠페인이 없습니다. "캠페인 만들기"로 첫 상권 리워드를 시작하세요.
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(camp => {
              const spentPct = camp.total_budget > 0 ? Math.min(100, Math.round((camp.spent / camp.total_budget) * 100)) : 0
              return (
                <div key={camp.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{camp.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${camp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {camp.status === 'active' ? '진행 중' : '종료'}
                        </span>
                        <span className="text-[11px] text-gray-400">지역 {camp.region_code}</span>
                        {(camp.starts_at || camp.ends_at) && (
                          <span className="text-[11px] text-gray-400">
                            {(camp.starts_at || '').slice(0, 10) || '—'} ~ {(camp.ends_at || '').slice(0, 10) || '—'}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        지급 {formatNumber(camp.reward_amount)}딜/인 · 지급 {formatNumber(camp.granted_count)}건
                        {camp.revoked_count > 0 && ` (회수 ${formatNumber(camp.revoked_count)}건)`}
                      </p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                          <span>소진 {formatNumber(camp.spent)}딜 / 캡 {formatNumber(camp.total_budget)}딜</span>
                          <span>{spentPct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-900 rounded-full" style={{ width: `${spentPct}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {camp.status === 'active' ? (
                        <button type="button" onClick={() => setStatus(camp, 'ended')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50">
                          <StopCircle className="w-3.5 h-3.5" /> 종료
                        </button>
                      ) : (
                        <button type="button" onClick={() => setStatus(camp, 'active')}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50">
                          <Play className="w-3.5 h-3.5" /> 재개
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
