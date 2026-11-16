# 2026-11-16 운영사 영입 매장 = 직접 10%

대표 *"내 유어딜 계정 있지? 그걸로 매장 영입할 때는 그렇게 해줘."* — 결재 `docs/decisions/2026-11-16-operator-recruited-stores-direct.md`.

## 한 것
- `ledger-commission-policy.ts`: `PLATFORM_OPERATOR_USER_IDS=[3]` + `operatorBrokeredAsDirect()` — `channelPlatformRate` 가 중개사=운영사인 중개 매장을 10% 로 판정(요율 판정의 단일 지점).
- `broker-share.ts`: 운영사에게는 중개사 몫 적립 안 함.
- 시험 `operator-recruited-direct-2026-11-16.test.ts`(가짜 DB 로 실제 함수 실행) + 주입 3건 빨간불 확인.

## 이번에 틀릴 뻔한 것
- 요율 판정은 `fee-resolver` 의 `ctx.storeChannel` 이 아니라 `channelPlatformRate` 다(`storeChannel` 을 채우는 호출부가 0).

## 남은 것
- 14번 매장(중개사 없음, 판매 중) 처리 · 에이전시 1(리스터코퍼레이션) 정체 · 23·24·29(직접인데 에이전시 2 연결) — 대표 확인 대기.
- 정산 10% 실측은 staging 실결제 또는 26번 다음 주문의 원장으로 판정(E4).

## 2차 (같은 날)
대표 *"리스터코퍼레이션 내 회사야. 그리고 이제 유어팀으로 회사명도 바꼈어."* → `PLATFORM_OPERATOR_AGENCY_IDS=[1]`: 그 에이전시가 active 로 맡은 중개 매장도 10%, `creditAgencyShare` 는 몫 없이 matched 반환(중개사 몫도 막음). 에이전시 이름 변경은 에이전시 콘솔 설정(`agency-staff.routes.ts`)에서 대표가 직접 — 어드민 경로 없음.
