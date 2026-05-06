/**
 * 셀러 승인 대기 페이지
 *
 * 카카오 로그인 후 sync/callback 이 intent=seller 상태에서
 * linked seller.status === 'pending' 또는 비-active 일 때 진입.
 *
 * - pending: 관리자 승인 대기 안내
 * - suspended/rejected: 상태 안내 + 고객센터 유도
 */

import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { Loader2, Clock, AlertCircle, ArrowRight, Home, RefreshCw } from 'lucide-react'

type Status = 'pending' | 'suspended' | 'rejected' | 'active' | 'unknown'

export default function SellerWaitingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('unknown')
  const [loading, setLoading] = useState(true)
  const [businessName, setBusinessName] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await api.get('/api/seller/my-seller-status')
      if (res.data?.success && res.data.data?.linked) {
        const s = res.data.data.seller?.status as Status
        setStatus(s || 'pending')
        setBusinessName(res.data.data.seller?.business_name || '')
        if (s === 'active' || (s as string) === 'approved') {
          navigate('/seller', { replace: true })
          return
        }
      } else {
        navigate('/seller/register/business?from=kakao', { replace: true })
        return
      }
    } catch (err: unknown) {
      // 🛡️ 2026-05-06: 에러 종류별 처리. 모든 에러를 /seller/login 으로 보내지 않음.
      //   401: 미로그인 → /seller/login (정상)
      //   403: 세션 권한 부족 → 화면에 안내, 카카오 재로그인 유도
      //   5xx/네트워크: 화면에 안내 + 재시도 (자동 redirect 안 함)
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        navigate('/seller/login', { replace: true })
        return
      }
      if (status === 403) {
        setErrorMsg(t('sellerWaiting.error403', { defaultValue: '셀러 정보 조회 권한이 없습니다. 카카오 재로그인이 필요할 수 있어요.' }))
      } else if (status && status >= 500) {
        setErrorMsg(t('sellerWaiting.error5xx', { defaultValue: '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' }))
      } else {
        setErrorMsg(t('sellerWaiting.errorNetwork', { defaultValue: '네트워크 연결을 확인해주세요.' }))
      }
    } finally { setLoading(false) }
  }, [navigate, t])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 text-red-500 animate-spin" />
      </div>
    )
  }

  // 🛡️ 2026-05-06: 에러 발생 시 자동 redirect 대신 안내 + 재시도 버튼
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title={`${t('sellerWaiting.errorTitle', { defaultValue: '셀러 상태 조회 오류' })} - 유어딜`} description={t('sellerWaiting.errorTitle', { defaultValue: '셀러 상태 조회에 실패했습니다' })} url="/seller/waiting" noindex />
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-sm">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-lg font-bold text-gray-900">{t('sellerWaiting.errorTitle', { defaultValue: '상태 확인 실패' })}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{errorMsg}</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={fetchStatus}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              {t('common.retry', { defaultValue: '다시 시도' })}
            </button>
            <Link to="/seller/login" className="block w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm text-center">
              {t('sellerWaiting.goLogin', { defaultValue: '셀러 로그인으로 이동' })}
            </Link>
            <Link to="/" className="block w-full py-3 text-gray-500 text-xs text-center">
              {t('common.home', { defaultValue: '홈으로' })}
            </Link>
          </div>
        </div>
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
