# 유어애즈 레인 배분 — 몫을 레인 개수가 아니라 **역할**이 정하게 (2026-08-02)

> 대표 확정: **"무료 유지 — 배분 정책 재설계"**(AskUserQuestion, 08-02 KST 새벽).
> 유료 전환은 **선택하지 않았다** — 아래 §4 에 그 근거와 되돌아올 조건을 남긴다.

## 1. 다음 세션의 첫 액션

**배포 후 첫 짝수 정각에 아래 3개를 본다. 판정은 `nb_unmeasured` 의 *방향* 하나다.**

```bash
# 어드민 토큰 취득은 CLAUDE.md "🔑 어드민 진단 접근" 절차 그대로 ($TOK, $UA)
# ① 배분이 실제로 역할대로 됐는가 (신설 필드)
curl -sS "https://live.ur-team.com/api/admin/ads/influencer-pool/stats" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" | python3 -m json.tool | head -40
#    → 어드민 진단의 dispatch 스냅샷에서 cap_measure / cap_other / ran_measure 확인
#      기대: cap_measure ≥ 1 이고 ran_measure 에 enrich-influencer-driver 가 자주 등장

# ② 측정 레인이 실제로 자주 도는가
curl -sS "https://live.ur-team.com/api/admin/cron-heartbeats" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" \
  | python3 -c "import sys,json;[print(r['at'][:19],r['name']) for r in json.load(sys.stdin)['data']['items'] if 'enrich' in r['name']]"
#    기대: ads:enrich-influencer-driver 가 ~1.5시간마다 (이전 ~3~4시간)

# ③ 백로그 방향 — 이게 유일한 성공 판정
#    stats.total(분모) 과 nb_unmeasured 를 **같이** 본다. 분모가 안 늘면 감소는 가짜다.
```

| 관측 | 08-02 20:32 UTC 기준선 | 기대 방향 |
|---|---|---|
| `nb_unmeasured` | **21,192**(상승 중) | 꺾여야 성공. 계속 오르면 `ADS_MEASURE_SHARE` 를 0.6~0.7 로 |
| `stats.total` | 41,725 | 계속 증가(수집은 느려지되 멈추면 안 됨) |
| `enrich-influencer-driver` 간격 | 154분(2틱 결번) | ~90분 |
| 부모 CPU 실패 | 08-01 16:00 에 2건 | **0 유지 — 늘면 즉시 §4 의 K 를 내릴 것** |

## 2. 완료분

- `src/worker-ads/dispatch-budget.ts` — 역할(`laneRole`)·비율(`MEASURE_SHARE_DEFAULT`=0.5,
  env `ADS_MEASURE_SHARE`)·역할별 몫(`splitCapByRole`)·역할별 커서(`LaneCursors`, `readCursors`).
- `src/worker-ads/lane-runner.ts` — 커서 읽기/쓰기를 JSON 으로(구 포맷 숫자 하나 하위호환), 비율 전달.
- `src/tests/unit/ads-dispatch-budget.test.ts` — 신규 가드 + **기존 "완전 균등" 어서션을 역할 내 공평성으로 교체**.
- `CLAUDE.md` — npm 가용성 단정 정정(§3).

**왜 이걸 했나(실측 근거)**: 커서 라운드로빈(#929)은 모든 매시간 레인을 동등하게 돌린다. 그런데
수집은 백로그를 **만들고** 보강은 **줄인다**. 동등 배분이면 각 기능의 몫이 **"누가 레인을 몇 개
등록했나"로 정해진다** — 라이브 `collect-* 13개 : 측정 1개`. 게다가 데이터 소스를 붙일 때마다
수집 레인이 늘어 측정 몫이 **자동으로 깎이는 한 방향 드리프트**였다.

**시뮬레이션 결과**(48회차, perTick 8, 라이브 레인 구성):
`enrich-influencer-driver` 13회 → **32회**. 수집 레인은 평균 12.8 → 8.0(의도된 감속).
수집 레인을 12개 더 등록해도 측정 회차 **32 유지**(드리프트 차단 확인).

## 3. 이번에 틀렸던 판단 — 다음 세션이 반복하지 말 것

1. **"라운드당 36명이라 2시간에 9,000명은 불가능"(2틱째 보고) — 틀렸다.**
   `enrich.routes.ts` 는 **K-way 슬라이스 팬아웃**(K≤12)이고 자식이 각자 스냅샷을 쓴다.
   스냅샷의 `naver.measured: 22` 는 **한 조각의 마지막 라운드**지 레인 처리량이 아니다.
   ⇒ **퍼-라운드 숫자로 처리량을 추정하지 말 것.** 누적은 `total_measured` 만.
2. **"레인이 안 돌았다 = 고장" 으로 의심했다 — 아니었다.** 하트비트가 없으면 *차례를 못 받은 것*이다
   (예산 분산). `ads_dispatch_last` 의 `deferred` 를 먼저 볼 것.
3. **하트비트 `stale: true` 를 신뢰하지 말 것.** `max_gap_min: 150` 은 레인 15개 시절 값이고
   실제 주기는 ~180분이라 **정상 레인이 매 주기 stale 로 뜬다**(§4 미수리).
4. **CLAUDE.md 의 "npm 정상화"를 믿고 시작했다가 403.** 세션마다 다르다 — 먼저 찔러볼 것.
5. **내 첫 어서션이 틀렸다**: "run ≤ perTick" 은 `perTick < always` 에서 **구조적으로 불가능**하다
   (미룰 수 없는 레인만으로 이미 초과 — 그게 `over_budget` 신호의 존재 이유). 해네스가 잡아줬다.
6. **컴파일된 JS 해네스로 "검증 끝"이라 믿었다가 CI 를 두 번 돌렸다.** 해네스는 타입 에러를 못 잡는다
   (`let cursor = 0` 에 객체 대입 = TS2322). CLAUDE.md 에 **스텁 tsconfig 로 테스트 파일까지
   타입체크하는 법**을 적어 뒀다 — 그걸로 바꾸자 TS7022(narrowing 순환)까지 미리 잡혔다.
   ⇒ npm 이 막혔으면 **실행 검증 + 스텁 타입체크를 둘 다** 하고 나서 푸시할 것.
7. **CI 실패를 "내 것"으로 단정하기 전에 스텝 설정을 볼 것.** 같은 로그에 스키마 drift 실패
   (`product_stay_rooms`)가 섞여 있었는데 그 스텝은 `continue-on-error: true`(정보용)라 차단 요인이
   아니었다. 차단한 건 내 TS 에러 하나뿐이다.

## 4. 남은 결정 / 미수리

- **[대표 결정 대기] 유료 전환** — 이번엔 "무료 유지"를 택했다. 되돌아올 조건: 이 배분 변경 후에도
  `nb_unmeasured` 가 계속 오르면, 무료의 천장(레인/틱 8)이 진짜 병목이라는 뜻이다.
  ⚠️ 전환 시 `ADS_PLAN=paid` **한 줄로는 부족하다** — 자동 확대되는 건 레인 주기뿐이고
  서브리퀘스트 천장(`ADS_SUBREQ_PLATFORM_CAP`, 기본 60)·팬아웃(`ADS_INFLUENCER_ENRICH_FANOUT`, 4)·
  라운드(`ADS_INFLUENCER_ENRICH_ROUNDS`, 12)·마감(`ADS_ENRICH_DEADLINE_MS`, 7s)은 **각자 별도 env**다.
  전부 무배포 조정 가능. 전환 체크리스트가 `docs/` 에 없다 — 만들 것.
- **[미수리] 하트비트 `max_gap_min` 미보정** — 150분 고정인데 실제 주기 ~180분. 정상 레인이 계속
  `stale` 로 떠서 **진짜 기아와 구분이 안 된다.** 조 개수에서 유도하면 해결(`60 × ceil(n/cap)`).
  이번 PR 범위 밖으로 뒀다(하트비트 메타는 다른 파일·다른 세션 활성 영역).
- **[관측] `yt_units.used 2003 / total 2000`** — 유튜브 일일 쿼터 초과 상태. yt 측정은 0이라
  당장 영향은 없으나 원인 미규명.
- **[미검증] 이 세션은 vitest·build 를 못 돌렸다**(npm 403). 순수 로직은 전역 tsc 로 단독 컴파일해
  **실제 실행 검증 + 되돌려-검증(2종 파괴 → 빨강 확인)** 까지 했고, audit-gate 81 GREEN.
  **배선·빌드 회귀는 CI 가 유일한 판정** — PR 초록 확인 후 머지할 것.

## 5. 롤백

`ADS_MEASURE_SHARE` 로는 못 되돌린다(비율 0/1 은 범위 밖이라 기본값). 되돌리려면
`selectLanesForTick` 의 역할 분기를 제거(= `pickFrom(movable, cap, cursor)` 한 번)하거나 커밋 revert.
커서는 구 포맷을 계속 읽으므로 **되돌려도 데이터 정합성 문제는 없다**.
