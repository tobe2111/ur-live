# 2026-10-15 — 거짓 cron 경보가 진짜를 가리던 것 (`skipped=` 를 값까지 읽는다)

대표 지시: **"남은거 다 해봐"** (SEO/GEO 판단 3건 승인에 이어, 제가 보고만 해 뒀던 "둘째건")

## 🎯 다음 세션의 첫 액션 — 배포 후 판정

```bash
# ① 거짓 blocked 가 멈췄는가 — 12시간 뒤(재알림 억제 주기)에 새 blocked:* 가 안 쌓이는지
#    어드민 토큰은 CLAUDE.md "어드민 진단 접근" 절차
curl -sS "https://live.ur-team.com/api/admin/cron-failures?resolved=0" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json,collections;d=json.load(sys.stdin)['data'];print(collections.Counter(r['job_name'].split(':')[0] for r in d['items']));print(d['unresolved_counts'])"
#    기대: blocked: 접두 비중이 81% 에서 내려간다(새로 안 쌓인다). 과거 행은 그대로 남는다.

# ② 심각도 필터가 행에 닿는가 — error 621건이 화면에 오는지
curl -sS "https://live.ur-team.com/api/admin/cron-failures?resolved=0&severity=error" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print('severity=',d.get('severity'),'· 행',len(d['items']))"
#    기대: severity=error · 행 100 (종전엔 이 질의 자체가 없어 error 가 0건 보였다)

# ③ 🔴 반대 방향 — 진짜 막힘은 여전히 울리는가
#    `skipped=min_interval` 이 아닌 이유 문자열을 내는 cron 이 생기면 blocked 로 잡혀야 한다.
#    (가드가 고정하지만, 라이브에서 그런 비트가 보이면 그게 진짜 신호다)
```

## 결함 (라이브 실측)

`cron-stale-watch` 는 2026-08-31 에 *"돌긴 하는데 아무것도 못 하는 것"* 을 잡으려고 `skipped` 표식이
붙은 비트를 골랐다. **처방은 옳았는데 정규식이 키만 보고 값을 안 봤다**:

```ts
/(^|[\s,{])skipped[=:]/.test(b.result || '')
```

그 사이 레인들이 같은 이름을 **세 가지 다른 뜻**으로 쓰게 됐다. 하트비트 145개 중 표식이 붙은 12개를
전수로 읽으니 **11개가 멀쩡한 레인**이었다:

| 비트 | result | 실제 뜻 |
|---|---|---|
| `ads:*` 9개 | `skipped=min_interval` | 최근에 돌아서 쉬는 중(레인 페이싱) |
| `demo-name-heal` | `healed=0 skipped=309 samples[0]` | **카운터** — 309건은 손댈 게 없었다 |
| `__catchup` | `started=0 skipped=6 deferred=0 known=145` | **카운터** — 밀린 게 없었다 |
| `group-buy-feed-cache` | `refreshed=0 skipped=false unchanged=true` | 명시적 "안 건너뛰었다" |

`__catchup` 의 주석은 심지어 *"started=0 skipped=27 이면 **돌았고 밀린 게 없었다**가 화면에서 읽힌다"*
고 적어 뒀다. **그 뜻을 감시 쪽이 정반대로 읽고 있었다.**

## 그 오독의 대가 (실측)

```
미해결 cron_failures   1,331건   (critical 11 · error 621 · warning 699)
어드민 최신 100건       blocked:* 81 · stale:* 13 · deploy:* 5 · 그 외 1
                        severity:  warning 94 · critical 6 · error 0   ← error 가 0건
```

12시간마다 11개 레인에 거짓 `blocked:*` 를 쏘아 창을 채웠고, **진짜 error 621건과 critical 5건이
화면에 도달하지 못했다.**

⇒ **거짓 경보는 침묵보다 나쁘다** — 침묵은 아무것도 안 가리지만 소음은 진짜를 가린다.

## 처방 둘

1. **값으로 판정하는 SSOT** `src/worker/utils/cron-beat-blocked.ts`
   - 숫자(`6`·`309`) = 카운터 → healthy
   - falsy(`false`·`0`·`none`…) → healthy
   - 허용목록(`min_interval`) → healthy
   - **그 외(이유 문자열·`true`) → blocked**
   - 🔴 **기본값이 blocked 인 것은 의도다** — 2026-08-31 이 잡으려던 사고(바인딩 부재로 이미지 이관이
     넉 달간 `migrated=0`)는 **이유 문자열**로 나타난다. 모르는 값을 안전한 쪽으로 넘기면 그 사고가
     다시 조용해진다. 넓히기는 **허용목록에 한 줄**로만.
2. **어드민이 심각도로 행에 닿는다** — `GET /cron-failures?severity=`(화이트리스트) + 심각도 칩을
   **누를 수 있게**. 숫자(`unresolved_counts`)는 **원래 내려가고 있었다** — 안 보인 것은 **행**이다.
   - 🔴 **정렬은 안 바꿨다**: severity 우선으로 바꾸면 100칸이 critical·error 로 차고 최근 warning 이
     영영 안 보인다(가리는 쪽만 바뀐다).

## 이번에 틀렸던 판단 / 정정

1. **"621 errors 가 unreachable" 이라고 보고했는데 반만 맞았다** — `unresolved_counts` 가 이미
   내려가고 있어서 **숫자는 보였다.** 안 보인 것은 행이다. 처방이 "집계 추가" 가 아니라 "필터 추가"
   인 이유가 이것이다.
2. **주입 앵커가 4곳에 맞았다** — `ORDER BY created_at DESC LIMIT 100` 이 그 파일에 4개. WHERE 절까지
   포함해 가름.
3. **그 단언이 헛돌았다** — 같은 이유로 `toContain('ORDER BY created_at DESC LIMIT 100')` 이 cron-failures
   쿼리만 severity 우선으로 바꿔도 통과했다(주입이 잡았다) → **그 쿼리만 떼어 내서** 본다.

## 가드

- `src/tests/unit/cron-blocked-value-2026-10-15.test.ts` **17건**
  (라이브에서 본 12개 문자열을 **그대로** 픽스처로 — 손으로 지어 쓰면 그 경우를 안 담아 규칙을
  없애도 초록이 된다)
- `scripts/mutations/cron-blocked-value-2026-10-15.mjs` **11건 — 되돌려-검증 전부 빨간불 확인**
  (**반대 방향 둘**: 기본값 뒤집기 · 허용목록에 `true` 추가. 그리고 정렬 뒤집기)

## 남은 것 / 대표 판단

- **이미 쌓인 1,331건**은 안 줄어든다. 새 거짓 경보는 멈추지만 과거 행은 어드민에서 해결 처리해야 한다.
  일괄 해결 도구는 **데이터 쓰기라 결재**다 — 필요하면 올릴 것.
- `/pass/` **화면 description** 이 `… 이용권 — 0명 함께 구매 중` 이다(라이브 **360건 중 358건이 0명**).
  게다가 서버 description(2026-10-13·14 에 가게명 중복 제거 + 지역·별점 보강됨)과 **두 벌**이라
  Googlebot(JS 렌더)은 옛 문구를, Yeti 는 새 문구를 받는다. 제목에서 방금 고친 그 구조이고,
  `GroupBuyDetailPage.tsx` 는 **잠금표 파일**이라 결재가 필요하다.

---

## 후속 (같은 날) — 첫 판은 15건 중 3건을 못 잡았다

### 🩸 내 조사 방법이 틀렸다

허용목록을 `min_interval` 하나로 정한 근거는 **하트비트 한 장 스냅샷**이었다
(`/api/admin/cron-heartbeats` 145개 중 표식 12개). 그런데 **시각 페이싱 레인은 자기 시각에만
그 표식을 낸다** — 홀수시만 돌거나, 4시간마다 돌거나, rescan 시각을 비켜 준다 ⇒ 스냅샷을 뜬
그 순간엔 정상 실행 중이라 표식이 없다.

권위 있는 출처는 **경보가 실제로 무엇에 울렸나** = `cron_failures` 였다. 10-15 04시 KST 배치
15건을 전수로 읽으니:

```
blocked:__catchup                    skipped=29            ← 카운터 (healthy)
blocked:ads:collect-franchise        skipped=min_interval  ← 허용목록 (healthy)
blocked:ads:collect-localdata-chain  skipped=min_interval
blocked:ads:collect-nara-contract    skipped=min_interval
blocked:ads:collect-nara-vendor      skipped=min_interval
blocked:ads:collect-nps              skipped=min_interval
blocked:ads:collect-storeinfo        skipped=min_interval
blocked:ads:daily-batch              skipped=min_interval
blocked:ads:maintenance              skipped=rescan_hour   ← 🔴 첫 판에 없다
blocked:ads:maintenance-rescan       skipped=min_interval
blocked:ads:scan-notices             skipped=off_hour      ← 🔴 첫 판에 없다
blocked:ads:sweep-mx                 skipped=min_interval
blocked:ads:sweep-nts                skipped=min_interval
blocked:demo-name-heal               skipped=309           ← 카운터 (healthy)
blocked:group-buy-feed-cache         skipped=false         ← falsy (healthy)
```
현 하트비트에 `ads:collect-company skipped=even_hour` 도 있다. ⇒ **첫 판 그대로면 15 → 3** 이고
0 이 아니었다.

셋 다 `src/worker-ads/lane-alarm-runners.ts` 의 **의도적 시각 페이싱**이다(`:127` rescan 시각
비켜 주기 · `:241` 홀수시만 · `:507` 4시간마다). 고장이 아니고 **내일 저절로 돈다.**

### 🔑 그리고 빈도도 틀리게 적어 뒀다

`cron-stale-watch` 는 `slotCron('0 19 * * *')` = **일 1회 04시 KST** 다. 처음에 "12시간마다" 로
적었는데 `cron_failures` 의 날짜별 집계가 그걸 바로 반증한다 — 10-10~10-15 전부 **04시 한 번**
(12·15·14·16·15·15건). CLAUDE.md 방어선 행과 모듈 머리말을 함께 정정했다.

### 처방 — 허용목록 3줄 + 세 번째가 없게 구조로

| | |
|---|---|
| `HEALTHY_SKIP_REASONS` | `min_interval` · **`even_hour`** · **`off_hour`** · **`rescan_hour`** (페이싱) |
| `BLOCKING_SKIP_REASONS` (신규) | `gate_off` · `disabled` — **꺼짐은 사람이 켜야 돈다** ⇒ 경보가 맞다 |

경계를 한 질문으로 적어 뒀다: **"내일 저절로 돌까?"** 돈다 → healthy · 사람이 켜야 한다 → blocking.

🔒 **구조적 수리가 본체다** — 가드가 러너의 `skipped:` 리터럴 **전수**가 두 집합 중 하나에 있는지
묻는다. 내일 누가 `skipped: 'quarter_hour'` 를 붙이면 그 자리에서 빨간불이 난다(주입으로 확인).
그게 없으면 같은 실수가 **세 번째로** 난다 — 빌드·시험·화면이 전부 멀쩡해서 재 본 사람만 안다.

가드 **21건** + 주입 **15건**(신규 4 · 재조준 1) 전부 되돌려-검증 빨간불 확인.
🩸 그 과정에서 내 주입 하나가 헛돌았다 — `toBeGreaterThanOrEqual(10)` → `(0)` 으로 바꿔도
리터럴이 여전히 다 잡히니 `unclassified` 가 정확했다(**하한을 낮추는 것만으로는 가드가 안 헐거워진다**).
⇒ *매치가 실제로 0건이 되는* 주입(정규식 교체)으로 바꿨고 그때 빨간불이 났다.

### ⚠️ 다음 세션의 첫 액션 (E4)

**10-16 04시 KST 회차 뒤**에만 판정된다(일 1회).

```bash
# 어드민 토큰($TOK) 확보 후
curl -sS "https://live.ur-team.com/api/admin/cron-failures?severity=warning&limit=100" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: <브라우저 UA>" \
  | python3 -c "import sys,json;rows=json.load(sys.stdin)['data']['items'];
import collections;c=collections.Counter(r['created_at'][:13] for r in rows if r['job_name'].startswith('blocked:'));print(sorted(c.items())[-3:])"
```
기대: `2026-10-15 19:` 시각대(= 10-16 04시 KST)에 `blocked:*` **0건**(종전 15건).
🔴 **한쪽만 보면 판정이 안 된다** — 0건이 "고쳐짐" 인지 "cron 이 안 돌았음" 인지 구분하려면
하트비트 `cron-stale-watch` 의 `at` 이 그 시각으로 갱신됐는지 **함께** 볼 것.

### ⚠️ 못 보는 것

- 이유 문자열이 *진짜* 막힘인지는 글자로만 판정한다.
- 이미 쌓인 1,331건은 그대로다(과거 행 일괄 해결은 데이터 쓰기 = 결재).
- `skipped` 를 아예 안 싣고 조용히 아무 일도 안 하는 cron(원래 한계).

---

## ✅ E4 통과 — 10-16 04시 KST 회차 (판정 10-16 04:20 KST)

위 "기대" 를 두 값으로 **함께** 확인했다.

### ① 그 회차가 실제로 돌았다
```
cron-stale-watch  at = 2026-10-15T19:00:10Z (= 10-16 04:00 KST) · ok: true · 4,158ms
                  rows_read 593 / rows_written 17 / queries 10 · cron "0 19 * * *" · stale: false
```

### ② 거짓 `blocked:*` = 0건
```
시각대별   10-10 19: 15 · 10-11 19: 14 · 10-12 19: 16 · 10-13 19: 15 · 10-14 19: 15
          10-15 19:  0        ← 이번 회차
```

### 🔑 "0 = 측정 실패" 를 대조군으로 배제했다
- `cron-failures` 응답 정렬이 **DESC(최신 먼저)** 이고 **첫 행이 `2026-10-15 19:00:09`** → 창이 그 배치를 덮는다.
- 그 시각대에 행이 **5건 있다 — 전부 `stale:*`(진짜 경보)**, `blocked:*` 는 0.
  ⇒ 감시가 **살아 있으면서** 거짓 경보만 사라졌다. **양방향 통과.**
  `stale:*` 까지 0 이었다면 감시가 통째로 침묵한 것이고 그건 통과가 아니다.

### 📌 그 5건은 새 결함이 아니다
`stale:ads:enrich-influencer`(·2·3·4) + `stale:ads:maintenance` — 마지막 실행 18:04~18:05Z,
점검 19:00 ⇒ ~55분 공백. 이미 올라가 있는 미결 결재
**`docs/decisions/2026-10-15-ads-alarm-stall-alert.md`**(open · 기한 10-22)의 그 현상이다
(측정 체인이 매시 1~3회 돌고 멎는다). **새 보고로 올리지 말 것.**

### 다음 세션에 남기는 것
- 이미 쌓인 미해결 **1,331건**은 그대로다. 줄이려면 어드민에서 해결 처리 = **데이터 쓰기 → 결재**.
- 판정은 늘 **새 회차 건수**로 할 것(누적 건수는 과거를 끌고 있어 수리 여부를 말해 주지 않는다).
