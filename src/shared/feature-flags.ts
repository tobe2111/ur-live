/**
 * 🏭 플랫폼 기능 플래그 (SSOT).
 *
 * LIVE_COMMERCE_SUSPENDED — 라이브커머스 **영구 중단** (2026-06-04 잠정 → 2026-06-17 사용자 확정 "안하기로 했어").
 *   true (고정): 셀러 대시보드에서 라이브 방송/송출/쇼츠/라이브분석/캐스팅/후원 등 라이브 메뉴·모드를
 *         전부 숨기고 공구·매장·소싱 경험으로 통일. 코드는 보존(전면 삭제 안 함 — 고위험·이득 0)이되
 *         **재활성 금지** (사용자 영구 결정 — false 로 되돌리려면 사용자 명시 허가 필요).
 *   ⚠️ 새 기능 설계 시 라이브를 "켜질 수 있는 능력 레이어"로 가정 금지 — 능력 모델은 큐레이터→매장(판매)까지.
 */
export const LIVE_COMMERCE_SUSPENDED = true

/**
 * SHOPPING_TAB_HIDDEN — 쇼핑 탭 잠정 숨김 (2026-06-10 사용자 결정, 동네딜 집중 전략).
 *   true: 하단바/PC 탭에서 쇼핑(/browse) 진입을 숨기고 그 자리에 ➕(공구 제안/만들기).
 *         라우트(/browse·/cart·/my-orders)와 모든 쇼핑 코드는 보존 — false 로 바꾸면 즉시 복원.
 */
export const SHOPPING_TAB_HIDDEN = true

/**
 * REFERRAL_GROUP_DISCOUNT_DISABLED — 친구초대 '동적 가격 할인'(referral_groups 티어) 종료
 *   (2026-06-17 사용자 결정 — 즉시판매 단일가로 통일).
 *   true: "친구 모을수록 더 싸진다"는 동적 티어 할인을 비활성 — 서버 재계산 0%(결제가 불변),
 *         상품상세 생성 UI(ReferralSection) 숨김, 그룹 페이지(/referral/:code)의 할인 문구 숨김.
 *         친구초대 '보너스 딜 적립'(affiliate_ref 기반)은 영향 없음. referral_groups 코드/데이터는
 *         보존 — false 로 바꾸면 즉시 복원.
 */
export const REFERRAL_GROUP_DISCOUNT_DISABLED = true

/**
 * HOSTING_HIDDEN — '공구 호스팅' 카탈로그(/host, /host/new) 진입 숨김 (2026-06-17 사용자 결정).
 *   배경: 링크샵 콘텐츠의 핵심은 '추천 핀'(addPin — 상품 상세/검색에서 1탭 핀). /host/new("공구 열기"
 *         어드민 큐레이션 이용권 호스팅)는 별개 시스템이고, 링크샵 버튼 폴백으로 떠서 혼란 + 동네공구
 *         (community-group-buy)와 중복.
 *   true: 큐레이터 콘솔의 '공구 호스팅' 카드 + 셀러 대시보드 '호스팅' nav + UMeRedirect 폴백을 숨김/우회.
 *         라우트(/host·/host/new)와 hosting API/코드는 보존 — false 로 바꾸면 즉시 복원. 직접 URL 진입은 가능.
 */
export const HOSTING_HIDDEN = true

/**
 * COMMUNITY_PROPOSAL_HIDDEN — '동네 공구 제안'(community-group-buy) 진입 숨김 (2026-06-18 사용자 결정).
 *   배경: 제안 기능은 (1) 확정 후 실제 결제·바우처 발급으로 가는 다리가 끊김(보증금 정책 미정),
 *         (2) 보증금 = 고객에게 진 부채, (3) 거의 미사용 + 유저 0 단계. 수요 발굴은 카카오/네이버
 *         공개데이터 + 에이전시 영입(어드민 동별 밀도 보드)이 더 싸고 확실 → 잠정 셸브.
 *   true: 소비자 진입(하단바 ➕ · PC 사이드바 '공구 제안' · 홈 동네딜 섹션 · 동네딜 '동네 공구' 탭/배너 ·
 *         마이 RoleCta)을 숨김. 라우트(/community-group-buy/*) · API · DB · 에이전시 뷰는 보존 — false 로 즉시 복원.
 */
export const COMMUNITY_PROPOSAL_HIDDEN = true

