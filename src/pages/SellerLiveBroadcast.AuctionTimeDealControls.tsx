/**
 * AuctionTimeDealControls — 라이브 방송 중 경매/타임딜/공동구매 컨트롤.
 *
 * SellerLiveBroadcastPage.tsx 에서 분리 (TD-006 / audit #10).
 * - 활성 경매/타임딜 5초 폴링 + 1초 카운트다운
 * - 경매/타임딜/공구 생성 폼 (모달 형태)
 *
 * 외부 의존성: api, toast, react-i18next, lucide-react.
 *
 * 🛡️ 2026-04-28: TD-006 추가 분할 — 215줄 self-contained 컴포넌트.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Gavel, Zap, Users } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  stock: number
  is_active: boolean
}

export default function AuctionTimeDealControls({ streamId, products }: { streamId: number; products: Product[] }) {
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
      const res = await api.post('/api/auction/start', { ...auctionForm, stream_id: streamId }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        toast.success(t('seller.liveBroadcast.auctionStarted'))
        setShowAuction(false)
        setActiveAuction(res.data.data)
      } else {
        toast.error(res.data.error || t('seller.liveBroadcast.auctionStartFailed'))
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('seller.liveBroadcast.auctionStartFailed'))
    } finally { setSubmitting(false) }
  }

  async function createTimeDeal() {
    if (!dealForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/start', { ...dealForm, stream_id: streamId }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        toast.success(t('seller.liveBroadcast.timeDealStarted'))
        setShowTimeDeal(false)
        setActiveTimeDeal(res.data.data)
      } else {
        toast.error(res.data.error || t('seller.liveBroadcast.timeDealStartFailed'))
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('seller.liveBroadcast.timeDealStartFailed'))
    } finally { setSubmitting(false) }
  }

  async function createGroupBuy() {
    if (!groupBuyForm.product_id) { toast.error(t('seller.liveBroadcast.selectProduct')); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/timedeal/group-buy/start', { ...groupBuyForm, stream_id: streamId }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        toast.success(t('seller.liveBroadcast.groupBuyStarted', { defaultValue: '공구 시작!' }))
        setShowGroupBuy(false)
        setActiveTimeDeal({ ...res.data.data, is_group_buy: true })
      } else {
        toast.error(res.data.error || '공구 시작 실패')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '공구 시작 실패')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <p className="text-xs font-bold text-gray-700">{t('seller.liveBroadcast.eventControls')}</p>

      {/* 활성 상태 표시 */}
      {(activeAuction || activeTimeDeal) && (
        <div className="space-y-1.5">
          {activeAuction && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
              <span className="font-bold text-purple-700">🔨 {t('seller.liveBroadcast.auctionInProgress')}</span>
              <span className="font-mono text-purple-900">{fmtRemaining(activeAuction.ends_at)}</span>
            </div>
          )}
          {activeTimeDeal && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
              <span className="font-bold text-orange-700">{activeTimeDeal.is_group_buy ? `👥 ${t('seller.liveBroadcast.groupBuyInProgress')}` : `⚡ ${t('seller.liveBroadcast.timeDealInProgress')}`}</span>
              <span className="font-mono text-orange-900">{fmtRemaining(activeTimeDeal.ends_at)}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setShowAuction(true)} disabled={!!activeAuction}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 text-purple-700 rounded-lg text-xs font-semibold">
          <Gavel className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.auction')}
        </button>
        <button onClick={() => setShowTimeDeal(true)} disabled={!!activeTimeDeal}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 text-orange-700 rounded-lg text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" /> {t('seller.liveBroadcast.timeDeal')}
        </button>
        <button onClick={() => setShowGroupBuy(true)} disabled={!!activeTimeDeal}
          className="flex items-center justify-center gap-1 px-2 py-2 bg-pink-50 hover:bg-pink-100 disabled:opacity-50 text-pink-700 rounded-lg text-xs font-semibold">
          <Users className="w-3.5 h-3.5" /> 공구
        </button>
      </div>

      {/* 경매 폼 */}
      {showAuction && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAuction(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">🔨 {t('seller.liveBroadcast.startAuction')}</h3>
            <input value={auctionForm.title} onChange={e => setAuctionForm({ ...auctionForm, title: e.target.value })}
              placeholder={t('seller.liveBroadcast.auctionTitle')} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            <select value={auctionForm.product_id} onChange={e => setAuctionForm({ ...auctionForm, product_id: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value={0}>{t('seller.liveBroadcast.selectProductOptional')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={auctionForm.start_price} onChange={e => setAuctionForm({ ...auctionForm, start_price: Number(e.target.value) })}
                placeholder={t('seller.liveBroadcast.startPrice')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              <input type="number" value={auctionForm.min_increment} onChange={e => setAuctionForm({ ...auctionForm, min_increment: Number(e.target.value) })}
                placeholder={t('seller.liveBroadcast.bidIncrement')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <select value={auctionForm.duration_seconds} onChange={e => setAuctionForm({ ...auctionForm, duration_seconds: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value={60}>1분</option>
              <option value={180}>3분</option>
              <option value={300}>5분</option>
              <option value={600}>10분</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowAuction(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">{t('common.cancel')}</button>
              <button onClick={createAuction} disabled={submitting} className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">{t('seller.liveBroadcast.start')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 타임딜 폼 */}
      {showTimeDeal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowTimeDeal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">⚡ {t('seller.liveBroadcast.startTimeDeal')}</h3>
            <select value={dealForm.product_id} onChange={e => setDealForm({ ...dealForm, product_id: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value={0}>{t('seller.liveBroadcast.selectProduct')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()}원)</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={dealForm.discount_percent} onChange={e => setDealForm({ ...dealForm, discount_percent: Number(e.target.value) })}
                placeholder={t('seller.liveBroadcast.discountPercent')} min={1} max={90} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              <input type="number" value={dealForm.max_claims} onChange={e => setDealForm({ ...dealForm, max_claims: Number(e.target.value) })}
                placeholder={t('seller.liveBroadcast.quantity')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
            </div>
            <select value={dealForm.duration_seconds} onChange={e => setDealForm({ ...dealForm, duration_seconds: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value={30}>30초</option>
              <option value={60}>1분</option>
              <option value={120}>2분</option>
              <option value={300}>5분</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowTimeDeal(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">{t('common.cancel')}</button>
              <button onClick={createTimeDeal} disabled={submitting} className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">{t('seller.liveBroadcast.start')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 공구 폼 */}
      {showGroupBuy && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowGroupBuy(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">👥 라이브 공구 시작</h3>
            <select value={groupBuyForm.product_id} onChange={e => setGroupBuyForm({ ...groupBuyForm, product_id: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value={0}>{t('seller.liveBroadcast.selectProduct')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price.toLocaleString()}원)</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500">목표 인원</label>
                <input type="number" value={groupBuyForm.target_participants} onChange={e => setGroupBuyForm({ ...groupBuyForm, target_participants: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">달성 시 추가 할인 (%)</label>
                <input type="number" value={groupBuyForm.bonus_discount_percent} onChange={e => setGroupBuyForm({ ...groupBuyForm, bonus_discount_percent: Number(e.target.value) })}
                  min={1} max={90} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
              </div>
            </div>
            <select value={groupBuyForm.duration_minutes} onChange={e => setGroupBuyForm({ ...groupBuyForm, duration_minutes: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
              <option value={5}>5분</option>
              <option value={10}>10분</option>
              <option value={15}>15분</option>
              <option value={30}>30분</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowGroupBuy(false)} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">{t('common.cancel')}</button>
              <button onClick={createGroupBuy} disabled={submitting} className="flex-1 py-2 bg-pink-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">{t('seller.liveBroadcast.start')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
