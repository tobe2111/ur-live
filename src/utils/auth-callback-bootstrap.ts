/**
 * 🛡️ 2026-05-01 (D fix): 카카오 OAuth callback URL 파라미터 처리.
 *
 * Why this exists:
 *   Worker 의 /auth/kakao/sync/callback 이 redirect 로 ?login=success&userId=X 를 부착해서
 *   프론트엔드에 돌려줍니다. 이 파라미터를 React 가 mount 되기 *전에* localStorage 로 옮겨야
 *   ProtectedRoute 가 첫 render 에서 통과합니다.
 *
 *   기존엔 App.tsx 의 render 함수 안에서 useRef 가드 + localStorage.setItem + history.replaceState
 *   를 호출했지만 이는 React 의 "render 는 순수해야 한다" 원칙 위반 → StrictMode 에서 중복 호출,
 *   future React features 와 호환 X.
 *
 *   이 함수는 main.tsx 에서 ReactDOM.createRoot 전에 동기 호출되어 안전합니다.
 *
 * 호출 시점: 무조건 1회, React 마운트 전.
 */

const PROCESSED_FLAG = '__urAuthCallbackProcessed'

export function processAuthCallbackParams(): void {
  // Idempotency: 모듈 hot-reload 등으로 두 번 호출되어도 안전
  const w = window as unknown as Record<string, unknown>
  if (w[PROCESSED_FLAG]) return
  w[PROCESSED_FLAG] = true

  let urlParams: URLSearchParams
  try {
    urlParams = new URLSearchParams(window.location.search)
  } catch {
    return
  }

  // ── 카카오 로그인 성공 ──
  if (urlParams.get('login') === 'success' && urlParams.get('userId')) {
    try {
      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_id', urlParams.get('userId')!)
      localStorage.setItem('session_login', 'true')
      const userName = urlParams.get('userName')
      const userEmail = urlParams.get('userEmail')
      const profileImage = urlParams.get('profileImage')
      if (userName) localStorage.setItem('user_name', userName)
      if (userEmail) localStorage.setItem('user_email', userEmail)
      if (profileImage) localStorage.setItem('user_profile_image', profileImage.replace(/^http:\/\//, 'https://'))
    } catch { /* localStorage blocked (incognito etc.) — ignore */ }

    // linked seller/agency token transfer (cookie → localStorage)
    try {
      const readCookie = (name: string): string | null => {
        const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(document.cookie)
        return match ? decodeURIComponent(match[1]) : null
      }
      const clearCookie = (name: string) => {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure`
      }
      const sellerToken = readCookie('ur_pending_seller_token')
      if (sellerToken) {
        localStorage.setItem('seller_token', sellerToken)
        const sellerInfoRaw = readCookie('ur_pending_seller_info')
        if (sellerInfoRaw) {
          try {
            const info = JSON.parse(sellerInfoRaw)
            if (info.id) localStorage.setItem('seller_id', String(info.id))
            if (info.business_name) localStorage.setItem('seller_name', info.business_name)
          } catch { /* ignore */ }
        }
        clearCookie('ur_pending_seller_token')
        clearCookie('ur_pending_seller_info')
      }
      const agencyToken = readCookie('ur_pending_agency_token')
      if (agencyToken) {
        localStorage.setItem('agency_token', agencyToken)
        const agencyInfoRaw = readCookie('ur_pending_agency_info')
        if (agencyInfoRaw) {
          try {
            const info = JSON.parse(agencyInfoRaw)
            if (info.id) localStorage.setItem('agency_id', String(info.id))
            if (info.name) localStorage.setItem('agency_name', info.name)
          } catch { /* ignore */ }
        }
        clearCookie('ur_pending_agency_token')
        clearCookie('ur_pending_agency_info')
      }
    } catch { /* ignore */ }

    // URL 정리 — 인증용 파라미터만 제거.
    //   new=1 (onboarding), restorable=1 (Option B 복원), originalName, userName 유지
    //   (OnboardingTrigger / RestoreConsent 가 useSearchParams 로 읽음).
    try {
      urlParams.delete('login')
      urlParams.delete('userId')
      urlParams.delete('userEmail')
      urlParams.delete('profileImage')
      const clean = urlParams.toString()
      window.history.replaceState({}, '', clean ? `${window.location.pathname}?${clean}` : window.location.pathname)
    } catch { /* ignore */ }
  }

  // 🛡️ 2026-05-01: 인증 상태 무결성 자가 점검 — localStorage 에 user_type/user_id 가
  //   있는데 세션 쿠키가 없거나 만료된 경우 (브라우저가 Secure 쿠키 drop, 30일 만료 등)
  //   조용히 정리. 백그라운드 ping 으로 처리해 페이지 렌더 차단 X.
  //
  //   호출 X 인 경우: localStorage 인증 흔적 자체가 없을 때 (이미 비로그인).
  try {
    const userType = localStorage.getItem('user_type')
    const userId = localStorage.getItem('user_id')
    if (userType === 'user' && userId) {
      // 백그라운드 ping (await X) — 실패 시 localStorage 정리.
      // login=success URL 거쳐온 경우엔 방금 발급된 쿠키라 healthy 정상 응답.
      void fetch('/api/auth/session/health', { credentials: 'include' })
        .then(async (r) => {
          if (!r.ok) return
          const body = await r.json().catch(() => null) as { data?: { session?: boolean } } | null
          if (body?.data?.session === false) {
            // 세션 무효 — localStorage 잔존 데이터 정리
            try {
              localStorage.removeItem('user_type')
              localStorage.removeItem('user_id')
              localStorage.removeItem('user_name')
              localStorage.removeItem('user_email')
              localStorage.removeItem('user_profile_image')
              localStorage.removeItem('session_login')
            } catch { /* ignore */ }
          }
        })
        .catch(() => { /* network error 등 — silent (다음 API 호출에서 재처리) */ })
    }
  } catch { /* ignore */ }
}
