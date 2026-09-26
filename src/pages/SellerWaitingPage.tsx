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
import { MY_PATH } from '@/lib/seller-return'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { Clock, AlertCircle, ArrowRight, Home, RefreshCw } from 'lucide-react'

type Status = 'pending' | 'suspended' | 'rejected' | 'active' | 'unknown'

export default function SellerWaitingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('unknown')
  const [loading, setLoading] = useState(true)
  const [businessName, setBusinessName] = useState('')
  // 🛡️ 2026-06-12 (감사 1단계): 거절 사유 표시 — admin-tools reject 가 sellers.reject_reason 저장.
  const [rejectReason, setRejectReason] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchStatus = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setErrorMsg(null)
    try {
      const res = await api.get('/api/seller/my-seller-status')
      if (res.data?.success && res.data.data?.linked) {
        const s = res.data.data.seller?.status as Status
        setStatus(s || 'pending')
        setBusinessName(res.data.data.seller?.business_name || '')
        setRejectReason(res.data.data.seller?.reject_reason || '')
        // 🥕 2026-09-16 (대표 — *"반려는 되더라도 쓸 수는 있게"*): 정지가 아니면 전부 대시보드로.
        //   종전엔 승인된 계정만 통과시키고 대기·반려는 **이 화면에 가뒀다** — 그래서 서류를 고쳐
        //   내려는 사장님이 고칠 화면(`/seller/business-info`)에 갈 수가 없었다. 상태는 대시보드의
        //   `SellerApprovalBanner` 가 말한다(정지는 서버 `switch-to-seller` 가 계속 막는다).
        if (s !== 'suspended') {
          // 🏁 2026-07-02 단일 퍼널: seller_token 없이 /seller 로 가면 requireSeller 가
          //   이메일/비번 로그인으로 튕김(카카오 유저에겐 낯선 화면). switch-to-seller 로
          //   같은 세션에서 셀러 토큰을 발급받아 저장한 뒤 진입 — 재로그인 0.
          let entered = false
          try {
            const sw = await api.post('/api/seller/switch-to-seller')
            if (sw.data?.success && sw.data.data?.accessToken) {
              const { accessToken, refreshToken, seller } = sw.data.data
              localStorage.setItem('seller_token', accessToken)
              if (refreshToken) localStorage.setItem('seller_refresh_token', refreshToken)
              if (seller?.id != null) localStorage.setItem('seller_id', String(seller.id))
              if (seller?.name) localStorage.setItem('seller_name', seller.name)
              if (seller?.email) localStorage.setItem('seller_email', seller.email)
              if (seller?.username) localStorage.setItem('seller_username', seller.username)
              if (seller?.seller_type) localStorage.setItem('seller_type', seller.seller_type)
              entered = true
            }
          } catch { /* 토큰 발급 실패 — 아래에서 이 화면에 남는다 */ }
          // ⚠️ **토큰을 실제로 받았을 때만** 보낸다. 종전엔 무조건 보냈는데, 그때는 승인된
          //    계정만 여기 왔으므로 실패가 곧 사고였다. 이제 대기·반려도 지나가므로 실패 시
          //    `/seller` 로 보내면 로그인 화면으로 튕긴다 — 대기 안내가 그것보다 낫다.
          if (entered) {
            /**
             * 🏠 2026-09-26 (대표 *"셀러대시보드를 쓸 필요없게끔"*): 착륙지를 **마이**로.
             *
             * 이 화면은 사장님의 **첫 접촉**이다 — 알림톡 "내 매장 관리하기" 가 여기로 온다
             * (`store-owner-notice.ts`). 종전엔 곧장 대시보드로 보냈고, 그러면 사장님이 처음
             * 배우는 것이 "내 가게는 저 대시보드에 있다" 가 된다. 마이로 보내면 첫 화면이
             * **내 가게**(오늘 매출 · 주문 확인 · 도구)다.
             *
             * ⚠️ `entered` 일 때만이라는 조건이 이걸 안전하게 만든다 — `switch-to-seller` 가
             *   성공했다는 건 **소비자 세션이 있다**는 증거고(그 API 가 그걸 요구한다),
             *   그 판정 기준(`sellers.linked_user_id`)은 마이의 좌석 목록(`listOperableStores`)이
             *   읽는 것과 **같다**. 즉 마이에 도착하면 내 가게가 반드시 보인다.
             */
            navigate(MY_PATH, { replace: true })
            return
          }
        }
      } else {
        // 신청 이력 없음 → 단일 가입 관문으로 (레거시 막다른 /register/business 아님)
        navigate('/seller/register/supplier', { replace: true })
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

  // 🏁 2026-07-02 단일 퍼널: pending 동안 30초마다 자동 갱신 — 승인되면 이 화면이 스스로
  //   토큰 발급 → 대시보드 진입(수동 새로고침 힌트 의존 제거). 언마운트 시 정리.
  useEffect(() => {
    if (status !== 'pending') return
    const timer = setInterval(() => { fetchStatus({ silent: true }) }, 30_000)
    return () => clearInterval(timer)
  }, [status, fetchStatus])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <BrandLoader />
      </div>
    )
  }

  // 🛡️ 2026-05-06: 에러 발생 시 자동 redirect 대신 안내 + 재시도 버튼
  if (errorMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <SEO title={`${t('sellerWaiting.errorTitle', { defaultValue: '셀러 상태 조회 오류' })} - 유어딜`} description={t('sellerWaiting.errorTitle', { defaultValue: '셀러 상태 조회에 실패했습니다' })} url="/seller/waiting" noindex />
        <div className="bg-white rounded-[var(--dash-radius,16px)] max-w-sm w-full p-6">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-tone-bad-bg flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-tone-bad" />
          </div>
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-lg font-bold text-gray-900">{t('sellerWaiting.errorTitle', { defaultValue: '상태 확인 실패' })}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{errorMsg}</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => fetchStatus()}
              className="ur-btn ur-btn-lg ur-btn-primary w-full flex items-center justify-center gap-2"
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
      <div className="bg-white rounded-[var(--dash-radius,16px)] max-w-sm w-full p-6">
        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
          isRejected ? 'bg-tone-bad-bg' : 'bg-tone-warn-bg'
        }`}>
          {isRejected
            ? <AlertCircle className="w-8 h-8 text-tone-bad" />
            : <Clock className="w-8 h-8 text-tone-warn" />}
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
            {status === 'rejected' && (
              <>
                {t('sellerWaiting.rejectedDesc')}
                {rejectReason && (
                  <>
                    <br />
                    <span className="font-semibold text-tone-bad">
                      {t('sellerWaiting.rejectReason', { defaultValue: '거절 사유' })}: {rejectReason}
                    </span>
                  </>
                )}
              </>
            )}
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
            {/* 🏁 2026-07-02 (#3 2단계 심사 투명화): 현금 정산 = 사업자등록증 인증 1회 추가 필요 사전 고지 */}
            <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-100">
              {t('sellerWaiting.secondGate', { defaultValue: '승인 후 현금 정산을 받으려면 사업자등록증 인증 1회가 추가로 필요해요 (대시보드 → 사업자 정보).' })}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Link to="/" className="ur-btn ur-btn-lg ur-btn-primary w-full flex items-center justify-center gap-2">
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
