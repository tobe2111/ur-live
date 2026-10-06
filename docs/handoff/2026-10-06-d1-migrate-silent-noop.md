# 스키마 자동복구 경로가 **셋**이고 하나는 죽어 있다 — 그리고 내가 두 번 오판했다 (2026-10-06)

**[E4]** 주문 85 소급 기록은 **라이브에서 판정 완료**(아래 실측). 경로 분석은 라이브 로그·하트비트 실측.
`d1-migrate.yml` 자체는 **고치지 않았다** — 고치면 main 푸시마다 프로덕션 스키마에 쓰기가 시작되므로 대표 판단 사항이다.

## ✅ 먼저 결론 — 소급 기록은 돌았다

```
배포 전   order 85 : total_amount 1800 · refunded_amount 0    ← 1,800 이 또 나갈 수 있었다
배포 후   order 85 : total_amount 1800 · refunded_amount 1800 ← 환불 상한 0, 구조적으로 못 나간다
```
`d1-migrate` 도 cron 도 아니라 **`main.yml` 의 `Auto schema repair after deploy`** 가 돌렸다
(Pages 배포 **직후** 같은 잡에서 `POST /api/_internal/repair-schema/auto`, `sleep 10` 뒤).
주문 85 의 값이 **배포 완료와 같은 시점에** 0 → 1800 으로 바뀌는 것을 1분 간격 폴링으로 확인했다.

## 경로 셋 — 성격이 다르다

| | 무엇 | 상태 | 성격 |
|---|---|---|---|
| **1차** | `main.yml` `Auto schema repair after deploy` → `/api/_internal/repair-schema/auto` | ✅ **살아 있음**(오늘 이게 돌았다) | 배포 **뒤**에 돈다 = 새 코드의 백필이 실제로 실행된다 |
| **2차** | cron `schema-repair-daily` → `runSchemaRepair` (`30 18 * * *` UTC = **03:30 KST**) | ✅ 살아 있음 | 배포가 없는 날의 받침 |
| **3차** | `d1-migrate.yml` → 같은 엔드포인트(admin GET) | 🔴 **죽어 있음** | 토큰 미설정으로 skip. 1차가 있어 **실질 피해는 없다** |

2차 하트비트 실측: `cron_hb:schema-repair-daily → {"at":"2026-10-05T18:33:24Z","ok":true,"ms":175790,"q":364}`

## 🔴 `d1-migrate.yml` 은 아무것도 안 하고 `success` 를 찍는다 (실측 run `37465121609`)

```
✘ [ERROR] Couldn't find DB with name 'ur-live'
⚠️ migrations/0289_vouchers_intro_stamp.sql 실패 (already applied?)
⚠️ migrations/fix_production_data.sql 실패 (already applied?)
⚠️ ADMIN_REPAIR_TOKEN 미설정 — repair-schema 호출 skip
→ job conclusion: success
```

| 무엇 | 실제 상태 | 왜 안 보였나 |
|---|---|---|
| **마이그레이션 적용** | **전부 실패** — 실제 이름은 `toss-live-commerce-db` 인데 기본값 `ur-live` 를 찾는다 | `\|\| echo "⚠️ 실패 (already applied?)"` 가 삼켜 **잡이 success** |
| repair-schema 호출 | 한 번도 안 됨 — `ADMIN_REPAIR_TOKEN` 미설정 | `else` 가지가 echo 만 하고 끝 |

실측한 실제 D1 이름(`wrangler.toml` 의 `DB` 바인딩과 일치):
```
d9530ba6-…   toss-live-commerce-db   ← 라이브 본진
d154f5d8-…   ur-live-db              ← 이름이 비슷한 다른 DB (본진 아님)
```
⇒ 워크플로 기본값 `ur-live` 는 **어느 DB 와도 일치하지 않는다.**

🔑 **심각도 정정**: repair-schema 쪽은 1차가 이미 하므로 **중복**이고 피해 0 이다.
**진짜로 안 돌고 있는 것은 `migrations/*.sql` 적용**이고, 그건 `TECHNICAL_DEBT` TD-001 이 말하는 그 부채다
(다만 기록된 원인이 틀렸다 — 아래).

## `TECHNICAL_DEBT.md` TD-001 정정

기록: *"Cloudflare API token 에 `Account > D1 > Edit` 권한 추가 필요"*.
실측 오류는 **권한이 아니라 이름**이다(`Couldn't find DB with name 'ur-live'`) — 권한을 추가해도 그대로 실패한다.
권한도 필요할 수는 있으나 **CI 시크릿이라 세션이 못 읽어 확인 못 했다.**

## 가드 재조준 (완화 아님 — 3경로 전부 고정)

`#1630` 의 배선 단언이 **3차(죽은) 경로**만 보고 있었다. 문자열로는 참이지만 런타임엔 skip 되므로 **거짓 안심**이다.
시험 16 → 19건 · 주입 7 → 11건(신규 4건 **전부 되돌려-검증 빨간불 확인**):

- 1차: `main.yml` 이 `repair-schema/auto` 를 부르는가 · `X-Repair-Token` 헤더가 있는가(없으면 403 fail-closed)
  · **`pages deploy` 보다 뒤인가**(앞이면 옛 워커에 닿아 백필이 안 돈다)
- 2차: `daily-lane.ts` 의 `runSchemaRepair(env.DB)` · `scheduled.ts` 의 `runDailyLane('maintenance'`
- 3차: `d1-migrate.yml` 배선 유지(토큰이 채워지면 다시 일한다)

## 🩸 이번에 틀렸던 내 판단 — **두 번이고, 두 번째가 더 값지다**

1. **1차 오판**: 워크플로 파일에 호출 줄이 있는 것을 "자동으로 돈다" 로 읽었다. 그 줄이
   `if [ -n "$ADMIN_TOKEN" ]` **안**에 있다는 것을 조건으로 세지 않았다. 시크릿은 레포에서 안 보이므로
   **파일만으로는 분기 방향을 알 수 없다** — 라이브 로그가 유일한 판정이다.
2. **2차 오판(더 나쁘다)**: 그걸 고치면서 *"그럼 보증은 cron 뿐"* 이라고 단정했다. 근거는
   `grep -rn repair-schema … src/ .github/ | grep -v … | head -20` 한 번이었고, **`head -20` 이
   `.github/` 매치를 통째로 잘라냈다.** `main.yml` 의 1차 경로가 그 안에 있었다.
   ⇒ **검색을 자르고 그 결과로 "없다" 를 결론 내렸다.** 출력이 상한에 닿았는지 먼저 봐야 했다.

🧭 정리: *"코드에 있다 ≠ 살아 있다"* 는 CI 워크플로에도 적용되고, **"grep 에 안 나왔다 ≠ 없다"** 는
출력을 자른 순간 성립하지 않는다.

## 남은 대표 판단 (세션이 손대지 않았다)

1. **`D1_DATABASE_NAME`** — `toss-live-commerce-db` 로 설정하거나 워크플로가 `wrangler.toml` 에서 읽게 수정.
   ⚠️ **고치면 main 푸시마다 프로덕션 D1 에 마이그레이션이 실제로 적용되기 시작한다** — 한 번도 안 돌던 것이라
   쌓인 분(migrations/ 전체)의 영향을 먼저 봐야 한다. **이게 TD-001 의 실체다.**
2. **`d1-migrate.yml` 의 repair-schema 스텝** — 1차와 중복이므로 **지우는 것도 선택지**다(토큰을 채우는 대신).
   남겨 두면 "두 자리에서 같은 일" 이고, 지우면 배포 경로 하나로 단순해진다.
3. **`|| echo … 실패` 삼킴** — 한 건도 적용되지 않으면 잡을 실패시키는 게 맞다고 보지만, ①을 정하기 전에
   고치면 main 푸시가 매번 빨간불이 된다(순서는 ① → ③).

## 다음 세션 첫 액션

소급 기록은 **이미 판정 완료**라 더 볼 것이 없다. 재확인하려면(읽기 전용):
```sql
SELECT id, total_amount, COALESCE(refunded_amount,0) AS booked FROM orders WHERE id = 85;  -- 1800
SELECT orders.id FROM orders WHERE COALESCE(refunded_amount,0) = 0
  AND (SELECT COALESCE(SUM(COALESCE(v.applied_price,0)),0) FROM vouchers v
        WHERE v.order_id = orders.id AND COALESCE(v.refund_status,'') = 'refunded') > 0;   -- 0행이어야 한다
```
