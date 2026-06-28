import { Outlet } from 'react-router-dom'
import WholesaleUtilBar from './WholesaleUtilBar'

/**
 * 🏭 2026-06-27 (대표 — 모든 도매 페이지 공통 상단바): 도매몰 app 페이지 공통 레이아웃.
 *   상단에 <WholesaleUtilBar/>(회원·예치금 실시간·충전·대시보드·로그아웃) 를 항상 렌더하고
 *   페이지 본문을 <Outlet/> 으로 표시한다. 카탈로그는 자체 풀헤더에 동일 바가 이미 있어 제외,
 *   로그인/가입/인트로/랜딩 같은 인증·랜딩 페이지도 제외(자체 풀페이지 디자인).
 */
export default function WholesaleLayout() {
  return (
    <>
      <WholesaleUtilBar />
      <Outlet />
    </>
  )
}
