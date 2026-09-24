# 이용권 정산을 한 레일(원장)로 모으는 스위치를 지금 켤까?

상태: open
등급: C
역할: finance
올린 날: 2026-09-24
기한: 2026-10-01

## 질문
`platform_settings.settlement_skip_ledgered` 를 **`true`** 로 켤까요?
(어드민 `/admin/platform-settings` → 머니 스위치 ⑨ "자동정산에서 원장 기록분 제외")

## 근거 (실측)

🔴 **코드 주석이 낡아 있었다.** `auto-settlement.ts` 의 2026-08-02 실측 주석은
*"`restaurant_settlements` 테이블 없음 ⇒ Rail A 는 단 한 행도 만든 적이 없다"* 인데, 지금은 다르다.

라이브 D1 직접 조회 (2026-09-24):

| | 2026-08-02 주석 | 2026-09-24 실측 |
|---|---|---|
| `restaurant_settlements` 테이블 | 없음 | **있음** |
| `vouchers.settlement_id` 컬럼 | 없음 | **있음** |
| Rail A 행 / `settlement_id` 채워진 voucher | — | 0 / 0 |
| 원장 `voucher_used` / `payouts` | — | 0 / 0 |
| `settlement_skip_ledgered` | — | **키 없음 = OFF** |

누군가 어드민 정산 화면을 열어 `ensureSettlementTables()` 가 발동했다 — 그 파일이 경고한
*"Rail A 는 화면 한 번으로 깨어난다"* 가 이미 일어났고, **cron 이 매일 03:00 KST 에 정상 진입한다.**

아직 사고는 없다(양쪽 0건). 하지만 **첫 이용권 사용부터** 같은 매출이 두 레일에 쌓이고,
두 레일은 서로의 멱등 마커를 안 본다 ⇒ 같은 매출을 두 번 지급할 수 있다.

요율 소스도 갈린다: Rail A 는 `commission_rate_meal_voucher`(항상 5%), Rail B 는
`channelPlatformRate()`(직접 10 / 중개 5).

## 선택지
1. **지금 켠다** — 즉시 변화 0(skip 대상 0건), 첫 사용부터 단일 레일 수렴. 머니 접촉: 있음(정산 경로).
2. **거래가 생긴 뒤 켠다** — 그 사이 쌓인 이중 적재분을 손으로 풀어야 한다. 머니 접촉: 있음.
3. **안 켜고 Rail A 를 코드로 막는다** — `ensureSettlementTables` 제거. 되돌리기 비싸고 범위가 크다.

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)
안 1. 지금이 가장 싸다 — 양쪽 0건이라 켜도 아무 값이 안 변하고, 나중엔 손으로 풀어야 한다.

근거: Rail B(원장)는 **게이트 없이 상시 기록**한다(`recordVoucherUsedLedger`, voucher 사용 직후
waitUntil). 즉 지급의 진실은 원장이고 Rail A 는 원장에 없는 것만 다루면 된다. 원장 기록이 실패한
voucher(merchant_id 0 등)는 skip 되지 않아 **Rail A 가 폴백**으로 남는다.

⚠️ 어드민 스위치 목록의 `turn_on_when` 은 *"그전엔 켜면 정산이 통째로 빠진다"* 고 경고하는데,
그 전제(Rail A 가 유일한 지급 경로)는 **지금 사실이 아니다** — 지급은 Rail B(원장→payouts)가 한다.

## 롤백
같은 스위치를 `false` 로 되돌린다(재배포 불필요, 즉시 반영).

## 결정 (대표가 한 말 그대로)

## 반영 커밋
