/**
 * 🧾 후기 보너스 설정 (셀러 대시보드) — 2026-08-31 대표 지시
 *
 * > "후기 보너스는 그러면 매장 사장님이 설정할 수 있도록 하자. 셀러 대시보드에서 말이야."
 *
 * 판정 SSOT 는 서버(`review-bonus-funding.ts`)다. 이 카드는 그 값을 읽고 쓰기만 한다 —
 * 특히 **재원 표기(`funded_by`)를 클라에서 추측하지 않는다.** 매장이 값을 넣어도 게이트가
 * 꺼져 있으면 실제 부담은 아직 유어딜이고, 사장님에게는 그 사실대로 보여야 한다.
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { Loader2, MessageSquareHeart } from 'lucide-react'

interface Policy { amount: number; store_set: boolean; funded_by: 'owner' | 'platform' }

export default function ReviewBonusCard() {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await api.get('/api/seller/stores/review-bonus')
      if (!r.data?.success) throw new Error(r.data?.error)
      const p: Policy = r.data.data
      setPolicy(p)
      setInput(p.store_set ? String(p.amount) : '')
    } catch (e: any) {
      setError(e?.response?.data?.error || '후기 보너스 설정을 불러오지 못했습니다')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function save(amount: number | null) {
    setSaving(true); setError(null); setSaved(false)
    try {
      const r = await api.patch('/api/seller/stores/review-bonus', { amount })
      if (!r.data?.success) throw new Error(r.data?.error)
      const p: Policy = r.data.data
      setPolicy(p)
      setInput(p.store_set ? String(p.amount) : '')
      setSaved(true)
    } catch (e: any) {
      setError(e?.response?.data?.error || '저장하지 못했습니다')
    } finally { setSaving(false) }
  }

  function onSave() {
    const t = input.trim()
    if (t === '') return save(null)
    const n = Number(t)
    if (!Number.isInteger(n) || n < 0 || n > 100000) { setError('0 이상 100,000 이하의 정수를 입력하세요'); return }
    save(n)
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquareHeart className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-bold text-gray-900">후기 보너스</h2>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
        손님이 카카오 지도에 후기를 남기고 매장이 확인해 주면 지급되는 딜입니다.
        별점과 후기 수는 매장의 자산이라, 금액을 매장이 직접 정합니다.
      </p>

      {loading ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-[220px]">
              <input
                type="number" min={0} max={100000} step={100} inputMode="numeric"
                value={input} onChange={e => { setInput(e.target.value); setSaved(false) }}
                placeholder={policy ? `기본값 ${policy.amount.toLocaleString()}` : '기본값'}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">딜</span>
            </div>
            <button onClick={onSave} disabled={saving}
              className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-50">
              {saving ? '저장 중…' : '저장'}
            </button>
            {policy?.store_set && (
              <button onClick={() => save(null)} disabled={saving}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-[11px] font-semibold hover:bg-gray-50 disabled:opacity-50">
                기본값으로
              </button>
            )}
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            비워 두면 유어딜 기본값을 씁니다. 지금 적용값{' '}
            <b className="text-gray-900">{(policy?.amount ?? 0).toLocaleString()}딜</b>
            {policy?.store_set ? ' (매장이 정한 값)' : ' (유어딜 기본값)'}
          </p>

          {/* ⚠️ 재원은 서버 판정을 그대로 옮긴다 — 아직 매장 정산에서 빠지지 않는데
              "매장 부담"이라고 쓰면 사장님이 없는 청구를 믿게 된다. */}
          {policy && (
            policy.funded_by === 'owner' ? (
              <p className="mt-1 text-[11px] text-amber-700">이 금액은 매장 정산에서 차감됩니다.</p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-400">
                지금은 유어딜이 부담합니다. 매장 정산 차감은 준비가 끝난 뒤 안내드리고 시작합니다.
              </p>
            )
          )}

          {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
          {saved && !error && <p className="mt-2 text-[11px] text-emerald-700">저장했어요.</p>}
        </>
      )}
    </div>
  )
}
