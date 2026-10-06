# `D1 Migration Auto-Apply` 는 **아무것도 안 하고 success 를 찍는다** — 머지 후 라이브 로그로 발견 (2026-10-06)

**[E2]** 측정됨(라이브 워크플로 로그 + D1 실측) · 가드 재조준 + 주입 2건 빨간불 확인.
워크플로 자체는 **고치지 않았다** — 고치면 main 푸시마다 프로덕션 스키마에 쓰기가 시작되므로 대표 판단 사항이다.

## 무엇을 알게 됐나

PR #1630(주문 85 소급 기록)을 머지하고 **"`d1-migrate` 가 `repair-schema` 를 자동 호출하니 사람이 누를 것이 없다"** 고
보고하려던 참에, 그 워크플로의 라이브 로그를 실제로 읽었다(run `37465121609`, job `112274111668`):

```
✘ [ERROR] Couldn't find DB with name 'ur-live'
⚠️ migrations/0289_vouchers_intro_stamp.sql 실패 (already applied?)
⚠️ migrations/fix_production_data.sql 실패 (already applied?)
⚠️ ADMIN_REPAIR_TOKEN 미설정 — repair-schema 호출 skip
→ job conclusion: success
```

**둘 다 미설정 시크릿이고, 둘 다 조용하다.**

| 무엇 | 실제 상태 | 왜 안 보였나 |
|---|---|---|
| 마이그레이션 적용 | **전부 실패** — 실제 이름은 `toss-live-commerce-db` 인데 기본값 `ur-live` 를 찾는다 | `\|\| echo "⚠️ 실패 (already applied?)"` 가 삼켜 **잡이 success** |
| `repair-schema` 호출 | **한 번도 안 됨** — `ADMIN_REPAIR_TOKEN` 미설정 | `else` 가지가 echo 만 하고 끝 |

실측한 실제 D1 이름(`wrangler.toml` 의 `DB` 바인딩과 일치):

```
d9530ba6-7a26-4c02-9295-3ce5aef112a3   toss-live-commerce-db   ← 라이브 본진
d154f5d8-3361-4498-b4b6-1c3ca946a228   ur-live-db              ← 이름이 비슷한 다른 DB (본진 아님)
```
⇒ 워크플로 기본값 `ur-live` 는 **어느 DB 와도 이름이 일치하지 않는다.**

## 🔴 `TECHNICAL_DEBT.md` TD-001 의 기록된 원인이 틀렸다(정정함)

TD-001 은 *"Cloudflare API token 에 `Account > D1 > Edit` 권한 추가 필요"* 라고만 적혀 있었다.
그 권한도 필요할 수는 있으나(CI 시크릿이라 세션이 못 읽어 **확인 못 했다**), **지금 로그가 내는 오류는 권한이
아니라 이름**이다. 권한을 추가해도 `ur-live` 를 찾는 한 똑같이 실패한다. 그리고 `ADMIN_REPAIR_TOKEN` 은
TD-001 에 **아예 언급이 없었다.**

## 소급 기록은 그래서 어떻게 도나 — **일간 cron 이 실제 보증이다**

`src/worker/cron/daily-lane.ts:112` 의 `schema-repair-daily` 가 `runSchemaRepair(env.DB)` 를 직접 부른다.
`scheduled.ts:307` → `runDailyLane('maintenance', …)`, 스케줄 `30 18 * * *` UTC = **03:30 KST**.

라이브 하트비트로 살아 있음을 확인했다:
```
cron_hb:schema-repair-daily → {"at":"2026-10-05T18:33:24Z","ok":true,"ms":175790,"q":364}   ← 10-06 03:33 KST
```
⇒ 소급 기록(주문 85)은 **늦어도 10-07 03:30 KST** 에 돈다. GitHub 시크릿과 무관하다.

## 이번에 고친 것 (가드 재조준 — 완화 아님)

`voucher-refund-backfill-2026-10-06.test.ts` 의 배선 단언이 **워크플로**를 보고 있었다. 문자열로는 참이지만
런타임엔 skip 되므로 **거짓 안심**이다. 지우지 않고 재조준했다:
- 신설 ①: `daily-lane.ts` 가 `runSchemaRepair(env.DB)` 를 부르는가
- 신설 ②: `scheduled.ts` 가 `runDailyLane('maintenance'` 를 등록하는가
- 기존(워크플로)은 **'보조 경로'** 로 남긴다 — 토큰이 채워지면 그날부터 다시 일하므로 배선은 지켜야 한다.

주입 2건 추가(`scripts/mutations/voucher-refund-backfill.mjs`, 7 → 9) — **둘 다 되돌려-검증 빨간불 확인**.
시험 16 → 18건 pass.

## 남은 대표 판단 (세션이 손대지 않았다)

1. **`D1_DATABASE_NAME` 시크릿** — `toss-live-commerce-db` 로 설정하거나, 워크플로가 `wrangler.toml` 에서
   읽게 코드를 고친다(시크릿 불필요). ⚠️ **고치면 main 푸시마다 프로덕션 D1 에 마이그레이션이 실제로 적용되기
   시작한다** — 지금까지 한 번도 안 돌던 것이 돌기 시작하는 것이라 쌓인 마이그레이션의 영향을 먼저 봐야 한다.
2. **`ADMIN_REPAIR_TOKEN` 시크릿** — 채우면 배포 직후에도 `repair-schema` 가 돈다(지금은 일간 cron 만).
   ⚠️ 이 워크플로는 **Pages 배포와 병렬**이라 채워도 호출이 옛 워커에 닿을 수 있다 — 순서를 보장하려면
   `needs:` 로 배포 완료를 기다리게 해야 한다(별건).
3. **`|| echo … 실패` 삼킴** — 실패를 삼켜 success 로 찍는 것 자체가 이 레포가 반복해 당한 클래스다.
   최소한 **한 건도 적용되지 않으면 잡을 실패**시키는 게 맞다고 보지만, 그러면 지금 상태에서 main 푸시가
   매번 빨간불이 되므로 ①을 먼저 정하는 게 순서다.

## 다음 세션 첫 액션

```sql
-- 10-07 03:30 KST 이후 (읽기 전용)
SELECT id, total_amount, COALESCE(refunded_amount,0) AS booked FROM orders WHERE id = 85;
-- booked 1800 이면 E4. 0 이면 cron 경로도 안 돈 것이므로 하트비트부터 볼 것:
SELECT value FROM platform_settings WHERE key = 'cron_hb:schema-repair-daily';
```

## 🩸 이번에 틀렸던 내 판단

**워크플로 파일에 호출 줄이 있다는 것을 "자동으로 돈다" 로 읽었다.** `.github/workflows/d1-migrate.yml` 을
읽고 시험까지 썼지만, **그 줄이 `if [ -n "$ADMIN_TOKEN" ]` 안에 있다는 것을 조건으로 세지 않았다.**
시크릿은 레포에서 안 보이므로 **파일만으로는 그 분기가 어느 쪽으로 가는지 알 수 없다** — 라이브 로그가 유일한 판정이다.
⇒ 교훈: **"코드에 있다 ≠ 살아 있다" 는 기능 플래그만의 이야기가 아니다. CI 워크플로도 같다.**
