# 2026-11-16 운영사 영입 매장 = 직접 10%

대표 *"내 유어딜 계정 있지? 그걸로 매장 영입할 때는 그렇게 해줘."* — 결재 `docs/decisions/archive/2026-11-16-operator-recruited-stores-direct.md`.

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

## 3차 (같은 날)
대표 *"14번은 내가 했어. 뽀야네 하우스는 자기들이 들고온게 맞아."*
- 유어팀 에이전시 콘솔로 등록하는 매장은 저장값부터 `direct`(`agency-store-register.ts`) — 사장님 화면·어드민 화면이 5% 를 보여 주던 어긋남 제거.
- 기존 매장 14·20·25·26 의 저장값 `direct` 전환은 어드민 PATCH 를 세션이 시도했으나 권한 검사에 막힘 → 대표가 `/admin/store-channel` 에서 직접. (20·25·26 은 실행 시점 규칙으로 이미 10%, 14 는 저장값을 바꿔야 10%.)
- 23·24·29(뽀야네 하우스가 데려옴, 저장값 direct=10%)는 정책상 중개 5% 대상 — 대표 판단 대기.

## 4차 (같은 날)
- 라이브 데이터 정정(어드민 PATCH, 대표 "너가 직접 해줘"): 23·24·29 → brokered, 14·20·25·26 → direct. D1 재조회로 확인.
- 대표 "내가 하더라도 5%로 하고 싶은 곳은…" → `channelPlatformRate` 의 실행 시점 덮어쓰기 제거(저장값 정본). `operatorRegisterChannel()` + 등록 카드 수수료 선택(유어팀만, `/me` 의 `agency.isOperator`). 중개사·에이전시 몫을 운영사에게 안 주는 규칙은 유지.
