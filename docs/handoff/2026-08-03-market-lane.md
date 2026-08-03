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
