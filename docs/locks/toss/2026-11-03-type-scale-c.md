# [UNLOCK] 2026-11-03 — 글자 체계 안 C (클래스만)

- 대표 허가: AskUserQuestion *"결제 잠금 파일 3개도 글자 크기·굵기가 바뀌어요 … 함께 바꿀까요?"* → **"허가 — 함께 바꿔"**
- 배경: 대표 *"안 C, 레포 규칙 허용도 할게. 모든 페이지들에 적용해줘"* — 큰 글자 한 단계 가볍게(17→16 · 24→20 · 28 글자→24 · 800→700 · 제목 600).
- 파일: `src/components/payments/TossPaymentWidget.tsx` · `src/pages/PaymentSuccessPage.tsx` · `src/pages/TossWidgetPayPage.tsx`
- 변경 범위: **className 의 `text-[Npx]`·`font-*` 토큰만.** 결제 호출·금액·SDK·리다이렉트 무변경.
- 도구: `scripts/codemods/type-scale-c.mjs` → `scripts/codemods/weight-scale.mjs`
