# 2026-11-23 — 주문번호 시험이 우연히 실패해 배포를 막던 것 (유어딜 소비자 · 시험만)

[E2] 시험 수정 · 로컬 22/22 통과 · 되돌려-검증 완료. 머니 경로 접촉 없음(시험 파일 1개).

## 무엇이었나
- `src/tests/unit/orderIdGenerator.test.ts` 의 "returns unique values on successive calls" 가
  진짜 난수로 "50개가 전부 다르다" 를 단언했다. 뒤 6자리는 900,000 가지, 50번은 같은 1초 안이라
  겹칠 확률 ≈ 50·49/(2·900,000) ≈ 0.14%(약 730번에 한 번).
- 2026-11-23 배포 run 45191275420(커밋 4c28fa2c) "단위 시험 4/4" 가 `expected 49 to be 50` 으로 멈춰 배포가 건너뛰어졌다.

## 한 것
- 그 시험을 난수 고정(`crypto.getRandomValues` 스텁 + 시계 정지) 시험 3개로 교체.
  ① 같은 1초에도 난수가 다르면 번호가 다르다 ② 뒷자리는 호출마다 `crypto.getRandomValues` 에서 온다
  ③ 900,000 범위 양 끝이 다 나온다. 형식(18자리·날짜 접두)은 안 바꿨고 생성기 코드는 무수정.
- 되돌려-검증: 생성기 뒷자리를 `rnd % 10` 으로 망가뜨리면 3건 모두 빨강 → 복원.

## 제품 쪽 판정 (실측) — 번호가 실제로 겹치면?
- 호출처는 `TossPaymentWidget.tsx:238` 하나(쇼핑 결제). 공구·숙소·광고는 서버의 `generateTossOrderId` 를 쓴다(다른 함수, 잠금 파일 — 안 건드림).
- 라이브 D1: `orders.order_number TEXT UNIQUE NOT NULL`. 다른 사람과 겹치면 주문 INSERT 가 실패하고
  재고·쿠폰이 복원된다(결제 전 단계). `/confirm` 도 주문의 `user_id` 가 본인인지 본다. ⇒ **돈이 잘못 가는 구멍은 없다.**
  최악은 "주문 생성 실패 → 다시 누르면 새 번호".

## 틀렸던/주의할 판단
- `live-schema.snapshot.json` 은 컬럼 이름만 있어 UNIQUE 여부를 못 알려준다. `sqlite_master` 를 직접 봐야 했다.

## 남은 것 (대표 판단 · 이 PR 범위 밖 · 미검증)
- `useBeforePayment.ts` 는 판매자 그룹마다 **같은** `order_number` 로 `/api/orders` 를 부른다. 라이브가 UNIQUE 이므로
  판매자가 둘 이상인 장바구니는 두 번째 주문 생성이 실패할 것으로 읽힌다(코드 읽기만, 재현 안 함. 쇼핑탭은 현재 숨김).
  머니 경로라 손대지 않았다.

## 이어받는 세션의 첫 액션 (대표가 이어서 하라고 했을 때만)
- `npx vitest run src/tests/unit/orderIdGenerator.test.ts` → 22건 통과면 끝. 위 "남은 것" 은 staging 에서 판매자 2곳 장바구니로 재현부터.
