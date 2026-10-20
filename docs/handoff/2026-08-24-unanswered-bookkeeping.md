# 2026-08-24 — 429 를 "결과 0건"으로 적던 것 (유어애즈 webkr 레인)

배포 판정 중 라이브에서 드러난 것을 그 자리에서 수리. 대표 *"응 고쳐"*.

## 무엇이 드러났나 (판정의 소득)

`#1197` 로 방금 켠 차단 계측이 **첫날부터 값을 냈다**:
```
ads_naver_openapi_block  →  blocked 16 · ok 92 · last_status 429   (요청의 15%)
```
어제까지 이 숫자는 **존재하지 않았다** — 막혀도 "결과 없음"과 똑같이 보였다.

## 피해 경로 — ⚠️ 처음 설명은 과장이었다

대표에게 처음 *"차단이 멀쩡한 업종을 은퇴시킨다"* 고 보고했는데 **확인해 보니 그 경로가 아니다.**
은퇴 판정(`company-subcat-yield`)은 `found_total` 을 **읽지 않고** `ad_company_leads` 의 실제 행에서만
수율을 계산한다 ⇒ 429 로 0건이 나도 거짓 저수율 신호는 생기지 않는다. 정정해서 다시 보고했다.

**진짜 피해는 신선도다.** `pickCompanyKeywords` 의 우선 픽 조건이 `last_run_at IS NULL` 인데,
429 를 받아도 부기가 `last_run_at` 을 찍었다:
```
429 한 번 → last_run_at 찍힘 → "안 돌아본 키워드" 자격 상실 → 회전 뒤로 밀림
⇒ 08-23 에 넣은 신규 1,410개가 **물어보지도 못한 채** 우선순위를 잃는다
```

## 수리

`searchNaverWeb` 에 `SearchOutcome { responded }` 회신함을 추가(성공 응답을 한 번이라도 받으면 true).
`webkr-collect` 는 `responded` 가 아니면 **부기를 건너뛴다** → `last_run_at` 이 NULL 로 남아 다음 회차에
다시 우선 선택된다. 상태줄에 `unanswered[]` 로 노출.

⚠️ **결과 0건은 부기한다** — 응답을 받았으면 그건 진짜 증거다.
⚠️ **타임아웃과 429 를 구분하지 않는다** — 둘 다 증거가 아니므로 같게 다루는 것이 이 레포 규칙에 맞다.
⚠️ **`collect-company` 는 의도적으로 손대지 않았다** — 그 레인은 지도·카카오·웹문서를 한 배열에 합쳐
   한 번 부기하므로, 웹문서만 429 여도 지도 실적이 있어 부기가 정당하다.

## 이번에 틀렸던 판단

1. **영향 경로를 과장해서 보고했다**(위 참조). 코드를 확인하기 전에 "은퇴시킨다"고 단정했다.
   ⇒ 파급을 말하기 전에 **그 값을 실제로 읽는 코드가 있는지** 먼저 grep 할 것.
2. **가드가 또 헛돌았다(3건 중 1건).** `continue` 를 지우는 주입이 초록으로 통과했다 — 분기 본문이
   깨끗한지만 봤고 **빠져나가는지**는 안 봤다. 본문은 그대로인데 아래로 흘러내려 부기된다.
   ⇒ 조기 반환 가드를 검사할 때는 **`continue`/`return` 자체를 앵커**할 것. 오늘 같은 클래스로
   세 번째다(분모·순서·흘러내림).
3. **문서의 DB 주소를 믿고 조회했다가 헛짚었다.** 다른 세션이 같은 날 업체 테이블을 세 번째 D1
   (`urads-company-db` 0e9a8f82)로 분리했다(#1199). CLAUDE.md 에는 두 개만 적혀 있다.
   내 코드는 `adsLeadsDb` 라우터가 문장 단위로 처리해 **무사했다**(수율 표가 실제로 생성된 것이 증거).

## 다음 세션의 첫 액션

```sql
-- 메인 D1 d9530ba6-…  (platform_settings)
SELECT value FROM platform_settings WHERE key='ads_webkr_stats';   -- unanswered[] 확인
SELECT value FROM platform_settings WHERE key='ads_naver_openapi_block';
-- 업체 D1 0e9a8f82-32fb-4584-878c-cdaec6c0aff0  ⚠️ ADS_DB(d4630482) 아님
SELECT COUNT(*) FROM ad_company_keywords
 WHERE last_run_at IS NULL AND (keyword LIKE '%SNS 마케팅 대행' OR keyword LIKE '%외식업 컨설팅');
```
판정: 신규 1,410개가 **줄어드는 속도**가 회차당 실제 실행 수와 맞는지. 429 로 삼켜지던 것이 멈췄으면
`unanswered` 에 이름이 남고 그 키워드는 다음 회차에 **다시** 나타난다(같은 이름이 재등장하면 정상).
