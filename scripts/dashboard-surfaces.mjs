/**
 * 🧰 대시보드·마이 첫 화면 진입점 — **한 목록**을 세 곳이 쓴다(2026-10-14 대표 *"대시보드랑 실행비용도 최적화 해줘"*).
 *   ⓪ `vite.config.ts` — 이 화면들을 공유 모듈의 '사용자' 로 센다(`surface-chunks.mjs` extraUsers). 안 세면 지도 봉투를 통째로 받는다
 *   ① `check-surface-budgets.mjs` — 이 화면들의 첫 화면 무게(brotli)를 래칫으로 잠근다
 *   ② `check-exec-cost.mjs` — 이 화면들의 실행된 JS 를 래칫으로 잠근다
 *   여러 벌이면 갈린다(한쪽에만 화면을 더하면 그 화면이 조용히 감시 밖에 남는다).
 *
 * 🩸 버린 길(2026-10-14 실측): 이 화면들의 lucide 아이콘만 화면별 봉투로 떼어 봤다(`lucide-x-*`). 아이콘은 옮겨졌지만
 *   이 화면들이 쓰는 공용 봉투(`app-components` 등) 안의 **다른** 모듈이 남은 `lucide` 봉투를 여전히 정적으로 끌고 와서
 *   그 봉투도 같이 받았다 → 무게 +1.6KB · 실행 +0.5KB 로 **오히려 나빠졌다.** 아이콘만 떼서는 안 된다 — 대시보드의
 *   src 봉투 자체를 쓰는 화면끼리 묶어야(손님 페이지의 `surface-chunks` 규칙 ③ 확장) 효과가 난다.
 *
 * 왜 따로 있나: 손님 화면은 `generate-route-chunk-map` ROUTES 가 워커 미리받기까지 정한다. 대시보드는 그 맵에
 *   없어서(하드로드 미리받기 대상이 아니다) 그동안 **어떤 예산도 바이트를 재지 않았다.**
 *   첫 화면 = 엔트리 폐쇄 + 아래 진입점들의 정적 import 폐쇄(첫 화면에 같이 뜨는 lazy 진입점은 함께 적는다).
 */
export const DASHBOARD_SURFACES = {
  // 마이 — 손님 메뉴 + 판매 구역(SellerSection 은 좌석이 있으면 첫 화면에 같이 뜨는 lazy 진입점이다)
  my: ['src/pages/UserProfilePage.tsx', 'src/pages/user-profile/SellerSection.tsx'],
  // 어드민 — 하위 라우트 표(admin.routes) + 대시보드 홈(AdminPage)
  admin: ['src/routes/admin.routes.tsx', 'src/pages/AdminPage.tsx'],
  // 에이전시 콘솔 — 매장 판이 주인공인 첫 화면
  agency: ['src/pages/agency-console/AgencyHomePage.tsx'],
}
