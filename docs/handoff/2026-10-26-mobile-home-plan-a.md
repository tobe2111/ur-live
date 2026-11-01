# 2026-10-26 모바일 메인 안 A(그루폰식) 구현

대표: *"메인페이지 UI 구조가 너무 심심해"* → 그루폰 참고 → 시안 6종(`docs/design/main-home-redesign-2026-10.md`)
→ ***"안 a로 하되 맨 밑 이용권 2줄로"*** · PC 는 *"모바일 먼저, PC는 다음"*.

## 최종 결정 (같은 날)
대표 *"안 a에서 배너 윗부분은 기존대로"* → 윗부분 시안 T0~T8(캔버스) → T6 고름 → ***"윗부분은 다시 돌려줘"***.
⇒ **배너 위(머리 · 위치 · 글자 탭 · 유어쇼츠 링크)는 원래 코드와 byte-동일**(`git diff ab17d07^ -- src/pages/mobile-home/MobileHomePage.tsx` 비어 있음).
큰 검색창 · 카테고리 원 · 채색 아이콘 3종 · 남색 머리띠는 전부 걷었다.

## 바뀐 것 (모바일 `/` 만 — PC 홈 무접촉)
- 편성 섹션(지금 인기 이용권 등) = **옆으로 넘기는 줄**(카드 폭 68%, 상품명 두 줄 자리 고정). 유어쇼츠 레일은 첫 섹션 다음(09-07 규칙 그대로).
- 맨 아래 피드는 종전 2열 그대로. 배너는 **어드민 배너 그대로**(`HomeBannerStrip`).
- 클래스 SSOT `src/shared/home-chrome.ts`(`HOME_SECTION_RAIL`) — 화면과 워커 첫 화면(`home-first-screen.ts`)이 같은 상수를 import.

## 검증 (E2 — 머지·배포 전)
- tsc 0 · 유닛 1123파일 전부 pass · pre-push 게이트(npm audit 제외 — 아래) · 주입 신규 3건 빨간불 확인.
- `visual-preview --deals` 390px 렌더 눈 확인(섹션 가로 줄 · 원 · 검색창).
- 재조준한 가드: home-ssr-first-screen · home-shorts-entry · bottomnav-black-filled · home-tablet-breakpoint · deal-card-grid-gap + 주입 2건.

## 남은 것
- **E4**: 배포 후 폰 `urdeal.kr/` 하드로드에서 첫 화면이 마운트 때 안 튀는지(서버 첫 화면이 새 머리·가로 줄을 그린다).
- layout-shift 홈 −42px 를 잡았다: 넓어진 카드에서 짧은 이름이 한 줄이 됨(→ 두 줄 자리 고정) + 하네스 스텁 섹션 부제 누락(라이브는 부제 있음 → 스텁에 넣음).
- 시안 A 의 "이번 주 테마" 큰 사진 카드는 이번에 안 했다 — 데이터가 어드민 배너(inline 자리)라 그 배너 모양을 바꾸는 별건.
- PC 홈 안 A — 대표 "모바일 먼저, PC는 다음".
- ⚠️ pre-push 게이트의 npm audit 빨간불(high 7건: follow-redirects·undici 등)은 이 브랜치와 무관(lockfile 무변경) — main 과 같다.

## 틀렸던 판단
- 처음에 유어쇼츠 원을 카테고리 스크롤 **안** 끝에 넣었다 — 원이 일곱이라 첫 화면 밖으로 밀린다. 기존 가드(home-shorts-entry)가 잡아 밖 고정으로 옮겼다.
- `visual-preview.mjs` 가 `chrome-linux/chrome` 만 찾는데 이 컨테이너는 `chrome-linux64` 다 — `PLAYWRIGHT_BROWSERS_PATH` 에 심볼릭 링크로 우회했다.

- 윗부분 시안을 9개(T0~T8) 만들었는데 결론은 원래 그대로였다 — 머리를 바꾸기 전에 "윗부분을 바꿀지" 부터 물었으면 왕복이 줄었다.
