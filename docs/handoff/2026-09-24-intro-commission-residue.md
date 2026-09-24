# 영입 커미션 잔재 정리 + 정산 레일 (2026-09-24)

## ➡️ 다음 세션 첫 액션

1. **대표가 켰는지 확인** — 어드민 `/admin/platform-settings` 머니 스위치 ⑨
   (`settlement_skip_ledgered`). 라이브 확인:
   ```sql
   SELECT key, value FROM platform_settings WHERE key = 'settlement_skip_ledgered'
   ```
   행이 없으면 아직 OFF. **Rail A 가 깨어 있는 상태이므로, 첫 이용권 사용 전에 켜는 것이 싸다.**
2. 그 뒤 첫 이용권 사용이 생기면 판정: `ledger_entries` 에 `voucher_used` 3행이 붙고
   `restaurant_settlements` 는 **안 늘어야** 한다(단일 레일 수렴 확인).

## ✅ 이번에 한 것

- `COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT` 2.0 → **0**
- `getStoreIntroPct` 의 `pct > 0` → `pct >= 0` (0-falsy 함정)
- 셀러 가이드 '영입 2%' 섹션 → 중단 안내 · 어드민 운영백서 동일 · `GUIDE_SEED_VERSION` 34 → **35**
- 가드 `intro-commission-off-2026-09-24.test.ts` 5건 + 주입 4건

## 🩸 이번에 내가 틀린 것 (제일 값지다)

**"영입 커미션이 켜져 있다"고 대표에게 보고했는데 이미 꺼져 있었다.** `platform_settings` 값이
`'2'` 인 것만 보고 단정했다. 실제로는 `creditInfluencerStoreIntroCommission` **호출부가 0개**다.

그리고 **이건 재발이다** — 2026-09-15 에 다른 세션이 똑같이 했고, 그 사건이
`store-intro-abolished-2026-09-16.test.ts` 머리말에 적혀 있었다. 나는 그걸 안 읽었다.

🧭 **머니 경로의 "켜져 있나"는 설정값이 아니라 호출부로 판정한다.** `grep -rn "<적립함수>" src/`
한 줄이면 됐다. 설정은 아무도 안 읽으면 그냥 남은 문자열이다.

🧭 **그리고 잔재를 남기면 사람이 또 속는다.** 오판의 원인은 사람이 아니라 폴백 상수 2.0 과
가이드 문구였다. 기능을 끌 때는 **폴백·문서·화면까지** 같이 꺼야 다음 사람이 안 헷갈린다.

## 🩸 두 번째: 내 가드가 헛돌았고 주입 러너가 잡았다

가이드 검사 ⑤ 가 두 군데서 헛돌았다.
1. `toContain('중단')` — **제목**에 '중단'이 있어서 본문을 통째로 지워도 통과
2. 정규식 `/매출의 \*\*2%\*\*/` — 원문은 `**매출의 2%**`(별표가 앞) → **매치 0**

⇒ 제목이 아니라 `content:` 이후만 자르고, 별표를 제거한 평문으로 검사하도록 교체.
그 과정에서 내 본문의 *직접 인용*("…드립니다")이 검사에 걸려, 인용을 간접 표현으로 바꿨다
(검사를 느슨하게 하면 진짜 약속이 돌아와도 못 잡는다).

## 🔴 코드 주석이 낡아 있다 (다음 세션 주의)

`auto-settlement.ts` 의 2026-08-02 실측 주석 — *"`restaurant_settlements` 테이블 없음 ⇒ Rail A 는
한 행도 만든 적이 없다"* — 은 **지금 사실이 아니다.** 테이블도 `vouchers.settlement_id` 도 있다.
누군가 어드민 정산 화면을 열어 `ensureSettlementTables()` 가 발동했다(그 파일이 경고한 경로).
⇒ **cron 이 매일 정상 진입한다.** 행은 아직 0이지만 구조는 무장돼 있다.

## ⏳ 남은 결정

| | 항목 | 상태 |
|---|---|---|
| 2 | `settlement_skip_ledgered = true` | **대표 실행 대기** — 세션 권한이 프로덕션 설정 쓰기를 막았다 |
| 3 | 부가세 별도(요율 ×1.1) | 세무사 질의 3건 대기. 요율과 약관 문구는 **같은 커밋**으로 |
| — | 매장 계좌번호 | 7곳 전부 `bank_account` NULL — 유보가 풀려도 이체 대상이 없다 |
