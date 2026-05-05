import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Zap, X } from 'lucide-react'

interface BoosterStatus {
  id: number
  multiplier: number
  duration_seconds: number
  ends_at: string
  total_donation_amount: number
  total_matched_amount: number
}

interface Props {
  liveStreamId: number
}

/**
 * 셀러용 후원 부스터 발동 버튼.
 *
 * 라이브 페이지에 마운트해서 사용. 라이브 1회 당 1회 발동 가능.
 * 활성 부스터가 있으면 카운트다운 + 매칭 실시간 표시.
 */
export default function DonationBoosterButton({ liveStreamId }: Props) {
  const { t } = useTranslation()
  const [active, setActive] = useState<BoosterStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showOptions, setShowOptions] = useState(false)
  const [now, setNow] = useState(Date.now())

  async function fetchActive() {
    try {
      const r = await api.get(`/api/donation-boosters-public/live/${liveStreamId}`)
      setActive(r.data?.data || null)
    } catch { /* skip */ }
    setLoading(false)
  }

  useEffect(() => {
    fetchActive()
    const interval = setInterval(() => {
      setNow(Date.now())
      if (!document.hidden) fetchActive()
    }, 10_000)
    return () => clearInterval(interval)
  }, [liveStreamId])

  async function startBooster(multiplier: number, durationSec: number) {
    if (!confirm(t('seller.boosterConfirm', { multiplier, minutes: Math.floor(durationSec / 60), defaultValue: `${multiplier}x 매칭 부스터를 ${Math.floor(durationSec / 60)}분 동안 발동하시겠습니까? 라이브 1회당 1번만 사용 가능합니다.` }))) return
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.post('/api/donation-boosters', {
        live_stream_id: liveStreamId,
        multiplier,
        duration_seconds: durationSec,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) {
        toast.success(t('seller.boosterActivated', { multiplier, defaultValue: `🚀 ${multiplier}x 부스터 발동!` }))
        setShowOptions(false)
        fetchActive()
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('seller.boosterActivateFailed', { defaultValue: '부스터 발동 실패' }))
    }
  }

  async function cancelBooster() {
    if (!active) return
    if (!confirm(t('seller.boosterCancelConfirm', { defaultValue: '부스터를 조기 종료하시겠습니까?' }))) return
    try {
      const token = localStorage.getItem('seller_token')
      await api.post(`/api/donation-boosters/${active.id}/cancel`, {},
        { headers: { Authorization: `Bearer ${token}` } })
      toast.info(t('seller.boosterCancelled', { defaultValue: '부스터 종료됨' }))
      fetchActive()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('common.error', { defaultValue: '실패' }))
    }
  }

  if (loading) return null

  // 활성 부스터 표시
  if (active) {
    const remainingMs = new Date(active.ends_at).getTime() - now
    const remainingSec = Math.max(0, Math.floor(remainingMs / 1000))
    const mm = Math.floor(remainingSec / 60)
    const ss = remainingSec % 60
    return (
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl p-3 shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Zap className="w-4 h-4 fill-white" />
            <span>{t('seller.boosterActive', { multiplier: active.multiplier, defaultValue: '{{multiplier}}x 매칭 진행 중' })}</span>
          </div>
          <button onClick={cancelBooster} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-2xl font-bold tabular-nums text-center mb-2">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white/20 rounded p-1.5">
            <div className="opacity-80">{t('seller.boosterReceived', { defaultValue: '받은 후원' })}</div>
            <div className="font-bold">{(active.total_donation_amount / 10_000).toFixed(1)}{t('common.unitMan', { defaultValue: '만' })}</div>
          </div>
          <div className="bg-white/20 rounded p-1.5">
            <div className="opacity-80">{t('seller.boosterMatched', { defaultValue: '매칭 추가' })}</div>
            <div className="font-bold">+{(active.total_matched_amount / 10_000).toFixed(1)}{t('common.unitMan', { defaultValue: '만' })}</div>
          </div>
        </div>
      </div>
    )
  }

  // 발동 버튼 + 옵션
  if (showOptions) {
    return (
      <div className="bg-white border border-purple-200 rounded-xl p-3 shadow">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-gray-900">{t('seller.boosterOptions', { defaultValue: '⚡ 후원 부스터 옵션' })}</h4>
          <button onClick={() => setShowOptions(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { mul: 1.5, dur: 900, label: '1.5x', sub: t('seller.boosterMin', { min: 15, defaultValue: '15분' }) },
            { mul: 2.0, dur: 600, label: '2x',   sub: t('seller.boosterMin', { min: 10, defaultValue: '10분' }) },
            { mul: 3.0, dur: 300, label: '3x',   sub: t('seller.boosterMin', { min: 5,  defaultValue: '5분' }) },
          ].map(opt => (
            <button
              key={opt.mul}
              onClick={() => startBooster(opt.mul, opt.dur)}
              className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg text-center"
            >
              <div className="text-lg font-bold">{opt.label}</div>
              <div className="text-[10px] opacity-90">{opt.sub}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-2 italic">
          {t('seller.boosterNotice', { defaultValue: '⚠️ 라이브 1회당 1번만 사용 가능. 매칭 금액은 시청자 결제와 별개로 시스템이 즉시 가산 처리합니다.' })}
        </p>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowOptions(true)}
      className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-xs font-bold rounded-lg shadow"
    >
      <Zap className="w-4 h-4" />
      {t('seller.boosterActivate', { defaultValue: '후원 부스터 발동' })}
    </button>
  )
}
