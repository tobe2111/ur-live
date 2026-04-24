import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Gavel, Zap, Users } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import type { Product } from '@/components/seller/broadcast/broadcast-types'

// ── 경매 / 타임딜 컨트롤 ─────────────────────────────────────────
export function AuctionTimeDealControls({ streamId, products }: { streamId: number; products: Product[] }) {
  const { t } = useTranslation()
  const [showAuction, setShowAuction] = useState(false)
  const [showTimeDeal, setShowTimeDeal] = useState(false)
  const [showGroupBuy, setShowGroupBuy] = useState(false)
  const [auctionForm, setAuctionForm] = useState({ product_id: 0, title: '', start_price: 1000, min_increment: 1000, duration_seconds: 180 })
  const [dealForm, setDealForm] = useState({ product_id: 0, discount_percent: 30, max_claims: 10, duration_seconds: 30 })
  const [groupBuyForm, setGroupBuyForm] = useState({ product_id: 0, target_participants: 20, bonus_discount_percent: 50, duration_minutes: 10 })
  const [submitting, setSubmitting] = useState(false)
  const [activeAuction, setActiveAuction] = useState<{ ends_at?: string } | null>(null)
  const [activeTimeDeal, setActiveTimeDeal] = useState<{ ends_at?: string; is_group_buy?: boolean } | null>(null)
  const [tick, setTick] = useState(0)
  const token = localStorage.getItem('seller_token')

  // 활성 경매/타임딜 5초 폴링
  useEffect(() => {
    let active = true
    const fetchActive = async () => {
      try {
        const [au, td] = await Promise.allSettled([
          api.get(`/api/auction/stream/${streamId}`),
          api.get(`/api/timedeal/stream/${streamId}`),
        ])
        if (!active) return
        setActiveAuction(au.status === 'fulfilled' && au.value.data?.success ? (au.value.data.data || null) : null)
        setActiveTimeDeal(td.status === 'fulfilled' && td.value.data?.success ? (td.value.data.data || null) : null)
      } catch { /* silent */ }
    }
    fetchActive()
    const id = setInterval(fetchActive, 5000)
    return () => { active = false; clearInterval(id) }
  }, [streamId])

  // 1초 카운트다운 갱신
  useEffect(() => {
    if (!activeAuction?.ends_at && !activeTimeDeal?.ends_at) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [activeAuction?.ends_at, activeTimeDeal?.ends_at])

  function fmtRemaining(endsAt?: string): string {
    if (!endsAt) return ''
    const sec = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
    void tick
    const m = Math.floor(sec / 60), s = sec % 60
    return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
  }

  async function createAuction() {
    if (!auctionForm.title || !auctionForm.start_price) { toast.error(t('seller.liveBroadcast.enterTitleAndPrice')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/auction/create', { stream_id: streamId, ...auctionForm }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.auctionStarted')); setShowAuction(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.auctionCreateFailed')) }
    finally { setSubmitting(false) }
  }

  async function createTimeDeal() {
    if (!dealForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/create', { stream_id: streamId, ...dealForm }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.timeDealStarted', { seconds: dealForm.duration_seconds })); setShowTimeDeal(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.timeDealCreateFailed')) }
    finally { setSubmitting(false) }
  }

  async function createGroupBuy() {
    if (!groupBuyForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/create', {
        stream_id: streamId,
        product_id: groupBuyForm.product_id,
        discount_percent: 0,
        max_claims: 100,
        duration_seconds: groupBuyForm.duration_minutes * 60,
        is_group_buy: true,
        target_participants: groupBuyForm.target_participants,
        bonus_discount_percent: groupBuyForm.bonus_discount_percent,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) { toast.success(t('seller.liveBroadcast.groupBuyStarted')); setShowGroupBuy(false) }
      else toast.error(res.data.error)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; toast.error(e?.response?.data?.error || t('seller.liveBroadcast.groupBuyCreateFailed')) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-2">
      {/* 활성 진행 상태 */}
      {(activeAuction || activeTimeDeal) && (
        <div className="flex flex-wrap gap-2">
          {activeAuction && (
            <span className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-semibold">
              <Gavel className="w-3 h-3" />
              {t('seller.liveBroadcast.auction')} · {fmtRemaining(activeAuction.ends_at)}
            </span>
          )}
          {activeTimeDeal && (
            <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${activeTimeDeal.is_group_buy ? 'bg-pink-100 text-pink-800' : 'bg-red-100 text-red-800'}`}>
              {activeTimeDeal.is_group_buy ? <Users className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
              {activeTimeDeal.is_group_buy ? t('seller.liveBroadcast.liveGroupBuy') : t('seller.liveBroadcast.timeDeal')} · {fmtRemaining(activeTimeDeal.ends_at)}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => { setShowAuction(!showAuction); setShowTimeDeal(false); setShowGroupBuy(false) }}
          disabled={!!activeAuction}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showAuction ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <Gavel className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.auction')}
        </button>
        <button onClick={() => { setShowTimeDeal(!showTimeDeal); setShowAuction(false); setShowGroupBuy(false) }}
          disabled={!!activeTimeDeal}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showTimeDeal ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          <Zap className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.timeDeal')}
        </button>
        <button onClick={() => { setShowGroupBuy(!showGroupBuy); setShowAuction(false); setShowTimeDeal(false) }}
          disabled={!!activeTimeDeal}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${showGroupBuy ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-600 border border-pink-200'}`}>
          <Users className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.liveGroupBuy')}
        </button>
      </div>

      {showAuction && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-amber-800">{t('seller.liveBroadcast.auctionSetup')}</p>
          <input value={auctionForm.title} onChange={e => setAuctionForm(f => ({ ...f, title: e.target.value }))}
            placeholder={t('seller.liveBroadcast.auctionTitlePlaceholder')} className="w-full px-2.5 py-2 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white" />
          <select value={auctionForm.product_id} onChange={e => setAuctionForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductOptional')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {([['start_price', t('seller.liveBroadcast.startPrice')], ['min_increment', t('seller.liveBroadcast.minIncrement')], ['duration_seconds', t('seller.liveBroadcast.durationSec')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-amber-700">{label}</label>
                <input type="number" value={auctionForm[key]} onChange={e => setAuctionForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createAuction} disabled={submitting}
            className="w-full py-2 bg-amber-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startAuction')}
          </button>
        </div>
      )}

      {showTimeDeal && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-red-700">{t('seller.liveBroadcast.timeDealSetup')}</p>
          <select value={dealForm.product_id} onChange={e => setDealForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-red-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductRequired')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price?.toLocaleString()}{t('common.won')})</option>)}
          </select>
          {/* 퀵 프리셋 */}
          <div className="flex gap-1.5">
            {[60, 180, 300].map(sec => (
              <button key={sec} type="button"
                onClick={() => setDealForm(f => ({ ...f, duration_seconds: sec }))}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border ${
                  dealForm.duration_seconds === sec ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200'
                }`}>
                {sec < 60 ? `${sec}s` : `${sec / 60}분`}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([['discount_percent', t('seller.liveBroadcast.discountPercent')], ['max_claims', t('common.quantity')], ['duration_seconds', t('seller.liveBroadcast.durationSec')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-red-600">{label}</label>
                <input type="number" value={dealForm[key]} onChange={e => setDealForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-red-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createTimeDeal} disabled={submitting || !dealForm.product_id}
            className="w-full py-2 bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startTimeDeal', { seconds: dealForm.duration_seconds })}
          </button>
        </div>
      )}

      {showGroupBuy && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-pink-700">{t('seller.liveBroadcast.groupBuySetup')}</p>
          <p className="text-[10px] text-pink-600">{t('seller.liveBroadcast.groupBuySetupDesc')}</p>
          <select value={groupBuyForm.product_id} onChange={e => setGroupBuyForm(f => ({ ...f, product_id: Number(e.target.value) }))}
            className="w-full px-2.5 py-2 border border-pink-200 rounded-lg text-xs text-gray-900 bg-white">
            <option value={0}>{t('seller.liveBroadcast.selectProductRequired')}</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price?.toLocaleString()}{t('common.won')})</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            {([['target_participants', t('seller.liveBroadcast.targetParticipants')], ['bonus_discount_percent', t('seller.liveBroadcast.discountPercent')], ['duration_minutes', t('seller.liveBroadcast.durationMin')]] as const).map(([key, label]) => (
              <div key={key}>
                <label className="text-[10px] text-pink-600">{label}</label>
                <input type="number" value={groupBuyForm[key]} onChange={e => setGroupBuyForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 border border-pink-200 rounded-lg text-xs text-gray-900 bg-white" />
              </div>
            ))}
          </div>
          <button onClick={createGroupBuy} disabled={submitting || !groupBuyForm.product_id}
            className="w-full py-2 bg-pink-500 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            {submitting ? t('common.creating') : t('seller.liveBroadcast.startGroupBuy')}
          </button>
        </div>
      )}
    </div>
  )
}
