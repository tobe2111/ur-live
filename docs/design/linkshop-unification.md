# 링크샵 통일 (Linkshop Unification) — 설계 북극성

> 🔒 **2026-06-17 사용자 확정 (반복 변경 금지)**: "링크샵 상품/동네딜 카드는 홈·동네딜·쇼핑에서
> **원래 쓰던 표준 그라데이션 카드(`src/pages/browse/BrowseProductCard.tsx`)를 그대로** 써라.
> 커스텀 카드 그만 만들고(=`EditorialProductCard` 같은 별도 디자인 X) 영구 고정하라."
> → CuratorPage 핀 그리드는 `BrowseProductCard` 재사용(클릭만 핀 redirect `to` override 로 추천적립 유지).
> 카드 디자인을 바꾸려면 `BrowseProductCard` 자체를 고쳐 쇼핑/링크샵이 **함께** 바뀌게 할 것. 링크샵 전용
> 카드 컴포넌트 신설 금지. (아래 step 2 의 EditorialProductCard 노선은 이 결정으로 **CuratorPage 에선 폐기**;
> SellerPublicPage 는 잠금이라 추후 동일 카드로 수렴 예정.)


> 2026-06-16 사용자 결정: "링크샵이라는 이름으로 통일하자. 일반·사업자로 나뉘더라도."
> 이 문서는 **다음 세션/에이전트도 같은 북극성을 보도록** 박제한 SSOT.

## 문제 (현재 — 이중 구조)
"링크샵"이 **계정 타입으로 페이지가 갈린다**:
- 일반 유저 → `CuratorPage` (`/u/{handle}`) — 남의 상품을 **핀**해서 추천
- 셀러 → `SellerPublicPage` (`/profile/{username}`) — **자기 상품** + 라이브 + 교환권 + 사업자정보

→ 디자인을 **두 번씩** 따로 해야 함 → 어긋남 + 이중 유지보수.

## 북극성 (가장 이상적 — 단일·적응형)
**한 사람의 링크샵 = 하나의 페이지가, 그 사람이 가진 것(capability)에 따라 섹션이 켜진다.**

| 차원 | 지금 (이중) | 이상 (단일·적응형) |
|---|---|---|
| 페이지 | 2개 컴포넌트 | **LinkshopPage 1개** (프로필·추천핀=공통 + 내상품·라이브·사업자=가진 사람만) |
| URL | `/u/{handle}` vs `/profile/{username}` | **하나로 통일** (`/u/{handle}`), 옛 주소 301 |
| 아이템 | 핀(추천) vs 내상품 따로 | **한 피드** — "파는 것 + 추천하는 것" 한 줄 큐레이션 |
| 수익 | 판매수익 / 추천적립 별개 | **한 화면** — 둘 다 "내 링크샵 수익" |
| 이름 | 셀러페이지/프로필 혼재 | 전부 **"링크샵"** |

→ 일반/사업자는 "타입 분기"가 아니라 **"가진 섹션의 차이"**로만 남는다.

## 단계 (빅뱅 금지 — 각 단계 독립 배포·저위험)
1. **[완료]** 이름 "링크샵" 통일 — CuratorHeader 공유 카피 + 셀러 SEO/공유 텍스트 `{이름} 의 링크샵` (commit `99fa0f3`)
2. **[진행중]** 공유 부품 추출 — `src/components/linkshop/EditorialProductCard.tsx` (카드) → CuratorPage PinCard / SellerPublicPage 상품 / HomeTab 이 같은 부품 사용. 순수 렌더라 셀러 결제/라이브 무손상. 이후 SNS/검색도.
3. URL 통일 — 셀러도 handle 부여, `/profile/`→`/u/` **301** (SEO 주의: canonical + sitemap + 기존 외부링크).
4. 아이템 피드 통합 — 셀러 링크샵에 추천핀+내상품 한 피드 (`CuratorPinsSection` 일부 존재).
5. 페이지 1개로 병합 — 위 단계 후 "셀러 쉘 삭제 + 섹션 합치기"라 위험 작음.

## ⚠️ SEO (사용자 명시 — "SEO는 마지막에 신경써서 다 완료")
**3단계(URL 통일)와 함께 마지막에 일괄 처리**:
- `/profile/{username}` → `/u/{handle}` **301 리다이렉트** (worker `src/worker/index.ts`).
- 두 URL 공존 기간엔 **canonical = 통일 URL** 명시 (중복 콘텐츠 회피).
- `sitemap` 갱신 (링크샵 URL 통일).
- OG/JSON-LD title 전부 "링크샵" 정합 (`/api/og/curator` ↔ 셀러 OG).
- SSR slot (`__SSR_INITIAL_SELLER__`) 키/HOT_PATHS 정합 (loading lock 준수 — 제거 X, 추가만).
- 기존 외부 인입 링크(`/profile/`) 깨지지 않게 301 영구 유지.

## 불변 (회귀 금지)
- 편집 차단: 모든 편집 API `/me/*` + 본인 토큰 — 방문자 수정 불가 (백엔드 방어선).
- 적립 루프: 핀클릭→`?ref/aff=주인ID` 302→상세 저장→주문 추천의도→결제확정 `creditAffiliateFromIntent`.
- 이미지 perf 속성(cfImage/cfSrcSet/sizes/loading/dominant_color) — loading lock, 약화 X.
- SellerPublicPage `__SSR_INITIAL_SELLER__` 즉시 사용 — loading lock.
