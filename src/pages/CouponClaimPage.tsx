import { useEffect, useState, useRef } from 'react'
import { GiftBoxIcon, OkIcon, BadIcon, BagIcon } from '@/components/icons/urdeal-icons'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n-lite'
import BrandLoader from '@/components/brand/BrandLoader'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { hasConsumerSession } from '@/utils/auth'
// 🎬 2026-11-02 시안 8차 "쿠폰 받기"(대표 "8차에서는 QR 화면 밝아짐 빼고 다 넣어줘") — 받은 쿠폰이 살짝 기운 채 아래에서 올라와 바로 선다.
//   상자 아이콘의 끝없이 통통 튀던 움직임은 한 번 톡으로 바꿨다 — 움직임은 한 번만 재생한다는 규칙.
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
injectMotionCss('ur-m-coupon', `@keyframes ur-cp-in { from { opacity: 0; transform: translateY(30px) rotate(-4deg) scale(.92); } to { opacity: 1; transform: none; } }@keyframes ur-cp-pop { 0% { transform: scale(.5); } 60% { transform: scale(1.12); } 100% { transform: none; } }.ur-cp-in { animation: ur-cp-in .55s cubic-bezier(.2,1,.3,1) .25s backwards; }.ur-cp-pop { animation: ur-cp-pop .45s cubic-bezier(.3,1.3,.5,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-cp-in,.ur-cp-pop{animation:none!important}}`)

/**
 * 🎬 2026-11-03 21차 ⑦ (대표 승인) — 받은 쿠폰 금액이 **은박으로 덮여 있고, 긁으면 드러난다.** 절반쯤 긁으면 나머지는 저절로 벗겨진다.
 *   쿠폰은 이미 발급됐다(서버) — 이건 보여 주는 순서일 뿐이다. 금액 글자는 처음부터 DOM 에 있어 읽기 프로그램은 바로 읽는다.
 *   키보드(Enter·Space)로도 벗길 수 있고, 동작 줄이기면 덮개 자체를 안 그린다.
 */
function ScratchCover({ label }: { label: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const [gone, setGone] = useState(() => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return true } })
  const [fading, setFading] = useState(false)
  const down = useRef(false)
  useEffect(() => {
    const c = ref.current; if (!c || gone) return
    const r = { width: c.offsetWidth, height: c.offsetHeight } // 카드가 기울어 들어오는 중이라 getBoundingClientRect 는 작게 잰다
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr))
    const g = c.getContext('2d'); if (!g) return
    g.scale(dpr, dpr)
    const gr = g.createLinearGradient(0, 0, r.width, r.height)
    gr.addColorStop(0, 'rgb(200,204,210)'); gr.addColorStop(0.5, 'rgb(238,240,243)'); gr.addColorStop(1, 'rgb(185,190,198)')
    g.fillStyle = gr; g.fillRect(0, 0, r.width, r.height)
    g.fillStyle = 'rgb(122,128,137)'; g.font = '700 15px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(label, r.width / 2, r.height / 2)
  }, [gone, label])
  const reveal = () => { setFading(true); window.setTimeout(() => setGone(true), 400) }
  const scratch = (x: number, y: number) => {
    const c = ref.current; const g = c?.getContext('2d'); if (!c || !g || fading) return
    const r = c.getBoundingClientRect()
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x - r.left, y - r.top, 20, 0, Math.PI * 2); g.fill()
    const d = g.getImageData(0, 0, c.width, c.height).data; let clear = 0, n = 0
    for (let i = 3; i < d.length; i += 64) { n++; if (d[i] === 0) clear++ }
    if (n && clear / n > 0.45) reveal()
  }
  if (gone) return null
  return (
    <canvas
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={label}
      className={`absolute inset-0 w-full h-full rounded-2xl cursor-pointer touch-none transition-opacity duration-300 ${fading ? 'opacity-0' : ''}`}
      onPointerDown={(e) => { down.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e.clientX, e.clientY) }}
      onPointerMove={(e) => { if (down.current) scratch(e.clientX, e.clientY) }}
      onPointerUp={() => { down.current = false }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal() } }}
    />
  )
}

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#45B7D1', '#FF9FF3', '#F368E0', '#FF6348', '#7BED9F', '#70A1FF', '#FFA502']
    const particles: Array<{
      x: number; y: number; vx: number; vy: number
      size: number; color: string; rotation: number; rotSpeed: number
      shape: 'rect' | 'circle' | 'star'; opacity: number
    }> = []

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 400,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        shape: (['rect', 'circle', 'star'] as const)[Math.floor(Math.random() * 3)],
        opacity: 1,
      })
    }

    let frame = 0
    const maxFrames = 180

    function animate() {
      if (!ctx || !canvas) return
      frame++
      if (frame > maxFrames) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach(p => {
        p.x += p.vx
        p.vy += 0.05
        p.y += p.vy
        p.rotation += p.rotSpeed
        if (frame > maxFrames - 60) p.opacity = Math.max(0, p.opacity - 0.016)

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        } else if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
            const r = i === 0 ? p.size : p.size
            ctx.lineTo(Math.cos(angle) * r * 0.5, Math.sin(angle) * r * 0.5)
          }
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      })

      requestAnimationFrame(animate)
    }

    animate()
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />
}

export default function CouponClaimPage() {
  const { t } = useTranslation()
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading')
  const [coupon, setCoupon] = useState<{ name: string; type: string; value: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showContent, setShowContent] = useState(false)

  const isLoggedIn = hasConsumerSession()

  useEffect(() => {
    if (!code) { setStatus('error'); setErrorMsg(t('couponClaim.noCode')); return }
    if (!isLoggedIn) {
      localStorage.setItem('loginReturnUrl', `/coupon/${code}`)
      navigate(`/login?returnUrl=${encodeURIComponent(`/coupon/${code}`)}`, { replace: true })
      return
    }
    claimCoupon()
  }, [code])

  useEffect(() => {
    if (status === 'success') {
      setTimeout(() => setShowContent(true), 300)
    }
  }, [status])

  async function claimCoupon() {
    try {
      const res = await api.get(`/api/coupons/claim/${code}`)
      if (res.data.success) {
        setCoupon(res.data.data)
        setStatus('success')
        try { if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(25) } catch { /* 진동 없음 */ } // 📳 20차 ⑧ — 쿠폰을 받으면 짧게 톡(0.025초)
      } else if (res.data.already_claimed) {
        setStatus('already')
      } else {
        setStatus('error')
        setErrorMsg(res.data.error || t('couponClaim.claimFail'))
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; already_claimed?: boolean } } }
      if (e.response?.data?.already_claimed) {
        setStatus('already')
      } else {
        setStatus('error')
        setErrorMsg(e.response?.data?.error || t('couponClaim.claimFail'))
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:bg-none dark:bg-[#11141C] flex items-center justify-center px-4">
      <SEO title={t('couponClaim.seoTitle')} description={t('couponClaim.seoDesc')} url={`/coupon/${code}`} />
      {status === 'success' && <ConfettiCanvas />}

      {/* 🛡️ 2026-05-20: PC 에서 cramped 안 보이도록 form 폭 확장 + 좌우 padding */}
      <div className="w-full max-w-sm lg:max-w-md text-center px-4 lg:px-8 relative z-10">
        {/* 🎯 2026-07-18 로딩 단일화 — 커스텀 Gift 애니메이션 → 유어딜 BrandLoader(라벨). */}
        {status === 'loading' && <BrandLoader label={t('couponClaim.claiming')} />}

        {status === 'success' && coupon && (
          <div className={`transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="w-24 h-24 mx-auto bg-gray-700 rounded-full flex items-center justify-center mb-5 shadow-lg ur-cp-pop">
              <GiftBoxIcon className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-[20px] font-semibold text-gray-900 dark:text-white mb-1">{t('couponClaim.celebrate')}</h1>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-6">{t('couponClaim.issuedHint')}</p>

            <div className="ur-cp-in relative bg-surface rounded-3xl p-6 border-2 border-dashed border-rule shadow-xl overflow-hidden">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-b from-gray-50 to-white dark:bg-none dark:bg-[#11141C] rounded-full" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-b from-gray-50 to-white dark:bg-none dark:bg-[#11141C] rounded-full" />

              <p className="text-[12px] text-brand-text font-medium mb-1">{t('couponClaim.couponLabel')}</p>
              <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{coupon.name}</p>
              <div className="relative -mx-2 px-2 rounded-2xl">
                <p className="text-[34px] font-bold text-brand-text">
                  {coupon.type === 'percent' ? `${coupon.value}%` : `${formatNumber(coupon.value)}원`}
                </p>
                <p className="text-[16px] font-bold text-gray-700 dark:text-gray-300 -mt-1">{t('couponClaim.discount')}</p>
                <ScratchCover label={t('couponClaim.scratch', { defaultValue: '긁어서 확인' })} />
              </div>
              <div className="mt-4 pt-4 border-t border-dashed border-rule ">
                <p className="text-[12px] text-gray-400 dark:text-gray-500">{t('couponClaim.footerNote')}</p>
              </div>
            </div>

            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-4 bg-brand text-white font-bold rounded-2xl active:scale-[0.97] transition-transform flex items-center justify-center gap-2 shadow-lg">
              <BagIcon className="w-5 h-5" />
              {t('couponClaim.goShop')}
            </button>

            <button onClick={() => navigate('/browse')}
              className="w-full mt-2 py-3 text-[15px] text-gray-500 dark:text-gray-400 font-medium">
              {t('couponClaim.browseProducts')}
            </button>
          </div>
        )}

        {status === 'already' && (
          <div className="animate-fade-in">
            <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
              <GiftBoxIcon className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-[16px] font-semibold text-gray-900 dark:text-white mb-2">{t('couponClaim.alreadyTitle')}</h1>
            <p className="text-[15px] text-gray-500 dark:text-gray-400">{t('couponClaim.alreadyHint')}</p>
            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-4 bg-brand text-white font-bold rounded-xl active:scale-[0.98]">
              {t('couponClaim.goHome')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in">
            <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <BadIcon className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-[16px] font-semibold text-gray-900 dark:text-white mb-2">{t('couponClaim.errorTitle')}</h1>
            <p className="text-[15px] text-gray-500 dark:text-gray-400">{errorMsg}</p>
            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-4 bg-brand text-white font-bold rounded-xl active:scale-[0.98]">
              {t('couponClaim.goHome')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
