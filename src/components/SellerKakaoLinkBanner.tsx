/**
 * SellerKakaoLinkBanner — 이메일/비번으로 로그인한 (카카오 미연동) 셀러에게
 * 카카오 계정 연동을 권하는 dismissible 배너. (2026-06-26 카카오 단일로그인 통일 Step 2b)
 *
 * 동작/비용 최소화:
 *  1. localStorage dismiss 플래그 있으면 즉시 null (네트워크 0).
 *  2. user_id(카카오 세션) 가 이미 있으면 null — 카카오로 로그인한 셀러는 대상 아님 (네트워크 0).
 *  3. 그 외(이메일 셀러 후보)만 1회 GET /api/seller/kakao-link-status 로 실제 연동 여부 확인 →
 *     이미 연동돼 있으면 dismiss 플래그 캐시 후 null, 미연동이면 배너 노출.
 *  CTA 는 /seller/profile (KakaoLinkButton 이 OAuth 팝업 처리) 로 이동 — 검증된 연동 흐름 재사용.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { X } from 'lucide-react'

const DISMISS_KEY = 'seller_kakao_link_banner_dismissed_v1'

export default function SellerKakaoLinkBanner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // 1) 이미 닫음 → 노출 안 함
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    // 2) 카카오 세션(user_id) 보유 = 카카오 로그인 셀러 → 대상 아님
    if (localStorage.getItem('user_id')) return
    // 3) 이메일 셀러 후보만 실제 연동 상태 1회 조회
    let alive = true
    api.get('/api/seller/kakao-link-status')
      .then((res) => {
        if (!alive) return
        if (res.data?.success && res.data.data?.linked) {
          // 이미 연동됨 → 다시 안 묻도록 캐시
          try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* quota */ }
          return
        }
        setShow(true)
      })
      .catch(() => { /* silent — 배너 미노출 */ })
    return () => { alive = false }
  }, [])

  if (!show) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* quota */ }
    setShow(false)
  }

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3.5 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-[#FEE500] flex items-center justify-center text-lg shrink-0">💬</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900">
          {t('seller.kakaoBannerTitle', { defaultValue: '카카오 로그인으로 더 간편하게' })}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
          {t('seller.kakaoBannerDesc', { defaultValue: '카카오 계정을 연동하면 다음부터 카카오 로그인 한 번으로 셀러 대시보드에 들어올 수 있어요.' })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/seller/profile')}
        className="shrink-0 px-3.5 py-2 bg-[#111827] hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
      >
        {t('seller.kakaoBannerCta', { defaultValue: '연동하기' })}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.close', { defaultValue: '닫기' })}
        className="shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
