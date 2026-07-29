# 부모 cron 의 부기 비용을 절반으로 — 레인 굶주림의 *산수* (2026-07-29)

## 다음 세션의 첫 액션

배포 후 **한 시간 뒤** 하트비트를 보고 판정한다:

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(d.get('token') or d.get('accessToken'))")
curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)['data']['items']; d.sort(key=lambda r: r['at'])
for r in d:
    if r['name'].startswith('ads:'): print(f\"{r['at'][11:19]} age={r.get('age_minutes'):>4}m {r['name']}\")"
```

**판정 기준(하나만 본다)**: *게이트 없는 매시간 레인*이 **직전 정시에 찍혔는가** —
`enrich-prospects` · `collect-neis` · `collect-hira` · `collect-localdata?mode=backfill` · `match-registry`.

| 결과 | 뜻 | 다음 |
|---|---|---|
| 전부 age ≈ 0~60분 | 부기 비용이 병목이었다 → **해결** | 통신판매(2시간마다)도 결번이 사라지는지 확인 |
| 여전히 결번 | 병목이 부기가 아니다 | 아래 "아직 모르는 것" 으로 |

⚠️ **계단 전체를 보고 판정하지 마라.** `maintenance?phase=*`(hourUTC 로테이션)·짝/홀수시 레인은
원래 매시간이 아니다. 이 오독은 같은 날 내가 실제로 했다.

## 무엇을 고쳤나 — 산수

`kick` 한 번 = **2 서브리퀘스트**(`SELF.fetch` 1 + 하트비트 D1 쓰기 1).
매시간 15~20개 레인 → **30~40**. 인보케이션 천장(~50, **D1 도 같은 지갑**)에 바로 닿는다.

천장을 넘으면 뒤쪽 `SELF.fetch` 가 던지고, `catch` 가 실패를 기록하려는 **D1 쓰기도 같이 실패**한다.
⇒ 그 레인은 `ok:false` 행이 아니라 **행 자체가 없다.** 라이브가 정확히 그 모습이었다 —
통신판매(2시간마다)가 **02:00 이후 04·06·08·10·12 를 통째로 결번**, 실패 기록도 0.

**처방**: 하트비트를 모아 `DB.batch` 로 **한 번에** 쓴다(문장이 몇 개든 서브리퀘스트 1개).
부모 비용 `2N` → `N+1`. 20개 레인이면 40 → 21.

- `beat-batch.ts` — 누적기(임계치 10에서 중간 flush, 마지막에 전체 flush).
- `buildCronBeatRow` 를 `cron-heartbeat.ts` 에서 export — 단건/일괄이 **같은 페이로드**를 쓰게(SSOT).
  두 벌로 쓰면 한쪽만 필드가 추가되고 그 어긋남은 조용하다.
- flush 는 **모든 디스패치가 끝난 뒤**(`Promise.allSettled(kicked)`) — 안 기다리면 빈 배치를 쓰고
  그 뒤 쌓인 기록은 영영 안 나간다(배선이 절반이면 관측이 0 이 되는 그 실패).

## 왜 이 처방을 믿는가 (앞선 오진과의 차이)

같은 날 "레인이 즉시 응답하게" 라는 처방을 냈다가 **되돌렸다** — 서비스 바인딩 피호출자는 호출자보다
오래 살 수 없어 작업이 **취소**됐다(#874 실측: 라운드 0회). 그건 *수명*을 건드리는 처방이었다.

이번 처방은 **수명을 건드리지 않는다**. 레인은 예전과 똑같이 응답 전에 일하고, 부모도 예전과 똑같이
기다린다. 줄어드는 건 **부기 비용**뿐이다. 즉 최악의 경우에도 **현행과 동일**하고, 나빠질 경로가 없다.

## 아직 모르는 것 (실측 전 채택 금지)

부기를 줄여도 결번이 남는다면 병목은 다른 데 있다. 후보:
① 부모의 **수명**(waitUntil 총 시간) ② `SELF.fetch` 자체의 동시성 한도 ③ 레인들이 서로의 D1 을 다툼.
**어느 것도 실측 없이 고르지 마라** — 오늘 이 자리에서 그럴듯한 처방이 정반대로 작동했다.

## 남의 부채 (내 변경 아님)

`src/features/marketing/api/influencer-auto-collect.ts` 가 **602줄**로 600 캡을 넘겼다(#875 에서).
CI 는 변경분만 보므로 통과했지만 `bash scripts/audit-gate.sh` 전체 실행은 **RED** 다.
그 파일을 만지는 세션이 함께 분리하거나, 정당하면 베이스라인에 등재할 것.
