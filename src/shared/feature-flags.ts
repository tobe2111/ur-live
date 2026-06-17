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

