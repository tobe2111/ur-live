import { useNavigate } from 'react-router-dom'
import { readMallOrigin } from '@/shared/mall/origin'

/**
 * 🏪 **"계속 쇼핑하기"가 어디로 가야 하는가** — 2026-08-12 (대표 *"완전 별개, 분리"*)
 *
 * 몰 손님의 동선은 `카톡 → urdeal.kr/{슬러그} → 상품 → 장바구니` 다. 그런데 장바구니부터는
 * **유어딜 화면**이라, 여기서 "쇼핑 계속하기"를 누르면 **유어딜 홈**으로 간다 —
 * 운영자가 데려온 손님을 본진 매대에 내려놓는 셈이다.
 *
 * ⇒ 흔적이 있으면 **그 가게로** 돌려보낸다. 흔적이 없으면 종전대로(`onFallback`).
 *   이건 `shared/mall/origin.ts` 가 명시한 **원래 용도**(되돌아갈 곳)라 판정 규칙과 충돌하지 않는다.
 *
 * ⚠️ 흔적은 세션 스토리지라 새 탭·오래된 세션에서는 없다. 그때는 폴백이 도는 것이 맞다 —
 *   **없는 정보를 지어내서 엉뚱한 가게로 보내지 않는다.**
 */
export default function ContinueShoppingLink({
  onFallback,
  className = 'text-[13px] text-gray-500 dark:text-gray-400 underline',
  label = '쇼핑 계속하기',
}: {
  onFallback: () => void
  className?: string
  /** 흔적이 없을 때(본진 손님)의 문구. 몰 손님 문구는 고정이다 — 가게로 보내는 말은 하나면 된다. */
  label?: string
}) {
  const navigate = useNavigate()
  const slug = readMallOrigin()
  return (
    <button type="button" onClick={() => (slug ? navigate(`/${slug}`) : onFallback())} className={className}>
      {slug ? '가게로 돌아가기' : label}
    </button>
  )
}
