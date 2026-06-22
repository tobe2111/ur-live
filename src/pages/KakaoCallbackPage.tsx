/**
 * KakaoCallbackPage - 카카오 OAuth 콜백 처리
 *
 * 🛡️ 2026-05-01: Firebase 100% 제거 — 한국·글로벌 모두 세션 쿠키 only.
 *
 * Flow:
 *   백엔드 POST /api/auth/kakao/callback → localStorage 설정 + httpOnly 세션 쿠키 발급
 *   → 리다이렉트.
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { isKorea } from '@/config/region'
import { getTempCartItem, clearTempCartItem } from '@/utils/auth'
import { toast } from '@/hooks/useToast'
import { safeInternalPath } from '@/utils/safe-internal-path'

export default function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const processingRef = useRef(false)

  useEffect(() => {
    if (processingRef.current) return
    processingRef.current = true

    const handleCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const state = searchParams.get('state')

      if (error || !code) {
        toast.error('카카오 로그인에 실패했습니다.')
        navigate('/login', { replace: true })
        return
      }

      try {
        // 🛡️ 2026-06-20 (C3): redirect_uri 는 이 페이지의 실제 경로(/auth/kakao/callback)와 일치해야 함.
        //   카카오 토큰 교환은 authorize 때 쓴 redirect_uri 와 정확히 같아야 성공(KOE006 방지).
        //   이전엔 /auth/kakao/sync/callback 을 보내 — 이 페이지가 /auth/kakao/callback 에 마운트되므로
        //   불일치였다(주 흐름은 서버 /sync/callback 이라 휴면 버그였지만, 이 SPA 경로로 code 가 오면 실패).
        const res = await api.post('/api/auth/kakao/callback', {
          code,
          redirect_uri: `${window.location.origin}/auth/kakao/callback`,
        })

        if (!res.data.success) throw new Error(res.data.error || '로그인 실패')

        const { user, seller_token, agency_token, agency_refresh_token, seller, agency } = res.data.data

        // 🏭 2026-06-05 [UNLOCK_LOADING] (사용자 신고 — 마이=정지원 / 링크샵=디스크프리 계정 중첩 영구수정):
        //   다른 카카오 계정(user.id 변경)으로 로그인하면, 이전 계정의 seller/agency/링크샵 캐시 키가
        //   localStorage 에 잔존 → BottomNav 링크샵 탭이 옛 계정(디스크프리)을 가리키고, 잔존 seller_token 은
        //   보안상으로도 위험. 계정 전환 시 이 키들을 먼저 제거하고, 아래에서 응답에 있는 것만 재설정 → 신원 1개로 정합.
        //   (잠긴 동작 불변·추가만: seller_username 저장 로직과 admin/agency 'user_type 보존'(아래 51줄)은 그대로.
        //    admin_token 은 별도 로그인 컨텍스트라 건드리지 않음.)
        const prevUserId = localStorage.getItem('user_id')
        if (prevUserId && prevUserId !== String(user.id)) {
          for (const k of [
            'seller_token', 'seller_refresh_token', 'seller_id', 'seller_name', 'seller_username',
            'linked_seller_username', 'user_handle',
            'agency_token', 'agency_refresh_token', 'agency_id', 'agency_name',
            'is_distributor',
          ]) {
            try { localStorage.removeItem(k) } catch { /* ignore */ }
          }
        }

        // ── localStorage 설정 (공통) ──
        // 🛡️ 2026-05-27 (이중 로그인 보호): admin/agency 토큰 있으면 user_type/active_role 덮어쓰지 않음.
        //   user_type 은 DISPLAY 컨텍스트 — 마지막 로그인 컨텍스트 우선. RouteGuards 는 이미 token-based.
        const hasOtherRoleToken = !!(localStorage.getItem('admin_token') || localStorage.getItem('agency_token'))
        if (!hasOtherRoleToken) {
          localStorage.setItem('user_type', 'user')
          localStorage.setItem('active_role', 'user')
        }
        localStorage.setItem('user_id', String(user.id))
        localStorage.setItem('user_name', user.name || '')
        localStorage.setItem('session_login', 'true')
        if (user.email) localStorage.setItem('user_email', user.email)
        if (user.profile_image) localStorage.setItem('user_profile_image', user.profile_image)
        // 🛡️ 2026-06-20 (A 방식): 이 POST 흐름은 same-origin XHR 200 응답에서 ur_session 쿠키를 set →
        //   iOS 에서도 영속(localStorage Bearer 불필요). 세션은 httpOnly 쿠키로만 인증.

        // ── 카카오 계정에 연결된 셀러/에이전시 권한 자동 복원 ──
        // (백엔드가 linked_user_id 기반으로 JWT 를 이미 발급해서 보내줌)
        if (seller_token) {
          localStorage.setItem('seller_token', seller_token)
          if (seller?.id) localStorage.setItem('seller_id', String(seller.id))
          if (seller?.business_name) localStorage.setItem('seller_name', seller.business_name)
          // 🛡️ 2026-05-27: seller_username 저장 → BottomNav 가 즉시 /profile/{username} navigate.
          if (seller?.username) localStorage.setItem('seller_username', seller.username)
          // 🛡️ 2026-06-19 (#4·#5 근본수정): 판매사면 is_distributor 저장 — 없으면 상품페이지 게스트 UI +
          //   충전→/wholesale/deposits 가드가 /wholesale 로 튕김("새로고침 느낌"). 일반 로그인과 대칭.
          if ((seller as { is_distributor?: number })?.is_distributor) localStorage.setItem('is_distributor', '1')
        }
        if (agency_token) {
          localStorage.setItem('agency_token', agency_token)
          // 🏁 2026-06-13: refresh token 저장 — 카카오 로그인 에이전시 자동 로그아웃 방지
          if (agency_refresh_token) localStorage.setItem('agency_refresh_token', agency_refresh_token)
          if (agency?.id) localStorage.setItem('agency_id', String(agency.id))
          if (agency?.name) localStorage.setItem('agency_name', agency.name)
        }

        // 🛡️ 2026-05-01: Firebase customToken 로그인 경로 제거.
        //   세션 쿠키만으로 한국·글로벌 모두 인증 처리.
        if (!isKorea()) {
          try {
            const { useAuthWorld } = await import('@/shared/stores/useAuthWorld')
            useAuthWorld.getState().setAuthReady(true)
          } catch { /* ignore */ }
        }

        // ── 장바구니 복원 ──
        // 🛡️ 2026-05-01: 실패 시 명시 toast — 이전엔 silent 무시 → 사용자가 cart 손실 인지 못 함.
        const tempCart = getTempCartItem()
        if (tempCart) {
          api.post('/api/cart', {
            product_id: tempCart.productId, quantity: tempCart.quantity,
            price_snapshot: tempCart.priceSnapshot, live_stream_id: tempCart.liveStreamId,
          }, { timeout: 5000 })
            .then(() => {
              toast.success('장바구니가 복원됐어요!')
            })
            .catch((e) => {
              if (import.meta.env.DEV) console.warn('[KakaoCallback] cart restore failed:', e)
              toast.error('장바구니 복원에 실패했어요. 다시 담아주세요.')
            })
            .finally(() => clearTempCartItem())
        }

        // 🛡️ 2026-05-27 (P2 referral): 초대 링크로 진입한 신규 사용자 → referral_tree 등록.
        //   self-invite (본인 = 초대자) 차단. 24시간 만료. 등록 후 cleanup.
        try {
          const raw = localStorage.getItem('pending_referral_inviter')
          if (raw) {
            const parsed = JSON.parse(raw) as { id: string; ts: number }
            const within24h = Date.now() - parsed.ts < 24 * 60 * 60_000
            if (within24h && parsed.id && String(parsed.id) !== String(user.id)) {
              api.post('/api/referral-tree/register', {
                user_id: String(user.id),
                user_type: 'user',
                referrer_id: String(parsed.id),
              }).catch(() => { /* graceful — 이미 등록 / 순환 등 */ })
            }
            localStorage.removeItem('pending_referral_inviter')
          }
        } catch { /* ignore */ }

        // ── returnUrl 결정 & 이동 ──
        // 🛡️ 2026-04-29: safeInternalPath 로 통일 — /auth/*, /login 자기참조 차단
        const stored = localStorage.getItem('loginReturnUrl')
        const returnUrl = safeInternalPath(state, safeInternalPath(stored, '/'))
        localStorage.removeItem('loginReturnUrl')
        navigate(returnUrl, { replace: true })

      } catch (err: unknown) {
        const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string };
        if (import.meta.env.DEV) console.error('[KakaoCallback] 실패:', err)
        toast.error(err_.response?.data?.error || err_.message || '로그인 실패')
        navigate('/login', { replace: true })
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#020202] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">로그인 처리 중...</p>
      </div>
    </div>
  )
}
