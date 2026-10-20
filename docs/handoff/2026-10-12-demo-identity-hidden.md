# 2026-10-12 — 데모 티 제거 + "나머지" 전부 (SEO/GEO 마감)

**[E2 검증됨]** (tsc 0 · 유닛 18건 + 인접 66건 pass · 주입 15건 되돌려-검증 전부 빨간불 · 배포 전)

## 대표 지시

> **"데모인 것을 티내지마. 나머진 다 해줘."**

"나머지"는 직전 보고의 2~4순위다: 유어샵 soft-404 · `/region/*` 커버리지 · `/stays` ItemList ·
hreflang · `llms.txt`.

## 다음 세션의 첫 액션

1. **이 PR 의 E4** — 배포 후 Googlebot UA 로:
   ```bash
   UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
   for p in / /map /pass/2914; do
     echo -n "$p demo-deal="; curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o -F 'demo-deal' | wc -l
   done
   # 배포 전 기준선: / 43 · /map 48 · /pass/2914 1   →  전부 0 이어야 한다
   ```
   그리고 **반대 방향**도 함께 재라 — 홈 피드에서 데모가 여전히 **뒤에** 오는지(`DEMO_LAST` 가 안 깨졌는지).
   실상품 2건(2919 `달빛한스푼` 등)이 앞에 있으면 통과.
2. **#12 유어샵 soft-404** (아직 미착수):
   ```
   /u/zzz-does-not-exist-9999 → HTTP 200 · robots: index, follow
                                 x-ssr-status: CURATOR:self-fetch-400
   ```
   🔑 **술어를 넓히지 말 것.** `shouldNoindexMissingEntity` 에 400 을 더하면 *살아 있는 가게*가
   일시적 검증 버그로 400 을 받는 날 색인에서 빠진다(타임아웃을 일부러 제외한 것과 같은 이유).
   `zzz-does-not-exist-9999` 는 **모양이 멀쩡한 핸들**인데 400 이 온다 — **curator API 가 404 를
   주게 고치는 쪽**이 맞고, 그러면 기존 술어가 한 글자도 안 바뀐 채로 잡는다.
3. 남은 것: `llms.txt`(404) · hreflang(0건) · `/region/경기`·`/대구` 항목 0건 · `/stays` ItemList.
   뒤 둘은 **서브리퀘스트 예산을 먼저 재야 한다**(무료 50/인보케이션, 실측 ~49).

## 이번에 한 것 (커밋 넷)

### 1. 데모 티 제거 (`7ab454eb2`)

| | 내용 |
|---|---|
| 응답 | `toPublicProductRows` — `slug`·`is_demo` 제거 · `fcfs.demo` → `fcfs.boost: false`. 데모 SSOT 와 같은 파일 |
| 배선 | 리스트 응답 **단일 지점** + `/api/fcfs/active` 둘만 |
| 상세 | `PRODUCT_DETAIL_FIELDS` 에서 `'slug'` 제거 |
| 라벨 | 데모 전용 `결제하기`·`응모 불가`·`결제 불가` 분기 제거 → 실상품 문구(`구매하기`)로 통일 |
| 지도 | `demo` → `boost` · `boost` 함수명 충돌 피해 `boostRank` |
| 가드 | `demo-identity-hidden-2026-10-12.test.ts` 18건 + 주입 15건 |

## 이번에 배운 것 / 틀렸던 판단

1. **SELECT 에서 slug 를 빼려다 멈췄다.** 그러면 서버 자신의 `DEMO_LAST` 정렬과 `fcfs` 판정이
   **늘 false** 가 되어 대표 2026-07-04 지시가 에러 없이 깨진다. ⇒ SQL 은 두고 **직렬화 직전**에서만
   지운다. 라이브·materialized 두 경로가 그 한 줄을 함께 지나므로 두 벌이 갈릴 수 없다.
2. **라벨을 지우기 전에 2026-08-11 의 우려를 따졌다.** 그 분기는 실수가 아니라 결제 오인을 막으려
   일부러 만든 것이었다. 원인이 "데모라서" 가 아니라 **하단 버튼이 하필 '응모하기' 였던 것**임을
   확인하고서야 지웠다(`구매하기` + 버튼의 금액이 같은 보호를 한다). **일부러 만든 것을 지울 때는
   그게 막던 것이 다른 방법으로 막히는지 먼저 보여야 한다.**
3. **실상품 slug 가 NULL 이라는 실측이 이 작업을 가능하게 했다.** 추측으로는 "slug 를 빼면 URL 이
   깨진다" 고 판단했을 것이다(실제로 `canonicalDetailPath` 는 id 기반이다).
4. 기존 가드 둘이 변경을 잡았고 **풀지 않고 재조준**했다(`map-feed-demand-loading` 의 total 앵커 ·
   인라인 주입 *"338곳을 50곳이라"*). 둘 다 불변식은 그대로이고 앵커만 옮겼다.

## 대표 판단 대기 (기술 아님)

- **실제 입점 매장이 2곳**(활성 50건 중 48건이 데모)이다. 데모 티를 지워도 *실물이 없다*는 사실은
  안 바뀐다 — "동네 맛집 할인권" 질의에 우리를 쓸 이유는 입점이 늘 때 생긴다.
- 데모 357건의 색인 유지는 대표 결정(2026-10-12 *"그냥 두기"*)이다. 이번 작업은 *어느 것이 데모인지*
  를 안 알리는 것까지다.


### 2. 형식이 틀린 유어샵 핸들 → 404 (`eb52f2c49`)

제 처음 진단이 반쪽 틀렸다 — *없는* 핸들은 이미 404+noindex 였고 **형식이 틀린** 핸들
(하이픈)만 200+index 였다. 술어를 넓히는 대신 **API 가 404 를 주게** 고쳤다. 읽기 404 ·
쓰기 400 · 가용성 조회 200 이 각자 다른 코드를 지키고 가드가 셋을 따로 잠근다.

### 3. `/llms.txt` 신설 (`d6fd5f52b`)

종전 404. 내용은 기존 SSOT 셋(`CONCEPT_ABOUT_LINES`·`CONCEPT_FAQ`·`CONSUMER_SURFACE_SEO`)에서
생성 — 실측 8,781바이트 / 표면 23개 / Q&A 14건 / noindex 표면 0건. `sitemapRoutes` 에 얹어
잠금표 `worker/index.ts` 무접촉. FAQ 는 `'서비스'` 카테고리를 앞에 놓는다(그러지 않으면 AI 가
처음 읽는 문장이 "주문을 취소하고 싶어요" 다).

### 4. 목록 네 표면 요약 + `/stays` ItemList

Googlebot UA 전수 실측에서 **색인 대상 17경로 중 11개가 15~40자**였다. 시드가 이미 있는 넷
(`/vouchers`·`/browse`·`/map`·`/stays`)에 요약을 넣고, `/stays` 는 홈과 같은 캐시 키를 받아
ItemList 까지 낸다(추가 self-fetch 키 0). 래칫 2672 유지 — 분기를 새로 안 만들고 지역 분기
조건에 한 줄 얹었다.

## 하지 않은 것 — 선행 조건이 없다 (셋 다 이유가 다르다)

### `/region/경기`·`/대구` 항목 0건 (#14)

홈 시드 1페이지 50건의 분포가 `서울 44 · 강원 3 · 전북 1 · 부산 1 · 경북 1` 이다. 지역별 시드로
가면 캐시 키가 44개로 갈려 cron 예열(`HOT_PATHS`)을 못 맞고, `region` 파라미터 경로는
`region_dong_code` 기반이라 `/region/서울`(시도 이름) 과 매핑이 필요하다. **그리고 값이 낮다** —
서울 44건이 거의 전부 데모이고, 지역 페이지에 항목이 뜨는 가치는 **실제 입점이 늘 때** 생긴다.

### `/stays` 외 시드 없는 표면 (#15 의 나머지)

`/experience`·`/new-openings`·`/creators`·`/partners`·`/join` 은 재사용할 캐시 키가 없다. 새
self-fetch 는 *추가 요청 0* 규율을 깨므로 예산(무료 50/인보케이션, 실측 ~41 — 도매 철거로
45→41)을 먼저 재야 한다.

### hreflang (#8)

**낼 대상 URL 이 없다.** 언어 전환이 `i18n.changeLanguage` + localStorage 로만 동작해 URL 이
안 바뀐다(`<html lang="ko">`·`og:locale: ko_KR` 은 이미 있다). 같은 URL 을 여러 언어로 선언하면
구글이 모순으로 본다 ⇒ hreflang 은 "메타 한 줄" 이 아니라 **언어별 URL 체계 신설**이고, 한국
서비스에 해외 사용자가 0 인 지금 값이 불확실하다.

## 다음 세션의 첫 액션 (배포 후 E4 넷)

```bash
UA='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
# ① 데모 티 — 전부 0 이어야 한다 (배포 전: / 43 · /map 48 · /pass/2914 1)
for p in / /map /pass/2914; do echo -n "$p "; curl -sS -A "$UA" "https://urdeal.kr$p" | grep -o -F demo-deal | wc -l; done
# ② 데모-후순위 정책이 안 깨졌는지 — 홈 피드 앞쪽에 실상품(2919 등)이 오는지
# ③ soft-404
curl -sS -A "$UA" -o /dev/null -w '%{http_code}\n' https://urdeal.kr/u/my-shop   # 404 기대
# ④ llms.txt + 목록 본문
curl -sSI https://urdeal.kr/llms.txt | head -3                                    # 200 + text/plain
for p in /vouchers /browse /map /stays; do echo -n "$p "; curl -sS -A "$UA" "https://urdeal.kr$p" | grep -c '<noscript>'; done
```
