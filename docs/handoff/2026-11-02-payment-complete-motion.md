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
