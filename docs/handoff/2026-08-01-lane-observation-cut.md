# 08-01 — 레인은 살아 있었다. 죽은 건 관측이다

## 한 줄

하트비트가 "죽었다"고 말한 레인 셋이 **같은 순간 자기 스탬프를 방금 찍고 있었다.**
레인은 일을 하고 D1 쓰기도 되는데, **그 직후의 하트비트 한 줄만** 안 남는다.

## 실측 (08-01 13:06 UTC, `/api/admin/cron-heartbeats` ↔ `/api/admin/partner-pool/stats`)

| 레인 | 하트비트가 말하는 것 | 그 레인의 자기 스탬프 | 판정 |
|---|---|---|---|
| `ads:enrich-company` | 07:00 **실패** | `enrichLast.last_run` **13:01:05** (`spent 21/51`, `limit_hit:false`) | 관측만 죽음 |
| `ads:match-registry` | 12:00 ok | `registryMatch.last_run` **13:01:03** (`scanned 400`) | 관측만 죽음 |
| `ads:reclassify-company?passes=5` | 12:00 ok | `reclassify.last_run` **13:01:04** (`scanned 1000 / updated 1000`) | 관측만 죽음 |
| `ads:sweep-kakao-chain` | 00:01:18 ok | `kakaoSweep.last_run` **00:01:18** | **일치** — 이건 진짜로 13시간째 안 돎 |

⚠️ 마지막 줄이 중요하다. 넷 다 "멈춤"으로 보였지만 **성격이 완전히 다르다.**
자기 스탬프와 대조하지 않았으면 넷을 같은 고장으로 묶어 엉뚱한 데를 팠을 것이다.
(대표 지시 "하트비트만 보고 판정하지 말 것"이 정확히 이걸 막았다.)

## 왜 그런가 (근거 있는 만큼만)

세 레인의 자기 스탬프는 **13:01:03~05** 에 몰려 있고, 부모의 하트비트 배치는 **13:01:05.347** 에 flush 되고 끝난다.
즉 자식들이 작업을 마치고 **마지막 한 줄을 쓰려는 그 1초 안에** 부모가 끝났다.
피호출자는 호출자보다 오래 살 수 없으므로(#874) 자식은 그 자리에서 함께 사라진다.

**기각한 가설** — `env.SELF` 미바인딩(= kick 이 인라인 폴백):
같은 회차에 reclassify(1000행×5패스) · registryMatch(d1 11) · enrich(fetches 17)가 **모두 완주**했다.
한 인보케이션의 서브리퀘스트 천장(≈50)으로는 불가능하다 ⇒ **kick 은 진짜 별도 인보케이션이 맞다.**
(`wrangler-ads.toml:48` 에 `[[services]] binding = "SELF"` 도 확인.)

## 무엇을 했나

**부모 실패 원문** (#912) — `cronErrorCode` 가 `name || 'Error'` 라 메시지를 통째로 버려 12개 레인이 전부
`err=Error` 한 단어였다. 분류(`limit`/`timeout` — AIMD 학습 상한이 실제로 읽는 값)는 **그대로 두고**
`detail` 을 함께 싣는다. 자식이 통째로 죽으면 #904 의 자식측 기록도 안 남으므로, 그 경우 **부모의 이 한 줄이 유일하다.**

## 하려다 **뺀 것** — `markLaneStarted` (다음 세션이 판단할 것)

레인이 일하기 **전에** `ok:false` + `phase:'start'` 한 줄을 먼저 써서 "안 돌았다" / "돌다가 잘렸다" 를
가르려 했다. 구현·시험까지 끝냈다가 **머지 직전에 뺐다.** 이유:

같은 시각 **#913** 이 정반대 방향을 머지했다 — `finally` 의 beat 쓰기 `await` 가 **자식 수명을 늘려**
느린 레인을 죽인다는 진단으로, 그 쓰기를 `waitUntil` 로 옮겨 **응답 경로 밖**으로 뺐다.
내 시작 표시는 그 앞에 D1 쓰기를 **다시 넣는다.** 두 가지가 겹치면:
1. #913 이 효과가 있었는지 **측정할 수 없다**(같은 틱에 두 변경이 섞인다)
2. #913 이 방금 제거한 지연을 내가 되돌려 놓는다

⇒ **#913 의 효과를 먼저 잰다.** beat 가 안정적으로 남으면 시작 표시는 애초에 불필요하다.
여전히 무기록이면 그때 넣는다 — 그때는 "시작조차 못 한다"가 유일하게 남은 갈래이므로 값이 확실하다.

> 설계 메모(다시 만들 때): `ok:true` 로 쓰면 **잘린 회차가 성공으로 굳는다** — 오늘 하루 세 번 우리를
> 속인 바로 그 양식이다. 반드시 `ok:false` + `phase:'start'`. 비용은 D1 쓰기 ≈408/일(같은 키 덮어쓰기).

## 이번에 내가 틀렸던 것

- 직전 보고에서 **"D1 전용 레인은 살고 외부 HTTP 레인만 죽는다"** 고 썼는데 **틀렸다.**
  `collect-maker`(외부 HTTP, 5789ms)는 13:01 에 멀쩡히 beat 를 남겼고, `match-registry`(D1 전용)는 안 남겼다.
  가르는 축은 **프로토콜이 아니라 완료 시점**이다 — 부모가 끝나는 순간에 걸렸는가.
- 한때 "레인 12개가 매시간 실패한다"고 읽었는데, 그중 최소 셋은 **실패가 아니라 기록 유실**이었다.

## 곁가지 실측 (판정은 아직 못 함)

- **ur-ads 배포 폭주**: 최근 100회 중 **12시대에만 50회**, 21회가 `cancelled`(`concurrency: cancel-in-progress`).
  `deploy-ads.yml` 의 경로 필터가 `src/worker/**` · `src/features/marketing|social-media|supply/**` 로 넓어
  **거의 모든 머지가 ur-ads 를 재배포**한다. 배포는 in-flight isolate 를 죽인다.
  → 다만 07:00~11:00 구간은 시간당 1회뿐이라 **이 구간의 기록 유실은 배포로 설명되지 않는다.** 별개 원인.
- **CF API 토큰은 여전히 죽어 있다** (`/user/tokens/verify` → `Invalid API Token`). 대표만 재발급 가능.

## 다음 세션의 첫 액션

1. **#913 이 먹혔는지부터** — 다음 정시에 `GET /api/admin/cron-heartbeats` 에서 13:00 에 기록이 없던
   레인들(`enrich-company`·`match-registry`·`reclassify-company`)에 beat 가 **생겼는지** 본다.
   ⚠️ 하트비트만 보지 말고 **자기 스탬프와 대조**한다(그게 이 판정의 전부다 — 위 표 방식 그대로).
   - 생겼다 ⇒ 수명 가설이 맞았다. 시작 표시는 **불필요**하다(위 "뺀 것" 참조).
   - 여전히 없다 ⇒ 시작조차 못 한다는 뜻이므로 그때 `markLaneStarted` 를 넣어 확정한다.
2. `ok=false` 인 레인의 **`result.detail`**(#912) 원문을 읽는다 — `Too many subrequests` / `Network connection lost` / `internal error` 중 무엇인지가 처방을 가른다.
3. `ads:sweep-kakao-chain` 은 위 둘과 **다른 문제**다(기록·스탬프 일치 = 진짜 미실행). 별건으로 볼 것 — 아래 가설 참조.

## `sweep-kakao-chain` — 검증되지 않은 가설 (다음 세션이 확인할 것)

00:01:18 이후 **하트비트도 스탬프도** 없다. 게이트는 켜져 있다(같은 게이트의 `enrich-company`·`match-registry`·
`reclassify` 는 13:01 에 돌았다). 즉 **kick 은 되는데 첫 쓰기 이전에 죽는다**로 보인다.

가장 유력한 자리는 후보 조회다 — `company-collect.ts:470`:

```sql
SELECT id, company_name, region, address FROM ad_company_leads
 WHERE merged_into IS NULL AND (phone IS NULL OR phone = '') AND address IS NOT NULL AND address != ''
   AND (kakao_checked_at IS NULL OR kakao_checked_at < datetime('now','-30 days'))
 ORDER BY (tier IS NULL) ASC, tier ASC, id ASC LIMIT 600
```

`held_no_contact` 가 **150,294** 건이고 정렬 키가 계산식(`tier IS NULL`)이라 인덱스를 타기 어렵다.
이 한 방이 오래 끌면 레인은 **아무 기록도 못 남기고** 사라진다 — 지금 화면과 정확히 같은 모습이다.

⚠️ **아직 가설이다.** #913 배포 후 다른 레인은 beat 가 살아났는데 **이 레인만 무기록**이면 가설이 강해진다
(그때 남는 차이는 이 레인만 갖는 150k행 조회다). 확정하려면 위에서 뺀 `markLaneStarted` 가 필요하다 —
`phase=start` 가 남으면 조회 **이후**에서 죽는 것이고, 그래도 무기록이면 조회와 무관한 디스패치 문제다.

판정 전에 인덱스를 추가하지 말 것 — 추측으로 스키마를 만지면 원인이 그대로 남은 채 증거만 흐려진다.

## 대표 판단 대기

- data.go.kr `1741000` 활용신청 상태/기간 (인허가 HTTP 500 — 요청 형태 5종 소진, 대조군으로 키는 유효 확인됨)
- CF API 토큰 재발급 (스코프는 **D1 읽기 전용 최소**)
- 인허가 백필 커서 리셋 여부
