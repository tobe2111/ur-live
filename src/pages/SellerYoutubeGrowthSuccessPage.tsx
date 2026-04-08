import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, Youtube, Loader2 } from 'lucide-react'
import api from '@/lib/api'

export default function SellerYoutubeGrowthSuccessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ subscribers: number; amount: number } | null>(null)
  const isProcessingRef = useRef(false)

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')
  const token = localStorage.getItem('seller_token')

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setError(t('seller.paymentInfoInvalid'))
      setLoading(false)
      return
    }
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    async function confirm() {
      try {
        const res = await api.post('/api/youtube-growth/confirm', {
          paymentKey,
          orderId,
          amount: Number(amount),
        }, { headers: { Authorization: `Bearer ${token}` } })

        if (res.data.success) {
          setResult(res.data.data)
        } else {
          setError(res.data.error || t('seller.paymentConfirmFailed'))
        }
      } catch (err: any) {
        setError(err.response?.data?.error || t('seller.paymentProcessingError'))
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
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-red-500 mx-auto mb-4" />
          <p className="text-gray-500">{t('seller.processingPayment')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl p-8 shadow-lg">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => navigate('/seller/youtube-growth')} className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold">
            {t('seller.goBackButton')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('seller.paymentCompleted')}</h1>
        <p className="text-sm text-gray-500 mb-6">{t('seller.subscriberGrowthAfterReview')}</p>
        <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-5 my-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-600">{t('seller.youtubeGrowth')}</span>
          </div>
          <p className="text-3xl font-bold text-red-600">+{result?.subscribers.toLocaleString()}명</p>
          <p className="text-sm text-gray-500 mt-2">{t('seller.paymentAmountLabel')}: {result?.amount.toLocaleString()}{t('common.won')}</p>
        </div>
        <button
          onClick={() => navigate('/seller/youtube-growth')}
          className="w-full py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600"
        >
          {t('seller.checkRequestHistory')}
        </button>
      </div>
    </div>
  )
}
