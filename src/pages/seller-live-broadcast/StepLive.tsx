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
import SellerKakaoNotifyButton from '@/components/seller/SellerKakaoNotifyButton'
import AuctionTimeDealControls from '../SellerLiveBroadcast.AuctionTimeDealControls'
import DonationBoosterButton from '@/components/seller/DonationBoosterButton'
import PKLiveBanner from '@/components/live/PKLiveBanner'
import LiveChatPanel from '@/components/seller/LiveChatPanel'
import ConnectionQualityGauge from '@/components/streaming/ConnectionQualityGauge'
import type { StreamMethod } from '../SellerLiveBroadcast.storage'
import type { LiveStream, Product } from './types'
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock'

interface StepLiveProps {
  stream: LiveStream
  products: Product[]
  method?: StreamMethod
  notifyFollowers?: boolean
  practiceMode?: boolean
  onChangeProduct: (productId: number) => void
  onEndStream: () => void
}

export default function StepLive({ stream, products, method, notifyFollowers = true, practiceMode = false, onChangeProduct, onEndStream }: StepLiveProps) {
  const { t } = useTranslation()
  const startedAtRef = useRef(Date.now())
  // 방송 중 화면 잠금 방지 (모바일에서 화면 꺼짐 방지)
  useScreenWakeLock(true)
  const [elapsed, setElapsed] = useState('00:00')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [pipActive, setPipActive] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const pipWindowRef = useRef<Window | null>(null)
  const pipUpdateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 상품 타이머 자동 전환
  const [autoAdvanceMin, setAutoAdvanceMin] = useState<number>(0) // 0 = 비활성
  const [autoAdvanceActive, setAutoAdvanceActive] = useState(false)
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvanceSecondsRef = useRef(0)
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState(0)
  const changingProductRef = useRef(false) // 상품 전환 중복 방지

  // 라이브 시작 60초 후 YouTube CDN 썸네일 자동 refresh
  // 셀러가 커스텀 썸네일을 직접 지정했으면 덮어쓰지 않음
  useEffect(() => {
    if (method !== 'youtube' && method !== 'quick') return
    if (stream.thumbnail_url) return  // 커스텀 썸네일 유지
    const timer = setTimeout(() => {
      api.post(`/api/youtube/live/${stream.id}/refresh-thumbnail`, {}).catch(() => { /* silent */ })
    }, 60000)
    return () => clearTimeout(timer)
  }, [stream.id, method, stream.thumbnail_url])

  // 🛡️ 2026-05-07: 라이브 시작 시 팔로워 알림톡 자동 1회 (셀러 잔액 사용)
  //   • notifyFollowers 토글 OFF / 연습 모드 → 발송 안 함
  //   • 30초 버퍼 후 발송 (트래픽 급증 방지)
  useEffect(() => {
    if (!notifyFollowers) return
    if (stream.title.startsWith('[연습]')) return
    const timer = setTimeout(() => {
      api.post(`/api/youtube/live/${stream.id}/notify-followers`, {})
        .then(r => {
          if (r.data?.success) {
            const sent = r.data.data?.sent || 0
            if (sent > 0) toast.success(`📨 팔로워 ${sent}명에게 알림톡 발송`)
            else toast.info('📨 알림 발송 대상 팔로워 없음')
          } else {
            const err = r.data?.error || ''
            if (err.includes('크레딧')) toast.error('알림톡 크레딧 부족 — 셀러 > 브랜드메시지에서 충전해주세요')
            else toast.error(`알림톡 발송 실패: ${err}`)
          }
        })
        .catch(() => { toast.error('알림톡 발송 중 오류가 발생했습니다') })
    }, 30000)
    return () => clearTimeout(timer)
  }, [stream.id, notifyFollowers, stream.title])

  // 방송 중 스트림 끊김 감지 (30초마다 /status 폴링, 캐시 재활용으로 YouTube API quota 최소화)
  useEffect(() => {
    if (!stream.youtube_video_id) return  // webcam 미연결 or non-YouTube 모드
    const check = async () => {
      try {
        const res = await api.get(`/api/seller/youtube/live/${stream.id}/status`)
        const data = res.data?.data
        // 🛡️ 2026-05-11: revoked 만 진짜 비정상 (정책 위반/strike). complete 은 우리 /end 호출 결과이므로 무시.
        if (data?.youtube_status === 'revoked') {
          toast.error('⚠️ YouTube 방송이 정책 위반으로 중단됐습니다. studio.youtube.com 확인 필요.')
        }
      } catch { /* silent — 네트워크 일시 오류는 무시 */ }
    }
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [stream.id, stream.youtube_video_id])

  // 🛡️ 2026-05-12: 송출 중 활성 신호 (60초마다) — 30분 자동종료 cron 방지
  useEffect(() => {
    const ping = () => {
      api.post(`/api/seller/streams/${stream.id}/heartbeat`, {}).catch(() => { /* silent */ })
    }
    ping() // 즉시 1회
    const id = setInterval(ping, 60000)
    return () => clearInterval(id)
  }, [stream.id])

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
        const imgEl = pipWin.document.getElementById('pip-product-img') as HTMLElement | null
        const nameEl = pipWin.document.getElementById('pip-product-name')
        const priceEl = pipWin.document.getElementById('pip-product-price')
        // 🛡️ 2026-05-19: PiP innerHTML XSS 방어 — image_url/name 을 직접 HTML 삽입 대신 DOM 요소로 생성.
        //   p.image_url 은 CSS url() context, p.name 은 HTML text context 였음 → 셀러 본인이 자기 화면에
        //   self-XSS 가능 (저위험이지만 영구 방어). image_url scheme 화이트리스트 + textContent 사용.
        const isSafeImageUrl = (u: unknown): u is string => {
          if (typeof u !== 'string' || !u) return false
          return /^https?:\/\//i.test(u) || u.startsWith('/')
        }
        if (currentP) {
          if (imgEl) imgEl.style.background = isSafeImageUrl(currentP.image_url) ? `url("${encodeURI(currentP.image_url)}") center/cover` : '#27272a'
          if (nameEl) nameEl.textContent = currentP.name
          if (priceEl) priceEl.textContent = `₩${formatNumber(currentP.price)}`
        }

        const listEl = pipWin.document.getElementById('pip-product-list')
        if (listEl) {
          listEl.innerHTML = ''
          products.forEach(p => {
            const btn = pipWin.document.createElement('button')
            btn.className = 'pip-btn' + (p.id === stream.current_product_id ? ' active' : '')
            const thumb = pipWin.document.createElement('span')
            thumb.style.cssText = 'width:20px;height:20px;border-radius:4px;flex-shrink:0'
            thumb.style.background = isSafeImageUrl(p.image_url) ? `url("${encodeURI(p.image_url)}") center/cover` : '#27272a'
            const label = pipWin.document.createElement('span')
            label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
            label.textContent = p.name
            btn.appendChild(thumb)
            btn.appendChild(label)
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
      pipUpdateIntervalRef.current = setInterval(() => {
        // PiP 창이 외부에서 닫혔는지 주기적으로 감지 (pagehide 가 일부 브라우저에서 미발화)
        if (!pipWin || pipWin.closed) {
          if (pipUpdateIntervalRef.current) clearInterval(pipUpdateIntervalRef.current)
          pipWindowRef.current = null
          setPipActive(false)
          return
        }
        updatePiP()
      }, 1000)
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

  // 상품 자동 전환 타이머
  useEffect(() => {
    if (!autoAdvanceActive || autoAdvanceMin <= 0) {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current)
      autoAdvanceRef.current = null
      return
    }
    const totalSec = autoAdvanceMin * 60
    autoAdvanceSecondsRef.current = totalSec
    setAutoAdvanceCountdown(totalSec)
    autoAdvanceRef.current = setInterval(() => {
      autoAdvanceSecondsRef.current -= 1
      setAutoAdvanceCountdown(autoAdvanceSecondsRef.current)
      if (autoAdvanceSecondsRef.current <= 0) {
        if (changingProductRef.current) {
          // 수동 전환 중이면 카운터만 리셋, API 호출 skip
          autoAdvanceSecondsRef.current = totalSec
          setAutoAdvanceCountdown(totalSec)
          return
        }
        const idx = products.findIndex(p => p.id === stream.current_product_id)
        const nextIdx = (idx + 1) % products.length
        const next = products[nextIdx]
        if (next && nextIdx !== idx) {
          changingProductRef.current = true
          api.post(`/api/seller/streams/${stream.id}/change-product`, { productId: next.id })
            .then(() => { onChangeProduct(next.id); toast.success(`⏱️ ${next.name} 자동 전환`) })
            .catch(() => {})
            .finally(() => { changingProductRef.current = false })
          autoAdvanceSecondsRef.current = totalSec
          setAutoAdvanceCountdown(totalSec)
        } else {
          setAutoAdvanceActive(false)
          toast.info('⏱️ 마지막 상품 — 자동 전환 종료')
        }
      }
    }, 1000)
    return () => { if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current) }
  }, [autoAdvanceActive, autoAdvanceMin, products, stream.id, stream.current_product_id, onChangeProduct])

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
      const target = e.target as HTMLElement
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (target?.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(v => !v) }
      else if (e.key === ' ' || e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (changingProductRef.current) return
        const idx = products.findIndex(p => p.id === stream.current_product_id)
        const next = products[(idx + 1) % products.length]
        if (next) {
          changingProductRef.current = true
          api.post(`/api/seller/streams/${stream.id}/change-product`, { productId: next.id })
            .then(() => { onChangeProduct(next.id) }) // 단축키는 toast 없이 (방송 중 잦은 전환 시 toast 폭탄 방지)
            .catch(() => { /* silent */ })
            .finally(() => { changingProductRef.current = false })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [products, stream.id, stream.current_product_id, onChangeProduct])

  return (
    <div className="space-y-4">
      {/* 연습 모드 배너 */}
      {practiceMode && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="text-base">🧪</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800">연습 모드 방송 중</p>
            <p className="text-[11px] text-amber-700">시청자 피드 미노출 · 알림톡 미발송 · 비공개(private) 방송입니다</p>
          </div>
        </div>
      )}

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
          <ConnectionQualityGauge streamId={stream.id} mode={method} />
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

      {/* 시청자 링크 공유 + 카카오 친구 알림 */}
      <div className="flex flex-wrap items-center gap-2">
        <ShareLiveLink streamId={stream.id} />
        {!practiceMode && (
          <SellerKakaoNotifyButton streamId={stream.id} streamTitle={stream.title} />
        )}
      </div>

      {/* 채팅 (영상 미리보기 제거 — YouTube embed는 30초 지연으로 모니터링 무의미)
          🛡️ 2026-05-13: PC 에선 더 큰 영역 (lg+ 60vh). 모바일에선 기존 320. */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ minHeight: 320 }}>
        <div className="lg:h-[60vh]">
          <LiveChatPanel streamId={stream.id} />
        </div>
      </div>

      {/* 상품 전환 + 경매/타임딜 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        {/* 상품 자동 전환 타이머 */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 shrink-0">⏱️ 자동 전환</span>
          {[0, 3, 5, 10, 15].map(min => (
            <button key={min} onClick={() => { setAutoAdvanceMin(min); setAutoAdvanceActive(min > 0) }}
              className={`px-2 py-1 rounded-lg border font-medium transition-all ${autoAdvanceMin === min && min > 0 && autoAdvanceActive ? 'border-blue-500 bg-blue-50 text-blue-700' : min === 0 ? 'border-gray-200 text-gray-400 hover:border-gray-300' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>
              {min === 0 ? '끄기' : `${min}분`}
            </button>
          ))}
          {autoAdvanceActive && autoAdvanceCountdown > 0 && (
            <span className="ml-auto text-blue-600 font-mono font-bold shrink-0">
              {Math.floor(autoAdvanceCountdown / 60)}:{String(autoAdvanceCountdown % 60).padStart(2, '0')} 후 전환
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-700 flex-1">{t('seller.liveBroadcast.switchProduct')} <span className="text-gray-400 font-normal">({t('seller.liveBroadcast.tapToSwitch')})</span></p>
            {products.length > 5 && (
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="상품 검색"
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-blue-300 text-gray-900"
              />
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {products
              .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))
              .map((p: Product) => {
              const isCurrent = stream.current_product_id === p.id
              const isSoldOut = p.stock === 0
              return (
                <button key={p.id}
                  onClick={async () => {
                    if (isSoldOut) { toast.error(`${p.name} 품절`); return }
                    if (changingProductRef.current) return
                    changingProductRef.current = true
                    try {
                      await api.post(`/api/seller/streams/${stream.id}/change-product`,
                        { productId: p.id },
                        { headers: { Authorization: `Bearer ${localStorage.getItem('seller_token')}` } })
                      onChangeProduct(p.id)
                      toast.success(`${p.name} ${t('seller.liveBroadcast.nowShowing')}`)
                    } catch { toast.error(t('seller.liveBroadcast.switchFailed')) }
                    finally { changingProductRef.current = false }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium shrink-0 transition-all active:scale-95 ${
                    isCurrent ? 'border-red-500 bg-red-50 text-red-600 shadow-sm' :
                    isSoldOut ? 'border-gray-100 bg-gray-50 text-gray-400 opacity-60' :
                    'border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}>
                  {p.image_url && <img src={p.image_url} alt="" className="w-7 h-7 rounded object-cover" loading="lazy" />}
                  <div className="min-w-0">
                    <span className="truncate max-w-[90px] block">{p.name}</span>
                    {isSoldOut && <span className="text-[9px] text-red-500 font-bold">품절</span>}
                  </div>
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
