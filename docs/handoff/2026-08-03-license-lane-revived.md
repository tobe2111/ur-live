# 인허가 레인 부활 — 죽은 게 아니라 **경로 한 칸이 빠져 있었다** (2026-08-03)

> 대표 우선업종(음식점·카페·미용·숙박) 리드가 **0건**이던 원인. 라이브 프로브로 확정했고,
> 대표가 추가로 해야 할 일은 **없다**(API 키도 더 필요 없다).

## 1. 무엇이 틀렸나

```
…/1741000/general_restaurants        → 400 · NO_OPENAPI_SERVICE_ERROR (code 12)
…/1741000/general_restaurants/info   → 200 · totalCount 70,469 · 실제 행
```

**오퍼레이션 세그먼트(`/info`) 하나가 빠져 있었다.** 같은 기관의 형제 서비스 전부 동일하다 —
휴게음식점·미용업·숙박업·약국·동물약국·이용업 실측 확인.

### 왜 며칠을 못 찾았나 (이게 더 중요하다)
`code 12` 는 *"이 주소가 지금 안 맞는다"* 까지만 말하고 **폐기인지 오타인지 구분하지 못한다.**
그래서 **이전 세션(나)이 "서비스 폐기 확정"이라고 인계에 적었다.** 그 오기를 믿으면 다음 세션은
후임 서비스를 찾으러 가지, 경로 끝을 의심하지 않는다.

🔑 힌트는 이미 *"둘을 구분할 수 없다"* 고 경고하고 있었다. **경고가 있어도 사람은 자기 가설로 좁힌다.**
이번에 힌트를 고쳐 *"살아있는 서비스도 오퍼레이션을 틀리면 같은 code 12"* 라는 **대조군 실측**을
문구에 넣었다(#1002). 나열이 아니라 **오추론을 명시적으로 막는 문장**이 필요하다.

## 2. 그런데 경로만 고치면 **여전히 0건**이었다 (두 번째 겹)

이관된 포털은 폐쇄된 `localdata.go.kr` 과 **필드명이 완전히 다르다**:

| 우리 코드가 찾던 이름 | 실제로 오는 이름 |
|---|---|
| `mgtno` | **`MNG_NO`** |
| `bplcnm` | **`BPLC_NM`** |
| `sitetel` | **`TELNO`** |
| `rdnwhladdr` | **`ROAD_NM_ADDR`** |
| `sitewhladdr` | **`LOTNO_ADDR`** |
| `trdstategbn` / `trdstatenm` | **`SALS_STTS_CD`** / **`SALS_STTS_NM`** |
| `apvpermymd` | **`LCPMT_YMD`** |
| `lastmodts` | **`LAST_MDFCN_PNT`** |
| `uptaenm` | **`BZSTAT_SE_NM`**(음식점) / **`SNTTN_BZSTAT_NM`**(이·미용) |

⚠️ **HTTP 200 에 실제 행까지 오는데 저장은 0** 이 된다 — 전부 빈 문자열로 읽혀 `mgt_no` 가 비고,
복합키가 성립하지 않아 행이 통째로 버려지기 때문이다. **200 은 성공이 아니다.**
경로만 고치고 배포했으면 "아직도 안 된다"로 오진했을 것이다.

## 3. 세 번째 겹 — 페이징 키

응답 봉투가 자기가 받은 값을 되돌려 준다:

```json
{"numOfRows":1,"pageNo":2,"totalCount":70469}
```

⇒ 이 서비스가 실제로 읽는 키는 **`pageNo`/`numOfRows`** 다. 레인이 쓰던 `pageIndex`/`pageSize` 는
**같이 보내도 조용히 무시**된다 — 즉 그대로 뒀으면 **200 을 받으면서 영원히 1페이지만** 긁는다.
이 레포가 "조용한 전진 0"이라 부르는 계열이다. 기본 변종을 `v4`(pageNo/numOfRows)로 승격했다.

## 4. 다음 세션의 첫 액션 (판정까지)

배포 후 인허가 레인이 한 번 돌면(일일 KST 05시 · 백필은 매시간) 어드민 상태줄 또는:

```sql
SELECT value FROM platform_settings WHERE key='ads_localdata_stats';
-- found > 0 · saved > 0 · diag.variant='v4' 이면 성공
SELECT category, COUNT(*) n, SUM(CASE WHEN phone<>'' THEN 1 ELSE 0 END) tel
  FROM store_prospects WHERE category IN ('일반음식점','휴게음식점','미용업','숙박업') GROUP BY category;
```

- **`found>0` 인데 `saved=0`** 이면 → 필드 별칭이 또 다른 업종에서 갈린 것이다(실측한 다섯 업종
  외에는 근거가 없다). `diag.sample` 의 원본 키를 보고 별칭을 더한다.
- **여전히 `found=0`** 이면 → `diag.fail_probe.url`(키 가려짐)을 보고 프로브로 그 주소를 그대로 찌른다:
  `POST /api/admin/partner-pool/probe-public-data?target=license&path=1741000/<업종>/info&rows=1&page=1`
- 오퍼레이션명이 바뀌면 **배포 없이** `ADS_LICENSE_OPERATION` env 로 교체 가능(빈 값 = 옛 형태).

## 5. 이번에 틀렸던 판단 (반복 방지)

1. **"공정위/인허가 서비스 폐기 확정"** — 틀렸다. 근거였던 code 12 는 폐기를 뜻하지 않는다.
   대조군(살아있는 서비스 + 없는 오퍼레이션)을 찔러 보고서야 알았다. **판정 전에 대조군부터.**
2. **"대표에게 [미리보기] URL 을 받아야 한다"** — 필요 없었다. 형제 서비스 하나의 문서 URL
   (`printing_shops/info`)이 검색에 걸렸고, 거기서 얻은 `/info` 가설을 **라이브 프로브로 직접 확인**했다.
   대표를 기다리기 전에 **내가 찌를 수 있는 경로가 이미 있었다**(`probe-public-data`).
3. 주입 검증 중 **한 번은 주입이 적용되지 않은 채 "초록"** 을 봤다(python 인덱스 조작 실패).
   CLAUDE.md 가 경고한 그대로다 — **주입이 실제로 적용됐는지부터 확인**하고 판정할 것.

## 6. 무엇으로 막았나

- `license-url-variant.test.ts` — `/info` 기본 부착 · env 덮어쓰기 · 경로 주입 차단 · 프로브도 같은 주소
- `license-field-aliases.test.ts` — **라이브 응답 원문을 픽스처로** 넣어 복합키·전화·영업상태 매핑 고정
- `check-guard-mutations.mjs` 3건 추가(오퍼레이션 제거 · 페이징 키 되돌림 · 대문자 별칭 제거)
- ⚠️ 기존 픽스처 5개가 **`v1` 이 기본이라는 전제를 리터럴로** 박고 있어 함께 깨졌다 —
  이름이 아니라 `LICENSE_VARIANTS[0]`/`[1]` 을 끌어오도록 **의미로 재앵커**했다.
