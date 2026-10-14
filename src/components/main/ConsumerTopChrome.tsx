import PromoBar from './PromoBar'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import DesktopTopNav from './DesktopTopNav'

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
  const wide = useMediaQuery('(min-width: 768px)')
  return (
    <>
      {wide && <PromoBar />}
      {wide && <DesktopTopNav />}
    </>
  )
}
