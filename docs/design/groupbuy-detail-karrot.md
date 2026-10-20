# 공동구매 상세 페이지 — 당근마켓(Karrot) 스타일 hero 재설계

- **시안 받은 날 / 출처**: 2026-06-07, 사용자 채팅 (원본 이미지는 채팅에서만 공유 — 아래 텍스트로 박제)
- **대상 파일**: `src/pages/GroupBuyDetailPage.tsx` (단일 파일)
- **상태**: ✅ 구현 완료 (working tree)

## 사용자 요구 (원문)

> "위에 바 부분을 없애진 않더라도 그 부분까지 사진이 보이도록 — 당근 페이지 디자인처럼. 대신 버튼들은 흰색. 그리고 페이지 UX/UI 이게 최선일까?"

## 당근마켓 상품 상세 레퍼런스 (원본 이미지 대체 설명)

당근마켓 중고거래 상품 상세 페이지의 hero 패턴:

1. **상품 사진이 화면 최상단까지 full-bleed** — 상태바/노치 영역 아래로 사진이 깔림. 별도의 흰 상단 바가 콘텐츠를 아래로 밀지 않음.
2. **상단 chrome 은 사진 위에 floating** — 좌상단 뒤로가기(←), 우상단 공유/더보기 아이콘. 모두 **흰색 아이콘 + 반투명 어두운 원형 스크림** 처리라 어떤 사진 위에서도 보임.
3. **사진 상단에 은은한 그라데이션 scrim** — 밝은 사진에서도 흰 아이콘이 묻히지 않게 위→아래 어둠 그라데이션.
4. **스크롤하면 상단 바가 solid 로 전환** — 사진을 지나 스크롤하면 투명 floating 헤더가 흰(다크모드 시 검정) 바로 채워지고 가운데에 상품명이 fade-in. 아이콘 색도 흰색→테마색으로 전환.
5. 사진 위 메타 배지(상태/카테고리)는 floating 헤더 버튼과 겹치지 않게 사진 하단 모서리에 배치.

## 현재(재설계 전) vs 신규(재설계 후)

| 항목 | 재설계 전 | 재설계 후 (당근 스타일) |
|---|---|---|
| 상단 바 | `sticky` 흰 solid 바, 콘텐츠를 아래로 밀어냄 | `fixed` 투명 overlay → 사진 위 floating |
| hero 이미지 위치 | `main` 내부, 흰 바 아래 (`-mx-4 -mt-4` 로 full-bleed 흉내) | content flow 첫 요소, 화면 최상단까지 닿음 |
| 뒤로가기/공유 버튼 | 흰 바 위 회색 아이콘 / 노란 카카오 원 | **흰 아이콘 + `bg-black/25 backdrop-blur` 원형 스크림** |
| 상단 scrim | 없음 | `from-black/30 to-transparent` h-24 그라데이션 |
| 노치 안전영역 | 미처리 | `paddingTop: max(0.625rem, env(safe-area-inset-top))` |
| 스크롤 동작 | 없음 (항상 흰 바) | 사진 지나면 solid 테마 바 + 제목 fade-in + 아이콘 테마색 전환 |
| 카테고리/상태 배지 | 사진 좌상단 (뒤로가기와 충돌) | 사진 **좌하단** (`bottom-3 left-3`) — 헤더와 분리 |
| CountdownRing | 사진 우상단 (공유 버튼과 충돌) | 사진 **우하단** (`bottom-3 right-3`) |
| influencer 배너 | 사진 위 (main 첫 자식) | 사진 **아래** (hero 다음) |
| 로딩 skeleton 헤더 | 흰 solid 바 (사진 전 깜빡임) | 투명 overlay + 즉시 full-bleed 사진 skeleton |

## 구현 핵심 (코드)

- **스크롤-aware 상태**: `heroRef` (hero `<div>` 높이 측정) + `headerSolid` `useState`.
  passive `scroll`/`resize` 리스너, `threshold = heroHeight - HEADER_H(56)`, unmount 시 정리.
- **헤더**: `fixed top-0 inset-x-0 z-40`, 데스크탑은 footer 와 동일 centering
  (`lg:max-w-[720px] lg:left-1/2 lg:-translate-x-1/2`), `transition-colors`.
- **버튼**: 투명 시 `bg-black/25 backdrop-blur-sm` + 흰 아이콘, solid 시 테마 hover + `text-gray-700 dark:text-gray-200`.
- **KakaoShareButton**: `compact` + `rounded-full bg-black/25 backdrop-blur-sm` → 흰 공유 아이콘 렌더.
- **scrim**: hero 내부 `absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent pointer-events-none`.

## LCP / 잠금 불변 (CLAUDE.md 준수)

- `__SSR_INITIAL_DETAIL__` consume 로직 **불변**.
- CountdownRing adaptive interval / polling jitter / below-fold lazy `Suspense`(Confetti·RestaurantMiniMap·ProductReviewsSection) **불변** — CountdownRing 은 위치만 이동.
- hero `<img>`: `loading="eager"` + `fetchPriority="high"` + width/height(1200) + `object-cover` **유지**.
- 다크/라이트 토글: over-image 요소는 scrim(양쪽 동작), solid 헤더는 흰/다크 토큰.

## UX 추가 개선 (이번 작업)

- 카테고리/상태 배지 ↔ CountdownRing ↔ 헤더 버튼 **비충돌 배치** (좌하단/우하단/상단 모서리).
- 상단 scrim 으로 밝은 사진에서도 흰 chrome 가독성 보장.
- 로딩 skeleton 도 동일 full-bleed 패턴 → 사진 로드 전 흰 바 깜빡임 제거 (CLS 0 유지).
- 가격 블록·결제 CTA·절약액 강조(`정가보다 N원 절약`)는 기존 설득 카피 그대로 유지.

## 미구현 / 추후 권고 (이번에 안 함)

- hero 이미지 **갤러리(여러 장 스와이프)** — 현재 단일 `image_url` 만. 다중 이미지 스키마 도입 시 고려.
- hero 더블탭/핀치 **확대(zoom)** — 당근에는 있음.
- 스크롤 시 헤더 배경 **opacity 보간(연속)** — 현재는 임계값 기준 binary 전환(transition 으로 부드럽게 처리하나 단계적). IntersectionObserver + rAF 보간으로 더 매끄럽게 가능.

## ✅ 구현 완료

- 파일: `src/pages/GroupBuyDetailPage.tsx`
- commit hash: (working tree — 커밋 시 갱신)
