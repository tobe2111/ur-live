# 2026-11-02 [UNLOCK_LOADING] 하단 탭 누름 반응 · 목록→상세 사진 이어짐

- 바꾼 잠금 파일: `src/components/main/BottomNav.tsx` · `src/pages/main-home/GroupBuyFeedCard.tsx`
  (+ 잠금 밖: `src/pages/group-buy/DetailGallery.tsx` · `src/lib/deal-view-transition.ts` · `src/index.css`)
- 대표 승인(AskUserQuestion, 그대로): **"셋 다 넣기"** — 질문: 하단 탭·마감 카운트다운·목록→상세 전환을
  잠금을 풀고 넣을지. 시안: `docs/design/motion-mockups-2026-11.md` (작은 움직임 D 묶음).

## 무엇을 왜
- **BottomNav**: 누른 탭 아이콘이 0.32초 눌렸다 튄다(`.ur-press`). 누를 때만 — 페이지를 새로 열 때
  활성 탭이 저절로 튀지 않게 클릭 카운터로 고른다. 아이콘을 `block` span 으로 한 겹 감쌌다.
- **GroupBuyFeedCard → 상세**: View Transitions API 로 카드 사진이 상세 첫 사진(모바일 갤러리 첫 장,
  `data-vt-hero`)으로 커진다. BrowserRouter 라 `<Link viewTransition>` 이 안 되므로 onClick 에서
  `document.startViewTransition` + `flushSync(navigate)` 후 상세 첫 장을 **최대 300ms** 기다린다.
- **마감 카운트다운(D2)은 넣지 않았다** — 상세의 CountdownRing 은 2026-06-16 리디자인에서 이미 제거됐고
  (`GroupBuyDetailPage.tsx:140`), 남은 카운트다운(TimedealCard·FlashDealsHero)은 참조 0 인 `MainHomePage`
  에서만 쓰인다. 새로 붙이는 것은 상품 결정이라 시안만 남긴다.

## 불변으로 지킨 잠금 항목
- BottomNav: `linkshopPath` localStorage 우선 순서 · `isActivePath` 의 `/profile/`·`/s/` · intent prefetch(`warm`).
- GroupBuyFeedCard: hover/touch/focus prefetch 세 줄 · IntersectionObserver viewport prefetch · `rootMargin` ·
  image fade-in · aboveFold eager · `React.memo`. 링크 `to` 값은 같은 식(`href` 로 이름만 붙임).
- 지원 안 하는 브라우저 · ⌘/Ctrl/Shift/Alt/가운데 클릭 · '동작 줄이기' · 이미 막힌 클릭(찜 하트)은
  **종전 링크 동작 그대로**(`canRunDealTransition`).

## 가드
- `src/tests/unit/motion-kit-2026-11-02.test.ts` — 위 불변 + 기다림 상한 + 탭 누름이 클릭에서만.

## E4 판정 · 롤백
- E4: 배포 후 폰(크롬·사파리 18+)에서 홈 카드 → 상세가 사진이 커지며 넘어가는지, 클릭~상세 첫 사진
  시간이 종전보다 늘지 않았는지(`node scripts/probe-loading.mjs /group-buy/<id>`). 탭은 눌러서 확인.
- 롤백: 두 파일의 해당 블록 revert(데이터·캐시 영향 없음).
