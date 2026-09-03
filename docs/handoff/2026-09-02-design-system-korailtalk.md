# 2026-09-02 — 디자인 시스템 확정 (코레일톡 시안) · 브랜드 블루 · 티켓 부품 · 결제 완료 화면

브랜치 `claude/taste-skill-install-n1s63z` (PR #1298 머지 뒤 main 에서 재시작) — PR #1301.

## 대표 지시 (순서대로, 전부 이 PR 에 반영)
1. 코레일톡 다크 결제 완료 화면 공유: *"이 색상과 느낌. 디자인 조화. 난 이게 좋아."*
2. *"저 이미지 속의 내용은 상관없어. 디자인 시스템이 중요하다는거야. 화이트 모드일 때는 어떻게 조화를 하면 되는거지?"*
3. 화이트 지갑 화면 공유: *"이게 화이트모드네"* · *"아이콘 디자인들도 저 정도로"*
4. *"시안들 보여주고 작업해줘"* · *"다크·화이트 이미지 다 오차없이 정확하게 디자인 시스템을 적용해서 진행해줘"*
5. *"우리 색상도 저 로즈 색 말고 내가 보내준 이미지 색으로 브랜드 색상 변경하자"*
6. *"결제가 완료되었어요 뒷 배경색이 난 가장 마음에 들기도 해"* → 다크 바탕 = 그 색(#11141C)
7. *"보내준 이미지 속 아이콘도 모두 그 느낌으로"* · *"앞으로 아이콘은 모두 저 컨셉이야 명심해줘"* → CLAUDE.md 🎫 절에 영구 규칙

## 완료분
- 시안 아카이브 + 픽셀 실측: `docs/design/ticket-completion-reference-2026-09.md` §6 (assets 2장).
- 시안 아티팩트(두 테마·아이콘): https://claude.ai/code/artifact/c1c7fdd5-4620-4c03-8a6f-0f79c4728426 (⚠️ 로즈 기준으로 그린 것 — 코드는 블루. 갱신 필요)
- 토큰: `src/index.css` 브랜드 블루·바탕·카드·`--rule/--rule-strong/--lift`, `tailwind.config.js` `shadow-lift`·`border-rule`. hex 일괄 이행 291파일(sed). 가드 3개(theme-consistency 목록·guard-mutations find 문자열)와 테스트 3개의 hex 도 함께.
- `src/components/ticket/TicketCard.tsx` 부품 4종.
- `GroupBuyConfirmPaymentPage` → 성공 시 `pages/group-buy/PaymentCompleteTicket.tsx` (자동 이동 폐기).
- 지갑: `VoucherTicket` TicketCard 화 · `MyVouchersPage` [사용 가능|사용 완료] 탭 + 칩(전체 N·만료 임박·지도). `WalletArchive` 는 교환권 지갑이 계속 쓴다.
- 아이콘: `urdeal-icons.tsx` 탭 5종 선/면 · `category-icons.tsx` 채색 flat 9종 + `CategoryTile`. `BottomNav` 교체(로딩 잠금 — CLAUDE.md audit log).
- 계약 테스트 `ticket-surface-system.test.ts`(6 그룹). 하네스 `--dark` 수리(다크 실제 적용) · 지갑 시드 product_id 9001 연결.

## 다음 세션 첫 액션
1. `npm run build && node scripts/visual-preview.mjs --route='/group-buy/confirm-payment?paymentKey=k&orderId=o&amount=17900&productId=9001&qty=1' --deals --wallet --auth=user --dark` → 다크 결제 완료가 시안과 같은지 눈으로.
2. 홈 카테고리 칩(`RestaurantMapPage`·`VouchersPage`, 로딩 잠금)을 `category-icons` 타일로 — 대표 지시 "거의 다 맞춰줘" 의 남은 절반. `[UNLOCK_LOADING]` 기록 필수.
3. `PaymentSuccessPage`(Toss 잠금) 시각만 시안 문법으로 — `AskUserQuestion` 필요.
4. `border border-*`(2,569줄)·색깔 정보상자(1,256줄) 래칫 가드 신설 후 화면 단위 정리.

## 이번에 틀렸던 판단
- **처음 시안을 "로즈로 옮기면 된다"고 봤다.** 대표는 색까지 바꾸길 원했다(5번). 시안을 받으면 "무엇을 그대로 가져올지"를 먼저 물어야 한다.
- **`--dark` 하네스가 다크를 켠 적이 없었다** — 라이트와 픽셀 동일한 `-dark.png` 를 며칠간 "다크 확인"으로 썼다. 부트 스크립트가 저장값 없으면 라이트 고정.
- 픽셀 측정 첫 판은 **표시 좌표를 원본 좌표로 안 바꿔** 엉뚱한 픽셀을 읽었다(1080px 원본 vs 773/980px 표시).

## 남은 결정
- 라이트 바탕을 시안값 #F8F7FC 로 바꿨다(구 크림 #FAF7F5). 대표가 크림을 원하면 `--bg` 한 줄 + `F8F7FC→FAF7F5` 되돌리기.
- PC 상단 네비(`DesktopTopNav`)·홈 카테고리 칩은 아직 lucide/텍스트 — 2번 후속.

## 추가 (PR #1305 에 얹음 — 같은 브랜치)

- **히어로**: 로즈·보라 블룸 삭제(`12e864f`) → 대표 *"위아래부분까지 그라데이션은 안해도"* → 세로 페이드·하단 띠 제거(`239a914`). 좌우 페이드만 남음. 하네스 `--hero=<사진>` 옵션 신설(`688b312`) — 히어로 사진은 SSR 시드에서만 오므로 `--deals` 만으론 빈 색면이다(D1 죽었을 때와 같은 그림이라 오진 주의).
- **지도 위 UI B안** (대표 확정): 위 §7 문서. 파일: `MapTopBar.tsx`(오버레이 흰 고정·선택 블루 면·선 아이콘) · `SheetFilterBar.tsx` · `RestaurantMapPage.tsx`(현위치 FAB) · `map-overlays.ts`(핀 잉크 링·이모지/그라디언트 폴백 삭제) · `HeroCarousel.tsx`(할인율 가격 줄·테두리 0) · `voucher-types.ts`(`emoji`→`icon`) · `urdeal-icons.tsx`(+4 선 아이콘) · `check-theme-consistency.mjs`(`light-fixed` 면제). 가드 `map-chips-b.test.ts` 13건 + 매니페스트 3건.
- **D1 사고**: 15:12·16:08·16:42 KST 에 DB API 전부 500(계정 일일 읽기 한도, #1302). 17:37 KST 회복. 홈 히어로 사진이 안 보인 것도 이것(시드 부재) — 코드 문제 아님.

## 대표가 지적했는데 아직 안 한 것 (다음 세션 첫 액션)

1. **교환권 페이지(`/vouchers`)** — 대표 *"교환권페이지 아직 수정 안된거지? 브랜드도 접혀있고 말이야"*. 새 체계(칩 흰/블루·선 아이콘·카드 테두리 0)가 아직 안 갔다. 브랜드 스트립 기본 접기는 2026-09-01 대표 승인("나안")인데 오늘 다시 언급했다 — **펼쳐 둘지 먼저 확인**. `VouchersPage.tsx` 는 로딩 잠금(SSR 즉시 소비·기본 정렬·이미지 속성 byte-불변) + 981줄 동결.
2. **유어샵(`/u/{handle}`)** — 대표 *"유어샵 부분도 수정이 안된 것 같네?"*. `CuratorPage`/`SellerPublicPage` 표면에 새 체계 미적용. 링크샵 소유권 가드(`check-linkshop-ownership`) 건드리지 말 것.
3. `PaymentSuccessPage`(Toss 잠금 — 허가 필요) · 홈 카테고리 칩(`RestaurantMapPage` list 모드 상단 탭은 밑줄 탭이라 이미 조용함) · DesktopTopNav 아이콘.
- **PC 홈 안A(라이트 섬)** — 위 §8. `tailwind.config` darkMode variant + `.light-island` + 패널 3곳. 가드 `home-panel-light-island.test.ts` 3건 + 매니페스트 2건. 하네스 다크 렌더 확인(`pchome-island-dark.png`).
- **셀프 구매 보상 차단** — `isSelfReferral`(gb-purchase-guards) `/join` 배선, STAGING P12. 머니 경로(귀속 차단만).
- **대표 확정(구현 대기)**: 유어샵 안3(왼정렬 헤더·반반 버튼·칩, 주인 띠 삭제, 방문자는 편집 버튼만 안 보임·팔로우 추가 금지; 07-07 에 뺐던 아바타·스탯이 안3 에 있음 — 보고에 명시) · 교환권 B안(칩+브랜드 펼침·실제 로고) · PC 마이(왼쪽 메뉴+오른쪽 내용, 보라 그라디언트 삭제) · 셀러 B안(잉크 사이드바 유지+콘텐츠 체계화, 화이트 고정).

## 유어샵 안3 + 안P1 구현 (같은 날 후속, #1305 다음 PR)

- **뭘 했나**: 주인 상단 띠 삭제(CuratorPage·SellerPublicPage 둘 다) · `CuratorHeader` 재작성(배너 히어로 렌더 삭제, 왼정렬 아바타+이름, 숫자 한 줄, [유어샵 편집][공유] 반반, `canEdit/onEnterEdit/onExitEdit/counts` prop 신설) · 카테고리 칩 `PinCategoryChips`(지도 SSOT 재사용, 7개 이상) · PC 2단 `.ur-ushop-pc`(index.css) + `pc-fullbleed.ts` 한 세그먼트 정규식 · `LinkshopVisitorRails` 삭제 → `UShopQrCard` · 순번 흰 원.
- **file-size**: CuratorPage 701 → 559 (`OwnerEarningsStrip`·`PinManageList` 를 curator-page/ 로 그대로 추출). CuratorHeader 549 → 466.
- **가드**: `ushop-a3-p1.test.ts` 13건 + 주입 매니페스트 3건(되돌려-검증 빨간불 확인). `check-linkshop-ownership` 3불변식 유지.
- **눈으로 본 것**: `visual-preview --pins=8` 모바일 라이트/다크/주인 · `--pc` 라이트/다크/주인 — 안3·안P1 과 일치.
- **SellerPublicPage 규약 변경**: 주인이 **방문자 화면으로 시작**(`previewAsVisitor` 기본 `true`, CuratorPage 와 통일). 편집 모드 툴바는 [+ 등록][셀러 대시보드] 만(`ur-btn`).
- **틀렸던/주의**: 2026-07-07 아바타·스탯 삭제 결정이 안3 으로 뒤집혔다 — 다음 세션이 "07-07 결정 위반"으로 되돌리지 말 것(설계 문서 §9).
- **남은 것**: ② 교환권 B안 · ③ PC 마이 · ④ 셀러 대시보드 B안 (대표 확정, 미착수).

## 교환권 B안 구현 (같은 PR)

- VouchersPage/shared.tsx: 잔액 흰 카드(모바일·PC 레일) · 칩 B안 · 브랜드 **기본 펼침**(09-01 접기 결정을 대표가 대체) · 행/카드/브랜드 타일 테두리 → 들림. 잠긴 계약 byte-불변(위 audit log). 파일 979줄.
- 테스트 `vouchers-top-chrome.test.ts` ①(슬래브 표식)②④ 재정의 + 매니페스트 1건 교체.
- #1305 는 main(#1308~#1311) 머지 후 유어샵·교환권을 **함께** 실어 보낸다(CI 한 사이클 절약). 충돌 1건: #1309 가 `LinkshopVisitorRails` 에 xl 게이트를 붙였는데 안P1 이 그 파일을 지웠다 → 삭제 유지, `linkshop-products-seed.test.ts` ③ 을 남은 레일만 검사하도록 수정.

## PC 마이 구현 (같은 PR)

- `AccountPcPane.tsx` 신규(lg+ 만 마운트, `useMediaQuery` 동기 분기) · UserProfilePage 그라디언트 헤더 삭제(PC 는 헤더 숨김) · AccountSideNav 블루 선택 + 내 교환권.
- 가드 `account-pc-pane.test.ts` 6건 + 매니페스트 2건. 하네스 `--route=/user/profile --pc --auth=user --deals --wallet` 라이트/다크 확인.
- ⚠️ 하네스에선 주문 현황·리뷰어 레벨이 데이터 0 이라 안 그려진다(둘 다 빈값이면 null) — 라이브에서 확인할 것.
- 남은 것: ④ 셀러 대시보드 B안.

## 셀러 대시보드 B안 구현 (같은 PR)

- `ur-btn-primary` 잉크 → 블루(어드민·에이전시도 함께) · SellerLayout 활성 블루 막대/로그아웃 중립/FAB 블루 · Kakao 배너 · MyStoresPanel STEP 티켓 · DashboardCard/StatCard 들림 · SellerPage amber 상자 제거 · 라이트 래퍼에 `--lift/--rule` 재선언.
- 가드 `seller-dashboard-b.test.ts` 7건 + 매니페스트 2건. `check-dashboard-theme`/`dashboard-button-system`/`design-slop` GREEN. 하네스 `--route=/seller --pc --auth=seller` 확인.
- 대표 확정 4건(유어샵·교환권·PC 마이·셀러) 전부 #1305 에 실림. 남은 것: CI → 머지 → 라이브 확인 → Notion.

## PC 홈 히어로 — 사진과 흰 패널 사이 공백 제거 (2026-09-03)

대표: *"히어로 사진과 아래 흰색 공간부분 간의 공백이 있는데 그걸 없애줘"*.
`PcHomePage` 의 콘텐츠 래퍼가 `pt-4`(16px)를 갖고 있어 히어로 사진 밑단과 흰 패널 사이로 색면이 띠처럼 드러났다.
히어로 사진은 `absolute inset-0` 이라 섹션 바닥 = 사진 바닥이므로 그 여백이 곧 빈 띠였다. `pt-4` 삭제 → 패널의
둥근 윗모서리가 사진에 그대로 물린다. 모바일 홈(RestaurantMapPage)은 다른 컴포넌트라 무접촉.
검증: 홈 계약 테스트 59건 pass · 하네스 PC 렌더로 눈 확인.

### 히어로 컨트롤 시안 → **확정·구현 완료** (2026-09-03)
대표: *"여기 버튼들도 시안 받아볼 수 있을까? 지금 AI 느낌 나서"* (전국 ⌄ / 현 위치로 설정 / 지도에서 가까운 딜 보기 → / 사진 속 딜 보기 →).
진단 다섯: ① 같은 무게 알약 셋 연속(위계 0) ② 위치라는 한 가지 일이 두 알약으로 쪼개짐 ③ 아이콘 셋 연달아(전부 "위치" 뜻)
④ 화살표 두 곳 ⑤ 주 행동에 브랜드 블루 없음(서비스 전체 규칙의 예외).
시안 3안: **안1(추천)** 세그먼트 위치 알약 + 블루 주 버튼 · **안2** 흰 바 한 줄 + 블루 원형 · **안3** 위치를 부제 문장 안 밑줄 단어로.
시안 아티팩트: https://claude.ai/code/artifact/7b435a49-6ad5-415e-90cc-04ec0e2090eb
바꿀 파일: `src/pages/pc-home/PcHomeLocationBar.tsx`(hero tone) · `src/components/home/HomeHeroDefault.tsx`.
⚠️ 같은 `LocationBar` 를 모바일 홈이 `tone="title"` 로 쓰므로 hero tone 만 건드릴 것.

**대표 확정: "3 · 흰 면 · 한 단계 작게"** — 안1 구조(세그먼트 위치 알약 + 블루 주 버튼) 위에,
위치 칩만 추가 시안 3안을 다시 받아 **흰 면 · 그림자 없음 · 높이 32(블루 38보다 한 단계 낮게)** 로 확정.

구현(같은 PR #1323):
- `PcHomeLocationBar.tsx` hero 분기 → 한 알약(`inline-flex items-stretch h-8 rounded-full overflow-hidden bg-white`)
  안에 [지역 트리거][`w-px` 실선][현 위치 아이콘 버튼]. **`panel`/`title` tone 무접촉**, `현 위치로 설정`
  문자열은 소스에 보존(`aria-label` + panel tone + `mobile-home.test.ts` 가 함께 본다).
- `HomeHeroDefault.tsx` → 주 버튼 `h-[38px] bg-brand text-white` "지도에서 딜 찾기"(화살표·아이콘 0),
  "사진 속 딜 보기 →" 는 사진 위 `absolute bottom-3 right-5` 로 이동, `ArrowRight/Map` import 제거.
- 가드 `pc-home-hero-controls.test.ts` 6건 + 주입 3건(되돌려-검증 빨간불 확인).
- 하네스 3종 확인: `--pc --deals`(사진 없음) · `--hero=<사진>`(사진 위 대비) · `--dark`.
- 설계 SSOT: `docs/design/ticket-completion-reference-2026-09.md` §13.

**다음 세션 첫 액션**: PR #1323 CI 초록 → 머지 → `main.yml` 배포 확인 →
`curl -s https://urdeal.kr/ | grep -o '지도에서 딜 찾기'` 로 라이브 반영 판정 → Notion 개발 로그 1행.

## 다크에서 안 보이는 글자 — 전수조사 (2026-09-03)

대표: *"글자가 또 하얘. 이런 경우 지금 많은 것 같은데 전수조사 필요해"* (`urdeal.kr/map?q=부산` 검색창).

**원인은 오타가 아니라 구조였다.** 전역 `.dark input:not(...)`(특이도 **0,5,1**)이
`text-gray-900`(**0,1,0**)을 **언제나** 이긴다. 지도 코드는 맞게 썼는데 CSS 가 조용히 뒤집었다.
게다가 지도에 달린 `light-fixed` 는 **주석**이라 `check-theme-consistency` 를 면제할 뿐
**런타임엔 아무 일도 안 한다** — 가드는 초록인데 화면은 안 보이는 "조용한 부재".

그리고 이건 **늘어날 수밖에 없는 구조**였다. 09-02 에 지도 위 UI·홈 패널을 "테마 무관 흰 면"으로
바꿨는데 전역 다크 규칙은 여전히 "앱이 다크면 표면도 어둡다"를 전제한다. 대표 직관이 정확했다.

### 🩸 이번에 틀렸던 판단 (다음 세션이 같은 길로 가지 말 것)

**처음에 grep 으로 찾으려다 0건이 나왔다.** 같은 className 안에 밝은 분기와 어두운 분기가
함께 있어서(`panel ? A : B`) 다른 분기의 `dark:text-` 때문에 통과했다. **특이도 싸움의 승자는
브라우저만 안다** — 이 클래스는 정적 검사로 못 잡는다. 렌더해서 재야 한다.

그리고 `grep dark:text-gray-600` 은 **192건**을 뱉었는데 대부분 정상이었다
(`dark:bg-white dark:text-gray-900` = 흰 버튼 위 검은 글자). 실제 결함은 렌더 측정이 짚은 1건.

### 한 일

- **신규 가드 `scripts/check-dark-contrast.mjs`** — 17개 소비자 경로를 다크로 렌더해 보이는 모든
  텍스트의 글자색 vs **실제 뒤 배경색**(투명하면 조상을 타고 올라감) WCAG 대비를 잰다.
  입력은 값을 채워서, 시트/모달은 열어서 잰다. 양방향(밝은 위 밝음 · 어두운 위 어두움).
  **측정 텍스트 200개 미만이면 통과가 아니라 실패**(헛도는 가드 방지). verify.yml strict + audit-gate.
- **수리 2건**: 지도 오버레이 컨테이너에 `light-island`(1.1:1 → 정상) ·
  `SiteFooter` 저작권 `dark:text-gray-600` → `-500`(2.4:1 → 정상).
- **`light-island` 완성**: placeholder·autofill 규칙에 빠져 있던 것을 채웠다(색 규칙엔 이미 있었다).
- 규칙 못박기: **늘 밝은 표면에는 `light-island` 클래스**. 주석은 부표일 뿐.
- 가드 `light-island-inputs.test.ts` 5건 + 주입 매니페스트 3건(되돌려-검증 빨간불 확인).

### 남은 것

- 가드 경로 목록이 곧 검사 범위다(현재 17개). 새 소비자 화면을 만들면 `ROUTES` 에 추가할 것.
- 못 보는 것: 사진/그라디언트 위 글자 · 호버/포커스 상태.
- 장식(빈 별점·구분자·빈 상태 아이콘) `text-gray-300 dark:text-gray-600` 은 ~68곳 남아 있다.
  **일부러 흐린 것이라 안 건드렸다** — 읽는 글자가 아니다. 도구가 나중에 그걸 신고하면
  baseline `allow` 에 넣되, **읽는 글자는 절대 넣지 말 것**.

### 🩸 이번에 또 틀린 것 — 브라우저 가드를 PR 게이트에 넣었다

`check-dark-contrast` 를 `verify.yml` strict 로 넣었다가 되돌렸다. 두 가지가 틀렸다:

1. **레포가 이미 정한 규칙을 어겼다.** `render-smoke.yml` 주석이 명시한다 —
   *"PR 게이트로 승격하지 말 것. 브라우저·dev 서버를 띄우므로 느리고 환경에 민감하다.
   간헐 실패가 머지를 막으면 가드를 꺼 버리게 된다."* `live-contracts.yml` 도 같은 판단이다.
2. **어차피 빨간불이 됐을 것이다.** `verify.yml` 은 브라우저를 설치하지 않는다
   (`npx playwright install` 은 `render-smoke.yml` 에만 있다). 인프라 이유로 머지가 막혔을 것이다.

⇒ 전용 워크플로 `.github/workflows/dark-contrast.yml` 로 옮겼다(브라우저 설치 + build + 경로 필터,
`workflow_dispatch` 로 손으로도 실행). audit-gate 등록은 유지(dist 없으면 skip).
그리고 브라우저를 못 띄우면 **크게 소리내고 건너뛴다** — 조용한 통과는 "돌고 있다"는 착각을 만든다.

**교훈**: 새 가드를 어디에 등록할지는 취향이 아니라 **이미 같은 성격의 가드가 어디 있는지**를 보고 정한다.
