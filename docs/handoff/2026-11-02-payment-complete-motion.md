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
