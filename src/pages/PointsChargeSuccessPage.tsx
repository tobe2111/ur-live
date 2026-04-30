import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, Zap, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'

export default function PointsChargeSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ points_added: number; balance: number } | null>(null)
  const isProcessingRef = useRef(false)

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setError('결제 정보가 유효하지 않습니다.')
      setLoading(false)
      return
    }
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    async function confirm() {
      try {
        const res = await api.post('/api/points/charge/confirm', {
          paymentKey,
          orderId,
          amount: Number(amount),
        })
        if (res.data.success) {
          setResult(res.data.data)
        } else {
          setError(res.data.error || '충전 확인에 실패했습니다.')
        }
      } catch (err: unknown) {
        const err_ = err as { response?: { data?: { error?: string }; status?: number } }
        setError(err_.response?.data?.error || '충전 처리 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
        isProcessingRef.current = false
      }
    }

    confirm()
  }, [paymentKey, orderId, amount])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <SEO title="딜 충전 처리" description="딜 포인트 충전 처리 중" url="/points/charge/success" noindex />
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-pink-500 mx-auto mb-4" />
          <p className="text-gray-500">충전을 처리하는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <SEO title="딜 충전 실패" description="딜 포인트 충전에 실패했습니다" url="/points/charge/success" noindex />
        <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 shadow-lg">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/points/charge')} className="px-6 py-3 bg-pink-500 text-white rounded-xl font-bold">
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
      <SEO title="딜 충전 완료" description="딜 포인트 충전이 완료되었습니다" url="/points/charge/success" noindex />
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">충전 완료!</h1>
        <div className="bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl p-5 my-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-pink-500" />
            <span className="text-sm text-gray-600">충전된 딜</span>
          </div>
          <p className="text-3xl font-bold text-pink-600">+{formatNumber(result?.points_added)}딜</p>
          <p className="text-sm text-gray-500 mt-2">현재 잔액: {formatNumber(result?.balance)}딜</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-2)}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold"
          >
            라이브로 돌아가기
          </button>
          <button
            onClick={() => navigate('/points/charge')}
            className="flex-1 py-3 bg-pink-500 text-white rounded-xl font-bold"
          >
            추가 충전
          </button>
        </div>
      </div>
    </div>
  )
}
