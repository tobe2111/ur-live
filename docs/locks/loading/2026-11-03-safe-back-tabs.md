# [UNLOCK_LOADING] 뒤로가기 정리 — 이용권 상세 ← · 하단 탭 이력 — 2026-11-03

- **바꾼 잠금 파일**: `src/pages/GroupBuyDetailPage.tsx` · `src/components/main/BottomNav.tsx`
- **대표 승인**: 결재 `docs/decisions/2026-11-03-back-navigation-locked-files.md` 질문에 ① · ③ 선택(2026-11-03, 이 세션 질문 응답).
- **배경(라이브 실측)**: 카톡 공유 링크처럼 `/pass/:id` 로 바로 들어와 ← 를 누르면 앱 밖으로 나갔다. 하단 탭을 7번 누르면 폰 뒤로를 7번 눌러야 앱을 나갔다.

## 무엇을
- `GroupBuyDetailPage`: `onBack={() => navigate(-1)}` → `useSafeBack('/')`(앱 안 칸이 없으면 홈으로 replace). 줄 수 불변(같은 줄에 선언).
- `BottomNav`: 탭 클릭 `navigate(path)` → `goTab(path)` — 규칙 SSOT `src/lib/tab-nav.ts` `decideTabNav`
  (홈 → 탭 push · 탭 → 탭 replace · 탭 → 홈은 아래가 홈이면 -1 · 같은 탭 replace · 상세 → 탭 push).

## 불변으로 지킨 잠금 항목
- GroupBuyDetailPage: `__SSR_INITIAL_DETAIL__` 즉시 사용 · CountdownRing/폴링 jitter · below-fold lazy.
- BottomNav: `linkshopPath` localStorage 캐시 우선 · `isActivePath` 의 `/profile/`·`/s/` 활성 · 탭 prefetch.

## 가드
`src/tests/unit/safe-back-2026-11-03.test.ts` ④(탭 이력 5건 — 라이브에서 잰 7번 탭 순서를 그대로 흉내). 되돌려-검증: 탭→탭을 push 로 바꾸면 2건 빨간불.

## E4 판정 · 롤백
- 판정: 새 탭에서 `https://urdeal.kr/pass/<id>` 열고 ← → `/`. 홈에서 탭 여러 번 → 폰 뒤로 한 번에 `/`.
- 롤백: 해당 커밋 revert.
