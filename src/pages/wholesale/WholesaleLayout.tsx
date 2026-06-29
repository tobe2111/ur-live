import { Outlet } from 'react-router-dom'
import WholesaleUtilBar from './WholesaleUtilBar'
import WholesaleShopBar from './WholesaleShopBar'

/**
 * 🏭 2026-06-27 (대표 — 모든 도매 페이지 공통 상단바): 도매몰 app 페이지 공통 레이아웃.
 *   상단에 <WholesaleUtilBar/>(회원·예치금 실시간·충전·대시보드·로그아웃) 를 항상 렌더하고
 *   페이지 본문을 <Outlet/> 으로 표시한다. 카탈로그는 자체 풀헤더에 동일 바가 이미 있어 제외,
 *   로그인/가입/인트로/랜딩 같은 인증·랜딩 페이지도 제외(자체 풀페이지 디자인).
 * 🏭 2026-06-29 (대표 — "각 페이지마다는 있어야"): 유틸바 아래에 <WholesaleShopBar/>(로고 + 검색 +
 *   견적함/관심상품/장바구니)를 추가 → 카탈로그를 벗어난 서브페이지(상품상세·장바구니·견적함·관심상품·
 *   주문 등)에서도 검색/쇼핑 내비가 상시 노출. 카탈로그 계열은 여전히 자체 CatalogHeader 사용(중복 X).
 */
export default function WholesaleLayout() {
  return (
    <>
      <WholesaleUtilBar />
      <WholesaleShopBar />
      <Outlet />
    </>
  )
}
