# 08-02 — 수집 조건을 화면에서 정한다 (①②③ 전부 완료)

> ⏰ 시각은 KST. DB 스탬프는 `Z` 없는 UTC 문자열이라 그대로 읽으면 9시간 어긋난다(+9h 변환).

## 대표 지시

> "완전히 수집 기능이 구현되면 페이지에서 직접 수집하고자 하는 카테고리나 조건을 설정할 수 있는거지" → **"모두 가장 이상적으로 진행"**

## 착수 전 실측 — 셋이 서로 다른 상태였다

| 풀 | 화면에서 설정 | 실체 |
|---|---|---|
| 인플루언서 | ✅ 된다 | `/admin/influencer-pool` `KeywordManager` |
| 파트너(업체) | ⚠️ **API는 있는데 화면이 0** | `GET/POST /api/admin/partner-pool/keywords` 살아 있음, 페이지 배선 없음 |
| 매장(카카오·인허가) | ❌ 안 된다 | 업태가 코드 상수 — 배포해야 바뀜 |

두 번째가 이 레포의 반복 클래스다 — **기능이 없는 게 아니라 보이지 않았다.**

## ① 완료 — 파트너 풀 업종 on/off

**설계를 바꿨다.** 처음엔 "키워드 관리 화면"을 만들려 했는데 라이브를 재보고 접었다:

```
ad_company_keywords  4,546개  ↔  업종 32개
간판·광고물 제작 1,172 · 창고형 공동구매 705(저장 0!) · 종합광고기획 470 · …
```

키워드는 **(지역 235 × 업종)의 곱**이다. 개별 토글이면 "카페 그만"이 235번의 클릭이 된다
(인플루언서 화면이 같은 이유로 렉 수리를 겪었다 — 칩 수백~1,000개). **사람이 내리는 결정의 단위는 업종**이다.

- `company-trades.ts` — 업종 키 `TRADE_EXPR` 상수 하나로 집계·토글·가드가 **같은 식**을 쓴다.
  두 벌로 두면 화면에서 끈 줄 아는 업종이 계속 캐진다.
- `partner-pool-trades.routes.ts` — 별도 파일(모 파일이 598줄로 600 캡에 붙어 있었다).
- `partner-pool/TradePanel.tsx` — 수확(저장) **순 정렬**. 어느 업종이 값을 만드는지 보여야 끌 결정을 한다.
  실측상 `창고형 공동구매`가 705키워드에 **저장 0** — 바로 끌 후보다.

🛡️ **마지막 활성 업종은 못 끈다**(`LAST_ACTIVE_TRADE`). 전부 끄면 회전 쿼리가 0행을 받아 수집이
**에러 없이** 멈추고 하트비트는 초록으로 남는다(레인은 정상 실행되고 할 일이 없을 뿐이다).
클릭 한 번으로 그 상태가 되면 안 된다. 그리고 **왜 막았는지를 화면에 사람 말로** 띄운다.

⚠️ 이 패널은 **새 스위치를 만들지 않았다.** 수집 회전은 원래부터 `WHERE active = 1` 로 돈다 —
그 값을 노출했을 뿐이다. 새로 만들었으면 수집 경로와 갈라졌을 것이다.

## ② 완료 — 매장 업태를 DB 로

- **업태만**(19행) 테이블(`ad_store_trades`). 파트너처럼 키워드 4,465행을 materialize 하지 **않았다** —
  이 레인은 이미 서브리퀘스트 기아(`stopped_by: budget`)라 시드 마라톤을 돌리면 그동안 수집이 0 이 된다.
  지역×업태 곱은 런타임 생성 유지.
- 시드는 `INSERT OR IGNORE` — **어드민이 끈 업태를 재배포가 되살리지 않는다**.
- 🔑 **폴백 규칙이 이 작업의 핵심이다.** 두 가지 "비었음"이 뜻이 정반대다:
  - 조회 실패 / 테이블 자체가 빔 → **코드 상수 폴백**(설정 조회 실패로 수집을 멈추지 않는다)
  - 읽었는데 그 블록의 활성 업태가 0 → **폴백하지 않는다.** 그건 대표의 선택이고, 되돌리면
    끈 것이 조용히 되살아난다 — 화면은 OFF 인데 수집은 계속 도는, 설정이 무력화되는 가장 나쁜 실패.
- 업태별 수확 누적(`found_total`/`saved_total`). ⚠️ 저장수는 업태별로 분해 불가(upsert 가 전체 단위)라
  **발굴 비율로 배분**한다 — 정확한 수인 척하지 않고 그 사실을 주석에 남겼다.

## ③ 완료 — 회차 조건(권역·비중·페이지·예산)

- `platform_settings.ads_store_kakao_config`. **저장할 때와 읽을 때 양쪽에서 clamp** —
  한쪽만 자르면 옛 배포가 쓴 값이나 손입력이 통과한다.
- 범위: 비중 0.1~0.9 · 페이지 1~3 · 예산 5~60. **화면이 상한을 뚫을 방법을 두지 않았다** —
  슬라이스를 무제한 올릴 수 있게 하면 그건 *CPU 한도로 죽는 문을 화면에 다는 것*이다
  (NEIS 6→3 · NPS 100→40, 둘 다 올린 날 죽어서 되돌린 전례).
- 지역은 `REGION_GROUPS`(company-keyword-grid 에서 신규 export) 단위. 지역 배열이 평평해서
  (`강남`·`부산 해운대`·`수원`) 접두사로는 서울을 못 고른다 — 권역 묶음이 필요했다.
  ⚠️ 순서는 항상 `S2_REGIONS` 를 따른다(선택 순서로 만들면 같은 설정에서도 커서가 흔들린다).
  ⚠️ 매칭이 0이면 **전국으로 되돌린다** — 침묵하는 0 보다 넓게 도는 편이 낫다.
- 조건 옆에 **직전 회차의 `elapsed_ms`/`stopped_by`/`spent`** 를 띄운다. 숫자를 바꾸게 하면서
  결과를 안 보여주면 추측으로 조정하게 된다. `deadline` 이면 "슬라이스를 줄이세요"로 경고.

## 🐛 시험이 잡은 실제 결함

`clampStoreConfig` 의 첫 구현이 `Number(v)` 하나였는데, `Number(null)`·`Number([])`·`Number('')` 가
전부 **0** 이라 "값 없음"이 기본값이 아니라 **하한**으로 조용히 바뀌었다(`max_pages: null` → 3 이 아니라 1).
이 레포가 부분환불에서 이미 당한 클래스다(`{amount: []}` → 0원 환불, #941). 숫자/숫자문자열만 받게 고쳤다.

## 남은 것

- 파트너 풀에도 ③(회차 조건)을 붙일 수 있다 — 지금은 매장만. 같은 `clampStoreConfig` 모양을 따르면 된다.
- 인플루언서 풀은 이미 자기 화면이 있어 손대지 않았다(세 화면을 하나로 합치는 건 별개 결정).

## ⚠️ 같은 지시를 두 세션이 동시에 받았다 (다음 세션이 알아야 할 것)

**#952 가 같은 문제를 독립적으로 풀어 먼저 머지됐다.** 같은 이유로 같은 파일 분리(600 캡)까지 했다.
확인 결과 **중복이 아니라 보완**이라 둘 다 남겼다:

| | #952 `CompanyKeywordManager` | 이 PR `TradePanel` |
|---|---|---|
| 단위 | 개별 키워드(상위 80 + 검색) | **업종 32개 일괄** |
| "카페 그만" | 235번 클릭 | **1번** |
| 정렬 | tier 순 | **수확(저장) 순** — 값을 만드는 업종이 보인다 |

⚠️ 앞으로 이 화면을 손볼 때 **둘을 하나로 합치려 하지 말 것** — 단위가 다르고, 4,546개 목록에서
업종을 끄는 건 개별 칩으로는 불가능하다. 합치려면 "업종 행을 펼치면 그 지역 키워드가 나오는"
계층 구조여야 하고, 그건 별개 결정이다.

**충돌 해소에서 함께 따라온 것**: main 이 `platformSubreqCap` → **`envSubreqCap(env)`**(요금제 연동,
#952)으로 바꿔 이 레인도 그쪽을 따르게 맞췄다. 유료 전환 시 이 레인의 천장도 같이 오른다.

## 🔍 매장 수집이 느린 **진짜 이유** (16:13 KST 실측 — 다음 세션이 다시 파지 말 것)

머지 후 카카오 매장 레인이 5시간 넘게 안 돌아 원인을 규명했다. **고장이 아니라 도메인 예산이다.**

```
dispatch.by_domain (free · per_tick 8)
  influencer  예산 3 / 레인 6  → 2.0 회차마다
  company     예산 3 / 레인 5  → 1.7 회차마다
  prospect    예산 1 / 레인 5  → ⚠️ 5.0 회차마다   ← collect-store-kakao 가 여기
  wholesale   예산 1 / 레인 1  → 매 회차
```

`deferred` 목록에 `collect-store-kakao` 가 실재함을 확인했다(= 큐에는 있다). 즉 **대기지 부재가 아니다.**

⚠️ **그런데 이건 대표 우선순위와 어긋난다.** 07-29·08-02 지시가 "음식점·카페·미용·숙박"인데
그걸 채우는 유일한 레인이 **가장 좁은 몫**을 받는다. `prospect` 도메인에 수집 4 + 보강 1 이 몰려
있어서 생긴 구조다.

🚫 **이 파일(`dispatch-budget.ts`)은 PR #943(다른 세션)이 방금 만든 것이다 — 손대지 말 것.**
조정이 필요하면 대표 판단을 받고, 그 세션과 겹치지 않게 조율할 것. 나는 사실만 보고했다.

**진단 명령**(이 스냅샷은 어드민 API 로만 보인다 — 전용 diag 라우트는 404 다):
```bash
curl -sS ".../api/admin/ads/influencer-pool/stats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(json.dumps(d['data']['diag']['dispatch'],ensure_ascii=False)[:800])"
```

## 이번에 틀렸던 판단

- "키워드 관리 화면을 붙이면 된다" — 규모를 안 보고 시작했다. 4,546개짜리 목록은 **만들어도 못 쓴다.**
  라이브를 먼저 세어 본 것이 설계를 바꿨다.
- 새 어드민 페이지(`/admin/collect-config`)를 만들려다 접었다 — `App.tsx` 가 baseline 1109줄로 동결이라
  라우트 2줄이 안 들어간다. 파트너 풀 페이지 안에 두는 게 맞기도 하다(그 풀의 설정이다).
- 시험 하나가 **아무것도 검사하지 않으면서 초록**이었다 — `const r = await DB.prepare` 로 구간을 잘랐는데
  그 문자열이 위 집계 함수에도 있어 슬라이스가 **빈 문자열**이었다. 가드 블록 시작에서 앞으로 자르게 고쳤다.

## 검증

`tsc 0` · `audit-gate ALL GREEN 81` · `check-guard-mutations` **30/30**(신규 6건 + main 합류분) ·
되돌려-검증 수동 8건 전부 RED(마지막 활성 가드 / 토글 식 갈라짐 / 패널 미배선 / 빈 배열 폴백 /
시드 REPLACE / `/trades` 라우트 순서 / 예산 차감 제거 / trade 역산).

## ④ 후속 — 수동 실행 버튼 (조건을 바꿔도 확인할 길이 없었다)

위 ③ 을 붙이고 나서 드러난 갭이다. **조건은 화면에서 바꿀 수 있게 됐는데 효과를 볼 방법이 없다** —
이 레인은 `prospect` 도메인(예산 1 / 레인 5)이라 **약 5회차에 한 번**만 돈다. 학원·병원엔 수동 버튼이
있는데, 정작 대표 우선업종(음식점·카페·미용·숙박)을 채우는 **유일한 레인**에만 없었다.

- `store-prospects.routes.ts` 의 기존 위임 루프에 **배열 한 줄** 추가(`/collect-store-kakao`).
  루프가 이미 waitUntil·503(바인딩 없음)·502 를 다룬다 — 새 핸들러를 쓰면 그 셋이 갈라진다.
- 버튼은 `busySub` 상태를 공유하되 **자기 것일 때만** '수집 중…' 을 띄운다.

🔑 **여기서 진짜 위험한 건 404 가 아니라 404 가 성공처럼 보이는 것이다.** 위임 `kick()` 은
`catch { /* fail-soft */ }` 라 대상 경로가 틀려도 `{success:true, started:true}` 를 돌려준다 —
토스트는 "수집 시작"이 뜨고 아무 일도 안 일어난다. 게다가 이 레인은 원래 5시간에 한 번 도니
**"곧 되겠지"와 구분조차 안 된다.** 그래서 시험이 위임 목록 전체를 훑어 **ur-ads 쪽에 그 경로가
실재하는지 대조**한다(이번 한 건이 아니라 앞으로 추가될 것까지).

⚠️ 자동 회차와 겹칠 수 있다 — 저장이 upsert 라 오염은 없고 중복 조회만 생긴다(학원·병원과 동일).

## 🔴 정정 — 위 §"느린 진짜 이유"는 **절반만 맞았다** (17:14 KST 실측)

위에서 나는 원인을 *도메인 예산*으로 단정했다. 더 재 보니 **그것만이 아니었다.**
17:00 KST 정각 스냅샷에서 이 레인은 **분명히 뽑혔다**:

```
prospect: { budget: 1, run: ["collect-store-kakao"], deferred: [collect-hira, collect-neis, …] }
```

그런데 하트비트에는 그 회차의 `ads:collect-store-kakao` 가 **없다** — 최신 beat 이 아직
`02:00:22`(11:00 KST)다. 하트비트는 레인당 **최신 1개만** 남으므로, 없다는 건 그때 이후로
**한 번도 완주하지 못했다**는 뜻이다. 같은 정각의 다른 레인들이 답을 준다:

```
08:01:01  ok=false  ms=3649  ads:collect-commerce            CPU time limit
08:01:01  ok=false  ms=3649  ads:maintenance?phase=quality   CPU time limit
08:01:01  ok=false  ms=3701  ads:sheets-sync                 CPU time limit
```

**부모가 3.6초에 죽는다.** 이 레인이 마지막에 성공했을 때 걸린 시간은 `elapsed_ms: 8097` 이다 —
차례가 와도 완주할 시간이 애초에 없다. 05·06·07·08시 정각 모두 같은 모양이다.

⇒ **차례가 드문 것(예산)** 과 **차례가 와도 죽는 것(부모 CPU)** 은 별개의 두 원인이고,
   두 번째가 지금 지배적이다. 예산만 넓혀도 이 레인은 안 돈다.

🧩 **그래서 이 PR 의 수동 버튼이 편의 기능이 아니다.** 수동 실행은 어드민 요청 **자기 인보케이션**에서
   서비스 바인딩으로 들어가므로 7개 레인과 CPU 를 다투지 않는다 — **지금 이 레인이 도는 유일한 길**이다.

📌 `FREE_LANES_PER_TICK` 은 레포에 이미 **6**(#958)인데 17:00 KST 스냅샷은 `per_tick: 8` 이었다 —
   그 정각엔 아직 옛 빌드였다. **다음 정각에 `per_tick: 6` 으로 바뀌는지**가 #958 의 판정이다.
🚫 `dispatch-budget.ts`·`lane-domains.ts` 는 다른 세션(#943/#958) 소관 — 나는 재지 않은 것을 단정한
   잘못만 정정하고 손대지 않았다.

## ⑤ 후속 — **완주를 전제하지 않는다**(중간 정산)

위 정정이 드러낸 것: 이 환경에서 **끝까지 사는 회차가 예외**다. 그런데 코드는 정반대를 가정했다 —
캔 것을 전부 메모리에 모아 뒀다가 **맨 끝에서 한 번** 저장하고 커서를 올렸다.
중간에 죽으면 **캔 것도 전진도 통째로** 사라지고, 다음 회차가 같은 키워드를 또 훑는다. 또 죽으면 영원히 0 —
#927 통신판매 레인이 며칠 멈춰 있던 바로 그 구조다.

**고친 지점은 마감선이 아니라 저장 시점이다.** 자기 마감선(12초)은 부모 수명(3.6초)보다 길어 아무것도 못 막고,
3초로 줄이면 부모가 건강한 회차의 수확까지 같이 깎인다. 대신 **키워드 경계마다** 정산한다:

- 경계에서만 올린다 — 그 앞 키워드는 전부 조회 완료라 커서 값이 **정확**하다(페이지 중간이면 안 본 페이지를 본 것으로 표시한다).
- 중간 커서와 최종 반환이 **같은 식**을 쓴다(두 벌이면 한쪽이 조용히 틀린 자리를 가리킨다).
- 블록 경계에서도 한 번 — 뒤 블록에서 죽어도 앞 블록 수확이 남는다.

💰 **비용이 거의 0 인 게 이 설계의 핵심**이다. 저장 batch 는 어차피 내야 하는 값이고 추가분은 커서 write 뿐이다.

⚠️ 이 수리는 **부모 CPU 문제를 고치지 못한다**(그건 다른 세션 소관). 죽는 걸 막는 게 아니라
**죽어도 그때까지 캔 것이 남게** 한다 — 이 레인이 지금 0 을 반복하는 이유의 절반이 그것이다.

## ⑥ 후속 — 파트너 풀 **영구 사각지대**(같은 클래스, 라이브 실측)

⑤ 를 고치고 나서 "다른 레인도 같은 가정을 하나" 를 재 봤더니 파트너(업체) 레인에 **더 나쁜 것**이 있었다.

```
company 레인 실측 — keywords 실행 11개 · limit_hit: true · spent 51 · total_keywords 4,546
커서 전진:  (cursor + batch) % total     ← batch = 계획한 창 크기 12
```

**11개 돌고 12칸 전진한다.** 못 돈 1개는 다음 회차로 넘어가는 게 아니라 **건너뛰어진다.**
그리고 전진폭이 창 크기와 같아 창 경계가 `[0..11] [12..23] …` 로 **영원히 고정**된다 ⇒
매 회전 **같은 자리**가 빠진다. **지연이 아니라 영구 사각지대**이고, 오류도 경고도 안 난다.

수정은 한 줄(`batch` → `used.length`)이지만 **시험은 문자열이 아니라 행동으로** 고정했다 —
`rotationWindow` 로 "매 회차 11개만 돌고 끊기는" 상황을 500회 돌려 두 방식을 비교한다:
소비량으로 감으면 **전량 조회**, 창 크기로 감으면 **일부가 영영 안 돈다**(고치기 전 실제 동작).
정상 회차(11=12)에서는 두 방식이 **동일**하다는 것도 함께 고정했다 — 이 수정이 잘 도는 회차를 바꾸지 않는다는 뜻.

⚠️ 소비 0(첫 키워드 전 예산 고갈)이면 전진 0 이다. **맞는 동작**이다 — 아무것도 안 봤으니
전진할 근거가 없다. 전진시키면 안 본 것을 본 것으로 표시하게 된다.


## ⑦ 매장 이메일이 **8건**이던 이유 (라이브 실측 → 파트너 처방 이식)

```
매장 보강 1회차 — processed 8 · email_found 0 · remaining_no_email 46,174
                 deadline_hit true(9.0초) · spent 46/60   ← 예산은 남는데 시간이 먼저 끝난다
pass2_reason: site_naver 5 · crawl_blocked_host 4 · site_search 3 · crawl_robots 1
전체 매장 46,182건 — 전화 25,743(55.7%) · **이메일 8(0.017%)**
```

두 가지가 겹쳤다:
1. **처리량** — 시간당 8건. 46,174건이면 240일. 병목은 예산이 아니라 **벽시계**다.
2. **수율** — 찾은 사이트 8건 중 **4건이 차단 호스트**(인스타·블로그·카페). 소상공인의 '홈페이지'가
   대부분 그것이라 **이메일이 구조적으로 없다.**

🔑 **파트너 레인이 07-28 에 이미 배운 것을 이 레인만 못 배웠다** — `company-collect` 는 같은 실측
(그 풀의 22.9%가 플랫폼 URL)으로 선정 SQL 에 `PLATFORM_URL_SQL_EXCLUDE` 를 넣었는데, 매장 레인엔
없었다. **슬롯이 15가 아니라 8이라 이쪽이 더 치명적인데도.** 새 규칙이 아니라 **검증된 패턴의 이식**이다.

수리: Pass 1 선정 SQL 에 제외 절(+bind) · Pass 2 는 플랫폼 URL 이면 **크롤만 건너뛴다**.
⚠️ **주소는 버리지 않는다** — 소상공인에겐 그 블로그가 실제 접점이다. 크롤 *시도*만 뺀다.
   (`site = null` 로 주소까지 버리는 실수를 되돌려-검증 항목에 넣었다.)

📌 **기대치를 정직하게**: 이메일이 쏟아지지 않는다. 회차당 8슬롯 중 **4개를 되찾는 것**이고,
   진짜 사이트를 가진 행이 슬롯을 얻게 되는 것이다. 라이브 판정 = `pass2_reason.site_platform_skip`
   출현 + `processed` 증가.

🧭 **확정된 구조 판단**: 매장 풀의 접점은 **이메일이 아니라 전화**다(25,743 vs 8).
   파트너 풀은 반대(이메일 20,505). 두 풀을 같은 전략으로 캐는 것이 애초에 안 맞는다.

## ⑧ CI 공용 차단 해제 — `worker-ads/index.ts` 600 래칫

591 → 599 → **608**(#963, 오늘 다른 세션). 그 뒤 main 에서 갈라진 **모든 PR** 의 Verify 가
`STRICT_FILE_SIZE` 에서 막혔다. 우회하지 않고 소형 정기작업 3블록을 `periodic-jobs.ts` 로 분리해
**583줄**로 복귀 → `audit-gate` 가 오늘 처음 **ALL GREEN 81**.
상세는 `2026-08-02-paid-plan-scaling.md`.


## ⑨ **60회 돌아 0건인데 초록불** — 무수확 레인 관측 신설

```
collect-hira   총 60회 · total_saved 0 · diag.error "네트워크 오류: timeout"
collect(인허가) 총 27회 · total_saved 0 · diag.error "API: HTTP 500"
하트비트:       ads:collect-hira  ok=true  ms=25750     ← 초록이다
```
하트비트는 *"예외 없이 끝났는가"* 만 본다. 레인은 실패를 `diag.error` 에 얌전히 적고 **정상 종료**한다.
⇒ 어디서도 빨간불이 아니다. 그리고 **죽은 레인도 회차 순번을 똑같이 나눠 갖는다** —
대표 우선업종 레인(`collect-store-kakao`)이 그만큼 밀린다.

🔎 **경보 장치는 이미 있었다** — `collect-health-alert.ts`. 그런데 **호출부가 `influencer-auto-collect`
하나뿐**이고 그 레인의 진단 모양(`{yt, naver, tistory}`)에 묶여 있었다. 공공데이터·매장 레인 6종은
무방비. *"기능이 없다"가 아니라 "기능이 한 곳만 쓴다"* — 이 레포의 반복 클래스의 변종이다.

신설 `lane-yield-health.ts`(순수 판정) + `/stats` 의 `laneHealth` + 어드민 경고 박스.
🛡️ **오경보 방지 규칙을 그대로 승계했다** — `saved === 0` 만으로는 절대 안 울린다(풀 포화 = 전부 중복은
정상). **`found` 까지 0** 일 때만 본다. 기존 경보가 2026-07-23 에 같은 오경보로 고친 판정식이다.
⚠️ **레인을 끄지 않는다.** 일시 장애와 영구 장애를 이 신호만으로는 못 가른다 — 보이게만 하고 사람이 정한다.

## 🔴 이번에 내 시험이 **헛돌았다** (다음 세션이 반복하지 않게)

오경보 방지 시험에 결함을 주입했는데 **초록불이 떴다.** 픽스처가
`{found: 200, saved: 0, total_saved: 9999}` 였는데 **`diag.error` 가 없어서**, 판정식에서 `found === 0`
조건을 통째로 지워도 `err` 가 undefined 라 여전히 `null` 을 돌려줬다.

> **가드가 "막는다"고 주장하는 그 경우가 픽스처에 실재하지 않으면, 그 검사는 아무것도 안 지킨다.**

이 레포가 하루에 세 번 만난 클래스(`check-guard-mutations` 헤더)를 내가 그대로 재현했다.
픽스처를 `found 200 + 오류 동시 존재`로 고치니 빨간불이 떴고, **그 사실을 매니페스트 사유에 적어 두었다.**


## ⑩ 🔴 **인허가 API 는 권한 문제가 아니었다** — 주소가 죽었다 (프로브 실측)

대표 대기 항목("data.go.kr 활용신청 확인")으로 몇 주째 분류돼 있던 것의 정체를 라이브 프로브로 확정했다:

```
POST /api/admin/partner-pool/probe-public-data?target=localdata&ladder=1,10,100
→ 세 번 모두 HTTP 400
  NO_OPENAPI_SERVICE_ERROR (returnReasonCode 12)
  "해당 오픈API 서비스가 없거나 폐기됨"
```

**화면엔 `API: HTTP 500 — Unexpected errors` 로 떠 있었다.** 그래서 "상대 서버 장애/권한"으로 읽혔고
대표가 기다리는 항목이 됐다. 실제로는 **엔드포인트가 폐기됐거나 경로가 틀린 것** — 기다릴 일이 아니라
고칠 일이다. 이게 음식점·카페·미용·숙박이 **0건**인 근본 원인이다(카카오 레인은 그 대체재였을 뿐).

⚠️ **아직 맞는 주소는 모른다.** 그건 후보를 찔러 봐야 알고, 이 환경은 `apis.data.go.kr` 이 CONNECT 403 이라
직접 못 찌른다 — **우리 워커를 통해서만** 가능하다. 그래서 아래 도구를 만들었다.

## ⑪ 🧭 **배포 없이 후임 주소를 찾는다** — 후보 경로 프로브 + hira 대상 신설

문제는 "맞는 주소를 확인할 방법이 **배포뿐**" 이었다는 것이다. 후보 하나에 배포 한 번이면 아무도 안 찾는다.

- **후보 경로 프로브** — `?target=localdata&path=1741000/후보경로` 로 경로만 갈아 끼워 그 자리에서 찌른다.
  페이징 파라미터 이름이 서비스마다 갈리므로(`pageNo/numOfRows` ↔ `pageIndex/pageSize`) **둘 다** 실어
  보낸다 — 하나만 보내면 *"이름이 달라서"* 실패한 것을 *"주소가 틀려서"* 로 오진한다.
  🔒 **호스트는 `apis.data.go.kr` 하나로 고정.** 어드민 인증이 있어도 임의 URL 을 받으면 SSRF 다
  (내부 메타데이터 `169.254.169.254` 까지 우리 워커 이름으로 찌를 수 있다). 쿼리스트링도 거절 —
  `serviceKey` 파라미터를 덮어쓸 수 있다.
- **`hira` 프로브 대상 신설** — 60회 실행에 0건인데 **프로브 대상에조차 없어** 원문을 한 번도 못 봤다.
  진단할 수 없는 레인은 고칠 수도 없다. 프로브 URL 이 레인의 `HIRA_BASE` 와 **같은 문자열인지**
  유닛이 대조한다 — 갈라지면 "프로브는 초록인데 레인은 죽는다"가 되어 진단이 오히려 오도한다.

#
## ⑫ 🔴 **6개 공공 소스 중 3개가 죽어 있다** (전수 프로브 — 이 세션의 가장 큰 발견)

```
POST /api/admin/partner-pool/probe-public-data?target=all&rows=1
  ✅ commerce-status  200 · totalCount 2,649,436
  ✅ commerce-detail  200 · totalCount 2,725,361
  🔴 franchise        400 · NO_OPENAPI_SERVICE_ERROR
  🔴 nara             400 · NO_OPENAPI_SERVICE_ERROR
  🔴 localdata        400 · NO_OPENAPI_SERVICE_ERROR
  ⚠️ nps              503 · SERVICETIMEOUT_ERROR (일시)
```

**이 한 장이 지금까지의 모든 이상 현상을 설명한다:**

| 관찰 | 이유 |
|---|---|
| 파트너 175,139건 중 **commerce 151,417(86%)** | 살아 있는 소스가 그것뿐 |
| 매장 46,182건 중 **학원 44,833(97%)** | 인허가가 죽어 NEIS 만 남음 |
| 대표 우선업종(음식점·카페·미용·숙박) **0건** | 그 소스가 바로 죽은 `localdata` |

⚠️ **같은 서비스키로 commerce 는 200 이다** — 활용신청·키 문제가 **아니고** 그 세 서비스의 **주소** 문제다.
세 기관이 전부 다르므로(공정위 1130000 · 조달청 1230000 · 행안부 1741000) 우연한 동시 폐기보다
**공통 원인**(게이트웨이 경로 변경 등)일 가능성이 크다 — 후보 경로 프로브로 확인할 일이다.

⇒ 무수확 관측(⑨)을 **파트너 풀에도** 배선했다. 죽은 레인은 그쪽에 더 많다.
⚠️ 그 과정에서 `partner-pool.routes.ts` 가 608줄이 됐다 — **방금 내가 푼 래칫을 내가 다시 깨는 것**이라
근거 주석을 판정기 헤더로 옮기고 배열을 압축해 **600줄**로 맞췄다(캡은 "600 초과"라 600 은 통과).

#
## ⑬ 🧭 후임 주소 추적 — **원천은 `localdata.go.kr` 이고 살아 있다** (웹 실측)

공식 문서는 봇 차단(403)이라 **제3자 기록**에서 실제 호출 형태를 확보했다:
```
https://www.localdata.go.kr/platform/rest/{그룹}/openDataApi
  ?authKey=…&resultType=json&pageIndex=1&pageSize=500&opnSvcId={업종}&lastModTsBgn=&lastModTsEnd=
```

**세 가지가 맞아떨어진다:**
1. **페이징 이름이 정확히 일치** — 우리 레인은 `pageIndex`/`pageSize`. data.go.kr 표준은 `pageNo`/`numOfRows` 다.
   ⇒ 이 코드는 **원래 localdata.go.kr 를 향해 쓰였다.**
2. **업종 키가 `opnSvcId`** — 우리 테이블 컬럼 `opn_svc_id` 와 같은 이름.
3. localdata.go.kr 는 **살아 있다**(API 신청·키 조회 페이지 정상).

⇒ 소스 헤더의 *"localdata.go.kr 폐쇄 2026-04-16 후 이관"* 은 **틀렸거나 이관 대상 경로가 틀렸다.**
base 만 `apis.data.go.kr/1741000` 으로 바뀌었는데 그 경로가 존재하지 않는다.

⚠️ **인증 파라미터가 다르다** — LOCALDATA 는 `authKey`, 우리는 `serviceKey`. 그리고 LOCALDATA 는
**자체 키 발급 체계**가 있다(`localdata.go.kr/devcenter/keylist.do`). 즉 우리 `PUBLIC_DATA_SERVICE_KEY`
로는 데이터를 못 받을 가능성이 크다 — **키 발급은 대표 작업**이다.

### 프로브 호스트 확장 — 정확히 **하나만**
`PROBE_ALLOWED_HOSTS = ['apis.data.go.kr', 'www.localdata.go.kr']`. 임의 URL 이 아니라 **열거된 둘**이다.

🔑 **우리 키를 발급처가 아닌 호스트로 보내지 않는다.** "혹시 되나" 보려고 자격증명을 흘리면 안 된다.
**키 없이 찔러도 판정은 된다** — 인증 오류 = *엔드포인트 존재*, `NO_OPENAPI_SERVICE_ERROR` = *여기도 아님*.
우리가 알고 싶은 건 "주소가 맞나"이지 "데이터를 받아오나"가 아니다.

### 다음 세션의 첫 액션 — **배포 후 바로**
```bash
# ① LOCALDATA 원천(키 없이 — 존재 여부만)
for G in GR0 TO0 ETC; do
  curl -sS -m 60 -X POST ".../api/admin/partner-pool/probe-public-data?target=localdata&host=www.localdata.go.kr&path=platform/rest/$G/openDataApi&rows=1" \
    -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
    | python3 -c "import sys,json;r=json.load(sys.stdin)['results'][0];print(r['http'], (r.get('hint') or r['body'])[:120])"
done
# ② 포털 쪽 버전 범프 후보(franchise·nara 는 접미사 패턴이 뚜렷하다: _Service2 · Service02)
#    1130000/FftcBrandRlsInfo_Service · FftcBrandRlsInfo3_Service · 1230000/ao/UsrInfoService03 …
```
**판정**: `200 + JSON` = 후임 · `인증 오류` = 주소는 맞고 키가 필요 · `NO_OPENAPI_SERVICE_ERROR` = 아님.

## 다음 세션의 첫 액션 — 후임 주소 찾기 (배포 후)
```bash
# 죽은 셋 각각에 후보를 몇 개씩. 200 + JSON 이 나오면 그게 후임이다(저장 없음 · 읽기 전용).
for T in localdata franchise nara; do
  for P in <후보경로들>; do
    curl -sS -m 60 -X POST ".../api/admin/partner-pool/probe-public-data?target=$T&path=$P&rows=1" \
      -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
      | python3 -c "import sys,json;r=json.load(sys.stdin)['results'][0];print(r['http'], (r.get('hint') or r['body'])[:100])"
  done
done
```
찾으면 → `ADS_LOCALDATA_ENDPOINT`(env, 무배포) 또는 코드 상수 교체. **env 변경은 대표 대시보드 작업**이다.

## 다음 세션의 첫 액션 (이 도구로)
```bash
# 배포 후. 후보를 몇 개 찔러 살아 있는 주소를 찾는다(저장 없음 · 읽기 전용).
for P in 1741000/LocalDataInfoSvc/getLocalData 1741000/localdataApi 1741000/general_restaurants; do
  curl -sS -m 60 -X POST ".../api/admin/partner-pool/probe-public-data?target=localdata&path=$P&rows=1" \
    -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" | python3 -c "import sys,json;r=json.load(sys.stdin)['results'][0];print(r['http'], r.get('hint') or r['body'][:120])"
done
# 살아 있는 경로를 찾으면 → ADS_LOCALDATA_ENDPOINT(env, 무배포) 또는 코드 상수 교체.
curl -sS -m 60 -X POST ".../api/admin/partner-pool/probe-public-data?target=hira&rows=1" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"
```

## 🔴 이번에 내 **주입 두 개가 가짜였다**(오늘 두 번째)

후보 경로 가드를 되돌려-검증했는데 두 주입이 통과했다. 확인해 보니 **결함을 안 만든 주입**이었다 —
하나는 문자클래스가 이중으로 막고 있었고(제거한 줄이 잉여였다), 하나는 `hira` 블록이 아니라 **라벨만**
바꿨다. 제대로 주입하니(두 방어 동시 제거 / 블록 통째 제거) 둘 다 빨간불이 떴다.
> **주입이 실제 결함을 만들지 못하면 아무것도 증명하지 못한다.** 오늘 ⑨ 에 이어 두 번째다.

## 다음 세션의 첫 액션

```bash
# 화면이 실제로 도는지 — 업종 32줄이 뜨고 토글이 먹는가
curl -sS "https://live.ur-team.com/api/admin/partner-pool/keyword-trades" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;t=json.load(sys.stdin)['trades'];print(len(t));print(t[:3])"
```
```bash
# 매장 업태 19행 + 조건
curl -sS ".../api/admin/store-prospects/trades" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"
curl -sS ".../api/admin/store-prospects/config" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"
```
⚠️ **첫 회차에 시드가 돈다**(19행 batch). 그 회차만 예산 3 을 더 쓰므로 `spent` 가 튀는 것은 정상이다.

---

## ⑭ 🔬 **머지 후 프로브 실측 — 내 판단 두 개가 틀렸다** (2026-08-03 02시 KST)

#967 머지·배포 직후 후보 경로 프로브를 실제로 쐈다. 결과가 **내가 세운 두 결론을 뒤집었다.**

### 실측 표

| 대상 | 결과 |
|---|---|
| **심평원 `hira`** | `rows 1·20·50·100·200·300·500` **전부 HTTP 200 · JSON · `NORMAL SERVICE`** |
| `commerce-status`(대조군) | 200 · `totalCount 2,649,436` |
| `franchise` 후보 3개 | 전부 `400 NO_OPENAPI_SERVICE_ERROR` — ⚠️ **단, 프로브가 틀린 오퍼레이션을 찔렀다**(아래) |
| `nara` 후보 3개 | 전부 `400 NO_OPENAPI_SERVICE_ERROR` |
| `localdata` 원천 3그룹 | 전부 **timeout** — `NO_OPENAPI_SERVICE_ERROR` 가 **아니다** |

### 🔴 정정 ① — "인허가 원천은 localdata.go.kr 이고 살아 있다"는 **우리 워커 기준으로 틀렸다**

#967 커밋 제목에 그렇게 썼다. 교정용으로 **`robots.txt`** 를 찔러 보니 그것도 15초 timeout —
즉 경로 문제가 아니라 **호스트 자체가 CF 워커에서 도달 불가**다. 브라우저에서 열리는 것과
워커에서 닿는 것은 다른 얘기였고, 나는 그 둘을 구분하지 않았다.
⇒ **원천 직행은 막힌 길이다.** 후임 주소를 찾아도 그 호스트로는 못 간다.

> 🧭 다음 세션 교훈: 새 호스트를 후보로 삼기 전에 **`robots.txt` 같은 무해한 경로로 도달성부터
> 교정**하라. 그거 한 번이면 "주소가 틀렸나"와 "아예 못 가나"가 갈린다.

### 🔴 정정 ② — `collect-hira` 는 **죽은 소스가 아니다**

60회 실행·저장 0·`timeout` 이라 죽은 소스로 분류했는데, API 는 레인이 쓰는 값
(`page=1`(커서 실측값) · `rows=100`)에서도, 심지어 `rows=500` 에서도 **즉답 200** 이다.
`ADS_HIRA_ROWS` 는 ur-ads 바인딩 42개에 **없다**(= 레인은 기본 100 을 쓴다).

⇒ 남은 차이는 **실행 문맥**뿐이다. 같은 시각 하트비트가 그 그림을 준다:

```
collect-neis        ms=42887   maintenance-rescan  ms=60425
scan-notices        ms=30806   sweep-kakao-phone   ms=31117
enrich-company           ok=false  Worker exceeded CPU time limit
maintenance?phase=quality ok=false  〃
reclassify-company        ok=false  〃
collect-hira        ms=25750  ← AbortSignal.timeout(25000) 그대로
```

**정각(매시 :00)에 워커가 포화**다. hira 의 25초는 심평원이 느려서가 아니라 **우리 워커에서
fetch 가 스케줄을 못 받아서**로 보인다 — 프로브는 한가한 시각에 단독으로 쏴서 즉답을 받았다.

⚠️ **아직 가설이다.** 결정적 판정은 *비정각에 레인을 수동 트리거*해 보는 것인데, 그건 읽기가
아니라 **수집 트리거(쓰기)** 라 대표 명시 지시 없이는 하지 않는다. 대표 지시는 "프로브를 쏴라"
였고 프로브는 읽기 전용이다.

### 🐛 그리고 진단 도구 자신의 결함 — **프로브가 레인과 다른 오퍼레이션을 찔렀다**

`franchise` 만 두 곳의 답이 갈렸다: 레인 stats `HTTP 404`, 프로브 `400 NO_OPENAPI_SERVICE_ERROR`.
같은 서비스인데 답이 다르면 **둘 중 하나가 다른 곳을 찌르고 있다.**

```
레인:   FftcBrandRlsInfo2_Service/getBrandList
프로브: FftcBrandRlsInfo2_Service/getBrandReleaseInfo   ← 틀림
```

기존 대조 유닛은 **서비스명만** 봐서 오퍼레이션 차이를 통과시켰다. 하마터면 그 400 을 근거로
*"공정위 서비스 폐기"* 라고 결론 낼 뻔했다 — **진단 도구가 오진의 재료가 되는 최악의 모양**이다.
수리 + 가드 확장(BASE/OP 통째 대조) → **PR #982**. 되돌려-검증 RED · 매니페스트 63건.

### 다음 세션의 첫 액션

1. **#982 머지 후 franchise 재프로브** — 이제야 레인과 같은 주소를 찌른다. `getBrandList` 로
   `404` 가 재현되면 *그때* "주소가 죽었다"가 근거를 갖는다.
2. **nara** 는 프로브·레인이 이미 같은 주소(`UsrInfoService02/getPrcrmntCorpBasicInfo`)이고
   `NO_OPENAPI_SERVICE_ERROR` 다 — 포털에서 실제 서비스명을 확인해야 한다(이 환경은 `data.go.kr`
   문서가 봇 차단이라 못 본다 → **대표 화면 확인 필요**).
3. **hira 정각 포화 가설** — 대표가 "수동 트리거 해봐라"고 하면 비정각 1회로 즉시 판정된다.
   처방은 *레인 회차 분산*이고 그건 `dispatch-budget`(다른 세션 소관) + 대표 판단이다.

## ⑮ ⚖️ **공정위 가맹 서비스는 실제로 폐기됐다** — 이제 근거가 있다 (#982 배포 후)

#982 로 프로브를 레인과 같은 오퍼레이션(`getBrandList`)에 맞춘 뒤 다시 쐈다. **이번 판정은 유효하다.**

```
1130000/FftcBrandRlsInfo2_Service/getBrandList        400  NO_OPENAPI_SERVICE_ERROR (code 12)
                              …/getBrandGnrlInfo      400  〃
                              …/getBrandOpenInfo      400  〃
                              …/getBrandFinanceInfo   400  〃
      "returnAuthMsg": "해당 오픈API 서비스가 없거나 폐기됨"
```

🔑 **키 문제가 아니라는 결정적 근거**: `commerce-status` 는 **같은 기관 접두사 `1130000`**
(`1130000/MllBs_2Service/getMllBsInfo_2`)인데 **200 · totalCount 2,649,436** 이다.
같은 키로 같은 기관의 다른 서비스는 되고 이것만 안 된다 ⇒ **활용신청·권한이 아니라 서비스 자체가 없다.**

### 🚧 후임 이름은 이 환경에서 못 찾는다 (대표 확인 필요)

`data.go.kr` 은 문서 페이지가 **전부 봇 차단(403)** 이다 — 한글판·영문판 모두 시도했다.
웹 검색으로는 데이터셋 **제목**까지만 보이고(예: `공정거래위원회_가맹정보_정보공개서_목록_조회`,
데이터셋 15125569 / 15125570 / 15110265) **호출 URL 문자열**은 문서 페이지 안에만 있다.

> 📌 **대표 액션(딱 한 가지)**: 위 데이터셋 페이지에서 **"요청주소"** 한 줄만 복사해 주시면 된다.
>   모양: `https://apis.data.go.kr/1130000/○○○Service/○○○`.
>   받으면 프로브로 즉시 검증 → `franchise-collect.ts` 상수 교체 → 레인 부활.

### 정리 — 6개 공공 소스 최종 판정

| 소스 | 판정 | 근거 |
|---|---|---|
| commerce(통신판매) | 🟢 정상 | 200 · 264만건 |
| **hira(심평원)** | 🟢 **API 정상** | rows 1~500 전부 200. 실패는 **정각 워커 포화** 가설 |
| nps(국민연금) | 🟡 일시 | 503 SERVICETIMEOUT |
| **franchise(공정위 가맹)** | 🔴 **폐기 확정** | 오퍼레이션 4종 전부 code 12 · 같은 기관 다른 서비스는 200 |
| nara(나라장터) | 🔴 폐기 추정 | 프로브·레인 동일 주소에서 code 12 |
| localdata(인허가) | 🔴 주소 불명 + **원천 호스트 도달 불가** | 포털 경로 code 12 · 원천은 robots.txt 조차 timeout |
