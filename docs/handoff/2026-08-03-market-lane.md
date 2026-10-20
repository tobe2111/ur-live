# 상권 축 1단계 — 전통시장 수집 레인 (2026-08-03)

> 대표 지시 *"상인회·상권 DB — 조인만 하면 됩니다"* 의 **중심축**. 네 소스 중 **연락처가 붙어 오는 유일한 것**.

## 라이브 실측 (이 레인의 근거)

```
GET api.data.go.kr/openapi/tn_pubr_public_trdit_mrkt_api?serviceKey=…&pageNo=1&numOfRows=2&type=json
→ 200 · resultCode "00" · totalCount 1393
  {"mrktNm":"사기막골도자기시장","mrktType":"상설장","phoneNumber":"031-638-8388",
   "homepageUrl":"www.sagimakgol.com","storNumber":"62","rdnmadr":"경기도 이천시 …",
   "latitude":"37.29483104","longitude":"127.4119796","trtmntPrdlst":"의류+가정용품+…"}
```

**전화·홈페이지·점포수·좌표**가 한 번에 온다. 좌표가 있어 소상공인 상가정보(`B553077`, 이미 키 열림)
반경조회로 바로 조인된다.

## 저장 위치 — 새 테이블 0

`ad_company_leads` 에 `source='market'` · `category='지역조직'` · `subcategory='상인회'`(tier 3).
**이미 있는 축을 쓴다** — 새 카테고리를 만들면 필터·리포트·내보내기가 소스마다 갈린다.

⚠️ `market` 을 `REGISTRY_CATEGORY_SOURCES` 에 넣었다. 시장 이름("사기막골도자기시장")은 분류기의
`상인회|번영회|…` 규칙에 **안 걸리는데**, 원부가 이미 "전통시장"이라고 말해 주기 때문이다.
(동반: `CLASSIFY_RULES_VERSION` 4→5. 소급 대상은 사실상 0이지만 **실패 모드가 비대칭**이라 올렸다 —
불필요한 bump 는 한 번 더 훑는 비용이고, 안 올리면 영구히 옛 판정에 갇힌다.)

## 🪤 이 게이트웨이의 함정 (오늘 세 번 데인 것의 총합)

| 축 | 이 소스의 값 | 틀리면 |
|---|---|---|
| 호스트 | `api.data.go.kr` (**`apis.` 아님**) | 키를 안 실어 보냄 → `SERVICE_KEY_IS_NULL` |
| 경로 | `openapi/tn_pubr_public_trdit_mrkt_api` | `code 12` — 폐기로 오해하기 쉽다 |
| 파라미터 | `serviceKey`·`pageNo`·`numOfRows`·`type` **넷만** | `INVALID_REQUEST_PARAMETER_ERROR` |
| 필드명 | `mrktNm`·`phoneNumber`·`homepageUrl`·`rdnmadr` | **200 인데 저장 0** |

> 🔑 넷은 **각각 실측해야 한다.** 하나가 맞았다고 나머지가 따라오지 않는다 — 오늘 이 순서로 세 번 막혔다.

## 가드로 고정한 것

- `market-collect.test.ts` — 라이브 응답을 **픽스처로** 넣어 매핑 고정 + 금지 파라미터 4종 차단 + 배선(라우트·cron·어드민)
- `check-guard-mutations` 2건 — 금지 파라미터 주입 · 전화 필드 끊기
- ⚠️ **내 가드가 내 코드를 잡았다**: `check-cursor-after-loop` 가 "커서 저장이 시간 상한 없는 루프 뒤"를
  신고 → 벽시계 마감선(`ADS_MARKET_DEADLINE_MS`, 기본 20s) 추가. `check-budget-bookkeeping` 은
  "루프 뒤 D1 쓰기 몫을 안 남긴다" 를 신고 → `RESERVE = 2`.
- 600줄 래칫에 걸려 공공데이터 cron 4종을 `worker-ads/cron-public-data.ts` 로 분리(**동작 불변**).

## 다음 세션의 첫 액션

1. **게이트를 켜기 전에 어드민에서 수동 1회**:
   `POST /api/admin/partner-pool/collect-market` → `ads_market_stats` 확인.
   - `found>0 · saved>0` 이면 성공. `stopped_by` 도 같이 본다(`deadline` 이 잦으면 `ADS_MARKET_PAGES` 를 줄인다).
   - `found>0` 인데 `saved=0` 이면 → **필드 매핑**(200 은 성공이 아니다). `diag.sample` 의 원본 키를 볼 것.
2. 좋으면 대표께 `ADS_MARKET_ENABLED=true` 요청(cron 일 1회, 20 UTC = KST 05시).
3. 그다음: 소상공인 상가정보 **반경조회**(`storeZoneInRadius`, 필수 `radius`/`cx`/`cy`) 로
   시장별 점포 수·업종 구성을 붙인다. 키는 이미 열려 있다(2026-08-03 실측).

## 아직 안 한 것 (우선순위 순)

- 고시·보조금·낙찰 **딱지** — 연락처가 없어 단독으로는 리드가 안 된다. 리드가 쌓인 뒤 붙이는 게 순서다.
- 지자체 고시 크롤은 구청마다 구조가 달라 비용이 크다. **가장 나중.**

---

## 배포 후 실측 — **한 회차에 전량** (2026-08-03 저녁)

수동 1회(`POST /api/admin/partner-pool/collect-market`):

```
found 1,393 · saved 1,390 · stopped_by "end"   ← 원부를 끝까지 돌았다는 뜻
저장 1,390 → 전화 849(active) · 전화없음 541(보류) · 홈페이지 57
카테고리 전량 지역조직/상인회 ✅
지역: 서울 130 · 부산 87 · 대구 51 · 창원 44 · 인천 37
표본: 의정부제일시장(031-846-2617, 점포 334개) · 관고전통시장(점포 99개)
```

**점포 수가 함께 와서 우선순위가 그냥 나온다** — 334개 점포 시장 하나가 개별 매장 수백 곳과 맞먹는다.

## ✉️ 이메일 수집 — 구조적으로 낮다 (대표 질문)

```
상인회 1,390 → 홈페이지 보유 57(4%) · 전화만 798 · 이메일 0
1,390 전부 이미 보강 큐에 있음(레인 WHERE 와 동일 조건으로 확인)
그 큐 전체 158,754건 중 홈페이지 보유는 1,699 — 시장 57 은 그 앞줄에 있다
```

이메일 경로는 결국 **홈페이지를 찾아 크롤**하는 것 하나인데 상인회는 보유율이 4%다.
⇒ **이 축의 도달 채널은 전화(849)** 이고, 이메일은 크롤이 붙이는 만큼만 덤으로 받는 게 맞다.
(느리게 붙는 건 상인회 탓이 아니라 **크롤 처리량 붕괴**다 — `2026-08-03-enrich-throughput-collapse.md`.)

## 🛑 소상공인 상가정보 반경조인 — **하지 않기로 판단**(근거)

`storeZoneInRadius`·`storeListInUpjong` 둘 다 **200 + 키 열림**(필수 파라미터만 없음)이라 *할 수는* 있다.
그런데 얻으려던 것이 이미 있다:

```
description LIKE '%점포%' → 1,385 / 1,390
```

**점포 수·취급품목은 시장 원부가 이미 준다.** 반경조회가 추가로 주는 건 *개별 점포 목록*인데
그건 매장 후보(`store_prospects`) 영역이고 거긴 인허가로 **전화까지** 들어온다.
⇒ 시장당 1요청 × 1,390 을 태워 **중복을 얻는 셈**이라 지금은 가치가 낮다. 필요해지면 그때.

## 🔴 나라장터 레인이 죽어 있다 — 그리고 **후임 주소를 찾았다**

```
ads_naravendor_stats: saved 0 · total_runs 15 · fail_streak 5 (2026-07-29 부터)
error: HTTP 400 · NO_OPENAPI_SERVICE_ERROR   ← 오늘 인허가와 **같은 클래스**
```

현재 주소 `1230000/ao/UsrInfoService02/getPrcrmntCorpBasicInfo` 와 변형 2개 모두 code 12.
**살아있는 후임을 프로브로 찾았다**(같은 기관 `1230000`, 같은 키):

| 후보 | 결과 |
|---|---|
| `ao/PubDataOpnStdService/getDataSetOpnStdCntrctInfo` (계약정보) | **200 · 정상** — 계약명·금액·계약일·계약방식 |
| `ao/PubDataOpnStdService/getDataSetOpnStdBidPblancInfo` (입찰공고) | **200 · 정상** |
| `ao/PubDataOpnStdService/getDataSetOpnStdScsbidInfo` (낙찰) | 200 · `resultCode 08 필수값 입력 에러` — **존재는 한다**(날짜 범위 등 필요) |

대표가 말한 *"상권활성화 용역을 누가 따갔나 — 타깃과 경쟁사가 동시에 나온다"* 에 가장 가까운 건
**계약정보**다(`cntrctNm` 에 "상권활성화 용역" 이 들어온다).

### 다음 세션의 첫 액션
1. 계약정보 응답의 **뒷부분 필드**를 확인한다 — 프로브 본문이 900자에서 잘려 계약업체명 필드를 아직 못 봤다
   (`cntrctInfoUrl` 다음에 `bidNtceNo`/`opengDate`/`prvtcntrctRsn`… 이 이어진다).
   업체명이 있으면 `nara-vendor-collect.ts` 의 base/op 교체 + 필드 remap 으로 **작은 수리**다.
2. 업체명이 없으면 계약정보는 *신호*(예산·발주기관)로만 쓰고, 업체는 낙찰 API 로 간다(필수 파라미터 확인 필요).
3. ⚠️ **code 12 를 보고 "폐기"로 단정하지 말 것** — 오늘 그 오판을 했고 원인은 경로였다.
