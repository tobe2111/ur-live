import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🏘️ **카페 트랙 원클릭 스위치** (2026-08-11 대표 지시 *"원클릭으로 카페도 켤 수 있게"*).
 *
 *   그전엔 Cloudflare 대시보드에서 워커 env 를 편집 → 재배포해야 켰다. 판단은 대표 것인데 수단이 없었다.
 *
 *   ⚠️ **스위치만 주지 않는다** — 같은 카드에 실측을 함께 띄운다. `CollectConfigPanel`(매장후보)이
 *   *"숫자를 바꿀 수 있게 하면서 결과를 안 보여주면 추측으로 조정하게 된다"* 고 적어 둔 것과 같은 이유다.
 *   카페는 특히 그렇다: 리드는 쌓이는데 **이메일이 0** 이고, 지금은 회차 예산이 캡이라 켜는 만큼
 *   키워드 폭이 줄어든다(= 발굴량 직접 감소). 그 상충을 숫자로 보고 누르게 한다.
 */
interface CafeGate {
  enabled: boolean
  setting: string | null
  env_fallback: string | null
  leads: number
  emails: number
  measured: number
}

export default function CafeTrackToggle() {
  const [gate, setGate] = useState<CafeGate | null>(null)
  const [saving, setSaving] = useState(false)
  const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/admin/ads/influencer-pool/collect-gates', auth)
      if (r.data?.success) setGate(r.data.data.cafe)
    } catch { /* 카드만 안 뜬다 — 수집 상태는 옆 패널이 이미 보여준다 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(next: boolean) {
    setSaving(true)
    try {
      const r = await api.patch('/api/admin/ads/influencer-pool/collect-gates', { cafe: next }, auth)
      // 서버가 다시 판정한 값을 반영한다(보낸 값을 믿고 그리면 화면과 실제가 갈라진다).
      if (r.data?.success) {
        setGate(g => (g ? { ...g, ...r.data.data.cafe } : g))
        toast.success(next ? '카페 수집 ON — 다음 회차부터 적용' : '카페 수집 OFF — 다음 회차부터 적용')
      }
    } catch { toast.error('저장 실패') } finally { setSaving(false) }
  }

  if (!gate) return null
  const emailRate = gate.leads > 0 ? (gate.emails / gate.leads) * 100 : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold text-gray-900">🏘️ 네이버 카페 수집</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${gate.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {gate.enabled ? 'ON' : 'OFF'}
        </span>
        {gate.setting === null && (
          <span className="text-[11px] text-gray-400" title={`설정 미지정 — 워커 env(${gate.env_fallback ?? '미설정'})를 따르는 중`}>
            env 폴백
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => toggle(!gate.enabled)}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 ${gate.enabled ? 'bg-gray-700 hover:bg-gray-800' : 'bg-brand hover:bg-brand-dark'}`}
        >
          {saving ? '저장 중…' : gate.enabled ? '끄기' : '켜기'}
        </button>
      </div>
      {/* 📊 켤 가치 — 전수 실측(표본 아님). 이 숫자가 스위치의 근거다. */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[10px] text-gray-500">수집된 카페</p><p className="text-sm font-bold text-gray-900">{formatNumber(gate.leads)}</p></div>
        <div><p className="text-[10px] text-gray-500">이메일 확보</p><p className={`text-sm font-bold ${gate.emails > 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatNumber(gate.emails)}</p></div>
        <div><p className="text-[10px] text-gray-500">연락 가능률</p><p className={`text-sm font-bold ${emailRate >= 1 ? 'text-gray-900' : 'text-red-600'}`}>{emailRate.toFixed(1)}%</p></div>
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        {gate.emails === 0
          ? '⚠️ 지금까지 수집한 카페에서 이메일이 0건입니다 — 카페는 보강(측정) 경로가 없어 제휴 제안을 보낼 수 없습니다.'
          : '카페 리드의 연락 가능률입니다.'}
        {' '}회차 예산이 상한에 닿아 있어, 켜면 키워드마다 호출을 1개씩 더 써 <b>돌 수 있는 키워드 수가 줄어듭니다</b>.
        언제든 이 버튼으로 되돌릴 수 있고, 다음 회차부터 반영됩니다.
      </p>
    </div>
  )
}
