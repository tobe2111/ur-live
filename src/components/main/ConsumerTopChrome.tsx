import PromoBar from './PromoBar'
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
  return (
    <>
      <div className="hidden md:block"><PromoBar /></div>
      <DesktopTopNav />
    </>
  )
}
