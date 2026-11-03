# 2026-11-02 결제 완료 티켓 모션 + 모션 시안 여섯 자리

서비스: **유어딜(소비자)** — 이용권 결제 완료 화면. 머니 경로 접촉 **없음**(표시만). 잠금 파일 무접촉.

## 다음 세션의 첫 액션
1. 머지·배포 뒤 E4 판정: 실제 이용권 결제(staging 또는 소액)로 `/group-buy/confirm-payment` 완료 화면에서
   제목→띠→본문→금액 숫자 올라감이 1.5초 안에 끝나는지, 화면을 누르면 즉시 끝나는지, 금액이 결제액과 같은지 본다.
   (세션은 실결제를 못 한다 — 대표 확인 필요.)
2. 대표가 2~6번 중 고른 것을 구현. 시안: `docs/design/motion-mockups-2026-11.md`.

## 완료분
- `PaymentCompleteTicket.tsx` 에 `useTicketMotion` + `payment-complete-motion.css`
- 가드 `payment-complete-motion-2026-11-02.test.tsx` 7건(주입: 키프레임에 height 추가 → 빨강, 끝 금액을 count 로 → 빨강)
- 시안 원본 `docs/design/assets/motion-mockups-2026-11-02.html`

## 이번에 틀렸던 판단
- "실제로 넣으려면 잠금 파일(`PaymentSuccessPage.tsx`) 승인이 필요" 라고 대표께 말했는데 **틀렸다**.
  이용권 결제 완료는 `GroupBuyConfirmPaymentPage` → `group-buy/PaymentCompleteTicket.tsx` 이고 잠금표 밖이다.
  `PaymentSuccessPage` 는 다른 흐름(Toss 리다이렉트 일반 주문)이다. ⇒ 화면 이름이 아니라 **실제 렌더 경로**를 grep 하고 말할 것.
- 시안에 QR·절취선을 넣었는데 실제 완료 화면엔 그게 없다. 구현에서 뺐다.

## 남은 결정
- 2~6번 시안 선택 · 완료 화면에 QR 을 넣을지(별도 디자인 결정) · 로딩 유달이는 로딩 잠금 승인 사항.

---

## 2차 — 시안 전부 적용 (대표 *"이전에 만든 모션그래픽 다 적용해줘"* + D 묶음 `AskUserQuestion` *"셋 다 넣기"*)

### 적용한 것 (공용 CSS = `src/index.css` "작은 움직임 키트")
| 시안 | 실제 위치 | 비고 |
|---|---|---|
| 유달이 몸짓(빈 화면·연결 끊김·가입 환영·검색 0건·404·선물) | `components/mascot/Udal.tsx` `GESTURE` 표 — `motion` 이면 등장→몸짓→둥실 | 화면이 아니라 **mood 가 몸짓을 정한다**. `motion` 없던 SearchStates·list-load-error·ErrorBoundary 에 켬 |
| 찜 하트 | `deal/WishlistHeart.tsx`(점 6개 + "찜했어요") · `WishlistButton.tsx`(톡) | |
| 리뷰 별점 | `product-detail/ProductReviews.tsx` | 차례로 톡톡 |
| 이용권 담기 | `curator/PinButton.tsx` | 아이콘 도장 |
| 사용 완료 도장 | `my-vouchers/QRModal.tsx` | **보는 중에 찍힐 때만**(폴링 전환) + 진동 |
| 사장님 사용처리 성공 | `voucher/VoucherScanner.tsx` | 결과 카드 올라옴 + 체크 톡 |
| 사장님 새 알림 | `seller-section/StoreNotifications.tsx` | 봉투 흔들림 + 숫자 톡 |
| 오늘 매출 | `user-profile/SellerSection.tsx` + `hooks/useCountUp.ts` | 값 도착 때 한 번 |
| 🔒 하단 탭 누름 | `main/BottomNav.tsx` | 클릭에서만 |
| 🔒 목록→상세 사진 이어짐 | `main-home/GroupBuyFeedCard.tsx` + `group-buy/DetailGallery.tsx` + `lib/deal-view-transition.ts` | View Transitions, 상세 첫 장 대기 300ms 상한 |

잠금 기록: `docs/locks/loading/2026-11-02-motion-tabs-deal-transition.md` · 가드 `motion-kit-2026-11-02.test.ts` 11건(주입 3건 빨간불 확인).

### 적용 안 한 것과 이유
- **링크 복사 알림**: 토스트가 이미 `animate-slide-down` 으로 올라온다 — 할 일 없음.
- **쿠폰 받기**: `CouponClaimPage` 에 이미 꽃가루가 있다.
- **딜 선물 숫자**: 딜 선물 도착 전용 화면이 없다(알림만). 선물 받기(`GiftClaimPage`)는 유달이 깡총으로 적용.
- **소개 흐름(/partners)**: 이미 스크롤 스토리(`StickyStory`)가 있고, 점·선 타임라인은 2026-10-31 에 "AI 랜딩 그림" 으로 **일부러 걷어냈다**. 시안 6을 넣으면 그 결정을 되돌린다.
- **마감 카운트다운**: 상세의 CountdownRing 은 2026-06-16 에 제거됨, 남은 카운트다운은 죽은 `MainHomePage` 에만.

### 이번에 틀렸던 판단
- 동적 클래스(`ur-udal-g-${x}`)는 죽은 CSS 검사가 "안 쓰는 클래스" 로 본다 → **클래스 이름을 문자열 그대로** 표에 둔다.
- Udal 의 몸짓 타입을 `'a' | 'b'` 로 쓰자 기존 시험(`| '이름'` 개수로 mood 를 셈)이 깨졌다 — 같은 파일의 유니온 문자열은 다른 시험의 측정 대상일 수 있다.

### 다음 세션 첫 액션
배포 뒤 폰(크롬·사파리 18+)에서: 홈 카드 → 상세 사진 이어짐 · 하단 탭 누름 · 내 이용권 빈 화면 유달이 · 404 유달이.
`node scripts/probe-loading.mjs /group-buy/<id>` 로 클릭~첫 사진 시간이 늘지 않았는지.

### 🔁 정정 — 유달이 몸짓은 뺐다 (2026-11-02 대표 *"유달이 움직이는건 더 쓰지 말자"* → *"유달이는 빼고"*)
`Udal.tsx` · SearchStates · list-load-error · ErrorBoundary 는 main 과 같게 되돌렸고, `ur-udal-g-*` CSS·시험·주입도 지웠다.
유달이는 종전 둥실(`ur-udal-bob`) 그대로다. **다시 몸짓을 넣지 말 것**(벡터 리그 시안도 보류 — 쓰지 않기로 했다).

## 3차 · 4차 적용 (대표 *"모두 좋다 그렇게 해줘"* · *"좋다 다 해주고"*)
표: `docs/design/motion-mockups-2026-11.md` "3차 · 4차". 가드 `motion-kit-2026-11-02` 15건 + 주입 4건(전부 빨간불 확인).
- 기존 시험 3건을 **의도는 그대로** 넓혔다: 정가 취소선(`line-through` 또는 `.ur-strike`) · 지갑 줄 배선(`onOpen()` 을 감싼 핸들러) — 주입 지도 4건도 새 앵커로.
- 서버 변경 하나: `reviews.routes.ts` 응답에 `reward_amount`(실제 적립액). 적립 로직은 불변.
- 안 한 것: 목록 첫 등장(첫 화면 지연) · 당겨서 새로고침(브라우저 자체 동작과 겹침) · 내 이용권 탭 밑줄(잠금 파일).
### 이번에 틀렸던 판단
- 테스트가 className 을 **따옴표 문자열**로 읽는다(`className="…"`) — 템플릿으로 바꾸면 그 검사가 깨진다. 조건은 `style` 로 빼라.
- 공용 시트의 닫힘 클래스는 등장 클래스 **뒤에 정의**해야 같이 붙어도 이긴다(시험이 원래 클래스 문자열을 고정한다).

## CI 빨간불 수리 — 화면별 첫 화면 무게 예산(`check-surface-budgets`)
- 증상: Verify 의 `Per-surface first-screen weight budget (strict)` 22건 실패(공용 +1.9 · 마이 최대 +7.9KB, 허용 +1.5).
- 원인과 처방(측정 순서대로):
  1. `src/hooks/useCountUp` 을 리뷰 폼(상세 청크)과 마이가 함께 써서 **마이가 상세 청크를 통째로** 받았다 → 훅을 `pages/user-profile/useCountUp.ts` 로 옮기고 리뷰 폼은 6줄 자체 카운터. (`src/hooks/*` 는 공용 유틸 청크로 묶인다.)
  2. 장바구니 수량 굴림이 장바구니를 상세 청크에 묶었다 → 장바구니만 굴림 제거.
  3. 키트 CSS 가 index.css 에 있어 모든 화면 +1.2 → **부품 파일 안 문자열 + `lib/motion-css.ts` `injectMotionCss`**. 🩸 중간에 `.css` 파일 import 로 나눴더니 묶음기가 그 CSS 를 따라 청크를 재편해 **마이가 상세 청크(19KB)를 받는 더 나쁜 결과** — CSS import 는 청크 묶음에 영향을 준다. 공유 상수 모듈도 공용 청크로 간다 ⇒ 부품마다 문자열을 둔다.
  4. 목록→상세 전환 CSS 는 `deal-view-transition.ts` 가 꽂는다. 그 파일을 동적 import 로 미뤄도 묶음기가 공용 청크에 그대로 둬서 이득 0 → 되돌림.
  5. 남은 증가(공용 +0.7~0.8 · 상세 +2.2 · 마이 +2.4)는 `--rebaseline --reason` 으로 기록. ⚠️ **main 자체가 이미 기준 대비 +1.0** 이었다(다른 세션 누적) — 측정은 main 워크트리 빌드와 나란히 비교해서 내 몫만 셌다.
- 6. 그 뒤 `chunks`(surface-chunk-runtime) 빨간불: 지도 첫 화면 청크 29 → 30. 공용 도우미 `lib/motion-css.ts` 를 **묶음기가 따로 청크로 뺐다**(lazy 부품만 쓰니 app-utils 에 안 남았다). ⇒ 각 부품에 **한 줄짜리** `injectMotionCss` 를 둔다(줄 수 불변). 이제 지도 29 · 이용권 상세 32→31.
- 🧭 교훈: 이 레포에서 "공용 모듈로 빼기" 는 공짜가 아니다 — CSS import·상수 모듈·작은 도우미 모두 묶음기가 청크를 다시 짠다. **바꾼 뒤엔 `check-surface-budgets` 와 `check-surface-chunk-runtime` 을 로컬에서 둘 다 돌릴 것**(빌드 필요).

## 5차 적용 + 🩸 큰 실수 하나 바로잡음
- 적용: 표는 `docs/design/motion-mockups-2026-11.md` "5차". 로컬 확인: 무게 예산 27화면 통과 · chunk-runtime 6화면 통과.
- 🩸 **이번에 틀렸던 판단(가장 값진 것)**: 키트 CSS 를 파일 → 부품 안 문자열로 옮길 때 스크립트로 "그 클래스 이름이 든 줄" 을 뽑았는데,
  **여러 줄짜리 동작 줄이기 규칙의 조각**(`.ur-strike::after, .ur-blink-once, .ur-shake { animation: none !important; }`)이
  조건(@media) **밖으로** 딸려 들어갔다 ⇒ 정가 줄 긋기 · D-day 깜빡임 · 입력칸 흔들림 · 사진 올리기 · 선물 상자가
  **모든 사람에게서 안 움직였다**(에러·시험 실패 0). 5차 중 발견해 지웠고, 가드(`motion-kit` "끄기 규칙은 조건 안에만")와 주입 1건을 더했다.
  ⇒ 기계적으로 CSS 를 옮길 때는 **옮긴 결과를 선택자 단위로 출력해 눈으로 볼 것**.
- 안 한 것(대표 결정 필요): 지도 다시 찾기 버튼 · 남은 수량 막대 · 이번 달 목표 · 가게 설정 진행.

## 6차 적용 (대표 *"다 넣어줘 허락할게"*)
표: `docs/design/motion-mockups-2026-11.md` "6차". 11개 중 **8개 적용**, 3개는 지금 화면에 자리가 없어 보류(단골 버튼 — 09-02 방문자 버튼 금지 결정 · 이용권 진행 단계 — 새 구역 · 공유 수단 등장 — 카카오/폰이 그리는 창).
- 가드 `motion-kit-2026-11-02` 24건 + 주입 4건 추가(전부 빨간불 확인). 화면 무게: 홈만 기준 갱신(`surface-budgets-history/2026-11-02-home.json`).
- 🩸 **이번에 잡은 결함**: 옛 공용 끄기 규칙의 선택자 조각(`.ur-slam, … .ur-flash,`)이 여섯 파일의 CSS 문자열 앞에 붙어 `…,@media(…)` 가 돼 있었다 — 브라우저가 규칙을 통째로 버려서 **동작 줄이기를 켠 사람에게도 움직였다**(에러 0). 5차 때 "끄기 규칙 누수" 를 고치며 *조건 밖 `animation:none`* 만 시험했고 이 모양은 못 봤다. 이제 레포 전체의 `injectMotionCss` 문자열에서 `,@media` 를 막는다.
- ⚠️ 결제 버튼은 도는 원만 넣었다(성공 체크·실패 흔들림은 신호가 없다 — 성공이면 토스로 넘어가고, 버튼이 다시 켜지는 것은 실패와 취소를 구분 못 한다). 잠금표 파일(Toss·로딩)은 하나도 안 건드렸다.

## 잠금 파일 허가분 (대표 *"허락해줄게 잠금 파일 부분도"*)
- `MyVouchersPage.tsx` 지갑 탭 밑줄 미끄러짐(3차 보류분) — `docs/locks/loading/2026-11-02-motion-wallet-tab-bar.md`
- `PaymentSuccessPage.tsx` 결과 카드 올라옴 · 승인 실패 경고 흔들림 — `docs/locks/toss/2026-11-02-payment-result-motion.md` (결제 로직 byte-불변)
- 잠금 밖 `PaymentFailPage.tsx` 도 같은 움직임(손님 취소는 안 흔듦). 유달이는 그대로.

## 7차 + 최적화 (대표 *"7차도 다 해주고, 셋 다 해줘"*)
표·결과: `docs/design/motion-mockups-2026-11.md` "7차". 11개 중 9개(카운트다운·카테고리 타일은 화면에 없다).
- 🩸 **이번에 틀릴 뻔한 판단**: 전환 코드를 동적 import 로만 바꾸면 갈라질 줄 알았다 — `vite.config` 의 `/src/lib/` 규칙과
  `surface-chunks` 묶음기가 다시 `lz-common` 으로 모았다(파일 해시까지 그대로). 두 군데(vite 규칙 + `LAZY_ENVELOPES`)를 다 고쳐야 갈라진다.
- 🩸 같은 이름의 `injectMotionCss` 는 **먼저 불린 쪽만** 꽂힌다 — 이름이 같고 내용이 다르면 뒤 화면 움직임이 조용히 사라진다. 지금은 셋 다 같은 내용(실측)이고 가드가 막는다.

## 8차 + 홈 지도 버튼 (대표 *"A, D, E 빼고 … QR 화면 밝아짐 빼고 다 넣어줘"*)
표: `docs/design/motion-mockups-2026-11.md` "8차". 지도 버튼 B·C + 8차 6개 적용, 나머지는 기능이 없어 보류(표에 이유).
- 🩸 공용 `RollingNumber` 를 검색 화면에서 import 하자 검색이 상세 묶음을 끌고 와 +2.8KB — 작은 화면엔 그 부품을 쓰지 말고 자체 한 줄 CSS 로.

## 9차 + 마이 + 결제창 안 A (대표 *"응 다 해주고"*)
표: `docs/design/motion-mockups-2026-11.md` "9차". 결제창은 **안 A(추천)** 로 넣었다(대표가 A/B 를 고르지 않아 추천안 — B 로 바꾸려면 티켓 밴드만 얹으면 된다).
- 🩸 확인 창·결제창은 새 키프레임 대신 공용 `.ur-sheet-in`/`.ur-sheet-out` 을 썼다 — 확인 창은 모든 화면이 싣는 셸에 있어서다(새 CSS 0).
- 🩸 끌어 닫는 시트에서 `setClosing(true)` 를 부르면 `.ur-sheet-out` 애니메이션이 인라인 transform 을 덮어 창이 튄다 — 시험이 막는다.
- 하단 구매 바는 **시안만**(안 1 추천) — 대표 선택 대기.

## 홈 밀림(shift 🔴) 수리 — 2026-11-02 대표 "모두 고쳐서 라이브에 모두 반영해줘"
- 원인: 모바일 안 1(#2117)이 유어쇼츠를 **둘째 섹션 뒤**로 옮겼는데, 섹션을 기다리는 자리(placeholder)는
  섹션 **하나** 뒤에 레일을 그렸다 → 응답 순간 레일 +841px. 동시에 하네스가 `/api/sections` 를 빈 배열로 줘서
  [자리 → 0건이라 자리 걷기] 라는 라이브에 없는 경로를 탔다(문서 4867→2126).
- 처방: `HomeSections` 자리 분기에서 `shortsAfter>0` 이면 레일을 안 그린다(배너만) · 하네스에 섹션 둘 스텁.
- 판정: `node scripts/check-layout-shift.mjs` 전체 ✅ 밀림 0(홈 🟡 화면 밖만). 주입 5건 빨간불 확인.
- 틀린 판단: 처음엔 "하네스 빈 섹션 탓" 으로만 봤다 — 스텁을 고치자 **진짜 +841px 밀림**이 드러났다.

## 10차 모션 (2026-11-02 대표 "모두 다 해줘")
- 구현 ①검색 제안 차례 등장 ②최근 검색어 지우기(사라짐 + FLIP) ③숙소 달력 범위 칠하기·N박 ④숙소 추천 줄(들어올 때만)
  ⑤견적 채팅 새 말풍선 ⑥생활 요청 단계 막대·넘김 ⑦참여권 숫자 굴림·+N장 ⑧별점 차례 튐(숙소 리뷰·생활 후기).
- 제외 ⑨(iOS 사파리 setState 금지 + 이미 전체 로딩) ⑩(이용권 주문은 단계가 하나뿐) — 근거 `docs/design/motion-mockups-2026-11.md`.
- 가드: `motion-kit-2026-11-02.test.ts` 🔟 블록 8건.

## 11차 모션 (2026-11-02 대표 "전부 다 해주고")
- 구현 ①⑩ 홈 카테고리 밑줄 미끄러짐 + 목록 떠오름 ② FAQ 부드럽게 펼침 ③ 블로그 읽기 막대 ④ 딜 내역 차례 등장 ⑤ 단골 해제 접힘
  ⑥ 유어샵 수익 막대·금액 ⑧ 유어쇼츠 목록 차례 등장 ⑨ 설정 스위치 늘어남·튐. 제외 ⑦(가입 화면에 전체 동의가 없음).
- 가드: `motion-kit-2026-11-02.test.ts` 1️⃣1️⃣ 블록.

## 12차 모션 (2026-11-02 대표 "1,9,10번 정도")
- ① 사용 방법 차례 켜짐(C안 한 줄 유지) ⑨ 공유 버튼 복사 체크(복사됐을 때만) ⑩ 딜 쓰기 알약·금액 굴림. 가드 1️⃣2️⃣ 블록.
- 대기: ①의 '그림 셋' 버전 여부(오늘 C안을 되돌리는 일).

## 13차 모션 (2026-11-02 대표 "모두 다 해줘")
- ①홈 고정 막대 내려옴 ②알림 모두 읽음 차례로 ③쿠폰함 ④⑤생활 홈 순서·타일 ⑥고수 요청함 탭 밑줄 ⑦유어샵 스크롤 진입 줄(처음 보이는 줄 무접촉)
  ⑧프로필 저장 줄 체크 ⑨사장님 정산 숫자 굴림(처음 도착 때만) ⑩지도 시트 손잡이·되튐 스냅. 가드 1️⃣3️⃣ 블록.
- ⚠️ 묶음 교훈: 상세 화면 파일이 공용 부품(QrScanIcon·RollingNumber)을 새로 부르면 묶음기가 그 부품을 상세 묶음에 넣어
  같은 부품을 쓰는 마이(+20KB)·생활 고수(+4KB)가 상세 묶음을 통째로 받는다 → 화면 안에 따로 그렸다(689ca1a9e 직전 커밋).

## 로딩 화면 개편 (2026-11-02 대표 "유달이 뜨는게 별로 … 위쪽 얇은 막대 + 화면 모양 미리 보여주기로")
- SSOT `src/shared/brand-loader-markup.ts` 한 벌을 워커 정적 로더 · BrandLoader · index.html · 카카오 오버레이가 같이 쓴다.
- 잠금 기록 `docs/locks/loading/2026-11-02-loader-topbar-skeleton.md`. 다음 단계 후보: 화면별 모양(상세·마이) — 지금은 카드 목록 모양 하나.
