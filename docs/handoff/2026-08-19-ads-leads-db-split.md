# 📣 유어애즈 리드 DB 분리 — 1단계(코드 스위치) (2026-08-19)

> 🧱 **레일**: 📣 유어애즈(수집) + 공통 인프라. 🎟️ 유어딜 / 🏪 공구 서비스 / 🏭 도매몰 **런타임 무접촉**.
> 💰 **머니 접촉: 없음.** 🔙 **롤백**: `ADS_DB` 바인딩을 떼면 즉시 원상복구(코드는 바인딩 없으면 현행 동일).
> 📐 설계·대표 실행 절차: `docs/design/ads-leads-db-split.md`

## 0. 다음 세션의 첫 액션

**대표가 새 D1 uuid 를 알려 주면 ③(이사)을 시작한다.** 그전까지 코드 작업은 없다.

```bash
# 이사 도구 — 읽기(plan)는 지금도 된다
node scripts/migrate-ads-leads-db.mjs --plan
#   → 716,488행 (ad_influencer_leads 122,553 · ad_company_leads 341,926 · store_prospects 209,228 …)
node scripts/migrate-ads-leads-db.mjs --to <uuid> --schema   # ①
node scripts/migrate-ads-leads-db.mjs --to <uuid> --copy     # ② 재시작 가능
node scripts/migrate-ads-leads-db.mjs --to <uuid> --verify   # ③ 대조 (실패하면 ④ 거부)
```
⚠️ `--copy` 부터는 **D1 Edit 권한 토큰**이 필요하다. 세션 기본 토큰은 조회 전용이라 여기서 막힌다 —
그건 버그가 아니라 설계다(쓰기는 대표가 의도적으로 열어 줄 때만).

**크기 재측정**(하루 뒤 판정용):
```bash
curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACC/d1/database/d9530ba6-7a26-4c02-9295-3ce5aef112a3" \
  -H "Authorization: Bearer $CFT" | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['file_size'])"
#   2026-08-19 06:00Z 기준 494,182,400
```

## 1. 왜 (실측)

```
toss-live-commerce-db  494 MB   ← 무료 플랜 DB 한도 500 MB 의 99%
유어애즈 수집 263.6 MB (실데이터의 92%)  ·  유어딜·도매 전부 22.1 MB (8%)
최근 7일 증가:  유어애즈 +123,368행   /   그 외 +179행
```

`ur-ads` 는 **워커만** 분리돼 있었다 — `wrangler.toml` 과 `wrangler-ads.toml` 의 `database_id` 가
**같은 uuid** 였다. 대표가 *"C는 했지 않아?"* 라고 물은 것도 그래서인데, 나뉜 건 연산이고 저장소가 아니다.

📌 2차 피해: **주간 D1 백업이 08-02 이후 죽었다**(08-09·08-16 미실행, 실패 기록조차 없음 =
워커가 통째로 죽음). 성공한 마지막 회차가 이미 147초였다. 리드가 빠지면 덤프는 22 MB 수준이 된다.

## 2. 완료분 (이 PR)

| 무엇 | 파일 |
|---|---|
| SQL 을 보고 목적지를 고르는 얇은 라우터 | `src/shared/ads/leads-db.ts` (신규) |
| 배선 — `env.DB` → `adsLeadsDb(env)` **270곳 / 43파일** | 코드모드(기계 치환) |
| 가드 R1~R3 + 라우터 단위테스트 13건 | `src/tests/unit/ads-leads-db.test.ts` (신규) |
| 이사 도구(삭제는 플래그 2개 필요) | `scripts/migrate-ads-leads-db.mjs` (신규) |
| 설계 + **대표 대시보드 절차** | `docs/design/ads-leads-db-split.md` (신규) |

**바인딩이 없으면 `adsLeadsDb(env)` 는 `env.DB` 를 그대로 돌려준다** — 래퍼조차 안 만든다.
그래서 이 PR 만 배포하면 동작은 오늘과 같다.

## 3. 🩸 이번에 틀렸던 판단 — **여기가 제일 값지다**

### ① "교차 조인 0건" 이라고 대표에게 보고했는데 **스캐너가 헛돌고 있었다**

SQL 문자열을 `` /(?:`|'|")([^`'"]{20,6000}?)(?:`|'|")/gs `` 로 떴다. 파일에 홑따옴표가 홀수면
(주석의 `don't` 하나로 충분하다) 짝이 밀린다. 실측: `lead-claim.ts` 는 `'` 72개 · `` ` `` 12개라
**일부러 심은 `FROM ad_influencer_leads l JOIN orders o …` 를 후보 38개 중 0개로 놓쳤다.**

문자 단위 스캐너로 바꾸자 **진짜 위반 1건**이 나왔다:
```
lead-claim.ts getFunnelTailStats:
  SUM(CASE WHEN EXISTS (SELECT 1 FROM affiliate_earnings ae …)) FROM ad_influencer_leads l …
```
바인딩을 붙이는 순간 `no such table: affiliate_earnings` 로 죽었을 쿼리다. 둘로 쪼개 고쳤다.

> 🔑 **"스캔했더니 0건"은 스캐너가 옳을 때만 0건이다.** 0건을 보고하기 전에 일부러 심어 볼 것.

### ② `UPDATE ... SET` 의 `SET` 을 테이블로 셌다
`INTO|UPDATE` 를 테이블 추출에 넣자 `ON CONFLICT DO UPDATE SET` 이 `SET` 이라는 테이블로 잡혀
오탐 6건. 키워드 제외 목록 추가.

### ③ **기존 테스트 9개가 `env.DB` 라는 철자에 묶여 있었다**
6개 파일이 배선을 `toMatch(/…\(env\.DB…/)` 로 검사했다. 핸들 이름만 바뀌었는데 빨간불이 떴다 —
**리팩토링이 가드를 무력화하는 방향이 아니라, 가드가 리팩토링을 막는 방향**의 같은 병이다.
`(?:adsLeadsDb\((?:c\.)?env\)|(?:c\.)?env\.DB)` 로 **의도**를 검사하게 바꾸고,
**배선을 실제로 끊어(`getPoolTimeline(someOtherDb, …)`) 여전히 빨강인지 확인**했다.

### ④ 파이썬 f-string 이 정규식을 이중 이스케이프했다
치환으로 만든 TS 정규식이 `\\(` 가 돼 아무것도 안 맞았다. 6파일 12곳. **한 번에 안 되면
"고쳤다"가 아니라 "다시 재라"** — 재실행으로 잡았다.

## 4. 남은 결정 / 대기 (대표 몫)

1. **새 D1 생성 + `ADS_DB` 바인딩 2곳**(ur-ads · ur-live Pages Production/Preview) — 절차는
   `docs/design/ads-leads-db-split.md` §7 에 화면 이름까지 적어 뒀다. **uuid 를 알려 주셔야** ③을 시작한다.
2. **수집 레인 일시정지 여부** — 안 껐으면 이사 중 들어온 행을 ③에서 다시 복사해야 한다(더 느릴 뿐 안전).
3. **파일 크기는 안 줄어들 수 있다** — SQLite 는 삭제로 파일이 안 줄고 D1 은 `VACUUM` 이 막혀 있다
   (`PRAGMA freelist_count` → `not authorized`). 이 작업의 목표는 **"안전"이 아니라 "안정"** 이다:
   494 MB 인데 **더 안 커진다** + 백업이 되살아난다. 파일을 실제로 줄이는 export→import 는 별도 건.
4. **백업 부활 확인** — 이사 후 첫 일요일(08-23) `cron_hb:d1-backup` 이 찍히는지.

> 📔 **Notion 미기록** — 이 세션에 MCP 미연결. 연결된 세션이 남길 것: 작업=유어애즈 리드 DB 분리(1단계) ·
> 서비스=유어애즈 · 머니 경로=없음 · PR=이 PR.
