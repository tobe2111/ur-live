# 유통스타트 도매몰 시안 — 구현 현황

출처: Claude Design 핸드오프 번들 (`유통스타트 도매몰.html` + `store/*.jsx`). 원본 시안/대화는 이 폴더에 보존.
디자인 언어: **TDS(Toss) 라이트** — 무채색 베이스(`#17181C`→그레이) + `#FF0033` 1포인트, 큰 라운드, 넉넉한 여백, 단가 tabular 정렬. 도매몰은 **라이트 고정 B2B 서피스**(대시보드 계열, dark: variant 없음 — 테마 체커 제외 등록).

토큰/헬퍼 SSOT: `src/pages/wholesale/wholesale-theme.ts` (`WT`, `won`/`comma`/`discountRate`/`unitMargin`/`marginRate`, `GRADE_LABEL`, `WHOLESALE_CATEGORIES`).

## ✅ 구현 완료 (2026-06-04)

### 홈/카탈로그 — `src/pages/WholesaleCatalogPage.tsx` (전면 재작성)
- **브랜드 히어로**: "검증된 제조사 상품을 [내 등급 공급가]로 사입하세요" + 가치 3종(다크 스테이트먼트).
- **사입 대시보드**: 등급 칩 + "등급 기준 공급가" + 메트릭 3종(이번달 사입액=거래내역 summary / 누적 주문 / 내 등급 마진) + 등급 시트 진입.
- **등급 안내 시트**: 특별가/A/B/C 4단계 (PDF 구조) + 상향 문의 안내.
- **섹션 레일**: 회원님 전용 공급(관리자 제안=`/home` proposals, '전용' 배지) / 베스트셀러 / 신규 입고.
- **전체 상품 그리드**: 정제된 카드(이미지 + 코너 +버튼 + 가격 앵커 + 할인% + 마진 +α). 정렬(인기/낮은공급가/높은마진) + 데스크톱 사이드바(카테고리 카운트) + 모바일 칩.
- **단가표 엑셀 다운로드** (`/api/wholesale/catalog-export`).
- OEM/ODM CTA, 특별가 적용 배너.

### 상품 상세 — `src/pages/WholesaleProductPage.tsx` (전면 재작성)
- 갤러리 + 등급가 칩 + 큰 공급가 앵커 + 할인% + 권장가 line-through.
- **마진 여력 밴드**(개당 마진 +₩/%), 정보 리스트(재고/누적사입/공급사 비공개), 섹션 탭(상세/배송/정산/반품).
- 데스크톱 인라인 CTA + 모바일 하단 고정 CTA(스텝퍼+합계+바로주문). 기존 주문 생성 API(`/api/wholesale/orders`) 유지.

### API 보강 (비잠금 `wholesale.routes.ts`)
- `/home` `/catalog` `/catalog/:id` 응답에 **`retail_price`(권장소비자가=products.price) + `sold_count`** 추가 → 카드/상세의 할인%·마진 산출. ⚠️ 원가(`supply_price`)·제조사 신원은 계속 비노출.

### 2차 증분 (2026-06-04, 우리 구조에 맞게)
- **다품목 장바구니**: `useWholesaleCart`(localStorage+useSyncExternalStore) + `WholesaleCartPage`(/wholesale/cart) + 카탈로그 코너 퀵담기 + 상세 "담기" + 헤더 뱃지. 주문 API `items[]` 그대로 활용(서버 등급가 재계산=SSOT, 카트가는 표시용 스냅샷).
- **빠른 재주문**: `GET /api/wholesale/recent-items`(본인 주문 상품별 최신+마지막수량+현재 등급가, 구매가능/가시성 통과만) + 홈 레일(같은 수량 재주문→카트).
- **badge 파생**: 재고<200 '마감임박'(카드). NEW/전용은 섹션으로 표현.
- **주문내역·거래내역서 TDS 정비**: WT 토큰 라이트 재정비(상태칩/송장복사/요약/표). OEM 페이지는 기존 라이트 유지(정상).

### 3차 증분 (2026-06-04) — MOQ(최소 주문 수량 / 박스 단위)
- `products.min_order_qty`(lazy ensure, 기본 1) + 공급자 등록폼 MOQ 입력 + `/products` INSERT + 공급자 목록 반환.
- API 4종(/home·/catalog·/catalog/:id·/recent-items)에 `moq` 반환.
- 카드 "최소 N개 · 박스 ₩" · 상세 수량 기본/스텝=MOQ·박스 단가 · 카트 담기 qty=MOQ·스텝퍼 MOQ 단위.
- **서버 검증**: `/orders` 에서 `qty < moq` 차단(클라 UI + 서버 이중 방어). verify:sql 9/9.

### 4차 증분 (2026-06-04) — 유통사 자료(거래명세서/세금계산서) 뷰
- `GET /api/wholesale/documents`(본인 sales 방향만) + `GET /documents/:id/html`(IDOR 가드 — distributor_seller_id 일치 + sales). 기존 `tax_documents`+`renderTaxDocHtml` 재사용.
- `WholesaleDocsPage`(/wholesale/documents): 거래명세서/세금계산서 탭 + 공급가/부가세/합계 + 상태칩 + 인쇄/PDF(인증 fetch→새창). 헤더 "자료" 링크.
- 공급사 정보 비노출 유지. verify:sql 10/10(스코프/IDOR 케이스 포함).

## 🟡 시안엔 있으나 미구현 (실데이터/모델 갭 — 추가 구현 후보)
| 시안 요소 | 갭 사유 |
|---|---|
| **수량 구간별 단가표**(많이 살수록↓) | 실제 모델은 등급 단일가. 구간 단가는 가격모델 확장 필요(대형). |
| 박스/개당 단가 병기 · MOQ | products에 MOQ 컬럼 없음. 추가 시 스키마 컬럼 필요. |
| 마감 임박 카운트다운 / badge(특가/NEW/BEST) | API가 badge 미반환. |
| 장바구니(다품목 담기) | 현재 흐름은 상세→단일주문→체크아웃. 카트 상태/엔드포인트 신설 필요. |
| 주문내역·정산·자료·마이·카테고리 화면 TDS 재정비 | 기존 페이지 존재(기능 OK) — 비주얼만 후속 정비. |

## 다음 증분 제안
1. 주문내역/거래내역(정산)/OEM 페이지를 같은 TDS 토큰으로 비주얼 정비(기능 그대로).
2. 장바구니(다품목) 도입 — 카트 상태 + 다품목 주문 생성.
3. (대형) 수량 구간별 단가 — 등급 단일가 → 구간 단가 모델 확장.
