# 2026-11-09 [UNLOCK] 결제 웹훅은 확정 전에 Toss 결제 조회로 본문을 대조한다

- **잠금 파일**: `src/worker/routes/webhook.routes.ts` (`handlePaymentConfirmed`) · `src/worker/utils/toss-gateway.ts` (`getTossPayment` **추가** — 기존 함수 무변경)
- **대표 승인**: 보안 전수조사 보고(웹훅 위조로 공짜 주문 — 라이브 `TOSS_WEBHOOK_IP_ALLOWLIST` 미설정 실측) 후
  *"모두 다 순서대로 진행해줘"* (2026-11-09) — 수정 순서 7번 항목.
- **docs**: https://docs.tosspayments.com/reference — `GET /v1/payments/{paymentKey}` "paymentKey로 결제 조회"
  (결제창형·주문서형 키 `*_gsk` 로도 호출 가능. orderId 조회는 `*_gsk` 불가라 쓰지 않았다).

## 무엇을 왜

V2 결제 웹훅엔 서명 헤더가 없다(2026-05-24 graceful 정책 — 그대로 둔다). 그래서 본문 금액을 DB 합계와 대조하는 것이
유일한 검사였는데, 공격자는 **자기 주문의 번호와 금액을 안다** — 결제 없이 `status:DONE` 본문만 보내면 확정·커미션 적립·
KT 교환권 실발송까지 진행됐다. IP 허용목록(`TOSS_WEBHOOK_IP_ALLOWLIST`)은 라이브에 없다(2026-11-09 Cloudflare API 실측).

→ 확정 직전에 Toss 에 그 결제를 조회해 **DONE · 같은 주문번호 · 같은 금액**일 때만 확정. 조회 실패·키 없음도 확정하지 않는다
(정상 결제는 `/confirm` 동기 경로가 이미 확정했고, Toss 는 웹훅을 재시도한다). 입금 알림처럼 본문에 paymentKey 가 없으면
`orders.toss_payment_key` 로 조회한다.

## 불변으로 지킨 잠금 항목

- 서명 graceful 정책(헤더 있으면 검증 · 없으면 통과)·IP allowlist·idempotency·금액 대조·`confirmPaymentAtomic` 이후 부수효과 전부 그대로.
- `confirmTossPayment`·`cancelTossPayment`·`detectTossKeyType`·`decideTossFlow` 무변경.

## 가드

`src/tests/unit/webhook-payment.test.ts` — 조회가 없는 결제·DONE 아님·다른 주문·금액 다름 4경우에 `confirmPaymentAtomic` 미호출,
정상 조회면 호출. 주입 `[sec] 웹훅이 Toss 조회 불일치에도 확정한다` 빨간불 확인.

## ⚠️ 남은 검증 (머니 경로 — CLAUDE.md 단독 세션 + staging 실결제 룰)

- staging 실결제 1회: 카드 결제 → `/confirm` 확정 후 Toss 웹훅이 와도 `ORDER_ALREADY_CONFIRMED` 로 끝나는지,
  웹훅만으로 확정되는 경로(가상계좌 입금 등)가 조회 후 정상 확정되는지. `docs/STAGING_CHECKLIST.md` 에 등록.
- 롤백: 이 커밋 revert.
