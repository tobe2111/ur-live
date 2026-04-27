/**
 * 셀러 승인 대기 페이지
 *
 * 카카오 로그인 후 sync/callback 이 intent=seller 상태에서
 * linked seller.status === 'pending' 또는 비-active 일 때 진입.
 *
 * - pending: 관리자 승인 대기 안내
 * - suspended/rejected: 상태 안내 + 고객센터 유도
 */

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { Loader2, Clock, AlertCircle, ArrowRight, Home } from 'lucide-react'

type Status = 'pending' | 'suspended' | 'rejected' | 'active' | 'unknown'

export default function SellerWaitingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('unknown')
  const [loading, setLoading] = useState(true)
  const [businessName, setBusinessName] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/seller/my-seller-status')
        if (res.data?.success && res.data.data?.linked) {
          const s = res.data.data.seller?.status as Status
          setStatus(s || 'pending')
          setBusinessName(res.data.data.seller?.business_name || '')
          // 'approved' 는 레거시 승인 상태 — active 와 동일하게 취급
          if (s === 'active' || (s as string) === 'approved') {
            navigate('/seller', { replace: true })
            return
          }
        } else {
          // linked seller 없음 → 등록 페이지로
          navigate('/seller/register/business?from=kakao', { replace: true })
          return
        }
      } catch {
        navigate('/seller/login', { replace: true })
        return
      } finally { setLoading(false) }
    })()
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
      </div>
    )
  }

  const isRejected = status === 'rejected' || status === 'suspended'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <SEO title={`${t('sellerWaiting.title')} - 유어딜`} description={t('sellerWaiting.description')} url="/seller/waiting" noindex />
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-sm">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
          isRejected ? 'bg-red-100' : 'bg-amber-100'
        }`}>
          {isRejected
            ? <AlertCircle className="w-8 h-8 text-red-500" />
            : <Clock className="w-8 h-8 text-amber-600" />}
        </div>

        <div className="text-center space-y-2 mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {status === 'pending' && t('sellerWaiting.statusPending')}
            {status === 'suspended' && t('sellerWaiting.statusSuspended')}
            {status === 'rejected' && t('sellerWaiting.statusRejected')}
            {status === 'unknown' && t('sellerWaiting.statusUnknown')}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {status === 'pending' && (
              <>
                {businessName && <><span className="font-semibold text-gray-700">{businessName}</span><br /></>}
                {t('sellerWaiting.pendingDesc')}
              </>
            )}
            {status === 'suspended' && t('sellerWaiting.contactSupport')}
            {status === 'rejected' && t('sellerWaiting.rejectedDesc')}
          </p>
        </div>

        {status === 'pending' && (
          <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
            <p className="text-xs font-semibold text-gray-700">{t('sellerWaiting.afterApproval')}</p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
              <li>{t('sellerWaiting.benefit1')}</li>
              <li>{t('sellerWaiting.benefit2')}</li>
              <li>{t('sellerWaiting.benefit3')}</li>
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Link to="/" className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm">
            <Home className="w-4 h-4" />
            {t('common.home')}
          </Link>
          {isRejected && (
            <a
              href="mailto:support@ur-team.com"
              className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 rounded-xl font-semibold text-sm"
            >
              {t('sellerWaiting.contactCS')}
              <ArrowRight className="w-4 h-4" />
            </a>
          )}
        </div>

        <p className="text-[11px] text-gray-400 text-center mt-4">
          {t('sellerWaiting.reloadHint')}
        </p>
      </div>
    </div>
  )
}
