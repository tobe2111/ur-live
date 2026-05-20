import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { Gift, CheckCircle, XCircle, Loader2, ShoppingBag } from 'lucide-react'
import { formatNumber } from '@/utils/format'

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

  const isLoggedIn = localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')

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
    <div className="min-h-screen bg-gradient-to-b from-pink-50 dark:from-[#0A0A0A] to-white dark:to-[#0A0A0A] flex items-center justify-center px-4">
      <SEO title={t('couponClaim.seoTitle')} description={t('couponClaim.seoDesc')} url={`/coupon/${code}`} />
      {status === 'success' && <ConfettiCanvas />}

      {/* 🛡️ 2026-05-20: PC 에서 cramped 안 보이도록 form 폭 확장 + 좌우 padding */}
      <div className="w-full max-w-sm lg:max-w-md text-center px-4 lg:px-8 relative z-10">
        {status === 'loading' && (
          <div className="animate-pulse">
            <div className="w-20 h-20 mx-auto bg-pink-100 dark:bg-pink-900/20 rounded-full flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-pink-400 animate-bounce" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('couponClaim.claiming')}</p>
          </div>
        )}

        {status === 'success' && coupon && (
          <div className={`transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-pink-400 to-red-400 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-pink-200 animate-bounce">
              <Gift className="w-12 h-12 text-white" />
            </div>

            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-1">{t('couponClaim.celebrate')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('couponClaim.issuedHint')}</p>

            <div className="relative bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 border-2 border-dashed border-pink-300 dark:border-pink-800/50 shadow-xl overflow-hidden">
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-b from-pink-50 dark:from-[#0A0A0A] to-white dark:to-[#0A0A0A] rounded-full" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-b from-pink-50 dark:from-[#0A0A0A] to-white dark:to-[#0A0A0A] rounded-full" />

              <p className="text-xs text-pink-500 font-medium mb-1">{t('couponClaim.couponLabel')}</p>
              <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">{coupon.name}</p>
              <p className="text-4xl font-black text-pink-500">
                {coupon.type === 'percent' ? `${coupon.value}%` : `${formatNumber(coupon.value)}원`}
              </p>
              <p className="text-lg font-bold text-gray-700 dark:text-gray-300 -mt-1">{t('couponClaim.discount')}</p>
              <div className="mt-4 pt-4 border-t border-dashed border-pink-200 dark:border-pink-900/40">
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{t('couponClaim.footerNote')}</p>
              </div>
            </div>

            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-2xl active:scale-[0.97] transition-transform flex items-center justify-center gap-2 shadow-lg">
              <ShoppingBag className="w-5 h-5" />
              {t('couponClaim.goShop')}
            </button>

            <button onClick={() => navigate('/browse')}
              className="w-full mt-2 py-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
              {t('couponClaim.browseProducts')}
            </button>
          </div>
        )}

        {status === 'already' && (
          <div className="animate-fade-in">
            <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('couponClaim.alreadyTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('couponClaim.alreadyHint')}</p>
            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl active:scale-[0.98]">
              {t('couponClaim.goHome')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in">
            <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('couponClaim.errorTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{errorMsg}</p>
            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl active:scale-[0.98]">
              {t('couponClaim.goHome')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
