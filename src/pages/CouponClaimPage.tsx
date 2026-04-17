import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Gift, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function CouponClaimPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading')
  const [coupon, setCoupon] = useState<{ name: string; type: string; value: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const isLoggedIn = localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id')

  useEffect(() => {
    if (!code) { setStatus('error'); setErrorMsg('쿠폰 코드가 없습니다'); return }
    if (!isLoggedIn) {
      localStorage.setItem('loginReturnUrl', `/coupon/${code}`)
      navigate(`/login?returnUrl=${encodeURIComponent(`/coupon/${code}`)}`, { replace: true })
      return
    }
    claimCoupon()
  }, [code])

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
        setErrorMsg(res.data.error || '쿠폰 발급에 실패했습니다')
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; already_claimed?: boolean } } }
      if (e.response?.data?.already_claimed) {
        setStatus('already')
      } else {
        setStatus('error')
        setErrorMsg(e.response?.data?.error || '쿠폰 발급에 실패했습니다')
      }
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-gray-400 animate-spin mb-4" />
            <p className="text-gray-500">쿠폰 발급 중...</p>
          </>
        )}

        {status === 'success' && coupon && (
          <>
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">쿠폰이 발급되었습니다!</h1>
            <div className="bg-gray-50 rounded-2xl p-5 mt-4 border border-gray-200">
              <Gift className="w-8 h-8 mx-auto text-pink-500 mb-2" />
              <p className="text-lg font-bold text-gray-900">{coupon.name}</p>
              <p className="text-2xl font-extrabold text-pink-500 mt-1">
                {coupon.type === 'percent' ? `${coupon.value}% 할인` : `${coupon.value.toLocaleString()}원 할인`}
              </p>
              <p className="text-xs text-gray-500 mt-2">결제 시 자동 적용됩니다</p>
            </div>
            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-3.5 bg-gray-900 text-white font-bold rounded-xl active:scale-[0.98]">
              쇼핑하러 가기
            </button>
          </>
        )}

        {status === 'already' && (
          <>
            <div className="w-20 h-20 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <Gift className="w-10 h-10 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">이미 받은 쿠폰입니다</h1>
            <p className="text-sm text-gray-500">마이페이지에서 쿠폰을 확인하세요</p>
            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-3.5 bg-gray-900 text-white font-bold rounded-xl active:scale-[0.98]">
              홈으로 가기
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">쿠폰 발급 실패</h1>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <button onClick={() => navigate('/')}
              className="w-full mt-6 py-3.5 bg-gray-900 text-white font-bold rounded-xl active:scale-[0.98]">
              홈으로 가기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
