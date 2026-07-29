# 인허가 500 — 추측 대신 라이브가 판정하게 (2026-07-29)

## 다음 세션의 첫 액션

배포 후 어드민에서 **인허가 진단 줄**을 읽는다(추측 금지 — 이 줄이 판정이다):

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d.get('token') or d.get('accessToken'))")
curl -sS "https://live.ur-team.com/api/admin/store-prospects/stats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;print(json.dumps(json.load(sys.stdin)['collect']['run']['diag'],ensure_ascii=False,indent=1))"
```

읽는 법 — **세 갈래로 갈린다**:

| `diag.probe.winner` | 뜻 | 다음 행동 |
|---|---|---|
| `"v2"`/`"v3"`/`"v4"`/`"v5"` | 요청 **형태**가 문제였고 스스로 갈아탔다 | 아무것도 안 해도 된다. `diag.variant` 가 그 값이면 이후 계속 그 형태로 간다. 안정되면 `ADS_LOCALDATA_VARIANT` 로 고정 |
| `null` (전 후보 실패) | **형태 문제가 아니다** — 키·활용신청·기관 장애 쪽 | `diag.fail_probe.url`(키 가려짐)을 그대로 대표에게 보여주고 data.go.kr 활용신청 상태 확인 요청 |
| `undefined` (프로브 미실행) | 500 이 안 났거나(정상) 쿨다운(6h) 중이거나 env 고정 | `diag.error`·`found` 를 본다 |

## 이번에 한 것

**문제**: #851 이 예산 문제를 고쳐 `spent: 20/40`(한도 여유)가 됐는데도 `found: 0`,
`API: HTTP 500 — Unexpected errors`. 500 은 본문에 원인 코드가 없어 `public-data-diag` 의
코드 매핑으로도 무엇이 틀렸는지 알 수 없다.

**제약**: 이 개발 환경은 `apis.data.go.kr` 로 나가는 CONNECT 가 프록시에서 막혀 있다 —
**직접 호출로 확인할 방법이 없다.** 그렇다고 URL 을 추측으로 바꾸는 건 이 레포가 반복해서 실패한 방식이다.

**해법**: 추측하지 않고 **라이브가 고르게** 한다.

1. `license-url.ts`(신규) — 요청 형태 후보 5개를 명시. **각 후보는 현행(v1)과 한 가지만 다르다**
   (크기 500→100 / `type` 제거 / `pageNo·numOfRows` / 날짜필터 제거). 그래야 결과가 원인을 지목한다.
2. 1페이지가 실패하면 **후보를 한 번씩 찔러** 행을 주는 형태를 찾고, 그 자리에서 재시도한 뒤
   답을 `platform_settings.ads_localdata_variant` 에 적는다 → 다음 실행부터 곧장 그 형태(무배포 자가 치유).
3. 판정 근거를 화면에 남긴다: `diag.variant` / `diag.fail_probe`(**키를 가린** 실제 요청) / `diag.probe`(시도 이력).
4. `ADS_LOCALDATA_PAGE_SIZE` — 크기가 원인이라고 확인되면 **배포 없이** 내릴 수 있는 레버.

**덤으로 고친 것**
- 마지막 페이지 판정이 `count < 500` **하드코딩**이었다 — 크기를 바꾸는 순간 2페이지를 영원히 안 본다.
  실제 크기(`size`)와 비교하도록 수정(테스트로 고정).
- 설정 3키를 **한 번에** 읽는다(3 서브리퀘스트 → 1). D1 도 같은 지갑이라 이 절약이 곧 수집량이다.
- 백필 레인도 일일 레인이 확인한 형태를 **공유**한다(형태가 갈리면 한쪽만 조용히 0건).

**안전장치**
- 프로브는 실패했을 때만·쿨다운 6h 안에서 1회·예산 6 이상 남았을 때만(반쯤 하다 끊기면 판정 불가).
- 서브리퀘스트 **한도** 실패는 프로브를 유발하지 않는다(우리 예산 문제지 상대 형태 문제가 아니다).
- `ADS_LOCALDATA_VARIANT` 가 있으면 자동 탐색이 그 결정을 덮어쓰지 않는다.
- **200 인데 0행은 승자가 아니다** — 그날 변동이 없어서일 수 있어 판정 근거가 못 된다.

## 이번에 조심한 것 (다음 세션이 같은 함정을 밟지 않게)

- 🔐 **진단에 URL 을 남기는 건 키 유출 위험을 새로 만드는 일이다.** 이 레포는 public 이고 진단
  스냅샷은 어드민 화면·핸드오프로 흘러간다. `redactServiceKey` 를 통과시키고, **그 사실을 테스트로 고정**했다
  (`ads-localdata-variant-probe.test.ts` 의 "서비스키가 없다" — 리댁션을 되돌리면 빨강).
- 새 테스트 6+16개는 **일부러 깨뜨려 확인**했다: 프로브 블록 제거 → 2 RED, 리댁션 제거 → 1 RED,
  `count < 500` 환원 → 1 RED. 복원 후 전부 초록.

## 남은 결정 / 대기

- 프랜차이즈·나라장터 404 엔드포인트(보류) — 같은 "형태 후보" 방식으로 확장 가능하나 대표 판단 대기.
- 학원(NEIS) 레인을 계속 돌릴지 — 대표 "학원은 거의 안 씀". 지금은 켜져 있고 `store_prospects` 의 99.5% 다.

## 커밋

- (이 브랜치) `feat(ads): 인허가 요청 형태 자가 진단 + 무배포 조정 레버`
