/**
 * 🧢 소비자 상·하단 크롬(PC 상단 네비 · 프로모 바 · 하단 탭)이 **주소만으로** 안 뜨는 화면 (2026-10-20 분리).
 *
 * 왜 따로 뺐나: 이 판정이 `App.tsx` 안에만 있었는데, `main.tsx` 가 **첫 렌더 전에** PC 상단 네비 코드를
 * 받아 두는 일(`warmDesktopChrome`, 2026-10-18)은 그 판정을 몰랐다. 그래서 어드민·셀러·에이전시처럼
 * 상단 네비가 **절대 안 그려지는** 화면에서도 그 코드(+ 딸린 홈 화면 봉투 넷)를 받는 동안 첫 렌더를 미뤘다
 * (라이브 실측 2026-10-20 `/admin`: 어드민 라우트 청크보다 **먼저** `app-desktop-chrome` ·
 * `lz-home-homePc*` 4개 · `lucide-home` 이 받아졌다). 두 자리가 같은 함수를 쓰면 다시 갈릴 수 없다.
 *
 * ⚠️ 여기엔 **의존 없는 판정만** 둔다. `App.tsx` 가 둘을 더한다:
 *   - `?embed=1` 유어샵 — 세션 저장소에 따라 갈려 주소만으론 모른다
 *   - 운영자 몰(`isMallSurfacePath`) — 그 판정(예약어 표)을 여기로 끌어오면 이 모듈이 셸 쪽 청크를 import 해
 *     `app-shell ↔ app-utils` 청크 순환이 생겼다(2026-10-20 빌드 게이트 실측). 몰 화면에서 부팅 준비가
 *     PC 네비를 미리 받는 것은 낭비일 뿐 화면은 같다(네비는 App.tsx 가 안 그린다).
 */
import { isMarketingSurface } from '@/utils/domain'

// 🛡️ 2026-05-24 (regression fix): /pay/widget 누락 → BottomNav 가 결제 버튼 가림.
//   결제 위젯 마운트하는 모든 경로는 반드시 여기 등록. 신규 추가 시 tests/unit/toss-fullscreen-routes.test.ts
//   가 자동 검증 (이 배열과 TossPaymentWidget 마운트 라우트 일치 확인).
export const fullScreenPrefixes = ['/cart', '/checkout', '/payment', '/pay', '/points', '/seller', '/admin', '/login', '/register', '/auth', '/embed', '/introduce', '/blog', '/about', '/partners', '/creators', '/my-orders', '/store/scan', '/videos', '/design', '/mall-admin', '/agency', '/life/q']

/**
 * 정확히 그 주소만 전체 화면인 곳 — 접두사로 넣으면 하위 도구 화면까지 네비를 잃는 경우.
 * 📣 2026-10-31 `/influencer` = 소개 파트너 모집 랜딩(자기 헤더가 있다). 그 아래
 *   `/influencer/dashboard`·`/settlement`·`/discover`·`/analytics` 는 폰 폭 도구라 네비가 남아야 한다
 *   (`pc-fullbleed.ts` 가 같은 이유로 정확 일치로 둔다).
 */
export const fullScreenExactPaths = ['/influencer']

/** 소비자 네비 없이 화면 전체를 쓰는 주소인가. */
export function isFullScreenPath(pathname: string): boolean {
  return fullScreenExactPaths.includes(pathname)
    || fullScreenPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

/**
 * 주소만으로 소비자 크롬이 숨는가 — `App.tsx` 의 `hideBottomNav` 와 `warmDesktopChrome` 이 같이 쓴다.
 *  - 전체 화면 주소(대시보드·결제·로그인·랜딩)
 *  - 쇼핑 상세(`/products/:id` — 자기 구매 바를 쓴다)
 *  - 유어애즈(`/ads`)
 */
export function consumerChromeHiddenByPath(pathname: string): boolean {
  return isFullScreenPath(pathname) || pathname.startsWith('/products/') || isMarketingSurface(pathname)
}
