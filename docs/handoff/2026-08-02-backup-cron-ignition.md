# 2026-08-02 — 워커측 주간 D1 백업 cron 점화 (2번째 백업 경로) + 인프라 시크릿 4종

머지: `#968`(문법 수정) · `#972`(슬롯 회수 + 점화) — 앞선 세션 작업은 `2026-08-01-consumer-seo-admin-ledger.md`

> ✏️ **제목 정정 (이 세션이 한 번 과장했다)**: 처음엔 *"재해복구가 0이던 것을 켰다"* 라고 적었다. **틀렸다.**
> `.github/workflows/d1-backup.yml` 이 **수요일 20:00 UTC 로 이미 돌고 있었다**(07-15·22·29 성공).
> 이번에 켠 것은 **워커측 일요일 회차** — 즉 0→1 이 아니라 **1→2(경로 분산)** 다.
> ⚠️ rebase 중에 이 정정이 한 번 유실돼 다시 적었다. **다음 세션은 이 줄을 지우지 말 것.**

---

## 0. 🔴 하마터면 조용히 실패할 뻔한 것 — **배포가 바인딩을 지운다**

`wrangler deploy` 는 `wrangler.toml` 이 선언한 것으로 워커 설정을 **통째로 교체**한다.
대시보드에서 손으로 붙인 바인딩은 **다음 배포에 삭제**된다 — "추가 안 함"이 아니라 **삭제**다.

같은 날 **두 번** 당했다:
1. `CACHE_KV` — 대표가 바인딩(00:31 KST) → `wrangler deploy`(#971, 00:43) 가 지움(12개 → 6개)
2. `BACKUP_BUCKET` — 대표가 바인딩 → **백업 cron 을 켜는 바로 그 배포**(15:43Z)가 지웠다.
   하필 백업을 켜는 배포가 백업이 쓸 버킷을 없앴다. 배포는 초록불이었고, 주간 회차가 오는
   **일주일 뒤**에나 `handleD1Backup` 이 throw 하며 드러났을 것이다.

→ `wrangler.toml` 에 `[[r2_buckets]] BACKUP_BUCKET` **선언**으로 고정 + 가드
   `worker-bindings-declared.test`(5). **새 cron 이 새 바인딩을 쓰면 그 목록에 한 줄 추가할 것.**

⚠️ **Pages 바인딩은 이 파일과 무관**하다(대시보드 관리). 이 규칙은 **cron 워커**에만 적용된다.

---


## 1. 다음 세션의 첫 액션 — **첫 백업 회차 판정** (⏰ 2026-08-03 05:00 KST)

첫 회차는 **일요일 20:00 UTC = 월요일 05:00 KST**. 아래 두 개가 다 있어야 성공이다.

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);dd=d.get('data') or {};print(dd.get('accessToken') or dd.get('token') or d.get('token') or '')")

# ① 하트비트 — d1-backup 이 실행됐는가
curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
 | python3 -c "import sys,json;i=(json.load(sys.stdin).get('data') or {}).get('items') or [];print([x for x in i if 'backup' in x['name']] or '❌ 없음')"

# ② R2 객체 — 실제로 파일이 떨어졌는가 (CF 토큰은 §3 참조)
curl -sS "https://api.cloudflare.com/client/v4/accounts/$CFA/r2/buckets/ur-live-backups/objects" -H "Authorization: Bearer $CFT"
```

**판정**
- ① 있고 ② 있음 → ✅ 끝. 이 항목은 닫는다.
- ① 있는데 `ok:false` → `handleD1Backup` 이 던졌다. `cron_failures` 테이블 + 어드민 벨에 사유가 있다.
  유력 후보는 **`BACKUP_BUCKET` 바인딩이 Worker 에 없음** — 그런데 대표가 2026-08-02 에 넣었고
  화면으로 확인했다(§2). 그 외라면 D1 dump 크기/CPU 한도.
- ① **아예 없음** → cron 이 발화 자체를 안 했다. CF 등록분을 다시 확인(§3 명령).

⚠️ **`/api/debug/bindings` 로 `BACKUP_BUCKET` 을 확인하지 마라.** 그 엔드포인트는 **Pages** 워커에서
돌아서 **Worker(cron) 의 바인딩을 못 본다.** `false` 가 떠도 정상이다 — 이걸 모르면 "안 됐네" 로 오판한다.

---

## 2. 완료분 — 대표 대시보드 작업 4건 + 코드 2건

| 항목 | 어디 | 확인 방법 |
|---|---|---|
| R2 버킷 `ur-live-backups` | R2 | 대시보드 |
| `BACKUP_BUCKET` 바인딩 | **Worker** `ur-live` (Pages 아님 — cron 전용) | 화면 확인 |
| `DATA_ENCRYPTION_KEY` | **Pages** (+Worker 권장 — 소셜 cron 이 `social-store` 로 토큰 복호화) | env-readiness 에서 사라짐 ✅ |
| `INTERNAL_API_TOKEN` · `ANALYTICS_KV` · `DISCORD_WEBHOOK_URL` | Pages | 재배포 후 반영 |
| `ur-live-cleanup-cron` 삭제 | Workers | CF API 워커 목록에서 사라짐 ✅ |
| GitHub `CLOUDFLARE_API_TOKEN` 교체 | GitHub Secrets | 배포 성공으로 입증 ✅ |

**코드**: `#968` 문법(`0`→`SUN`) · `#972` 슬롯 회수 + 점화 + 가드.

**최종 실측 (2026-08-02 15:43Z)**
```
ur-live 등록 cron: 0 18 * * *  ·  0 19 * * *  ·  0 20 * * SUN  ·  */5 * * * *   (4개)
계정 전체 5/5      (ur-live 4 + ur-ads 1 · 나머지 5개 워커는 cron 0)
```

---

## 3. 이번에 틀렸던 판단 — **여기가 제일 값지다**

### ① "문법만 고치면 된다" — 벽이 두 개였다
`0 20 * * 0` 이 CF 문법 밖(code 10100)인 건 맞았다. 고쳐서 배포했더니 **다른 에러**가 나왔다:
**계정당 cron 5개 한도**(code 10072). 계정이 이미 정확히 5였다.

⇒ **첫 번째 벽을 고쳐야 두 번째가 보인다.** "고쳤다"를 배포 전에 선언하지 말 것.

### ② 그리고 그 6번째 트리거가 **배포 파이프라인을 통째로 막았다**
스케줄 PUT 이 원자적이라 거부되면 **그 뒤 모든 worker-deploy 가 실패**한다 — 내 것만이 아니라
**다른 세션의 cron 변경까지** 멈춘다. 되돌리는 게 최우선이었다.
→ 지금은 `check-cron-syntax` 가 `wrangler*.toml` **합산**으로 커밋 시점에 막는다.

### ③ CF 토큰이 "죽었다"는 내 진단은 절반만 맞았다
`platform_settings.cf_api_token` 이 `Invalid API Token` 이라 **토큰이 죽었다**고 적었다.
다른 세션이 `#974` 에서 밝힌 진짜 원인은 **저장 UI** 였다(값이 온전히 안 들어갔다).
대표가 다시 넣자 **같은 토큰이 `status: active`** 로 살아났다.

⇒ 이 세션은 그 오진 때문에 **몇 시간 동안 "CF 는 내가 못 한다"고 전제**했다.
   다음 세션은 **`verify` 부터 찔러 볼 것** — 문서의 "죽었다" 를 믿지 말 것.

### ④ 저장소가 두 개인 걸 대표에게 늦게 설명했다
- `platform_settings.cf_api_token` → **세션(진단·조회)용**
- GitHub Actions Secret `CLOUDFLARE_API_TOKEN` → **worker-deploy / main.yml(Pages) 용**

대표가 어드민에만 넣고 "왜 아직도?" 가 됐다. **완전히 다른 저장소**이고 둘 다 넣어야 한다.
오늘 토큰을 새로 만드시면서 GitHub 쪽 옛 토큰이 죽어 **Pages 배포까지 3회 연속 실패**했다
(프로덕션이 `163c0c50` 에 몇 시간 멈춰 있었다 — 아무도 몰랐다).

### ⑤ 경로 하드코딩, 하루에 네 번
`repair-schema` 분리에서 3건, 추천보너스 추출에서 1건, 그리고 `wrangler-cron.toml` 삭제에서
`wholesale-invariants.test` 가 ENOENT 로 터졌다. 전부 `readdirSync`/합산 패턴으로 교정.
⚠️ **터지는 방향보다 반대가 더 위험하다** — 새 파일이 생겼는데 하드코딩 목록에 없으면 **조용히 빠진다**.

---

## 4. 남은 결정 / 대기

### ✅ 대표가 닫은 것 — **다시 묻지 말 것** (2026-08-02 확정)
1. **어긋난 4명 잔액 교정 → 안 한다.** 합 −16,380딜. 관측(`ledger_integrity_log`)은 계속 돌지만
   **교정 작업을 제안하지 말 것.** 다이제스트에 `user_points_balance_mismatch: 4` 가 계속 뜨는 건
   알려진 상태이지 새 이슈가 아니다.
2. **가입 보너스 재활성 → 안 한다.** `platform_settings.signup_bonus_amount` 는 0으로 둔다.
3. **배포 실패 알림 → 안 붙인다.** 워크플로 실패를 디스코드/푸시로 보내는 배선은 만들지 않는다.

### 대표 판단 (열림)
1. **Workers Paid 전환 여부** — 지금 cron **5/5 로 꽉 찼다.** 트리거가 하나 더 필요해지면
   유료(한도 1,000)로 가거나 또 자리를 비워야 한다. `docs/design/cron-staged-ignition-plan-2026-07.md`
   의 3·4단계(매시간·주간 payouts)가 **전부 이 제약에 걸린다.**

### ⚠️ 이 수리에서 **내가 만든 실수 2건** — 같은 함정에 다시 빠지지 말 것

1. **SQL 인라인 주석 `--` 이 뒤따르는 컬럼을 삼킨다.**
   파일 크기 래칫을 맞추려고 줄 수를 안 늘리는 방법으로 `--` 인라인 주석을 붙였는데,
   한 사이트에서 그 뒤에 `p.restaurant_name, p.category` 가 **같은 줄에 남아 두 컬럼이 통째로
   주석 처리**됐다. **이 PR 이 고치던 것과 정확히 같은 클래스**(조용히 사라지는 컬럼)를 스스로 만든 것이다.
   프로덕션 D1 에 그 SELECT 를 던져 **반환 컬럼 10개를 눈으로 확인**하고서야 잡았다.
   ⇒ 여러 컬럼이 한 줄에 있으면 인라인 주석 금지. 그리고 **SQL 을 고쳤으면 D1 에 던져 볼 것.**

2. **템플릿 리터럴 안 SQL 주석에 백틱을 쓰면 리터럴이 끊긴다.**
   `` -- `sellers.avg_rating` 는… `` 이 `tsc` 를 TS1005 로 깨뜨렸다. 설명은 `DB.prepare(` **밖**에 둔다.

📌 **파일 크기 래칫을 로컬에서 재현하려면 CI 와 같은 플래그를 써야 한다**:
`node scripts/check-file-size.mjs --changed-only -s` — 플래그 없이 돌리면 *"대상 없음(skip)"* 이 떠서
**초록으로 오해**한다(실제로 그래서 빨강을 CI 에서 처음 봤다).

### 🔥 다음 세션이 이어받을 것 — 유어애즈 레인 침묵 8건 (2026-08-02 실측)

`/api/admin/cron-heartbeats` 기준 **68개 중 8개가 stale**, **전부 `ads:*`**:

```
6573분  ads:sweep-kakao-phone              (허용 150)
1834분  ads:maintenance?phase=merge        (허용 1470)
 814분  ads:collect-localdata?mode=backfill(허용 150)
 573분  ads:collect-company   ok=false  err=Error detail=Worker exceeded CPU tim…   ← 원인
 573분  ads:enrich-influencer-fanout / -driver
 273분  ads:lane-alarm-boot   ·  153분  ads:match-registry
```

**원인은 새 결함이 아니라 알려진 CPU 예산 포화**다(`check-ads-dispatch-bypass` 가 지키는 그 클래스).
처방은 ① 건당 비용 절감 ② 유료 전환 — ②는 위 "대표 판단(열림)"과 같은 문제다.

⚠️ **이 세션이 한 번 오진했다**: 임계값이 잘못 잡힌 것 아니냐고 짐작하며 `reconciliation`(1,413분)을
근거로 들었는데, **그건 애초에 stale 목록에 없었다**(허용 2,910분 — 일 1회 cron 은 `base*2+30` 으로
정확히 계산된다). 임계는 멀쩡하고 **8건은 전부 진짜 정지다.** 짐작으로 임계를 손대지 말 것.

### 세션이 못 하는 것
- **구글 AI 검색**: CF **Managed robots.txt** 가 레포 robots.txt 를 통째로 대체하며
  `Google-Extended: Disallow: /` 를 붙인다. 데이터 문제가 아니다(JSON-LD 정상).
  → 대시보드 **AI Crawl Control** 에서 Allow. **CF 토큰이 살아났으니 다음 세션은 API 로 시도해 볼 것.**
- 소셜 발행 토큰(OAuth).

---

## 4-b. 🔴 후속 세션 — **없는 컬럼을 읽는 SQL 11건** (대표 다이제스트에서 출발)

대표가 붙여 준 일일 다이제스트의 한 줄 —
`Cron auto-settlement encountered an error: no such column: p.commission_rate` — 을 당겼더니
**같은 병이 11군데** 나왔다. 전부 프로덕션 D1 에서 실제로 `no such column` 을 낸다(1건씩 실측).

> 🧠 **SQLite 는 없는 컬럼을 NULL 로 봐주지 않는다. 쿼리 *전체*를 던진다.**
> 그리고 이 11건은 **전부 `try/catch` 또는 `.catch(...)` 안**이라 예외가 사람에게 도달하지 않았다.
> 그래서 "기능이 고장 났다"가 아니라 **"기능이 조용히 없다"** 로 남아 있었다.

| 사이트 | 없던 컬럼 → 고친 것 | 죽어 있던 것 |
|---|---|---|
| `cron/auto-settlement.ts` | `p.commission_rate` → `sellers.commission_rate` 조인 | 이용권 정산 회차 **전체**가 매일 03:00 KST 에 사망 |
| `utils/affiliate-credit.ts` | `s.user_id` → `s.linked_user_id` | **자기구매 + SELF_SELLER 이중지급 가드**가 한 번도 발동 못 함(2026-07-07 대표 결정) |
| `referral/referral-tree.routes.ts` | 〃 | 같은 가드 |
| `cron/seller-churn-detect.ts` | 〃 | 이탈 감지 집계 |
| `group-buy-voucher.routes.ts` ×2 | `p.consigned_from_seller_id` → `NULL AS …` | **`recordVoucherUsedLedger`(실지급 레일 B) 미실행** |
| `group-buy-public.routes.ts` ×2 | `u.display_name` → `u.name` | 라이브 티커 |
| `seller-public.routes.ts` | 〃 | 매장 단골 목록 |
| `seller/seller-orders.routes.ts` | `p.image` 제거 | 셀러 주문 목록 이미지 |
| `admin/admin-orders.routes.ts` ×2 | `o.tracking_company` → `o.shipping_company` | 어드민 주문 목록 |
| `admin/admin-settlements.routes.ts` | `o.total_price` 제거 | 정산 폴백 쿼리 |
| `agency/agency-incentives.routes.ts` | `s.avg_rating` → `product_reviews.rating` 집계 | 셀러 KPI **항상 빈 배열** = 인센티브 산정 불가 |
| `agency/agency-stays.routes.ts` | `ag.status` 조건 제거(컬럼 없음) | 숙소 KPI |
| `supply/wholesale-tax.routes.ts` ×2 | `s.name` → `s.business_name` | 도매 세금 공급자 지급액 |
| `internal-admin-tools.routes.ts` | `s.store_category` 제거 | 어드민 셀러 조회 |

**11건 전부 수정 후 프로덕션 D1 에 실제로 던져 ✅ 확인**(정적 통과가 아니라 실행 검증).

### ⚖️ 규모 — 과장하지 말 것
프로덕션은 **주문 88 · 유저 16 · 셀러 10 · 이용권 1(미사용) · affiliate_earnings 0 · 반품 0** 이다.
⇒ **돈이 새고 있던 게 아니다.** 전부 **첫 실사용 순간에 조용히 실패하도록 배선된 지뢰**였다.
(처음엔 "매장이 정산을 못 받고 있다"로 쓸 뻔했다 — `vouchers` 를 세어 보고 정정했다.)

### 정산 레일의 진실 — **설계 문서가 사실과 달랐다**
`settlement-reconciliation.md §Severe 3` 은 이용권이 두 레일에 **"100% 중복 적재"** 된다고 적었다.
프로덕션 실측은 반대다: **`restaurant_settlements` 테이블도, `vouchers.settlement_id` 도 없다.**
둘 다 어드민이 정산 화면을 열 때만 만들어지는데 아무도 안 열었다 ⇒ **Rail A 는 한 행도 만든 적이 없다.**

⇒ 그래서 "테이블을 만들어 주자"는 **수리가 아니라 사고**다(과거분 일괄 적재 → Rail B 와 이중지급).
   `railAProvisioned()` 로 **판정만** 하고 프로비저닝은 절대 안 한다. `auto-settlement-rail-a.test`(12)가 고정.
   ⚠️ 다만 **어드민이 그 화면을 한 번 열면 Rail A 는 깨어난다.** 그 문까지 닫으려면 게이트
   `settlement_skip_ledgered` flip — 머니 경로라 **대표 판단 + staging**.

### 🐺 거짓 🔴 3건도 같이 껐다
다이제스트의 `🔴 누락된 Secret: JWT_SECRET, REFRESH_TOKEN_SECRET, KAKAO_REST_API_KEY` 는 **전부 거짓**이었다.
라이브 `/api/version` 은 셋 다 present 로 답한다 — **캐리어가 다르다**(Pages=시크릿 전부 / Workers=cron).
그 셋을 읽는 **등록된** cron 은 없다. 목록을 `CRON_REQUIRED_ENV`(등록 블록만 담는 SSOT)에서 파생하게 바꿨다.
> 진짜 경보가 거짓 옆에 섞이면 구분이 안 된다. 늑대소년은 알림을 켜는 순간이 아니라 **이미** 시작돼 있었다.

---

## 5. 새 가드 (다음 세션이 믿어도 되는 것)

| 가드 | 막는 것 | **못 막는 것** |
|---|---|---|
| `check-cron-syntax` + `cron-schedule.test`(9) | CF 문법(**DOW 0 금지**) · 5필드 · 중복 · **계정 합 ≤ 5** · 백업 트리거 존재 · `safeCron` 배선 · 세 표기 수용 | **CF 에 실제 등록됐는지는 모른다** — 유일한 답은 `worker-deploy` 로그의 `schedule:` 목록. 배열에서 항목을 **빼는**(=삭제) 실수도 못 막는다 |
| `check-sql-column-exists` **SELECT 패스**(신설) | `FROM t a` / `JOIN t a ON` 로 바인딩된 **alias 한정 컬럼**이 스키마에 있는지. 이 파일 헤더가 "복잡해서 skip" 이라 적어 둔 사각지대를 열었다 — 그 뒤에 11건이 살아 있었다 | alias 없는 컬럼(`SELECT foo FROM t`) · 서브쿼리 alias 재바인딩 · 완전 동적 SQL · **레포엔 없고 프로덕션에만 있는 컬럼**(→ `SELECT_ALIAS_OK` 면제 4건) |
| `auto-settlement-rail-a.test`(12) | 정산 cron 이 Rail A 를 **프로비저닝하지 않음** · 수수료 출처가 `sellers` · 게이트가 INSERT 보다 앞 · 가드의 SELECT 패스가 헛돌지 않음 | 어드민이 정산 화면을 열어 테이블이 생기는 경로(라우트의 정당한 기능) |
| `diagnostic-carrier-scope.test`(7) | 일일 진단이 **Pages 전용 키를 이 캐리어에서 찾지 않음** · 목록을 `CRON_REQUIRED_ENV` 에서 파생 · 빈 문자열도 부재로 셈 | Pages 쪽 키가 진짜로 사라지는 것(→ `/api/health/env-readiness` 담당) · 키가 *있는데 틀린* 경우 |

### 🔴 가드를 만들면서 **두 번 물렸다** — 둘 다 손으로 깨뜨려 봐서 알았다
1. **보간이 있으면 문장을 통째로 skip** 하게 짰는데, **이 사건의 원본 쿼리**가 정확히 그 형태
   (`auto-settlement` 의 `${ledgerSkipClause}`)라 주입 검증에서 **초록**이 떴다. 가드를 붙여 놓고
   정작 그것 때문에 만든 결함을 못 보는 상태였다 → 보간 *조각만* 지우고 리터럴은 검사하도록 수정.
2. **내가 방금 쓴 설명 주석**(`p.commission_rate` 라고 적은 문장)을 코드로 읽어 위반으로 신고했다
   → `blankComments()` 추가. `check-lock-table-symbols` 의 *"주석에만 남아도 통과"* 함정의 거울상이다.

⇒ **매니페스트 4건 추가(70→74), 전부 빨간불 확인.** 만들었으면 반드시 깨뜨려 볼 것.

`check-guard-mutations` 매니페스트 등록 완료 — 6번째 트리거를 주입하면 CI 가 빨강을 낸다.

⚠️ **가드는 레포만 본다.** 계정에 다른 워커(다른 레포/수동 생성)가 cron 을 달면 합산에서 빠진다.
실제 계정 값은 CF API 로만 알 수 있다:

```bash
# CF 자격은 어드민에서 (2026-08-02 기준 유효 — 하지만 verify 로 먼저 확인할 것)
CFJSON=$(curl -sS "https://live.ur-team.com/api/admin/tools/settings" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA")
CFT=$(echo "$CFJSON" | python3 -c "import sys,json;print((json.load(sys.stdin).get('data') or {}).get('cf_api_token',''))")
CFA=$(echo "$CFJSON" | python3 -c "import sys,json;print((json.load(sys.stdin).get('data') or {}).get('cf_account_id',''))")
curl -sS "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer $CFT"   # 먼저 이것부터

for w in $(curl -sS "https://api.cloudflare.com/client/v4/accounts/$CFA/workers/scripts" -H "Authorization: Bearer $CFT" \
  | python3 -c "import sys,json;print(' '.join(x['id'] for x in json.load(sys.stdin)['result']))"); do
  echo -n "$w: "
  curl -sS "https://api.cloudflare.com/client/v4/accounts/$CFA/workers/scripts/$w/schedules" -H "Authorization: Bearer $CFT" \
    | python3 -c "import sys,json;s=(json.load(sys.stdin).get('result') or {}).get('schedules') or [];print(len(s), [x['cron'] for x in s])"
done
```
