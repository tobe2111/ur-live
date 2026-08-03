# 2026-08-03 — 주간 백업이 `products`·`sellers` 를 조용히 빼먹고 있었다

PR: `#995` — 앞선 세션 작업은 `2026-08-02-backup-cron-ignition.md`

---

## 1. 다음 세션의 첫 액션 — **다음 회차에 두 테이블이 들어갔는가** (⏰ 2026-08-10 05:00 KST)

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);dd=d.get('data') or {};print(dd.get('accessToken') or dd.get('token') or d.get('token') or '')")

curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
 | python3 -c "import sys,json;i=(json.load(sys.stdin).get('data') or {}).get('items') or [];print([x for x in i if x['name']=='d1-backup'])"
```

**판정** — `r` 문자열을 본다(이번 PR 로 내용이 늘었다):
- `ok=true` + `success=true tables=316 skipped=N` → ✅ 끝. `skipped` 는 FTS 그림자·`_cf_KV` 라 정상.
- `ok=false` + `부분 백업 — dump 실패 …` → 🔴 아직 빠지는 테이블이 있다. **이름이 메시지에 있다.**
- `ok=true` 인데 `tables` 가 없으면 → **배포가 안 나간 것**이다(`2026-08-03-urads-deploy-silent-miss.md` 의 그 클래스).

⚠️ **R2 목록 조회는 이 세션의 CF 토큰으로 안 된다**(조회 4종에 R2 없음 — `Authentication error`).
대표 대시보드 확인이거나, 코드의 자체 `head()` 검증 + 하트비트로 판정한다.

---

## 2. 무슨 일이 있었나

첫 회차(08-03 05:02 KST)는 **성공처럼 보였다** — 19MB, `ok=true`, 알림 "완료".
디스코드 원문에만 이 줄이 있었다:

```
- dump 실패 테이블 5개: _cf_KV, products, products_fts_config, products_fts_idx, sellers
```

**`products` 와 `sellers` 가 빠진 백업이다.** 그걸로 복구하면 상품도 셀러도 없다.

### 원인 — 커서 한 칸이 컬럼 한도를 넘겼다

dump 가 `SELECT rowid, * FROM t` 로 페이징했다. **D1 결과 컬럼 한도 100** · `products`·`sellers` 는
**이미 정확히 100컬럼**(컬럼 예산제가 존재하는 바로 그 이유) ⇒ `rowid` 한 칸 = 101 = 실패.

| 프로덕션 실측 | |
|---|---|
| `SELECT rowid, * FROM products` | 🔴 `too many columns in result set` |
| `SELECT * FROM products` | ✅ 정확히 100컬럼 |
| `SELECT rowid, * FROM products_fts_idx` · `_cf_KV` | 🔴 `no such column: rowid` |

### 수정
- **단일 INTEGER PK 를 커서로** — 그 값은 이미 `*` 안에 있어 컬럼이 안 는다.
- PK 없으면 rowid 를 **따로**(1컬럼) 읽어 그 묶음으로 본문을 가져온다.
- rowid 조차 없는 파생/내부 테이블은 **skip**(에러로 세면 진짜 실패가 소음에 묻힌다).
- 복구 대상이 빠지면 **업로드 후 throw** → `ok:false` + `cron_failures` + 🚨.

---

## 3. 이번에 틀렸던 판단 — **여기가 제일 값지다**

### ① 나는 "경고 없음"이라고 대표에게 보고했다. 틀렸다.
하트비트에는 무결성 경고가 **안 실린다**(경고는 디스코드로만 갔다). 나는 그 사실을 **바로 앞
문단에서 직접 확인해 놓고도** `success=true` 만 보고 "경고 없음"이라고 단언했다.
**침묵을 성공으로 읽은 것이다.** 이 레포가 반복해 만난 바로 그 클래스를 내가 다시 밟았다.

⇒ 수리는 코드로 했다: 반환값에 `tables`/`skipped` 를 싣고, 실패는 throw 한다.
⇒ **관측 채널이 둘이면 둘 다 같은 사실을 실어야 한다.** 한쪽만 보고 판정하게 두면 또 물린다.

### ② 주입 검증이 한 번 초록으로 속였다
`errorTables.length > 0` 문자열이 그 파일에 **두 번** 나온다(무결성 경고용 + 게이트).
게이트를 `if (false)` 로 바꿔도 다른 등장에 매치돼 **초록**이 떴다.
→ throw 를 감싼 `if` 의 **조건을 직접 읽도록** 교정. **문자열 존재는 구조의 증거가 아니다.**

### ③ 어제도 같은 계열에 물렸다(연속 3회)
`check-sql-column-exists` 는 내가 쓴 **설명 주석**을 코드로 읽어 오탐했고, 보간(`${}`) 쿼리를
통째로 건너뛰어 **사건의 원본 쿼리를 못 봤다.** 셋 다 "텍스트를 봤는데 구조를 안 봤다".

---

## 4. 같이 한 것 — 유어애즈 건당 비용 절감 (대표 승인 "1번")

41개 레인 소요 실측(하트비트 `ms`) 상위:

```
67s collect-hira · 60s maintenance-rescan · 31s sweep-kakao-phone · 31s scan-notices
합계 316s / 41 레인
```

⚠️ **앞 두 개는 오늘 다른 세션이 만지는 중**(#988 심평원 실험)이라 **피했다.**
파일별 최종 수정일로 판별했다 — `git log -1 --format=%ad --date=short -- <file>`.
**같은 파일을 병렬로 파면 충돌 + 중복이다. 착수 전에 이 확인을 할 것.**

`scan-notices` 를 잡았고, 원인이 예상과 달랐다:
**예산(20)이 한 번도 안 걸린다** — 실제 호출이 6번뿐이라. 비용은 요청 수가 아니라 **시간**인데
시간을 재는 것이 없었다(공공 API 하나가 15초 → 최악 90초).

수정은 **둘이 짝**이다:
1. 벽시계 마감선(free 12s / paid 24s, `envPlanValue` — 유료 전환에 코드 변경 0)
2. **키워드 회전 커서** — 마감선은 일을 줄이는 게 아니라 *미루는* 것이라, 시작점을 고정하면
   뒤쪽 키워드가 **영원히** 안 돈다. 레인 단위에서 이미 겪은 구조적 기아의 키워드판.

### 후속(같은 세션, `#997`) — 레인 2종 추가 + 5xx 관측

`sweep-kakao-phone`(31s, 침묵 1위) · `sweep-mx`(12.5s) 에도 마감선을 넣었다.

> 🔑 **마감선의 짝은 구조마다 다르다 — 이걸 틀리면 없던 기아를 만든다.**
>
> | 레인 | 대상 선택 | 필요한 짝 |
> |---|---|---|
> | `scan-notices` | 고정 키워드 배열 | **회전 커서** |
> | `sweep-mx` | 블록 ①회사→②매장 **고정 순서** | **블록 선후 회전**(없으면 ②가 매 회차 굶음) |
> | `sweep-kakao-phone` | `kakao_checked_at < now-30d` + **시도한 행에만 도장** | **불필요**(잘린 행은 다음 라운드 재선택) |
>
> 마지막 줄이 중요하다 — 여기에 회전을 덧붙이면 **없는 문제를 푸는 코드**가 늘 뿐이다.

**5xx 경보도 고쳤다.** 다이제스트의 `⚠️ 5xx spike 2건` 을 D1 으로 추적하니 **모든 창이 count=1**
(시간당 1건)이었다 — 임계 10/분이므로 스파이크가 아니다. 옛 문구는 *"5xx 가 있던 분의 개수"* 를
"spike N건"으로 불렀다. 게다가 표에 **숫자만** 있어 무엇이 실패했는지 알 수 없었다(조치 불가 경보).
→ `5xx_path` 경로별 계수 + 진단은 건수/최다분/상위경로, **임계 넘었을 때만 🔴**.

### 다음 세션이 이어받을 것 — 판정 3개

1. **레인이 마감선 안으로 들어왔나** — 하트비트 `ms` 재측정.
   `stopped_by='deadline'` 이면 시간이 병목(예산 아님)이라는 뜻이고, 그때 마감선 값을 조정한다.
2. **기아가 없는가** — `ads_notice_stats.diag.kwFrom` 과 `ads_mxsweep_stats.first_block` 이
   회차마다 **움직이는지** 본다. 고정돼 있으면 회전이 안 도는 것이다.
3. **🔴 시간당 5xx 1건의 정체** — 배포 24시간 뒤 `5xx_path` 분포로 밝힌다:
   ```sql
   SELECT key, SUM(count) n FROM rate_limit_attempts
    WHERE action='5xx_path' AND window_start >= strftime('%s','now')-86400
    GROUP BY key ORDER BY n DESC LIMIT 10;
   ```

### ✅ 완료 — `danger`·`warn` 레인 **전부** 마감선 보유 (2026-08-03, `#997`+후속)

| 레인 | 실측 | 처방 | 짝이 필요했나 |
|---|---|---|---|
| `collect-hira` | 67s | 마감선 20s/60s | ❌ page 커서가 성공 시에만 전진 |
| `maintenance-rescan` | 60s | 마감선 20s/45s | ✅ **하위작업 선두 회전**(naver 가 영구 미실행이던 자리) |
| `sweep-kakao-phone` | 31s | 마감선 12s/24s | ❌ 도장이 시도한 행에만 |
| `scan-notices` | 31s | 마감선 12s/24s | ✅ **키워드 회전 커서** |
| `maintenance?phase=reextract` | 16s | `POOL_SCAN_MAX_MS` | (다른 세션이 이미 처리) |
| `sweep-mx` | 12.5s | 마감선 10s/24s | ✅ **블록 선후 회전** |

> 🔑 **이 시리즈의 교훈 한 줄**: 마감선은 일을 줄이지 않고 **미룬다.**
> 그래서 매번 *"미뤄진 일감이 다음 회차에 반드시 잡히는가"* 를 봐야 하고,
> 답이 ❌ 면 회전이 **필수**, ✅ 면 회전은 **없는 문제를 푸는 코드**다.
> 세 번은 필요했고 두 번은 아니었다 — 구조를 보지 않고 일괄 적용하면 둘 다 틀린다.

⚠️ `collect-hira` 의 per-fetch `AbortSignal.timeout(25000)` 은 **다른 세션의 재시도 실험 변수**라
건드리지 않았다(`diag.retry` 로 원인을 가르는 중). 테스트가 그 값의 불변을 고정한다 —
무심코 바꾸면 빨간불이 뜬다. **실험 결론이 나온 뒤에** 조정할 것.

⚠️ 남의 세션 파일 착수 전 반드시: `git log -1 --format='%ad %h' --date=short -- <file>`

### 🧱 부산물 — `rescan-rotation.ts` 추출 (파일크기 래칫에 걸려서)

마감선+회전을 넣자 `influencer-maintenance.ts` 가 **626줄**(캡 600)이 됐다. 레포 규칙대로
**그 시점에** 회전 정책(상수 3 + 순수함수 3)을 새 모듈로 뺐다 → 600줄.
같은 파일에 있던 다른 세션의 busy-경로 근거 주석도 **원문 그대로 옮겼다**(지우지 않았다).

> ⚠️ **로컬에서 래칫을 두 번 놓쳤다.** `node scripts/check-file-size.mjs` 를 **플래그 없이** 돌리면
> `대상 없음(skip)` 만 찍혀 초록처럼 보인다. CI 가 쓰는 형태는 **`--changed-only -s`** 다.
> 커밋 전에 그 형태로 돌릴 것 — 두 번 다 CI 빨간불로 알았다.

추출로 **가드가 하나 더 생겼다**: 배선(호출문)은 텍스트로, **회전 산술은 동작으로** 본다.
호출은 남기고 `rotatedOrder` 안에서 `start = 0` 으로 죽이는 결함은 텍스트 검사가 못 잡는다 —
그래서 주입 매니페스트에 그 항목을 따로 넣었다(빨간불 확인 완료).

---

## 5. 새 가드 (다음 세션이 믿어도 되는 것)

| 가드 | 막는 것 | **못 막는 것** |
|---|---|---|
| `d1-backup-wide-tables.test`(8) | `SELECT rowid, *` 복귀 · PK 커서 · rowid 별도조회 · 파생테이블 skip · 실패 시 throw · 반환값에 tables | **실제 R2 파일 내용**. 소스 텍스트만 본다 — 다음 회차 하트비트가 유일한 판정 |
| `notice-scan-deadline.test`(10) | 마감선 부재 · 요금제 하드코딩 · 회전 제거 · 커서 미저장. **회전 산술은 텍스트가 아니라 동작으로** 검증(1개씩만 돌아도 5회차에 전부 덮는지) | 실제 소요 시간. 마감선 값의 타당성은 하트비트 재측정으로만 안다 |

주입 매니페스트 **+4건**, 전부 빨간불 확인.
