/**
 * 💰 어드민 매장 카드 — 채널(직접/대행) 스위치 + **돈 갈림표**.
 *
 * 대표 2026-08-31: *"되게 복잡해졌어"* → 매장 하나를 이해하려면 화면 다섯을 열어야 했다.
 * 그래서 질문을 둘로 줄이고, **바꾸면 돈이 어떻게 갈리는지 그 자리에서** 보여준다:
 *
 *   ① 이 매장, 누가 운영하나?  → 채널 (직접 10% / 대행 5%)
 *   ② 이 매장, 누가 데려왔나?  → 영입자 2%·1년 (직접 입점 매장만)
 *
 * 🔒 **어드민 전용이다** — 대표: *"3번 결과는 운영자인 나만 보여야 해"*.
 *   표에 PG 준비금과 유어딜 실수령이 들어간다. 매장·소개자에게 보일 성질이 아니므로
 *   이 컴포넌트를 셀러/소개자 화면에서 재사용하지 말 것.
 *
 * 라이트 테마 고정(대시보드 룰 — `dark:` 금지).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'

type Channel = 'direct' | 'brokered'

interface Rates {
  direct_pct: number
  brokered_pct: number
  pg_reserve_pct: number
  store_intro_pct: number
}

interface ChannelData {
  seller_id: number
  channel: Channel | null
  channel_rates_active: boolean
  rates: Rates
}

/** 표에 쓰는 기준 주문액. 감각을 잡는 용도라 딱 떨어지는 값으로 고정한다. */
const SAMPLE_ORDER = 10_000

export default function StoreChannelCard({
  sellerId,
  hasIntroducer,
}: {
  sellerId: number
  /** 영입자가 지정돼 있나 — 없으면 채널이 direct 여도 2% 는 나갈 데가 없다. */
  hasIntroducer: boolean
}) {
  const [data, setData] = useState<ChannelData | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    api.get(`/api/admin/sellers/${sellerId}/channel`)
      .then((res) => { if (alive && res.data?.success) setData(res.data.data) })
      .catch(() => { /* 조회 실패 시 카드를 안 그린다 — 틀린 숫자보다 없는 게 낫다 */ })
    return () => { alive = false }
  }, [sellerId])

  async function setChannel(next: Channel) {
    if (saving || data?.channel === next) return
    setSaving(true)
    try {
      const res = await api.patch(`/api/admin/sellers/${sellerId}/channel`, { channel: next })
      if (res.data?.success) {
        setData((d) => (d ? { ...d, channel: next } : d))
        // 게이트가 꺼져 있으면 서버가 그 사실을 message 로 알려준다 — 숨기지 않고 그대로 띄운다.
        toast.success(res.data.message || '채널을 변경했습니다')
      } else {
        toast.error(res.data?.error || '변경 실패')
      }
    } catch {
      toast.error('변경 중 오류')
    } finally {
      setSaving(false)
    }
  }

  if (!data) return null
  const { channel, channel_rates_active: gateOn, rates } = data

  // 채널 미지정이면 요율을 종전 경로(sellers.commission_rate 등)가 정한다 — 여기서 계산할 수 없다.
  const feePct = channel === 'direct' ? rates.direct_pct : channel === 'brokered' ? rates.brokered_pct : null
  const fee = feePct != null ? Math.floor((SAMPLE_ORDER * feePct) / 100) : null
  const pg = Math.floor((SAMPLE_ORDER * rates.pg_reserve_pct) / 100)
  // 영입 2% 는 **직접 입점 + 영입자 지정** 둘 다여야 나간다(2026-08-31, PR #1254).
  const introPays = channel === 'direct' && hasIntroducer
  const intro = introPays ? Math.floor((SAMPLE_ORDER * rates.store_intro_pct) / 100) : 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-gray-900">이 매장, 누가 운영하나?</p>
        <p className="text-xs text-gray-500 mt-0.5">유어딜이 얼마를 뗄지 정합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(['direct', 'brokered'] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={saving}
            onClick={() => setChannel(c)}
            className={`rounded-lg border-2 p-3 text-left transition ${
              channel === c ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300'
            } ${saving ? 'opacity-60' : ''}`}
          >
            <p className="text-sm font-bold text-gray-900">
              {c === 'direct' ? '매장이 직접' : '대행사 경유'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              유어딜 {c === 'direct' ? rates.direct_pct : rates.brokered_pct}%
            </p>
          </button>
        ))}
      </div>

      {channel === null && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          아직 지정 안 됨 — 요율은 종전 경로가 정하고, <b>영입 2%는 나가지 않습니다.</b>
        </p>
      )}
      {!gateOn && (
        <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2">
          채널 요율 스위치가 꺼져 있어 <b>지금은 요율에 반영되지 않습니다</b>(설정에서 켤 수 있습니다).
        </p>
      )}

      {/* 💰 돈 갈림표 — 어드민 전용 */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
        <p className="text-xs font-bold text-gray-700 mb-2">
          {formatWon(SAMPLE_ORDER)} 주문이면 <span className="font-normal text-gray-500">(어드민만 보임)</span>
        </p>
        {fee == null ? (
          <p className="text-xs text-gray-500">채널을 정하면 계산해서 보여드립니다.</p>
        ) : (
          <table className="w-full text-xs tabular-nums">
            <tbody>
              <tr><td className="py-0.5 text-gray-600">매장 수령</td><td className="py-0.5 text-right font-medium text-gray-900">{formatWon(SAMPLE_ORDER - fee)}</td></tr>
              <tr><td className="py-0.5 text-gray-600">유어딜 수수료 ({feePct}%)</td><td className="py-0.5 text-right text-gray-900">{formatWon(fee)}</td></tr>
              <tr><td className="py-0.5 text-gray-500 pl-3">− PG 준비금 ({rates.pg_reserve_pct}%)</td><td className="py-0.5 text-right text-gray-500">−{formatWon(pg)}</td></tr>
              <tr>
                <td className="py-0.5 text-gray-500 pl-3">
                  − 영입자 몫 ({rates.store_intro_pct}%)
                  {!introPays && <span className="ml-1 text-gray-400">{channel === 'brokered' ? '· 대행이라 미지급' : '· 영입자 없음'}</span>}
                </td>
                <td className="py-0.5 text-right text-gray-500">{intro > 0 ? `−${formatWon(intro)}` : '—'}</td>
              </tr>
              <tr className="border-t border-gray-300">
                <td className="pt-1.5 font-bold text-gray-900">유어딜 실수령</td>
                <td className={`pt-1.5 text-right font-bold ${fee - pg - intro <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatWon(fee - pg - intro)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
