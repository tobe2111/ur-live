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

/**
 * SELLER_PROMO_FIELD_ENABLED — 셀러 딜 등록 화면의 '소개비(promo)%' 입력 + 마진 계산기 노출
 *   (2026-07-05 인플루언서 이용권 공구 엔진 스프린트 §1).
 *   배경: 매장이 딜마다 "추천(핀) 판매 시 인플루언서에게 줄 소개비 N%"를 직접 설정하는 레버.
 *         resolveOrderFees(owner-funded promo 슬라이스)로 실수령 실시간 표시.
 *   ⚠️ **커플링(중요)**: 이 필드가 저장하는 products.referral_commission_rate 는 *라이브 어필리에이트
 *     적립*을 override 한다. 그런데 어필리에이트 재원이 아직 **플랫폼 부담**(promo_funding_source='platform',
 *     기본)이면 매장이 건 소개비를 **유어딜이 대신 문다**(재원 구조 설계의 −14% 누수). 따라서 이 필드는
 *     **owner-funding(promo_funding_source='owner') + 예산캡(commission_budget_enabled)이 스테이징에서
 *     검증돼 라이브로 켜진 뒤에만** 활성해야 안전하다. 그 전까지 기본 false(=미노출) + 서버도
 *     `platform_settings.seller_promo_field_enabled==='true'` 일 때만 referral_commission_rate 저장(이중 안전).
 *   활성 절차: docs/design/commission-funding-restructure.md 의 "§1 authoritative 활성 런북" 참조.
 */
export const SELLER_PROMO_FIELD_ENABLED = false

/**
 * GB_ENGINE_ENABLED — 공구 상태 엔진(상태형·양방향) 표면 노출 (2026-07-06 공구 엔진 완결 스펙).
 *   배경: 이용권은 상품이 아니라 "이용권에 얹는 상태"(gb_mode off|scheduled|live|ended). 매장이 공구를
 *         열면 기간·특가·promo 가 얹히고 끝나면 상시로 복귀. 양방향(매장→인플루언서 / 인플루언서 제안→매장).
 *   ⚠️ **커플링**: 공구 promo 재원은 owner-funding(promo_funding_source='owner') + 예산캡이 스테이징
 *     검증돼 켜진 뒤에만 안전(그 전엔 매장 소개비를 플랫폼이 부담 = 누수). 활성 순서 = SELLER_PROMO_FIELD
 *     와 동일 런북의 4단계(commission-funding-restructure.md §1 런북 + 공구 §5). 기본 false = 표면 미노출.
 *     서버도 `platform_settings.gb_engine_enabled==='true'` 게이트(이중 안전).
 */
export const GB_ENGINE_ENABLED = false

/**
 * TOPUP_DISABLED — '딜 충전'(현금→딜 유상 충전) **서비스 전체 종료** (2026-07-18 대표 확정
 *   "딜 포인트 충전 자체를 빼자 우리 서비스에서" — 앱 전환 시 Apple IAP 30% 이슈 원천 제거).
 *   딜 = **적립 전용 리워드 통화**로 전환: 친구초대·추천(핀)·커미션 등 무상 적립과 딜 *사용*
 *   (교환권 딜결제·혼합결제 차감)·환불 복원은 전부 불변 — 유상 충전 *진입*만 닫는다.
 *   true: 충전 진입점 전부 숨김/안내 전환(/points/charge 라우트 게이트 + 홈 딜모으는법 · 마이 ·
 *         교환권 잔액카드 · 딜내역 · 잔액부족 CTA) + 서버 /api/points/charge/init 403.
 *   보존: 충전 코드·라우트·성공/확인 페이지(/points/charge/success — 배포 시점 진행중 결제 완결용)·
 *         어드민 충전 모니터링(과거 데이터). false 로 바꾸면 즉시 복원(가역).
 */
export const TOPUP_DISABLED = true

/**
 * IOS_HIDE_DIGITAL_TOPUP — iOS 네이티브 앱에서 '딜 충전'(순수 디지털 포인트)을 숨기고
 *   외부 브라우저로 유도 (Apple 인앱결제(IAP) 정책 대비). 2026-06-27 메커니즘 신설.
 *   배경: 애플은 앱 내 디지털 재화에 자사 IAP(30%) 강제 가능. 단, 유어딜 딜은 공구/숙소/교환권
 *         (대부분 실세계 상품·서비스) 결제용이라 외부결제 허용 여지도 있어 **거절 여부 미확정**.
 *   ⚠️ 기본 false (현행 유지) — 미리 켜면 매출/UX 손실. **애플 심사에서 IAP 사유로 거절되면 true 로**
 *     전환(딜충전 진입 `/points/charge` 만 게이트, `/pay/widget` 범용결제·실물·숙소는 영향 0).
 *   true: iOS 네이티브에서 `/points/charge` 진입 시 외부 브라우저(웹)로 충전 유도.
 */
export const IOS_HIDE_DIGITAL_TOPUP = false

/**
 * MATCHING_ENABLED — 인플루언서↔업체 성과기반 매칭 **어드민 전용 내부 도구** 노출 (2026-07-14).
 *   배경: 팔로워가 아니라 **실제 전환**(유입→방문→재방문, inflow_clicks·voucher_visits)으로 매칭.
 *         유어애즈 인플루언서 발굴 패널 옆 `sec-matching` 섹션 — 직영 에이전시(운영자)가 매칭 판단.
 *         매장·인플루언서 공개 뷰는 데이터·법무 충분해지면(나중).
 *   ✅ 2026-07-18 true 전환(대표 "자동으로 켜둬") — **실질 게이트는 어드민 잠금**: 이 플래그가 true 여도
 *      **어드민 로그인(admin_token) + 서버 `requireAdmin`(비어드민 403)** 이라 소비자/광고주 노출 0.
 *      읽기 전용·머니 무접촉이라 상시 ON 이 안전 — 데이터 없으면 목업 미리보기, 쌓이면 실측 자동 전환.
 *      false 로 내리면 어드민에게도 즉시 숨김(가역).
 *      정산(머니)은 별도 스위치(env MATCHING_SETTLEMENT_ENABLED, 기본 OFF 유지) — 이 플래그와 독립.
 */
export const MATCHING_ENABLED = true

