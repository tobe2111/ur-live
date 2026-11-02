# 모션 시안 여섯 자리 (2026-11-02)

대표 질문 *"서비스 페이지들 안에서 모션그래픽을 쓰기 좋을 것들 있나?"* → *"1번 정도만 시안"* →
*"응 그렇게 해줘. 그리고 다른 위치들 시안들도 다 보여줘."*

- 시안 원본(움직이는 HTML, 그대로 열면 재생): `docs/design/assets/motion-mockups-2026-11-02.html`
- 공유 페이지(비공개 아티팩트): https://claude.ai/artifact/VbTxbB5jJkvGQXESFLGrPH
- 공통 규칙: transform·opacity·clip-path 만 움직인다(밀림 0) · '동작 줄이기' 면 끈다 ·
  한 번 돌고 멈춘다 · 누르면 즉시 끝 · 브랜드 블루 하나, 체크 원·꽃가루·그라디언트 없음 ·
  유달이는 **기존 그림만** 쓴다(새 그림 생성 0 → 생성 철칙 대상 아님).

| # | 자리 | 움직임 | 길이 | 상태 |
|---|---|---|---|---|
| 1 | 이용권 결제 완료 | 제목 → 파란 띠 툭 → 본문 영수증처럼 펼침 → 가게·이름·금액(숫자 올라감) → 버튼 → 안내 | 1.4초 | 🟢 구현(아래) |
| 2 | 이용권 사용 완료(손님 폰) | "사용 완료" 도장 쾅 + 티켓 눌림 → 띠 회색·QR 흐려짐 → 도장 유달이 톡 | 1.6초 | 🟡 시안 |
| 3 | 빈 화면(이용권·찜 0) | 빈 지갑 유달이 올라와 두 번 갸웃 → 글·버튼 | 3.0초 | 🟡 시안 |
| 4 | 딜 선물·쿠폰 도착 | +5,000딜 숫자 올라감 → 내 딜 10,300→15,300 → 하이파이브 유달이 깡총 | 2.0초 | 🟡 시안 |
| 5 | 연결 끊김 | 케이블 유달이 두 번 당김 · 다시 시도 아이콘 회전 | 2.0초 | 🟡 시안 |
| 6 | 소개 흐름(/partners 등) | 손님 → 이용권 → 매장 원이 차례로 켜지고 선이 이어짐 | 2.6초 | 🟡 시안 |

## 바꾼 판단
- 처음 제안 5번 "로딩 중 유달이" → **연결 끊김**으로 바꿈. 로딩 잠금(첫 페인트 표준)이 로더를
  BrandLoader 하나로 정해 두었다 — 바꾸려면 `[UNLOCK_LOADING]` 승인이 필요하다.
- 1번 시안 v1(3.5초, QR 칸 300개 개별 움직임) → 대표 지적(부담·대기) 반영해 1.8초 · 누르면 즉시 끝 ·
  QR 한 장 드러내기. 실제 화면에는 QR·절취선이 **원래 없어서** 그 두 단계는 구현에서 뺐다
  (완료 화면에 QR 을 넣는 것은 별도 디자인 결정).

## ✅ 구현 완료 — 1번
- `src/pages/group-buy/PaymentCompleteTicket.tsx` (`useTicketMotion`) + `payment-complete-motion.css`
- 가드 `src/tests/unit/payment-complete-motion-2026-11-02.test.tsx`(7건, 주입 2건 빨간불 확인)
- 결제 처리·잠금 파일 무접촉(이 부품은 잠금표 밖이다).

## 작은 움직임 열네 가지 (같은 날 2차 — 대표 *"다 한번 시안 만들어볼래?"*)
- 시안 원본: `docs/design/assets/micro-motion-mockups-2026-11-02.html` · 공유: https://claude.ai/artifact/1iyHahHtDA8M5vc5gnFhx4
- **A 누르는 반응**: 찜 하트(톡 커짐 + 점 여섯 개) · 리뷰 별점(차례로 채움) · 쿠폰 받기(내 쿠폰으로 날아감, 숫자 2→3) · 유어샵 링크 복사(알림) · 이용권 담기("추천" 배지 도장)
- **B 사장님**(유달이 금지 자리라 그림 없음): 사용처리 성공(스캔 줄 → 파란 원 + 체크 + 진동) · 새 주문(종 흔들림, 숫자 3→4, 줄 미끄러져 들어옴) · 오늘 매출(숫자 올라감 + 일주일 막대)
- **C 첫 만남**: 가입 환영(stand 유달이 인사) · 검색 0건(curious 두리번) · 404(cable 걸어 들어옴)
- **D 승인 필요(로딩 잠금)**: 하단 탭 선→면 전환 · 마감 카운트다운 숫자 넘김 · 목록→상세 사진 이어짐
- 상태: 🟡 전부 시안, 대표 선택 대기

## 3차 · 4차 (같은 날 — 대표 *"모두 좋다 그렇게 해줘. 유달이는 빼고"* → *"좋다 다 해주고"*)
- 시안: `assets/motion-mockups-3-2026-11-02.html`(https://claude.ai/artifact/MT8Lh7LMBeu72xKiBYoboh) · `assets/motion-mockups-4-2026-11-02.html`(https://claude.ai/artifact/E9UeMT2dxVDykayXpeerum)
- 🦦 **유달이 움직임은 쓰지 않는다**(대표 확정). 1~2차에 넣었던 상황별 몸짓도 뺐다.

| 시안 | 적용 위치 | 상태 |
|---|---|---|
| 탭 밑줄 | `curator-page/PinCategoryChips.tsx`(유어샵) | 🟢 측정 뒤에만 움직이는 막대로 교체(첫 화면 불변) · 내 이용권 탭은 잠금 파일이라 보류 |
| 올라오는 창 통일 | 공용 `seller-section/Sheet.tsx` 닫힘 애니메이션 + 등장 없던 시트 9개에 `.ur-sheet-in` | 🟢 |
| 지도 핀 | `useKakaoMap.ts`(핀 톡) · `SelectedDealCard.tsx`(카드 올라옴) | 🟢 |
| 이용권 → QR | `my-vouchers/qr-origin.ts` + WalletRow · QRModal | 🟢 부모(잠금 파일) 무접촉 |
| 리뷰 리워드 | ProductReviews + 서버 응답 `reward_amount`(실제 적립액, 건너뛰면 0) | 🟢 |
| 수량 굴림 | `ui/RollingNumber.tsx` → 딜 하단바·PC 구매칸·상품 상세 2곳·장바구니 | 🟢 |
| 목록 첫 등장 | — | ⛔ 첫 화면을 서버가 그린다(로딩 잠금) — 흐리게 시작하면 보이는 시점이 늦어진다 |
| 등록 완료 · 정산 · 주문 상태 | SellerMealVoucherNewPage · PayoutSheet · MobileOrderList | 🟢 |
| 할인가 줄 긋기 | `group-buy/PassHeadCard.tsx` `.ur-strike` | 🟢 |
| 머리 줄어듦 | `DetailFloatingHeader` | ✅ 이미 있다(스크롤 시 제목이 위 막대로) |
| 장바구니 담기 | `lib/fly-to-cart.ts` → `[data-cart-icon]`(PC 네비 · 상품 머리) | 🟢 아이콘이 화면에 없으면 알림만 |
| 선물 완료 | GiftVoucherSheet(방금 만든 링크일 때만) | 🟢 |
| D-day 깜빡 | WalletRow(임박만, 한 번) | 🟢 |
| 입력칸 흔들림 | ProductReviews(글자 수 모자람) | 🟢 |
| 버튼 처리 중 | profile-edit `RowActions` | 🟢 |
| 당겨서 새로고침 | — | ⛔ 모바일 브라우저 자체 당겨서 새로고침과 겹친다 |
| 판매 스위치 · 사진 올리기 · 매장 바꾸기 | VoucherRow · PhotoGalleryEditor · SellerSection(`useCountUp` resetKey) | 🟢 |
