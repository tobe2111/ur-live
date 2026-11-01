import { Suspense } from 'react'
import PromoBar from './PromoBar'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { lazyPage, BOOT_PAGE_WAIT_MS } from '@/lib/boot-page'
import { consumerChromeHiddenByPath } from '@/lib/consumer-chrome'

/** PC 상단 네비가 뜨는 폭 — 아래 `useMediaQuery` 와 부팅 준비(`warmDesktopChrome`)가 같은 값을 쓴다. */
export const DESKTOP_CHROME_QUERY = '(min-width: 768px)'

/**
 * 🖥️ 2026-10-18 (대표 *"다 이상적으로 해줘"* — 첫 방문 화면 코드 무게): PC 상단 네비(+계정 메뉴·앱 받기 모달·
 *   알림 드롭다운, raw ~33KB)는 폰에선 마운트조차 안 되는데 **정적 import 라 폰의 첫 방문 묶음에 실려 왔다.**
 *   이제 자기 청크(`app-desktop-chrome`)로 떼고, 넓은 화면이면 `main.tsx` 가 **첫 렌더 전에** 받아 둔다
 *   (`warmDesktopChrome`) — 그래서 PC 는 종전처럼 첫 렌더부터 그려지고 늦게 끼어들며 본문을 밀지 않는다
 *   (2026-10-13 audit log 가 lazy 를 피한 이유가 정확히 그것이었다 — `lazyPage` 는 준비된 모듈을 동기로 그린다).
 *   상한(BOOT_PAGE_WAIT_MS) 안에 못 받으면 그 한 번만 늦게 뜬다(종전 페이지 lazy 와 같은 폴백).
 */
const DesktopTopNav = lazyPage(() => import('./DesktopTopNav'))

export function warmDesktopChrome(): Promise<unknown> {
  try {
    if (typeof matchMedia !== 'function' || !matchMedia(DESKTOP_CHROME_QUERY).matches) return Promise.resolve()
    // 🧢 2026-10-20: 상단 네비가 안 그려지는 주소(어드민·셀러·에이전시·결제·랜딩·몰)에선 받지도, 첫 렌더를 미루지도 않는다.
    //   App.tsx 의 `hideBottomNav` 와 같은 함수다 — 둘이 갈리면 네비가 뜨는 화면에서 늦게 끼어들거나(밀림),
    //   안 뜨는 화면에서 그 코드를 기다린다(라이브 `/admin` 실측: 어드민 라우트보다 먼저 홈 봉투 넷을 받았다).
    if (typeof location !== 'undefined' && consumerChromeHiddenByPath(location.pathname)) return Promise.resolve()
  } catch { return Promise.resolve() }
  return Promise.race([DesktopTopNav.load().catch(() => undefined), new Promise((r) => setTimeout(r, BOOT_PAGE_WAIT_MS))])
}

/**
 * 🧢 소비자 화면 상단 묶음 (2026-08-19).
 *
 * `[프로모 바] + [상단 네비]` 는 항상 이 순서로 함께 붙는다 — 프로모 바가 **헤더 위**에 있어야
 * 스크롤하면 같이 올라가고 헤더만 상단에 붙는다(그루폰과 같은 동작). 둘을 각각 App.tsx 에서
 * 부르면 그 순서 규칙이 App.tsx 에 흩어지고, 다음 사람이 순서를 바꿔도 아무도 모른다.
 *
 * 📱 프로모 바는 PC 전용이다 — 모바일 표면은 페이지마다 자체 고정 헤더가 있어 띠를 얹으면 겹친다.
 *    그 판단이 여기 한 곳에 있다(PromoBar 를 다른 데서 재사용할 때 규칙을 다시 안 베끼도록).
 */
export default function ConsumerTopChrome() {
  /**
   * 📱 2026-10-13: 폰에서는 프로모 바를 **마운트하지 않는다**. 종전엔 CSS 로만 숨겨서(`hidden md:block`)
   *   보이지도 않는 띠를 위해 폰의 모든 하드로드가 `/api/promo-bar` 를 한 번씩 불렀다(첫 화면 요청 실측).
   *   중단점은 종전 CSS 와 같은 768(md) — 화면이 넓어지면 그때 마운트된다.
   *
   * 📱 2026-10-13 (후속): PC 상단 네비도 같은 이유로 폰에서 마운트하지 않는다. 그 헤더는
   *   `hidden md:block` 이라 폰에선 안 보이는데 React 는 매 하드로드마다 통째로 렌더했다
   *   (재생 프로파일 — 홈 부팅 중 렌더 75ms, CPU 4배). lazy 가 아니라 **조건부 렌더**라서
   *   PC 는 첫 렌더부터 `wide=true`(matchMedia 동기 초기값)로 종전과 똑같이 그려진다 —
   *   2026-10-13 audit log 가 경고한 *"늦게 끼어들며 본문을 민다"* 는 lazy 에만 해당한다.
   */
  const wide = useMediaQuery(DESKTOP_CHROME_QUERY)
  return (
    <>
      {wide && <PromoBar />}
      {wide && <Suspense fallback={null}><DesktopTopNav /></Suspense>}
    </>
  )
}
