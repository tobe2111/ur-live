/**
 * 🛡️ 2026-05-15 (PRISM 따라잡기): 단골 등록 배지 — 알림 opt-in 강조.
 *
 * 기존 FollowButton (/api/social/follow) 와 별개:
 *   - FollowButton: 단순 follow (소셜 그래프)
 *   - RegularBadge: 알림 opt-in (신상품 / 라이브 시작 / 공구 시작 push)
 *
 * mallpro 의 "단골맺기" 기능 따라잡기.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Bell, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Props {
  sellerId: number
  className?: string
  variant?: 'pill' | 'full'
}

export default function RegularBadge({ sellerId, className = '', variant = 'pill' }: Props) {
  const navigate = useNavigate()
  const [isRegular, setIsRegular] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const isLoggedIn = !!localStorage.getItem('user_id') || !!localStorage.getItem('uid')

  useEffect(() => {
    if (!sellerId || sellerId <= 0) return
    api.get(`/api/seller-public/${sellerId}/is-following`)
      .then(r => {
        if (r.data?.success) {
          setIsRegular(!!r.data.data?.isFollowing)
          setCount(Number(r.data.data?.count ?? 0))
        }
      })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false))
  }, [sellerId])

  async function toggle() {
    if (!isLoggedIn) {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    setSubmitting(true)
    const wasRegular = isRegular
    setIsRegular(!wasRegular)
    setCount(c => c + (wasRegular ? -1 : 1))
    try {
      if (wasRegular) {
        await api.delete(`/api/seller-public/${sellerId}/follow`)
        toast.info('단골 해제')
      } else {
        const res = await api.post(`/api/seller-public/${sellerId}/follow`)
        toast.success(res.data?.message || '🔔 단골 등록! 신상품/라이브 알림 받을게요')
      }
    } catch (err) {
      setIsRegular(wasRegular)
      setCount(c => c + (wasRegular ? 1 : -1))
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '실패')
    } finally {
      setSubmitting(false)
    }
  }

  if (variant === 'full') {
    return (
      <button
        onClick={toggle}
        disabled={loading || submitting}
        className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          isRegular
            ? 'bg-pink-50 text-pink-600 border border-pink-200'
            : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
        } ${className}`}
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> :
          isRegular ? <Bell className="w-4 h-4 fill-current" /> : <Heart className="w-4 h-4" />}
        {isRegular ? '단골 등록됨' : '단골 등록하고 알림받기'}
        {count > 0 && <span className="text-[11px] opacity-70">({count.toLocaleString()})</span>}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || submitting}
      aria-label={isRegular ? '단골 해제' : '단골 등록'}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
        isRegular
          ? 'bg-pink-100 text-pink-600 hover:bg-pink-200'
          : 'bg-pink-500 text-white hover:bg-pink-600 shadow-sm'
      } disabled:opacity-50 ${className}`}
    >
      {submitting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isRegular ? (
        <><Bell className="w-3.5 h-3.5 fill-current" /> 단골</>
      ) : (
        <><Heart className="w-3.5 h-3.5" /> 단골 등록</>
      )}
      {count > 0 && (
        <span className="text-[10px] opacity-80">· {count.toLocaleString()}</span>
      )}
    </button>
  )
}
