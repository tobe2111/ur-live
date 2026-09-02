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
