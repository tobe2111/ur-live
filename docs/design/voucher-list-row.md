# 교환권 `/vouchers` 1줄 리스트 배치 (2026-06-20)

## 사용자 요청
- URL: `https://live.ur-team.com/vouchers?category=커피/음료`
- 레퍼런스: 매장주문 메뉴식 1줄 리스트(이미지 왼쪽 + 이름/가격 오른쪽 + 행 사이 구분선)
- 사용자 명확화: **"이렇게 1줄로 되게끔. 그냥 내가 1줄짜리를 보여주는거지 내용은 다르면 안돼"**
  → 레퍼런스는 **행 포맷만** 참고. 내용(상품명/브랜드/딜 가격/할인/평점)은 기존 교환권 데이터 그대로.

## 결정 (AskUserQuestion)
| 질문 | 선택 |
|---|---|
| 적용 범위 | **/vouchers 전체 페이지만** (홈 `/` 임베디드 피드는 그리드 유지) |
| PC/태블릿 열 수 | ~~2열 리스트~~ → **1열로 정정** (2026-06-20 사용자 "PC 도 1줄에 1개, 모바일처럼") |

### 2026-06-20 정정 — PC 도 1열
처음 "2열 리스트"로 구현했으나, 데스크탑에서 `/vouchers` 가 좁은 중앙 컬럼에 렌더되는데
Tailwind `lg:` 가 **컨테이너가 아닌 뷰포트 폭**(~1900px)으로 트리거 → `lg:grid-cols-2` 가
좁은 컬럼에 2열을 욱여넣어 답답. 사용자 요청대로 `grid grid-cols-1`(항상 1열)로 변경.

## 레퍼런스 (매장주문 — 우지커피)
```
[ img ]  디카페인 HOT 아메리카노
         Decaffein HOT Americano   ← (참고용, 우리는 브랜드명 줄)
         2,800원                    ← (우리는 N딜)
──────────────────────────────────
[ img ]  디카페인 ICE 아메리카노
         ...
```

## 구현 (commit 참조)
- `src/pages/VouchersPage.tsx`
  - 신규 `VoucherRow` memo 컴포넌트 — 좌측 정사각 이미지(`w-[88px] h-[88px] sm:w-24`, rounded-2xl, 그라데이션 placeholder) + 우측 브랜드/상품명/딜 가격/할인 취소선/평점·구매수.
  - 비-embedded 렌더: `grid grid-cols-1 lg:grid-cols-2` 리스트 + 행별 `border-b` 구분선.
  - 로딩 스켈레톤도 embedded(그리드) / 비-embedded(리스트) 분기.
  - 기존 `VoucherCard`(그리드 카드)는 홈 embedded 전용으로 유지.

### 잠금 항목 보존 (로딩 최적화 락)
- 이미지 속성: `width/height` + `cfImage`/`cfSrcSet` + `loading`(aboveFold eager) + `fetchPriority` + `decoding`
- `dominant_color` placeholder + `onLoad` 색추출 + `reportDominantColor` 백필
- `React.memo` 래퍼 (VoucherCard 유지 + VoucherRow 신규 — 약화/제거 0)
- `__SSR_INITIAL_VOUCHERS__` 즉시 소비 + default sort `price_low` 불변

## ✅ 구현 완료
- 검증: tsc 0 · build 0 · check-theme-consistency 0 (라이트/다크 토큰 정합)
- commit: (아래 push 해시)

## 2026-06-20 추가 — 상품이 너무 아래로 밀림 / 시작 지점 구별 안 됨
사용자 신고: "교환권이 계속 아래로 떠서 상품이 언제 뜨는지 구별이 없어."
원인: `/vouchers` 상단에 잔액카드 → 카테고리탭 → 인기브랜드 **12개 로고 그리드(3~4행)**
가 쌓여 상품이 fold 한참 아래로 밀리고, 상품 시작 경계가 없었음.

수정 (VouchersPage):
1. **인기 브랜드 그리드 → 1행 가로 스크롤** (홈 embedded 와 동일). 약 2~3행 높이 절약.
2. **상품 섹션 헤더 신설** (`!embedded`): 구분선(border-t) + "{카테고리/브랜드} 교환권 {개수}"
   + 정렬(SortMenu) 을 상품 리스트 바로 위로 → "여기서부터 상품" 명확.
3. 기존 정렬/브랜드칩은 홈(embedded) 전용으로 게이트 → **홈 동작 byte-identical**, /vouchers 만 개선.
검증: tsc 0 · build 0 · theme 0.

## 2026-06-20 추가 — 교환권/쇼핑 상단 탭 분리 (사용자 결정)
사용자: "교환권 무한스크롤이 쇼핑 상품을 묻는다. 상단 탭으로 분리하되 교환권부터 보여줘."
결정(AskUserQuestion): **상단 탭 분리, 교환권을 기본(첫) 탭.**

수정 (VouchersPage, 비embedded /vouchers 전용):
1. 헤더에 [교환권][쇼핑] 탭(기본 교환권). URL `?tab=shopping` 동기화.
2. 교환권 탭 = 기존 본문(잔액/카테고리/브랜드/1열 리스트) → `showVouchers` 게이트.
3. 쇼핑 탭 = 신규 `ShoppingGrid` — `/api/products?exclude_deal_only=1&sort=popular` 2열 그리드,
   `BrowseProductCard` 재사용(/browse 동일 데이터·카드), 자체 무한스크롤. **활성 시만 마운트**(불필요 fetch 0).
4. 두 탭은 독립 컴포넌트/스크롤 → 서로 안 묻힘. 홈(embedded)은 탭 없음 → 동작 불변.
검증: tsc 0 · build 0 · theme 0.
