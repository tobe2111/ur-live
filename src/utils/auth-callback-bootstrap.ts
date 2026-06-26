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

  // 🛡️ 2026-06-20 (A2): 방금 login=success 로 진입한 로드인지 — 이 로드에선 health-wipe 를 건너뛴다.
  //   세션 쿠키가 막 발급돼 propagation race 가 있거나, Safari/ITP 가 redirect 의 Set-Cookie 를 드롭한
  //   순간에 health 핑이 session:false 를 보고 localStorage 를 wipe → "로그인 직후 자동 로그아웃" 발생.
  //   이 로드만 grace 부여(다음 로드/실제 API 401 에서 자연 정리).
  let didFreshLogin = false

  // ── 카카오 로그인 성공 ──
  if (urlParams.get('login') === 'success' && urlParams.get('userId')) {
    didFreshLogin = true
    // 🛡️ 2026-05-01: 새 사용자 로그인 시 이전 사용자 데이터 wipe — cross-user leak 차단.
    //   사용자 신고: "다른 사람 폰에서 내 계정 로그인했는데 그 사람 이름으로 됨".
    //
    //   접근 변경: KEEP whitelist (allowlist) — 명시된 기기/앱 설정 키만 유지하고
    //   나머지 모든 localStorage 키 wipe. 새로 추가된 인증/사용자 데이터 키도
    //   자동으로 wipe 됨 (prefix maintenance 부담 X).
    //
    //   유지 대상 (기기 preferences, attribution, PWA 가드):
    //   - i18n*, feature_flags, dark/light/theme (UI preferences)
    //   - ur_pwa_*, ur_kakao_external_* (PWA / webview 가드)
    //   - affiliate_ref, affiliate_ref_expires (추천인 attribution)
    try {
      const KEEP_PREFIXES = ['ur_pwa_', 'ur_kakao_external_', 'i18n']
      const KEEP_KEYS = new Set([
        'feature_flags',
        'dark', 'light', 'theme',
        'affiliate_ref', 'affiliate_ref_expires',
      ])
      // 🏁 2026-06-12 (P7 — 전 플로우 감사, 사용자 승인 "모두 이상적"): 같은 user.id 재로그인이면
      //   admin 세션 보존 — SPA 콜백(KakaoCallbackPage:69 'admin_token 은 별도 컨텍스트')과 정책 통일.
      //   다른 user.id(계정 전환/공용 기기)는 기존대로 전부 wipe (cross-user 누출 차단이 우선).
      try {
        const incomingUserId = urlParams.get('userId')
        const prevUserId = localStorage.getItem('user_id')
        if (incomingUserId && prevUserId && String(incomingUserId) === String(prevUserId)) {
          for (const k of ['admin_token', 'admin_refresh_token', 'admin_id', 'admin_name', 'admin_email']) KEEP_KEYS.add(k)
          // 🛡️ 2026-06-26 (소비자 감사 P1): 같은 user.id 재로그인이면 링크샵 핸들 캐시도 보존 —
          //   로그인 직후 첫 링크샵 클릭이 느리거나 /creator 로 fall-through 하던 것 방지(누출 위험 없음, 동일인).
          for (const k of ['user_handle', 'linked_seller_username', 'seller_username']) KEEP_KEYS.add(k)
        }
      } catch { /* ignore */ }
      const isKeeper = (k: string) =>
        KEEP_KEYS.has(k) || KEEP_PREFIXES.some(p => k.startsWith(p))

      // localStorage 순회 → keeper 가 아니면 모두 wipe
      const allKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k) allKeys.push(k)
      }
      for (const k of allKeys) {
        if (!isKeeper(k)) {
          try { localStorage.removeItem(k) } catch { /* ignore */ }
        }
      }
      try { sessionStorage.clear() } catch { /* */ }
    } catch { /* ignore */ }

    try {
      localStorage.setItem('user_type', 'user')
      localStorage.setItem('user_id', urlParams.get('userId')!)
      localStorage.setItem('session_login', 'true')
      // 🛡️ 2026-05-01: active_role 명시 — 카카오 user 로그인은 항상 'user' DISPLAY.
      //   linked seller 가 있어도 BottomNav 는 user UI 표시 (사용자가 명시 전환해야 seller).
      localStorage.setItem('active_role', 'user')
      const userName = urlParams.get('userName')
      const userEmail = urlParams.get('userEmail')
      const profileImage = urlParams.get('profileImage')
      if (userName) localStorage.setItem('user_name', userName)
      if (userEmail) localStorage.setItem('user_email', userEmail)
      if (profileImage) localStorage.setItem('user_profile_image', profileImage.replace(/^http:\/\//, 'https://'))

      // 🛡️ 2026-06-20 (A 방식): 서버가 fragment(#st=)로 넘긴 단명(120초) 세션 티켓을 window 에 stash →
      //   main.tsx bootApp 이 렌더 전 same-origin POST /api/auth/session/establish 로 교환해 httpOnly
      //   ur_session 을 first-party 200 응답에서 발급(iOS 영속). **토큰을 localStorage 에 두지 않음**.
      //   아래 URL 정리에서 hash(#st) 제거됨(서버/Referer 로도 안 나감).
      try {
        const h = window.location.hash || ''
        const m = h.match(/[#&]st=([^&]+)/)
        if (m && m[1]) (window as unknown as { __urEstablishTicket?: string }).__urEstablishTicket = decodeURIComponent(m[1])
      } catch { /* ignore */ }

      // 🛡️ 2026-05-01: 로그인 직후 어떤 카카오 계정으로 로그인됐는지 명확히 표시.
      //   사용자 신고: "다른 사람 폰에서 로그인했더니 그 사람 이름으로 됨".
      //   sessionStorage 에 이름 저장 → React mount 후 toast 가 읽어서 표시.
      if (userName) {
        try { sessionStorage.setItem('ur_kakao_login_welcome', userName) } catch { /* */ }
      }
    } catch { /* localStorage blocked (incognito etc.) — ignore */ }

    // 🛡️ 2026-06-20 (iOS 대시보드 로그인 — A 방식 자매수정): 링크 역할 토큰(seller/agency/판매사 등)을
    //   transfer 쿠키(cross-site 302 set → iOS WebKit 미영속)가 아니라 **fragment(#auth=)** 로 받아
    //   localStorage 로 이전. fragment 는 모든 브라우저(특히 iOS)에서 생존 → 대시보드 로그인 iOS-safe.
    //   - 허용목록(seller_*/agency_*/supplier_* 네임스페이스 + 명시 키)만 적용 → **미래 역할도 같은
    //     네임스페이스면 클라 변경 없이 자동 동작**(서버 pendingLs 맵에 한 줄 추가만). SSOT: worker/utils/pending-auth.ts.
    //   - 토큰 값은 서명 JWT → 서버가 검증. fragment(envelope)는 비신뢰지만 위변조해도 가짜 토큰 통과 불가.
    //   - 아래 URL 정리(replaceState pathname+search)에서 hash(#st/#auth) 제거됨(서버/Referer 미전송).
    try {
      const h = window.location.hash || ''
      const m = h.match(/[#&]auth=([^&]+)/)
      if (m && m[1]) {
        const b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/')
        const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=')
        const bin = atob(padded)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        const obj = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
        const ALLOW = /^(seller_|agency_|supplier_|is_distributor$|user_handle$|linked_seller_username$)/
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'string' && ALLOW.test(k)) {
            try { localStorage.setItem(k, v) } catch { /* quota */ }
          }
        }
      }
    } catch { /* fragment 파싱 실패 — 무시(로그인 자체엔 영향 없음) */ }

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
    // 🛡️ 2026-06-20 (A2): 방금 로그인한 로드면 health-wipe 스킵 — 쿠키 propagation race / Safari 드롭
    //   순간의 오탐 로그아웃 방지. 세션이 실제로 없으면 다음 로드나 첫 API 401 에서 정리된다.
    if (didFreshLogin) return
    const userType = localStorage.getItem('user_type')
    const userId = localStorage.getItem('user_id')
    if (userType === 'user' && userId) {
      // 백그라운드 ping (await X) — 실패 시 localStorage 정리.
      // login=success URL 거쳐온 경우엔 방금 발급된 쿠키라 healthy 정상 응답.
      // 🛡️ 2026-06-20 (iOS 로그인 안정화): user_token Bearer 동봉 — iOS WebKit 가 세션 쿠키를
      //   유실해도 Bearer 로 session:true 판정 → 부당한 자동 wipe 방지. (health 가 Bearer 도 인정)
      const userToken = localStorage.getItem('user_token')
      void fetch('/api/auth/session/health', {
        credentials: 'include',
        headers: userToken ? { Authorization: `Bearer ${userToken}` } : undefined,
      })
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
              localStorage.removeItem('user_token')
              localStorage.removeItem('user_refresh_token')
            } catch { /* ignore */ }
          }
        })
        .catch(() => { /* network error 등 — silent (다음 API 호출에서 재처리) */ })
    }
  } catch { /* ignore */ }
}
