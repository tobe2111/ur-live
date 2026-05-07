/**
 * 🛡️ 2026-05-01: TD-018 분할 — SellerLiveBroadcastPage StepLive 추출.
 *
 * 라이브 방송 중 진행 단계 — 상태바 / Picture-in-Picture / 단축키 / 통계 /
 * 후원 부스터 / PK 배너 / 채팅 / 상품 전환 / 경매/타임딜 컨트롤.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { LiveStatsBar, ShareLiveLink } from '../SellerLiveBroadcast.parts'
import AuctionTimeDealControls from '../SellerLiveBroadcast.AuctionTimeDealControls'
import DonationBoosterButton from '@/components/seller/DonationBoosterButton'
import PKLiveBanner from '@/components/live/PKLiveBanner'
import LiveChatPanel from '@/components/seller/LiveChatPanel'
import YouTubeChatSyncIndicator from '@/components/streaming/YouTubeChatSyncIndicator'
import type { StreamMethod } from '../SellerLiveBroadcast.storage'
import type { LiveStream, Product } from './types'

interface StepLiveProps {
  stream: LiveStream
  products: Product[]
  method?: StreamMethod
  onChangeProduct: (productId: number) => void
  onEndStream: () => void
}

export default function StepLive({ stream, products, method, onChangeProduct, onEndStream }: StepLiveProps) {
  const { t } = useTranslation()
  const startedAtRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState('00:00')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pipActive, setPipActive] = useState(false)
  const pipWindowRef = useRef<Window | null>(null)
  const pipUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Document Picture-in-Picture API (Chrome 116+)
  async function togglePiP() {
    // @ts-expect-error: documentPictureInPicture is not in standard DOM types yet
    const dpip = window.documentPictureInPicture
    if (!dpip) {
      toast.error('PiP 모드는 Chrome 116+ / Edge 에서만 지원됩니다')
      return
    }
    if (pipActive) {
      try { pipWindowRef.current?.close() } catch { /* ignore */ }
      return
    }
    try {
      const pipWin = await dpip.requestWindow({ width: 320, height: 420 })
      pipWindowRef.current = pipWin
      pipWin.document.title = 'UR Live — 방송 중'
      pipWin.document.body.style.margin = '0'
      pipWin.document.body.style.fontFamily = 'system-ui, sans-serif'
      pipWin.document.body.style.background = '#0a0a0a'
      pipWin.document.body.style.color = 'white'
      pipWin.document.body.innerHTML = `
        <div style="padding:12px;display:flex;flex-direction:column;gap:10px;height:100dvh;box-sizing:border-box">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="display:inline-block;width:8px;height:8px;background:#ef4444;border-radius:50%;animation:pulse 1s infinite"></span>
            <span style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:0.5px">LIVE</span>
            <span id="pip-elapsed" style="font-size:11px;font-family:monospace;color:#a1a1aa;margin-left:4px"></span>
          </div>
          <p id="pip-title" style="font-size:13px;font-weight:600;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></p>
          <div style="font-size:10px;color:#71717a;margin-top:-4px">현재 상품</div>
          <div id="pip-current-product" style="background:#18181b;border-radius:8px;padding:8px;display:flex;gap:8px;align-items:center">
            <div id="pip-product-img" style="width:40px;height:40px;border-radius:6px;background:#27272a;flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <p id="pip-product-name" style="font-size:12px;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></p>
              <p id="pip-product-price" style="font-size:10px;color:#a1a1aa;margin:2px 0 0"></p>
            </div>
          </div>
          <div style="font-size:10px;color:#71717a">상품 전환</div>
          <div id="pip-product-list" style="display:flex;flex-direction:column;gap:4px;overflow-y:auto;flex:1"></div>
        </div>
        <style>
          @keyframes pulse { 50% { opacity:0.4 } }
          .pip-btn { background:#18181b;border:none;color:white;padding:8px;border-radius:6px;cursor:pointer;text-align:left;font-size:11px;display:flex;gap:6px;align-items:center }
          .pip-btn:hover { background:#27272a }
          .pip-btn.active { background:#dc2626 }
        </style>
      `
      setPipActive(true)

      const updatePiP = () => {
        if (!pipWin.document) return
        const titleEl = pipWin.document.getElementById('pip-title')
        const elapsedEl = pipWin.document.getElementById('pip-elapsed')
        if (titleEl) titleEl.textContent = stream.title
        if (elapsedEl) elapsedEl.textContent = elapsed

        const currentP = products.find(p => p.id === stream.current_product_id)
        const imgEl = pipWin.document.getElementById('pip-product-img') as HTMLElement
        const nameEl = pipWin.document.getElementById('pip-product-name')
        const priceEl = pipWin.document.getElementById('pip-product-price')
        if (currentP && imgEl && nameEl && priceEl) {
          imgEl.style.background = currentP.image_url ? `url(${currentP.image_url}) center/cover` : '#27272a'
          nameEl.textContent = currentP.name
          priceEl.textContent = `₩${formatNumber(currentP.price)}`
        }

        const listEl = pipWin.document.getElementById('pip-product-list')
        if (listEl) {
          listEl.innerHTML = ''
          products.forEach(p => {
            const btn = pipWin.document.createElement('button')
            btn.className = 'pip-btn' + (p.id === stream.current_product_id ? ' active' : '')
            btn.innerHTML = `
              <span style="width:20px;height:20px;border-radius:4px;${p.image_url ? `background:url(${p.image_url}) center/cover` : 'background:#27272a'};flex-shrink:0"></span>
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
            `
            btn.onclick = async () => {
              try {
                await api.post(`/api/seller/streams/${stream.id}/change-product`, { productId: p.id })
                onChangeProduct(p.id)
              } catch { /* ignore */ }
            }
            listEl.appendChild(btn)
          })
        }
      }
      updatePiP()
      pipUpdateIntervalRef.current = setInterval(updatePiP, 1000)
      pipWin.addEventListener('pagehide', () => {
        if (pipUpdateIntervalRef.current) clearInterval(pipUpdateIntervalRef.current)
        pipWindowRef.current = null
        setPipActive(false)
      })
    } catch { /* cancelled or blocked */ }
  }

  // cleanup on unmount
  useEffect(() => () => {
    if (pipUpdateIntervalRef.current) clearInterval(pipUpdateIntervalRef.current)
    try { pipWindowRef.current?.close() } catch { /* ignore */ }
  }, [])

  // 방송 경과 시간 타이머
  useEffect(() => {
    const tick = () => {
      const sec = Math.floor((Date.now() - startedAtRef.current) / 1000)
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      const s = sec % 60
      setElapsed(h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // P2-12: 키보드 단축키 (input 포커스 중에는 무시)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(v => !v) }
      else if (e.key === ' ' || e.key.toLowerCase() === 'n') {
        e.preventDefault()
        const idx = products.findIndex(p => p.id === stream.current_product_id)
        const next = products[(idx + 1) % products.length]
        if (next) {
          api.post(`/api/seller/streams/${stream.id}/change-product`, { productId: next.id })
            .then(() => { onChangeProduct(next.id); toast.success(`${next.name} ▶`) })
            .catch(() => { /* silent */ })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [products, stream.id, stream.current_product_id, onChangeProduct])

  return (
    <div className="space-y-4">
      {/* 상태 바 */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
          </span>
          <span className="text-xs font-mono text-gray-500 shrink-0">{elapsed}</span>
          <p className="text-sm font-semibold text-gray-900 truncate">{stream.title}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={togglePiP}
            className={`w-7 h-7 rounded-full text-xs font-bold ${pipActive ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            title="Picture-in-Picture (PiP)">
            ⧉
          </button>
          <button onClick={() => setShowShortcuts(v => !v)}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold"
            title="키보드 단축키 (?)">
            ?
          </button>
          <Button onClick={onEndStream} size="sm" variant="destructive">{t('seller.liveBroadcast.endBroadcast')}</Button>
        </div>
      </div>

      {/* 🛡️ 2026-05-07: YouTube 라이브 채팅 동기화 (YouTube Studio / Quick 모드) */}
      {(method === 'youtube' || method === 'quick') && (
        <YouTubeChatSyncIndicator streamId={stream.id} />
      )}

      {/* P2-12: 단축키 도움말 */}
      {showShortcuts && (
        <div className="bg-gray-900 text-white rounded-xl p-4 text-xs space-y-1.5">
          <p className="font-bold text-gray-100 mb-2">{t('seller.liveBroadcast.shortcutsTitle')}</p>
          <div className="flex justify-between"><span className="text-gray-300">{t('seller.liveBroadcast.shortcutNextProduct')}</span><kbd className="bg-gray-800 px-2 py-0.5 rounded font-mono">Space</kbd></div>
          <div className="flex justify-between"><span className="text-gray-300">{t('seller.liveBroadcast.shortcutToggleHelp')}</span><kbd className="bg-gray-800 px-2 py-0.5 rounded font-mono">?</kbd></div>
        </div>
      )}

      {/* 실시간 통계 카운터 */}
      <LiveStatsBar streamId={stream.id} />

      {/* 🛡️ 2026-04-27 후원 부스터 발동 버튼 + PK 진행 표시 */}
      <DonationBoosterButton liveStreamId={stream.id} />
      <PKLiveBanner liveStreamId={stream.id} />

      {/* 시청자 링크 공유 */}
      <ShareLiveLink streamId={stream.id} />

      {/* 채팅 (영상 미리보기 제거 — YouTube embed는 30초 지연으로 모니터링 무의미) */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: 320 }}>
        <LiveChatPanel streamId={stream.id} />
      </div>

      {/* 상품 전환 + 경매/타임딜 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">{t('seller.liveBroadcast.switchProduct')} <span className="text-gray-400 font-normal">({t('seller.liveBroadcast.tapToSwitch')})</span></p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {products.map((p: Product) => {
              const isCurrent = stream.current_product_id === p.id
              return (
                <button key={p.id}
                  onClick={async () => {
                    try {
                      await api.post(`/api/seller/streams/${stream.id}/change-product`,
                        { productId: p.id },
                        { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })
                      onChangeProduct(p.id)
                      toast.success(`${p.name} ${t('seller.liveBroadcast.nowShowing')}`)
                    } catch { toast.error(t('seller.liveBroadcast.switchFailed')) }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-all active:scale-95 ${
                    isCurrent ? 'border-red-500 bg-red-50 text-red-600 shadow-sm' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover" loading="lazy" />}
                  <span className="truncate max-w-[90px]">{p.name}</span>
                  {isCurrent && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
        <AuctionTimeDealControls streamId={stream.id} products={products} />
      </div>
    </div>
  )
}
