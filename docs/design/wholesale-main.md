# 도매몰 메인(/wholesale) 디자인 시안 — Sellpie 형 B2B 레이아웃

> **출처**: 사용자 제공 스크린샷 (Sellpie B2B 도매몰), 2026-06-09. **참고용** — 픽셀 카피 X, 유통스타트 브랜드(레드 `#FF0033`, `WT` 토큰)로 재해석.
> **연관**: Wave 2 (메인 배너 + 프리미엄 전용관 + 제안/신고 탭). 일부는 이미 구현됨(예치금신청).

## 시안 레이아웃 분해 (위→아래)

### 1. 최상단 유틸 바 (우측 정렬, 작은 텍스트)
`로그인 | 회원가입 | 장바구니 (0) | 마이페이지▾`
- 우리 현재: 카탈로그 헤더에 로그인/로그아웃/장바구니 있음 → 유틸바 형태로 정돈.

### 2. 헤더 (로고 + 검색 + 우측 아이콘 3개)
- 좌: 로고 (Sellpie = 우리 "유통스타트" 워드마크 + 로고)
- 중앙: **큰 검색바** (상품명·브랜드 검색, 우측 검색 버튼 오렌지/레드)
- 우: 아이콘 3개 — **처음이세요?**(가이드) · **제안/신고** · **예치금신청**
  - ✅ 예치금신청 = 이미 구현됨(`/wholesale/deposits`) → 아이콘만 헤더로
  - 🆕 제안/신고 = Wave 2 신규(`/wholesale/proposals` 또는 모달)
  - 처음이세요? = 가이드/온보딩 링크

### 3. 카테고리 네비 바 (가로 풀바)
`[≡ 전체카테고리] (레드/오렌지 강조) | 브랜드 전시관 | 월간 베스트 | 신상품 | 판매마진 40% | 프리미엄 전용관`
- ≡ 전체카테고리: 좌측 강조 박스(레드 배경) → 클릭 시 카테고리 드롭다운/메가메뉴
- 메뉴 항목:
  - **브랜드 전시관**: 브랜드별 큐레이션 (브랜드 그리드 → 필터)
  - **월간 베스트**: 판매량 정렬
  - **신상품**: 최신 등록
  - **판매마진 40%**: 마진율 높은 상품 필터 (소구 카피)
  - 🆕 **프리미엄 전용관**: 어드민이 `is_premium` 플래그한 상품/공급사 전용 탭

### 4. 메인 배너 캐러셀 (히어로) 🆕
- 풀폭 큰 배너, 좌우 화살표(‹ ›) + 하단 도트 인디케이터(10개)
- 자동 슬라이드 + 상품 프로모션 (이미지 + 카피 + CTA)
- **어드민 관리형**: 배너 CRUD(이미지/링크/순서/노출기간) → `wholesale_banners` 테이블 + `/admin/wholesale-banners`
- 비용 0: 정적 이미지(R2/cfImage) + D1 메타. 자동재생은 클라 타이머.

### 5. BEST PRODUCT 섹션 (가운데 제목)
- "BEST PRODUCT" 헤딩 + 상품 그리드 4열

### 6. 상품 카드 (그리드)
- 정사각 이미지(좌상단 "기획전" 등 뱃지) + 상품명(2줄) + **상품코드(P0000xxx)** + **가격 자리에 "회원공개"**(빨강)
- ✅ **회원공개 = 가입/승인 후 가격 노출** — 우리 이미 구현(미승인 `회원공개`/locked, 승인 후 공급가). 시안과 일치.
- 카드 이미지 cfImage 썸네일 + memo (이미 적용됨, commit 12dcb57)
- 상품코드 표시 추가 필요(현재 미표시일 수 있음)

## 현재 vs 시안 차이

| 영역 | 현재 (`WholesaleCatalogPage`) | 시안 목표 | Wave |
|---|---|---|---|
| 최상단 유틸바 | 헤더에 혼재 | 분리된 유틸바(로그인/가입/장바구니/마이) | 2 |
| 검색바 | 있음(상단) | 헤더 중앙 큰 검색바 | 2 |
| 우측 아이콘 | 일부 | 처음이세요?/제안·신고/예치금신청 3아이콘 | 2 |
| 카테고리 네비 | 칩 형태 | 가로 풀바 + 전체카테고리 메가메뉴 + 6메뉴 | 2 |
| 메인 배너 | **없음** | 캐러셀(어드민 관리) | 2 🆕 |
| BEST PRODUCT | 일부(재주문/추천) | "BEST PRODUCT" 베스트 섹션 | 2 |
| 프리미엄 전용관 | **없음** | 전용 탭 + 어드민 플래그 | 2 🆕 |
| 제안/신고 | **없음** | 헤더 아이콘 + 페이지 | 2 🆕 |
| 상품코드 표시 | 미표시(추정) | P0000xxx 코드 | 2 |
| 회원공개 가격 게이트 | ✅ 구현됨 | 동일 | — |
| 예치금신청 | ✅ 구현됨 | 헤더 아이콘으로 | — |

## 구현 todo 체크리스트 (Wave 2)
- [ ] `wholesale_banners` 테이블(image_url, link, sort, active, start_at, end_at) + ensure/repair-schema
- [ ] `GET /api/wholesale/banners`(공개, 캐시) + 어드민 CRUD `/api/admin/wholesale-banners`
- [ ] 메인 배너 캐러셀 컴포넌트(자동슬라이드 + 도트 + 화살표, cfImage)
- [ ] 어드민 배너 관리 페이지 `/admin/wholesale-banners`
- [ ] 카테고리 네비 바(전체카테고리 메가메뉴 + 브랜드전시관/월간베스트/신상품/마진/프리미엄)
- [ ] 프리미엄 전용관: `products.is_premium`(또는 supplier 플래그) + 어드민 토글 + `/wholesale?premium=1` 필터 + 네비 항목
- [ ] 제안/신고: `wholesale_proposals`(type=proposal|report, target, body, status) + 유통사 폼(`/wholesale/proposals` 또는 모달) + 어드민 처리 큐 + 알림
- [ ] 헤더 재구성: 유틸바 + 중앙 검색 + 우측 3아이콘(처음이세요?/제안·신고/예치금신청)
- [ ] 상품카드 상품코드(P-code) 표시
- [ ] BEST PRODUCT 섹션(판매량 정렬)

## 브랜드 적용 노트
- 색: Sellpie 오렌지 → 유통스타트 **레드 `#FF0033`**(WT.brand). 전체카테고리 강조 박스도 레드.
- 톤: 깔끔한 화이트 B2B(라이트 고정, `dark:` 금지). WT 토큰(`WT.ink/ink2/ink3/line/fill`).
- 반응형: 모바일 우선 + `lg:` 그리드(시안은 PC 4열).
- 성능: 배너/카드 cfImage, 캐시 헤더, 회원공개 게이트 유지.

## ✅ 구현 완료 (Wave 2 FRONTEND — 2026-06-09, v1 리뷰 대기)
프론트엔드 재구성 완료 (백엔드 엔드포인트 병행 작업, 계약 기준). commit hash 는 머지 후 추가.

- [x] 헤더 재구성 (`WholesaleCatalogPage.tsx`): 유틸바(로그인/가입/장바구니/마이·로그아웃) + 로고 + **중앙 큰 검색바**(기존 search 와이어 유지) + 우측 3아이콘(처음이세요?→`/wholesale/intro` · 제안/신고→모달 · 예치금→`/wholesale/deposits`, 로그인 시 잔액 표시 `useWholesaleDeposit`).
- [x] 카테고리 네비 바: `[≡ 전체카테고리]`(레드, 메가드롭다운=기존 `cats` 재활용) · 브랜드 전시관 · 월간 베스트(sort popular) · 신상품(newest) · 판매마진 40%(discount) · **프리미엄 전용관**(premium=1). 기존 cat/sort/필터/SSR 그대로 재스킨.
- [x] 메인 배너 캐러셀 (`WholesaleBannerCarousel.tsx`): `GET /api/wholesale/banners`, 자동슬라이드 5s(hover/visibility pause), 좌우 화살표 + 도트, cfImage, 내부링크 `safeInternalPath`/외부 `_blank`. 배너 0개 시 자동 숨김.
- [x] BEST PRODUCT 섹션 헤딩 + 기존 ProductCard(memo+cfImage) 유지. **상품코드(P0000xxx)** 라인 추가(`product.code` 우선, 없으면 `P`+7자리 id). **회원공개(locked) 가격 게이트 그대로**.
- [x] 프리미엄 전용관 뷰: premium nav 활성 시 catalog `?premium=1` + 프리미엄 헤더/뱃지.
- [x] 제안/신고: `WholesaleProposalModal.tsx`(헤더 아이콘 모달) + `WholesaleProposalsPage.tsx`(`/wholesale/proposals`). 타입 토글(제안/신고)·대상·제목·내용 → `POST /api/wholesale/proposals` + 내 내역 `GET`. 비로그인 → 로그인 유도.
- [x] 어드민: `AdminWholesaleBannersPage.tsx`(`/admin/wholesale-banners`, ImageUpload + 순서/노출/삭제) + `AdminWholesaleProposalsPage.tsx`(`/admin/wholesale-proposals`, 상태필터 + 처리/반려 + 메모).
- [x] 라우트(App.tsx `/wholesale/proposals`, admin.routes.tsx 2개) + AdminLayout 도매몰 그룹 nav 2개(도매 배너 / 도매 제안·신고) + 훅(`useWholesale.ts`: banners/premium/feedbacks/feedback mutation).
- [ ] **(follow-up)** 프리미엄 상품 토글 (`POST /api/admin/wholesale-products/:id/premium`): 기존 어드민에 도매 카탈로그 상품 리스트 화면이 없어 trivial inline host 부재 → 별도 도매 상품 관리 화면 또는 공급자 상품 화면에 토글 추가 필요. 백엔드 엔드포인트는 계약대로 가정.
