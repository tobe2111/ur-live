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

## 남은 결정 / 대기

- 인허가 500: PR #860 의 형태 프로브가 배포됨 → 다음 실행에서 `diag.probe.winner` 로 갈린다.
- 4대 업종 대안 소스(상가정보 기반 매장 수집기)는 위 판정 후 결정 — 근거는
  `2026-07-29-localdata-500-selfprobe.md` 참조.
