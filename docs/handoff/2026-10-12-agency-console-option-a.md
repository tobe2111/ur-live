# 2026-10-12 — 셀러 대시보드 제거 2단계: 에이전시 콘솔 안 A (모바일 + PC)

대표: *"A안으로 해줘. 이건 PC버전도 중요해"* (시안 캔버스 https://claude.ai/artifact/A1nqgwt9bDQXncAhgc1KdD 의 안 A)

서비스: 🎟️ 유어딜 (에이전시 콘솔 `/agency`). 머니 경로 접촉 없음 — 오늘 숫자는 읽기 전용 집계, 정산은 보기만.

## 무엇이 바뀌었나
- **판**(`src/pages/agency-console/AgencyStorePlate.tsx`) — 마이 판매 구역과 같은 판: 오늘 숫자(누르면 매출 분석) ·
  이용권 사용처리 티켓 · 이용권 등록·관리(진한 블루) · 주문 · 정산(보기만) · 전체 도구. 도구는 `ToolPageSheet`
  (대시보드 화면을 시트 안에 그대로)로 연다. 마이 판을 import 하지 않은 이유: 마이 판은 사람의 좌석 목록과 카카오 계정에
  묶여 있고 시험 42곳이 그 파일을 붙든다 → 생김새 클래스를 같게 쓰고 **시험이 짝을 대조**한다.
- **화면**(`AgencyStoresPanel.tsx` 재작성 · `AgencyHomePage.tsx`) — 폰: [맡은 매장 · 고르기 칩] → 판 → [에이전시] 줄
  (맡김 요청 · 직원 · 에이전시 정보 · 매장 초대·대신 등록, 전부 시트). PC: 왼쪽 매장 목록 + 에이전시 줄 / 오른쪽 판.
  같은 DOM 을 `order-*` 로만 바꾼다. 고른 매장은 `localStorage.agency_console_store` 에 기억(편의).
- **서버**(`agency-store-today.ts` + `/api/agency-console/stores`) — 운영 중 매장에 `today`(오늘 매출·주문·처리 대기·판매 중)를
  싣는다. 규칙은 마이 `/my-stores/summary` 와 같은 문장(시험이 대조).
- **좌석** — 판을 여는 것만으로 받지 않는다. 도구를 누를 때 `enterAgencyStore`, 이미 **이 직원의 · 이 매장** 좌석이면 재발급 안 함
  (`isMyAgencySeat` — 매장 컴퓨터 공유 대비 직원 id 까지 본다). 좌석을 바꾸면 `bumpSeatGeneration()`.
- **PC 액자** — `/agency` 가 PC 에서 430 소비자 액자에 갇혀 있었다(하네스 실측 — 원래부터의 결함). `MobileAppLayout` `HIDE_SIDEBAR_PREFIXES` 에 추가.
- **대시보드 [운영하기] 제거** — 콘솔 어디서도 `/seller` 로 보내지 않는다(가드).
- 하네스: `scripts/visual-preview.mjs --auth=agency` (+ `--stub-file` 로 `/api/agency-console/{me,staff,stores}`).

## 검증
- tsc 0 · 신규 시험 29건 · 주변 65파일 903건 pass · 주입 7건 전부 빨간불 · 낡은 앵커 0.
- 렌더 실측(폰 390 · PC 1440): 시안 A 와 같은 배치. **PC 세 칸에서 긴 오른쪽 값이 제목을 0px 로 눌러 '정산' 글자가 사라졌다** →
  짧게(정산 "보기만", 전체 도구 값 없음) 고쳐 재확인.

## 다음 세션의 첫 액션
1. #1718 CI 확인 → 대표 머지 지시 대기.
2. 배포 뒤 E4: 에이전시 계정으로 `urdeal.kr/agency` — 오늘 숫자가 뜨는지 · [주문] 눌러 시트로 열리는지(좌석 1회 발급) ·
   다른 매장 고르고 다시 눌러 좌석이 바뀌는지 · PC 에서 두 칸인지. (에이전시 테스트 계정이 필요 — 대표 판단)
3. 남은 3단계(에이전시 몫): 알림·메일의 `/seller/*` 깊은 링크가 에이전시 좌석이면 아직 대시보드 → 콘솔 `?tool=` 로 받는 길.
4. 4단계 전 정리: 사용처리(`/seller/scan`) · 시트 불가 화면(`/seller/meal-voucher/new`)이 아직 대시보드 껍데기 안에서 뜬다.

## 이번에 틀렸던 판단
- 처음 PC 렌더가 "홈 화면"처럼 찍혀 하네스 문제로 의심했다 — 실제는 **콘솔이 소비자 액자 안에 갇혀** 좌우 거터 레일이
  본문 앞부분으로 읽힌 것이었다. 그림을 먼저 봤으면 바로 알았다(본문 텍스트 요약만 보고 판단하지 말 것).

## 남은 결정
- 없음(대표 확정안 그대로 구현).

## ➕ 3단계 에이전시 몫 — 깊은 링크 → 콘솔 시트 (같은 날, #1718 머지 뒤 새 PR)
대표 *"초록 뜨면 머지하고 남은거 계속 해줘"*. #1718 은 auto-merge(squash) 걸어 둠.
- `src/lib/seller-deep-link.ts`: `shouldSendAgencyToConsole`(에이전시 좌석 **+** 콘솔 토큰 살아 있음) · `consoleRedirectFor`
  (홈류 → `/agency`, 하위 → `/agency?tool=`, `dash=1`·전용 길 그대로). 마이 판정과 `toolRedirect` 를 공유.
- `SellerLayout`: 사장님 판정 **뒤에** `toConsole`.
- 콘솔 `AgencyStoresPanel`: `?tool=` → 좌석 토큰의 매장을 고르고 `AgencyStorePlate initialPath` 로 시트를 연 채 마운트.
  이 직원의 그 매장 좌석이 아니면 `location.replace(dashboardFallback)`. 한 번만 쓴다(`deepDone`).
- 판의 전체화면(`goFull`)은 `dashboardFallback(path)` — 껍데기가 다시 콘솔로 튕기지 않게.
- 검증: 신규 시험 `agency-deep-link-2026-10-12` + 주입 6건, 앞 단계 7건과 합쳐 13건 전부 빨간불 확인.
- ⚠️ 콘솔 토큰 키를 lib 가 문자열로 따로 들고 있다(페이지 import 금지) — 시험이 `AGENCY_TOKEN_KEY` 와 대조.

## 4단계(껍데기 삭제) 전에 남은 것
- 대시보드 껍데기를 아직 쓰는 길: `/seller/scan`(카메라) · `/seller/meal-voucher/new` · `/seller/youtube/callback` ·
  `?dash=1` 되돌림 · `?from=my` 전체화면 · 마이 없는 옛 셀러 계정 · 콘솔 로그인 없는 에이전시 좌석.
  이 길들이 **사이드바 없는 최소 껍데기**로 충분한지부터 재고, 그다음 사이드바·상단바·하단 탭을 지우고 번들을 잰다.

## ➕ 판매 알림을 마이로 (4단계 선행 — 같은 날)
- **발견**: 판매 알림(`dashboard_notifications` recipient_type='seller' — 결제 확정·정산·승인·제안·재고)은 **대시보드 껍데기의 종에서만**
  보였다. 3단계에서 카카오 사장님을 마이로 보내며 그 받은편지함이 사라졌다(에러 0). 4단계 차단 요인 ③.
- 서버 `seller-store-notifications.ts`: `GET /api/seller/my-stores/notifications` · `POST …/read` — **사람 기준**(앉을 수 있는 매장 전부,
  `resolveStoreScope` = `/my-stores/summary` 와 같은 근거, 정지 제외). 읽음도 그 범위 안에서만. 좌석 가드 예외 등록(쿠키 판정).
- 마이: '내 가게' 머리에 종(`StoreNotifButton`) — 지금 가게 알림은 시트로 열고, 다른 가게 알림은 "가게를 바꾸라" 고 말한다(좌석이 매장을 정하므로).
- 시험 11건(실제 SQLite — 남의 매장 알림 못 읽고 못 지움) + 주입 6건 전부 빨간불.
- ✅ 에이전시 콘솔도 됨 — `/api/agency-console/notifications`(맡은 매장 전부) + `AgencyNotificationsSheet` (#1718).

## 4단계 실측 (셀러 화면 69개 조사)
- 껍데기 자체: 소스 ~50KB(SellerLayout 25KB + 껍데기 전용 부품). **번들 감소는 작다.**
- 아무도 못 들어가는 화면(플래그로 숨김 포함) 14개 청크 합 **146KB raw** — 전체 예산 7.0MB 의 약 2%.
- 이미 import 0 인 파일 4개는 지워도 번들 0바이트(애초에 안 실린다). 나머지 4개는 퇴역 보존 가드가 붙든다 — 손대지 않음.
- 껍데기 삭제를 막는 것: ① 페이지 53개가 `<SellerLayout>` 으로 자신을 감싼다(얇은 틀로 교체 필요) ② 리다이렉트·토큰 갱신이 껍데기 안에 있다
  ③ 판매 알림함(이번에 마이로 옮김, 콘솔은 남음) ④ 테스트 11개.
- 대표 판단 필요: 플래그로 숨긴 화면(쿠폰·공급·숙소 묶음·리뷰 인증·체험단)을 **지울지**(되살리기 어려워진다).

## ➕ 에이전시 콘솔 판매 알림 + 대표 결정
- 대표 결정(2026-10-12 `AskUserQuestion`): **플래그로 숨긴 셀러 화면(쿠폰·공급·숙소 4종·리뷰 인증·체험단)은 남겨 둔다.** 껍데기만 얇게 바꾼다.
- 콘솔 `GET/POST /api/agency-console/notifications(/read)` — 우리 에이전시 · active · 직원 배정(`staffStoreAccessSql`, `/stores` 와 같은 문장).
- 콘솔 '에이전시' 구역 맨 위 `판매 알림` 줄 → 시트. 누르면 그 매장을 고르고, 이 직원의 좌석이 아니면 **그 클릭에서** 좌석을 받고 화면을 시트로 연다.
- 링크 판정은 마이·콘솔 공용 `src/lib/notif-target.ts`.
- 시험 8건(실제 SQLite) + 주입 5건. 🩸 주입이 헛도는 단언 하나를 잡았다 — 숫자 힌트만 눌러서 줄 이름이 바뀌어도 통과했다.

## ➕ 4단계 — 단독 대시보드 틀 얇게 (같은 날, "남은거 다 진행해줘")
- 사이드바(PC)·하단 탭 다섯(폰) 제거 → 머리줄 하나 [매장(전환 겸용)·제목 · 검색(⌘K) · 알림 · 전체 메뉴]. `SellerLayout` 395→254줄.
- `/seller/more` = 메뉴 허브: 이용권 등록(파란 버튼, 종전 사이드바 CTA) · 홈/주문/이용권/정산 · 나머지(`moreGroups`) · 계정(유어딜 홈·설정·공개 프로필·언어·로그아웃).
- `SellerBottomTabs.tsx` 삭제 · `.ur-seller-nav-active` 제거 · `SellerBottomBar`/FAB 오프셋에서 탭 60px 제거(마이 시트 안에서 떠 있던 결함 동반 수리).
- 시험 5개 재조준(지우지 않고 불변식을 머리줄·전체 메뉴로) · 낡은 주입 앵커 5건 재조준 · 새 주입 3건(`[얇은틀]`) · `--changed` 403건 전부 빨간불.
- 검증: tsc 0 · 틀 참조 시험 52파일 878건 통과 · 렌더 눈 확인(`visual-preview --auth=seller`, `/seller/more`·`/seller/orders` 폰·PC):
  폰 머리줄 = 매장 이름 + [검색·알림·전체 메뉴] 한 줄, 하단 탭 없음 · PC = 로고 · `매장 / 제목` · `전체 메뉴` 라벨. 번들 실측은 안 했다(틀 소스 ~10KB 감소라 작다).
- PR: 2·3단계 + 판매 알림 = **#1718 머지 `ba0d258`(12:50 KST 자동 머지, 배포 워크플로 전부 성공, 새 엔드포인트 비인증 401 라이브 확인 — E3)**.
  4단계 = **#1723**(draft). Notion 로그 기록 완료(#1718).
- 다음 세션 첫 액션: #1723 CI 확인 → 대표 지시 시 머지 → 라이브에서 마이 없는 셀러 계정으로 `/seller/orders` 머리줄 확인(E4).
- 이용자: 카카오 사장님·에이전시 직원은 이 틀을 안 본다(3단계 리다이렉트). 보는 사람 = 마이 없는 옛 계정 · 콘솔 로그인 없는 좌석 · `?dash=1` 화면.

## ➕ 1단계 마무리 — 진입점 없던 화면 (같은 날, "초록 뜨면 머지하고 마저 해줘")
- `consignment` 은 이미 2026-09-28 결재로 은퇴(리다이렉트 · API 보존) — 새로 할 일 없음.
- `plus-friend-guide`(알림톡 채널 안내)는 유일한 링크가 렌더 0 인 `SellerOnboardingChecklist` 안에만 있었다 →
  `SELLER_SEARCH_ONLY` 에 추가(설정 묶음). 마이 '전체 도구'·⌘K 에서 닿는다. 라벨 6개 언어 `seller.nav.plusFriendGuide`.
  가드: `seller-page-search-2026-09-03.test.ts` ④ + 주입 `scripts/mutations/seller-plus-friend-entry-2026-10-12.mjs`(빨간불 확인).
- 이로써 계획서 1~4단계가 전부 E2 이상. 남은 것은 라이브 판정(E4)뿐: 마이 없는 옛 셀러 계정 머리줄 · 에이전시 계정 실사용.
- **#1723 머지 `34f269d35`** (squash 자동 머지 — Verify·contrast·Pages 초록 확인 후). E3.

## ➕ 마지막 두 길 — 대시보드에 안 가도 되는가 (같은 날, 대표 *"이제 셀러 대시보드, 에이전시 대시보드로 굳이 안가서 해도 돼?"*)
- 재 보니 **두 길이 아직 얇은 대시보드 틀로 떨어지고 있었다**:
  ① 전체 도구에서 '바우처 스캔' · '이용권 등록' 을 고르면 마이·에이전시 콘솔 **둘 다** 대시보드 주소로 보냈다.
     `tool-pages.ts` 는 *"마이엔 전용 길이 있다"* 고 적어 놓고, 그 길(`VoucherNewSheet`, 2026-09-26)은 **아무도 렌더하지 않았다**(고아).
  ② 에이전시 직원 계산대가 `/seller/scan`(대시보드)이었다 — `/store/scan` 라우트가 `requireUser`(소비자 로그인)를 요구해서다.
     같은 요구가 **스캔 전용 기기 링크 `/store/scan?dk=` 도 막고 있었다**(로그인 없이 쓰라고 만든 링크인데 로그인 화면으로 튕김 — 기능 결함).
- 수리: `tool-pages.ts` 에 `OWN_PATH`(scan→`/store/scan` · voucherNew→`VoucherNewSheet`) 한 곳 → `AllToolsSheet` 가 `onPick` 4번째 인자로 넘김 →
  마이(`SellerSection`)·콘솔(`AgencyStorePlate`)이 받은 대로 연다. 등록 완료 '내 이용권 보기' 는 이용권 목록 시트로.
  `/store/scan` 라우트에서 `ProtectedRoute requireUser` 제거 — 화면 가드(seller_token 또는 scan_device_key, 없으면 마이로)가 유일한 문이고 서버가 토큰을 검증한다.
  셀러 가이드 '처음 시작한다면' 2·3번을 마이 경로로 + `GUIDE_SEED_VERSION` 45.
- 가드: `dashboard-free-own-paths-2026-10-12.test.tsx` 13건(AllToolsSheet 를 실제로 렌더해 눌러 본다) + 주입 `[전용길]` 6건 전부 빨간불.
  재조준 2건: `agency-console-plate` (*"/store/scan 이 아니라 /seller/scan"* → 같은 계산대) · `my-seller-all-in-my` (onPick 인자).
- ⇒ **답: 사장님은 마이, 에이전시 직원은 에이전시 콘솔에서 전부 된다.** 대시보드가 남는 경우 = 마이 없는 옛 셀러 계정 · 콘솔 로그인 없는 좌석 ·
  `/seller/*` 를 직접 연 깊은 링크 중 전용 화면(`STAY_ON_DASHBOARD`: 스캔·등록·유튜브 OAuth 복귀) · `?dash=1`.
- ⚠️ 못 잰 것(E4): 실기기 카메라 · 에이전시 계정으로 `/store/scan` 진입 → 처리 매장이 맞게 잡히는지 · 스캔 기기 링크 비로그인 진입.
- 다음 세션 첫 액션: 이 PR CI 확인 → 대표 지시 시 머지 → 스캔 기기 링크를 비로그인 브라우저로 열어 계산대가 뜨는지(E4).

### ➕ 2차 — 깊은 링크도 (대표 *"이제 모두 가장 이상적인 형태야?"* → 재 보니 아니었다)
- 🩸 **틀린 판단**: 1차에서 *"이제 다 된다"* 고 답할 뻔했다. 전체 도구만 고쳤고 **바깥에서 들어오는 문**을 안 셌다.
  `seller-deep-link.ts` `STAY_ON_DASHBOARD` 가 `/seller/scan`·`/seller/meal-voucher/new` 를 *"마이에 전용 길이 있다"* 는 이유로
  대시보드에 **남기고** 있었다 → 알림톡 '사용처리'(`/store/go?to=scan`) · 주문 상세 '사용처리 화면으로' · 사용 처리 완료의
  '다음 손님 QR 찍기' · 하단 ➕ '이용권 등록' · 유어샵 '이용권 등록' 이 전부 얇은 대시보드 틀로 떨어졌다.
- 수리: `OWN_PATH`·`STORE_SCAN_PATH`·`ownPathFor` 를 `@/lib/seller-deep-link` 로 옮기고(`tool-pages` 는 재수출) `STAY_ON_DASHBOARD` 는
  OAuth 복귀 하나만. 깊은 링크 `/seller/scan` → `/store/scan`(쿼리 유지, 사장님·에이전시 모두), `/seller/meal-voucher/new` → `?tool=` →
  마이(`useToolDeepLink` 가 `own` 을 넘김)·콘솔(`initialOwn`)이 `VoucherNewSheet` 로. 직접 링크 셋(`STORE_GO_TARGETS.scan` ·
  `OrderDetailModal` · `VoucherVerifyPage`)을 `/store/scan` 으로. 유어샵 CTA·매장 등록 모달의 "셀러 대시보드 ›" 문구 → 마이 '내 가게'.
- 가드: 같은 시험 +5건(⑥) · 주입 `[전용길]` 10건 · `[깊은링크]` 9건 전부 빨간불 · 재조준 3건(`seller-deep-link-to-my` · `agency-deep-link` ·
  `store-deep-link`). 관련 94파일 1,476건 통과 · tsc 0.
- 🩸 tsc 가 잡은 것: 문구 치환이 JS 문자열 안의 작은따옴표를 깨뜨렸다(`'…마이 '내 가게'…'`) — 그 컴포넌트를 렌더하는 시험이 없어 vitest 는 초록이었다.
- 남는 대시보드: 마이 없는 옛 계정 · 콘솔 로그인 없는 좌석 · `?dash=1` · 유튜브 OAuth 복귀. (BottomNav ➕ 는 잠금 파일이라 주소는 그대로 두고 깊은 링크가 받는다.)

### ✅ 머지·배포·라이브 판정
- **#1726 머지 `a636651`** (Verify 초록 확인 후 squash — 자동 머지가 안 걸려 직접 머지). Pages 배포 성공. Notion 로그 기록(#1723·#1726).
- 🩸 CI 가 잡은 것: `가드 주입 검증 (변경분)` 2건 — 새 코드가 같은 문자열(`const back = pageFrom; …` · `enterSeat('/store/scan')`)을 써서
  기존 가드 둘이 **그쪽에 매치돼** 원래 자리를 못 지키게 됐다. 앵커를 자리 고유 표지로 재조준(`21c8a51`).
- **E4(라이브, 아이폰 UA · 비로그인 브라우저)** — 같은 탐침을 배포 전후로 돌렸다:
  | 탐침 | 배포 전 | 배포 후 |
  |---|---|---|
  | `/store/scan?dk=<키>` (스캔 전용 기기 링크) | `/login?returnUrl=…` 로 튕김 · 키 저장 안 됨 | **`매장 계산대` 렌더 · 키 저장 · 주소에서 `dk` 제거** |
  | `/store/scan` (자격 없음) | `/login` | `/user/profile` → `/login` (화면 가드가 막는다) |
  탐침은 `--proxy-server=$HTTPS_PROXY --ssl-version-max=tls1.2` 로 라이브에 붙었다(`visual-preview.mjs` 머리말의 방법).
- ⚠️ 아직 못 잰 것(로그인 필요): 카카오 사장님이 알림톡 `/store/go?to=scan` 을 눌러 계산대가 뜨는지 · 에이전시 계정으로 사용처리 시 매장이 맞는지
  · 하단 ➕ '이용권 등록' → 마이 등록 시트. 대표 계정(users.id=3)은 셀러 좌석이 없어 이 경로를 재현할 수 없다.

## 3차 — 버튼도 곧장 (대표 "응응 거치는 단계 없애줘")

- 하단 ➕ '이용권 등록'·'셀러 대시보드'와 유어샵 세 버튼이 `/seller/*` 를 거치지 않는다 — `sellerEntryPath()` 가
  대시보드 껍데기와 **같은 판정**(`sellerEntryRedirect`, `src/lib/seller-deep-link.ts`)을 누르는 순간 한다.
  껍데기(`SellerLayout`)도 그 함수로 바꿨다(두 벌 금지). 옛 셀러·`dash=1`·콘솔 로그인 없는 에이전시 좌석은 종전대로 대시보드.
- ➕ 시트 두 번째 버튼 이름도 도착지대로: `마이 '내 가게'` / `에이전시 대시보드` / `셀러 대시보드`.
- 잠금 파일 `BottomNav.tsx` — CLAUDE.md 로딩 잠금 audit log 에 기록. linkshopPath·isActivePath 불변.
- 검증: tsc 0 · 관련 6파일 129건 pass · 주입 4 + 재조준 2 빨간불 · critical-chunks 17 · surface-role-leak 0.
- **다음 세션 첫 액션(E4, 로그인 필요)**: 사장님 계정으로 ➕ → '이용권 등록' → 주소창이 `/seller/...` 를 한 번도 안 찍고
  `/user/profile?tool=%2Fseller%2Fmeal-voucher%2Fnew` 로 가서 등록 시트가 뜨는지.

## 4차 — "남은 것 모두" (대표 "모두 진행해줘")

- **오진 정정**: 직전에 *"마이 '이용권' 시트 안 '새 이용권'·'재발행' 이 대시보드 등록 화면을 띄운다"* 고 보고했는데 **틀렸다.**
  렌더해 보니 시트 안에서 같은 위저드가 껍데기 없이(`aside` 0 · `ur-embed-page`) 뜨고 `?copyFrom` 도 받으며, 등록 뒤엔 위저드가
  `/seller/group-buy` 로 가서 시트 안 목록이 다시 마운트된다. 고칠 것 없음 → `tool-page-sheet-renders` 에 렌더 시험 + 주입 1건으로 고정.
  ⇒ **"대시보드 주소" 와 "대시보드 틀" 은 다르다** — 시트 안의 `/seller/*` 는 메모리 라우터 안이라 틀이 없다. 주소만 보고 판단하지 말 것.
- **옛 계정 실측(라이브 D1, 읽기 전용, 16:20 KST)**: 셀러 13 · 승인 10 · 정지 3 · 도매 0.
  승인 10 중 마이 길 있음 8(연결 1 · 주인 좌석 1 · 운영자 좌석 6 — 운영자 좌석도 `/api/seller/my-stores` 가 돌려준다),
  **마이 길 없음 2(id 21·22)** — 2026-09-23 같은 분에 23·24 와 함께 만들어진 빈 가입(상품 0 · 주문 0 · 비밀번호 없음 · 사업자 서류 pending).
  새 에이전시 콘솔 계정 0(테이블이 아직 안 만들어짐). ⇒ **실제로 대시보드가 필요한 사람은 0명.** 완전 삭제는 대표 판단.
