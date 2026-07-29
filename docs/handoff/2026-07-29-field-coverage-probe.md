# 필드 커버리지 프로브 — "무엇이 실제로 채워져 오는가" (2026-07-29)

## 다음 세션의 첫 액션

배포 후 **한 번의 조회로 세 가지가 동시에 풀린다**:

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d.get('token') or d.get('accessToken'))")
curl -sS "https://live.ur-team.com/api/admin/partner-pool/stats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)['commerce']['run']['diag']['coverage'],ensure_ascii=False,indent=1))"
```

| 볼 것 | 무엇이 결정되는가 |
|---|---|
| `domnCn` 의 `pct` | **홈페이지 0.0% 의 정체.** 0% → 원부가 도메인을 안 준다(이 경로는 죽었다, 다른 발굴 수단 필요). >0% 인데 우리 DB 는 0% → **우리 `anyDomain` 정규식이 거르는 것** = 즉시 수리 가능 |
| `trtmntPrdlstNm`/`ntslPrdlstCn` 의 `pct` + `ex` | **취급품목 버킷 표 정밀화.** `ex`(예시 값)가 실제 표기를 보여준다 — `PRODUCT_BUCKETS` 정규식을 그 표기에 맞춘다 |
| `telno` 의 `pct` | 통신판매 원부에 업체 전화가 오는가(현재 코드는 '안 온다' 전제로 phone=null 고정) |
| `pct: 0` 인 필드 목록 | 우리가 별칭으로 겨누고 있는데 **실제로는 안 오는 필드** — 코드에서 지울 대상 |

인허가 레인도 같은 자리에 실린다: `store-prospects/stats` → `collect.run.diag.coverage`
(단 그 레인은 500 이 먼저 풀려야 항목이 생긴다).

## 왜 만들었나

같은 날 세 번, **같은 이유**로 데이터를 잃고 있었다는 게 드러났다 — 전부 *원본 응답이 무엇을 주는지
몰라서* 생긴 일이다:

1. `upteNm`(업태)로 분류하려 했는데 그 키가 **실응답에 아예 없었다** → 온라인판매 15만 건의
   subcategory 가 **100% 상수 `'통신판매'`** 로 굳었다.
2. `"N/A"` 를 값으로 채택해 **주소의 31.7%** 를 잃었다(+ 카카오 스윕이 없는 주소를 조회).
3. 그리고 아직 못 푼 것: **온라인 판매업체인데 홈페이지 보유율 0.0%**(원부에 `domnCn` 이 있는데도).

공통점은 하나다: **필드 이름을 스펙 추정으로 쓰고, 맞았는지 확인할 길이 없었다.** 이 개발 환경은
`apis.data.go.kr` CONNECT 가 막혀 있어 직접 못 본다. ⇒ **라이브가 이미 받아온 응답을 세게 한다**
(추가 요청 0 · 외부 쿼터 0 · 수집 동작 무영향).

## 설계 결정 (다음 세션이 알아야 할 것)

- **`isNoValue` 로 판정한다.** `"N/A"` 를 채워진 것으로 세면 이 프로브 자체가 거짓말이 된다 —
  고치려는 바로 그 버그를 반복하게 된다(테스트로 고정).
- **등장한 키는 전부 비어도 기록**한다. "이 필드는 오지만 항상 비어 있다"가 우리가 찾던 답이다.
- **예시 값은 마스킹**한다(이메일 로컬파트, 8자리+ 숫자). 진단 스냅샷은 어드민 화면·핸드오프로
  흘러가므로, 안 가리면 **우리가 새 유출 경로를 만드는 것**이다(요청 URL 의 서비스키를 가린 것과 같은 이유).
- **마지막 페이지 기준**(누적 안 함) — 스냅샷 비대화 방지, 페이지마다 채움률이 다를 이유도 없다.


## 같은 PR 두 번째 건 — 판정이 **하루 뒤**였던 것을 한 시간으로

인허가 일일 레인은 `dailyAt(20)` = **KST 05시, 하루 1회**다. 프로브를 그 레인에만 둔 건 내 결정이었고
("판정은 한 곳에서만"), 그 대가는 **500 의 정체를 아는 데 최대 24시간**이다. 백필 레인은 **매시간** 도는데
같은 500 을 맞으면서 아무것도 알아내지 못했다 — 관측 기회를 하루 23번 버리는 셈이다.

- 프로브를 `maybeProbeVariant()` 로 추출해 **두 레인이 공유**한다.
- "판정은 한 곳" 원칙은 **쿨다운(`probed_at`)과 DB 키 공유**로 지킨다 — 한쪽이 먼저 돌면 다른 쪽은
  구조적으로 건너뛴다(중복 프로브·엇갈린 답 불가능). 예산은 각 레인이 자기 것에서 낸다.
- 테스트 2개로 고정: ① 백필이 스스로 형태를 찾아 기억한다 ② 쿨다운 안에서는 후보를 하나도 안 쏜다.


## 세 번째 건 — 매장 3.5만 중 **이메일 1건**, 그런데 왜 0인지가 안 남았다

**실측**: `store_prospects` 35,812건 중 `with_email: 1`(전화는 20,737 = 58%).
보강 레인 스냅샷: `processed:9 · site_found:1 · email_found:0 · crawl_reason:{}` (시간당).
`crawl_reason` 이 비었다 = **Pass 1(홈페이지 보유)이 0건** — 매장은 홈페이지가 없다.
전부 Pass 2(네이버로 사이트 발견 → 크롤)인데, 9건 중 사이트 1건·이메일 0건이다.

문제는 숫자가 아니라 **왜 0인지 구분이 안 된다**는 것이다. 셋은 처방이 전부 다르다:
| 원인 | 처방 |
|---|---|
| 사이트를 못 찾음 | 발견 경로를 늘린다(다른 검색·업종 디렉터리) |
| 찾았는데 이메일 없음 | **이 경로는 수율이 낮다 → 투자 중단** |
| 크롤이 막힘 | 크롤러 수리(UA·타임아웃·차단) |

⚠️ 이 구분 없이 레인을 체인으로 증속하면 **0 을 N배 한 0** 을 얻는다. 지금 가장 유혹적인 오답이다.
⇒ `pass2_reason` 신설(`site_naver`/`site_search`/`no_site`/`no_site_budget`/`email`/`crawl_<사유>`).
그리고 이 레인 스냅샷은 **API 가 계속 주고 있었는데 화면에 없어서 아무도 못 봤다** → 어드민에 노출.

**다음 세션의 판정**: `/api/admin/store-prospects/stats` → `enrich.run.pass2_reason` 분포를 보고
위 표대로 갈라라. `no_site` 가 압도적이면 발견 경로 확대, `crawl_*` 이 많으면 크롤러, 
`crawl_no_contact` 가 많으면 **이 경로 자체를 접고** 전화 기반 접촉으로 방향을 튼다.

## 남은 결정 / 대기

- 인허가 500: PR #860 의 형태 프로브가 배포됨 → 다음 실행에서 `diag.probe.winner` 로 갈린다.
- 4대 업종 대안 소스(상가정보 기반 매장 수집기)는 위 판정 후 결정 — 근거는
  `2026-07-29-localdata-500-selfprobe.md` 참조.
