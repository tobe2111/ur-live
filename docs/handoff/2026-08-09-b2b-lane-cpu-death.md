# 2026-08-09 — B2B 수집 레인이 CPU 한도로 죽는다: 원인은 "낡은 보정값"

## 실측 (라이브 하트비트 · `cron_hb:*`)

2026-08-08 **23:00 KST** 한 회차에서 **셋이 동시에** 죽었다. 셋 다 **B2B** 다.

```
collect-hira       ms 21,067   err=Error detail=Worker exceeded CPU time limit
collect-commerce   ms 13,921   err=Error detail=Worker exceeded CPU time limit
collect-storeinfo  ms 13,833   err=Error detail=Worker exceeded CPU time limit
```

⚠️ **벽시계가 판별자가 아니다** — 같은 날 `collect-neis` 는 **24,218ms 에 성공**했다(found 3,000).
13.8초에 죽고 24.2초에 사는 것은 시간이 아니라 **CPU 밀도**가 다르기 때문이다.
`collect-commerce` 는 레코드마다 필드 전수를 정규식으로 훑는다(`anyEmail` 이 `Object.values` 전부,
`anyDomain` 이 `Object.entries` 전부) — 1,499건이면 수만 번이다. `neis` 는 벌크 삽입이라 I/O 지배적이다.

**CPU 위험 경고는 이미 6개 더 있다**(죽지 않았을 뿐 문턱): `collect-nara-contract` 25.4초 ·
`collect-neis` 24.2초 · `collect-localdata-chain` 22.4초 · `maintenance-rescan` 19.5초 ·
`collect-nps` 16.0초 · `maintenance?phase=reextract` 16.1초.

## 근본 원인 — 방어는 있었다. **보정값이 낡았다.**

`commerce-notify-collect.ts` 는 이미 마감선(`RUN_DEADLINE_MS`)과 레코드 상한(`MAX_RECORDS_PER_RUN`)을
갖고 있고, 소스 주석이 12초를 고른 근거를 명시한다 — *"죽는 지점(26초)의 절반 이하"*.

**그 전제가 더는 참이 아니다:**

```
마지막 성공 08-08 21:00 KST  elapsed_ms 13,935  stopped_by="deadline"  found 1,499
사망        08-08 23:00 KST  ms        13,921  CPU limit
```
사망점이 26초 → **13.9초**로 내려오면서 12초 마감선은 사망점의 **87%** 가 됐다 — 여유가 사실상 0.
그리고 마지막 성공 회차는 **마감선(12초)과 레코드 상한(1,500)에 동시에** 닿아 있었다. 둘 다 한계였다.

> 🔑 **왜 이런 낡음이 조용한가**: 워커는 CPU 시간을 안 준다. 그래서 마감선은 **CPU 의 대리 측정**이고,
> 대리값은 사망점이 움직이면 자동으로 낡는다. 게다가 **죽으면 루프 뒤 커서 저장이 안 돌아** 다음 회차가
> 같은 페이지를 또 훑는다(소스 주석의 *"영원히 전진 0"*) — 즉 **죽는 것은 느린 것보다 훨씬 나쁘다.**

## 이번에 한 것

`collect-commerce` 만 재보정했다(증거가 확실한 하나). **원래 기준("사망점의 절반")을 그대로 지키되
갱신된 사망점으로 다시 계산**했다:

| | 전 | 후 |
|---|---|---|
| `RUN_DEADLINE_MS` | 12,000 | **6,000** |
| `MAX_RECORDS_PER_RUN` | 1,500 | **700** |

**보정이 다시 낡는 것을 테스트로 막았다** — `ads-commerce-deadline-calibration.test.ts` 가
`마감선 ≤ 관측 사망점/2` 를 숫자로 고정한다(주석에만 적으면 다음 세션이 "느리니까"로 되돌린다 —
이번에 낡은 것이 바로 주석이었다). 되돌려-검증: 옛 값으로 되돌리면 **2건 빨간불**. 
주입 매니페스트에도 등재(`check-guard-mutations` 220 → **221**, `--only` 로 빨간불 확인).

## ⚠️ 다음 세션이 이어야 할 것 — **아직 둘이 남았다**

- **`collect-storeinfo`**(13,833ms) · **`collect-hira`**(21,067ms) 는 **손대지 않았다.**
  같은 클래스일 가능성이 높지만 각 레인의 마감선/상한을 읽고 **각자의 사망점으로** 보정해야 한다.
  ❌ 공용 상수로 묶지 말 것 — `neis` 가 24.2초에 사는 것이 반증이다. **마감선은 레인마다 다른 값이다.**
  · `hira` 는 성격이 다를 수 있다: 페이지당 `AbortSignal.timeout(25000)` 이라 **I/O 지배적**인데도
    CPU 로 죽었다 ⇒ 자기 일이 아니라 **부모가 이미 CPU 를 태운 상태**에서 죽었을 가능성. 확인할 것.
- **처방 후보 2안**(이번엔 안 건드렸다): ① 레코드당 CPU 를 줄인다(`anyEmail`/`anyDomain` 이 전 필드를
  훑는 것을 후보 키로 좁힌다) — 슬라이스를 안 줄이고 CPU 만 줄이는 유일한 길. ② 유료 전환(CPU 30초).
- **판정 명령**: 배포 다음 짝수시 회차 뒤
  `GET /api/admin/cron-heartbeats` → `ads:collect-commerce` 의 `ok:true` 와 `ms`.
  기대: `ms` 가 6~7초대, `stopped_by="deadline"|"records"`, **`total_saved` 가 전진**.
  ⚠️ **회차당 수확은 줄어드는 게 정상이다**(1,499 → ~700). 판정 기준은 수확이 아니라 **전진**이다.

## 이번에 틀렸던 것

- 대표께 처음 보고할 때 이 셋을 *"부모 CPU 예산을 우회하는 레인"* 문제로 짐작했다. **아니었다** —
  셋 다 `kick`/`gates` 경유의 **자식 인보케이션**이라 자기 CPU 예산을 갖는다. 문제는 배차가 아니라
  **한 회차가 자기 예산 안에서 너무 많은 일을 하는 것**이었다. 짐작 말고 하트비트 원문을 먼저 볼 것.
- "최근 실패 5" 중 **2건은 유령**이다(`enrich-influencer-fanout`, `maintenance?phase=quality` —
  하트비트 응답의 `orphan_lanes` 에 있다 = 코드에서 사라진 레인). 화면이 이걸 계속 실패로 보여줘
  **진짜 실패 3건이 묻힌다.** 어드민에서 orphan 을 접거나 따로 표시하는 것이 남은 일.
