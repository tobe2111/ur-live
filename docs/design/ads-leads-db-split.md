# 📣 유어애즈 발굴 리드 → 전용 D1 분리 (2026-08-19)

> 🧱 **레일**: 📣 유어애즈(수집) + 공통 인프라. 🎟️ 유어딜 / 🏪 공구 서비스 / 🏭 도매몰 **런타임 무접촉**.
> 💰 **머니 접촉: 없음** — 결제·정산·적립·환불·원장 코드는 한 줄도 안 바뀐다.
> 🔙 **롤백**: 바인딩(`ADS_DB`)을 떼면 즉시 원상복구. 코드는 바인딩이 없으면 현행과 동일하게 동작한다.

## 1. 무슨 일이 있었나 (실측)

```
toss-live-commerce-db   494 MB   ← 무료 플랜 DB 한도 500 MB 의 약 99%
```

`ur-ads` 는 **워커만** 분리돼 있었고 **DB 는 한 번도 분리된 적이 없다** —
`wrangler.toml` 과 `wrangler-ads.toml` 의 `database_id` 가 같은 uuid 였다.

| | 실데이터 | 최근 7일 증가 |
|---|---|---|
| 📣 유어애즈 수집 | **263.6 MB (92%)** | **+123,368행** |
| 🎟️ 유어딜 · 🏭 도매 전부 | 22.1 MB (8%) | +179행 |

```
ad_influencer_leads  125.9 MB / 122,558행   ad_company_leads 77.7 MB / 341,926행
store_prospects       53.4 MB / 209,228행   supply_maker_leads 5.4 MB / 25,584행
```

⇒ 한도에 닿으면 유어애즈만 멈추는 게 아니라 **주문·결제 쓰기가 같이 죽는다.**
**유어딜은 원인이 아니라 인질이다.**

📌 같은 뿌리의 2차 피해: **주간 D1 백업이 2026-08-02 이후 죽었다**(08-09·08-16 미실행).
실패 기록조차 없다 = 예외가 아니라 워커가 통째로 죽었다는 뜻이고, 성공했던 회차가 이미
**147초**나 걸렸던 걸 보면 덤프가 한도를 넘긴 것으로 보인다. 리드가 빠지면 덤프는 22 MB 수준이 된다.

## 2. 왜 "지우기"가 아니라 "이사"인가

SQLite 는 **행을 지워도 파일이 줄지 않는다**(빈 페이지로 남고 `VACUUM` 이 필요한데 D1 은 못 쓴다 —
`PRAGMA freelist_count` 도 `not authorized`). 그래서 이 작업의 목표는 **"파일을 줄이는 것"이 아니다.**

| | 지금 | 이사 후 |
|---|---|---|
| 크기 | 494 MB **이고 매일 커짐** | 494 MB **인데 안 커짐** |
| 절벽 | 며칠 | **없음** |
| 백업 | 죽음 | **되살아남** (덤프는 파일이 아니라 *행*을 읽는다) |
| 결제 위험 | 유어애즈가 결제를 인질로 잡음 | **분리됨** |

즉 **"안전"이 아니라 "안정"** 이다. 파일을 실제로 줄이는 작업(D1 export → 새 DB import)은
급하지 않으니 **나중에 제대로** 한다 — 결제 DB를 급하게 갈아엎는 건 하면 안 되는 일이다.

## 3. 무엇을 옮기고 무엇을 남기나

**옮긴다(7개)** — SSOT 는 `src/shared/ads/leads-db.ts` 의 `ADS_LEADS_TABLES`:
`ad_influencer_leads` · `ad_company_leads` · `store_prospects` · `supply_maker_leads` ·
`ad_discovery_keywords` · `ad_company_keywords` · `ad_email_suppress`

**남긴다** — 특히 `ad_slots` · `ad_bids` · `ad_accounts`. 이름은 `ad_` 로 시작하지만
**유어딜 셀러의 광고슬롯 입찰 기능**이고 `sellers` 와 조인한다. 옮기면 그 조인이 깨진다.

> `ad_email_suppress` 는 리드가 아닌데도 옮긴다 — **`ad_company_leads` 와 같은 `.batch()` 에
> 묶여 있어서**다. 안 옮기면 그 batch 가 두 DB에 걸쳐 원자성을 잃는다.

## 4. 어떻게 — 호출부 267곳을 안 건드리는 방법

깊은 함수들이 `DB: D1Database` 를 **인자로** 받으므로 어느 핸들을 넘길지 일일이 판단하면
70여 파일에서 사람이 실수하기 딱 좋다. 대신 **SQL 을 보고 목적지를 고르는 얇은 라우터**를 끼웠다.

```ts
const DB = adsLeadsDb(c.env)         // ADS_DB 없으면 c.env.DB 그대로 (래퍼조차 안 만든다)
DB.prepare('SELECT … FROM ad_influencer_leads …')  // → ADS_DB
DB.prepare('SELECT … FROM orders …')               // → DB
```

이게 안전한 이유는 실측된 전제 하나 때문이다 — **이사 대상은 남는 테이블과 같은 쿼리에
등장하지 않는다.** 그 전제를 `src/tests/unit/ads-leads-db.test.ts` 가 매번 다시 잰다(R1~R3).

## 5. 🩸 이 작업에서 틀렸던 판단 — **가드가 사람을 이겼다**

처음 만든 스캐너가 SQL 문자열을 정규식으로 떴다:
`` /(?:`|'|")([^`'"]{20,6000}?)(?:`|'|")/gs ``. 파일에 홑따옴표가 홀수면(주석의 `don't` 하나로도
충분하다) 짝이 밀린다. 그 상태로 레포를 훑고 **"교차 조인 0건, 자를 자리가 깨끗하다"** 고
대표에게 보고했다.

**주입 검증에서 드러났다** — 일부러 심은 `FROM ad_influencer_leads l JOIN orders o …` 를
스캐너가 못 봤다(문자열 후보 38개 중 0). 문자 단위 스캐너로 바꾸자 **진짜 위반 1건**이 나왔다:

```
src/features/marketing/api/lead-claim.ts : ad_influencer_leads × affiliate_earnings
  SUM(CASE WHEN EXISTS (SELECT 1 FROM affiliate_earnings ae WHERE ae.referrer_id = …) …)
    FROM ad_influencer_leads l …
```

바인딩을 붙이는 순간 이 쿼리는 `no such table` 로 죽었을 것이다. 쿼리를 둘로 쪼개 고쳤다
(`adsLeadsDb` 라우터라 호출부는 그대로 — ①은 유어애즈 DB, ②는 결제 DB로 자동으로 갈린다).

> 🔑 **교훈**: "스캔했더니 0건"은 **스캐너가 옳을 때만** 0건이다. 0건 보고 전에 **일부러 심어 보라.**
> 이 레포가 반복해 겪은 실패 양식(`check-guard-mutations` 매니페스트)의 또 한 사례다.

## 6. 단계 — 누가 무엇을

| 단계 | 누가 | 무엇 | 상태 |
|---|---|---|---|
| ① 코드 스위치 | 세션 | `adsLeadsDb` 라우터 + 가드 + 마이그레이션 도구 | ✅ 이 PR |
| ② 바인딩 | **대표** | D1 생성 + `ADS_DB` 바인딩 + 수집 레인 일시정지 | ⏳ 아래 §7 |
| ③ 이사 | 세션 | 스키마 → 복사 → **대조** | 대기 |
| ④ 원본 삭제 | 세션 | 대조 통과 후에만 | 대기 |

## 7. ② 대표가 할 일 — 화면 이름까지

> ⚠️ **①을 먼저 배포한 뒤에** 하십시오. 순서가 바뀌면 어드민 화면이 빈 목록을 보여줍니다
> (테이블이 새 DB에 아직 없어서).

### 7-1. 수집 레인을 잠시 멈춘다 (이사 중 새 행이 끼어들지 않게)

`Workers & Pages → ur-ads → Settings → Variables and Secrets` 에서 아래 값을 **`false`** 로:

```
ADS_COMPANY_COLLECT_ENABLED   ADS_LOCALDATA_ENABLED   ADS_HIRA_ENABLED
ADS_NEIS_ENABLED              ADS_NPS_ENABLED         ADS_COMMERCE_ENABLED
ADS_STORE_KAKAO_ENABLED       ADS_FRANCHISE_ENABLED   ADS_COLLECT_CAFE_ENABLED
```
(끄기 싫으시면 건너뛰어도 됩니다 — 이사 중 들어온 행은 ③에서 다시 복사합니다. 다만
④ 직전에 한 번 더 대조해야 하니 시간이 더 걸립니다.)

### 7-2. D1 을 새로 만든다

`Storage & Databases → D1 → Create database`
- 이름: **`urads-leads-db`**
- 생성 후 **Database ID(uuid)를 복사**해서 저에게 알려 주십시오. 그게 있어야 이사를 시작합니다.

### 7-3. 바인딩을 **두 곳**에 붙인다

같은 DB를 **두 워커**가 봅니다. 유어애즈 수집기가 쓰고, **어드민 화면이 읽습니다**
(`/admin/partner-pool` · `/admin/store-prospects` 는 메인 워커에 있습니다). 하나만 붙이면 반쪽이 깨집니다.

| 어디 | 경로 | 변수 이름 |
|---|---|---|
| 유어애즈 워커 | `Workers & Pages → ur-ads → Settings → Bindings → Add → D1 database` | **`ADS_DB`** |
| 소비자 Pages | `Workers & Pages → ur-live → Settings → Bindings → D1 database bindings` (Production·Preview 둘 다) | **`ADS_DB`** |

⚠️ 변수 이름은 **정확히 `ADS_DB`** 여야 합니다(대문자, 밑줄).
⚠️ `ur-live` 는 Pages 라 **Production 과 Preview 를 따로** 지정해야 합니다.

### 7-4. 저에게 알려 주실 것

1. 새 DB 의 **uuid**
2. 바인딩을 **두 곳 다** 붙였는지
3. 수집 레인을 껐는지(껐다면 나중에 다시 켜 드려야 하니 알려 주세요)

그러면 제가 ③(스키마 → 복사 → 대조)를 돌리고 결과를 숫자로 보고드립니다.
**대조가 하나라도 어긋나면 ④(원본 삭제)는 실행 자체가 거부됩니다** — 도구에 그렇게 박아 뒀습니다.

## 8. 되돌리는 법

- **②까지 한 상태에서 되돌리기**: `ADS_DB` 바인딩 제거 → 라우터가 즉시 `DB` 로 전부 되돌아감.
- **③까지 한 상태**: 원본이 그대로 있으므로 ②와 동일. 새 DB는 그냥 버리면 됨.
- **④ 이후**: 새 DB가 유일한 원본이 된다. 그래서 ④는 대조 통과 + 명시 플래그 2개를 요구한다.
