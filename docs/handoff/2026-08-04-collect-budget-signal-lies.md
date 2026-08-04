# 커버리지가 2일로 늘어난 걸 아무도 못 봤다 — 확인처가 늘 "정상"이라서

> 2026-08-04 세션. 어제와 **같은 클래스**다: 신호가 거짓말한다.
> ⚠️ 이번엔 "고치면 악화되는" 함정이 있었다 — §3 을 반드시 읽을 것.

## 1) 다음 세션의 첫 액션

```
GET /api/admin/ads/influencer-pool/stats  → run.budget_exhausted 가 보이는가
D1: SELECT value FROM platform_settings WHERE key='cron_hb:ads:collect'   → at 이 1시간 내인가
```

* `budget_exhausted: true` 가 뜨면 ① 반영됨.
* `cron_hb:ads:collect` 가 최신이면 ③ 반영됨(수리 전: **27시간** 낡음).

## 2) 무엇이 고장나 있었나 (실측)

경보가 *"키워드 순환 정체 — 활성 399개 중 320개가 이틀째 미실행"* 을 띄웠다. 실측:

```
picks : planned 16 → processed 4   (그중 from_cursor 2 · from_yt 2)
예산  : spent 56 / budget_total 56   ·   limit_hit: false   ← 🔴
```

**정체가 아니라 2.1일 주기**다: 회전을 넘기는 건 `from_cursor` 2개뿐 →
`2 × 4라운드(ADS_COLLECT_ROUNDS 기본) × 24h = 192/일`, 활성 399 ÷ 192 ≈ **2.1일**.
경보 임계가 2일이라 딱 걸린 것이고, 수확 자체는 정상이었다(naver 382 발견 → 262 저장).

⚠️ 그리고 **이미 알려져 있었다** — `chain.routes.ts` 주석에 7/29 실측이 있다:
*"키워드 16개 중 3개만 처리 → 활성 210개 한 바퀴 42시간"*. 그때 210이던 활성이 지금 399다.

## 3) ⚠️ 고치면 악화되는 함정 — `limit_hit` 에 합치지 말 것

`limit_hit` 은 `isSubrequestLimitError(diag.yt.error)` 로, **플랫폼 한도 에러를 맞았나**만 본다.
예산은 에러 없이 깨끗하게 소진되므로(키워드마다 `budget.left` 를 보고 멈춘다) 늘 `false` 다.

"그럼 예산 소진도 `limit_hit` 에 넣자" 가 자연스러운 수리인데 **정반대로 악화된다**:

```ts
nextSubreqCap(spent, hitLimit, …)
  if (hitLimit) return … Math.floor(spent * BACKOFF_RATIO)   // ← cap 을 축소한다
```

예산은 거의 매 회차 소진되므로, 합치는 순간 상한이 **매 회차 깎인다.**
⇒ 자가튜닝 입력(`hitLimit`)은 **건드리지 않고**, 보고용 `budget_exhausted` 를 **따로** 낸다.

## 4) 수리 3건

1. **`budget_exhausted`** 신설(`influencer-auto-collect` + 타입). `limit_hit` 무접촉.
2. **경보에 숫자를 싣는다** — 종전엔 `• 점검: run.spent/budget_total/limit_hit` 처럼 *확인처만*
   알려 줬는데, 그 확인처가 늘 정상이라 열어 봐도 소용없었다. 이제 예산·처리·회전 수를 본문에 넣는다.
3. **알람 레인 하트비트 복구** — #1000 이 `collect` 를 DO 알람으로 옮기면서 부모 kick 이 사라졌고,
   `cron_hb:ads:collect` 가 **그 시점에 멈췄다**(실측 27시간 낡음, 실제로는 매시간 정상 실행).
   `getCronHealth` 는 그 키로 판정하므로 **이 레인은 죽어도 침묵 경보가 안 울린다**(#1006 이 고친
   "판정 대상에서 빠짐" 이 알람 이전으로 되살아난 것). 알람 스탬프와 **같은 batch**(서브리퀘스트 +0),
   페이로드는 `buildCronBeatRow`(SSOT) 재사용.

## 5) 이번에 틀렸던 판단 (둘)

**① "긴 자식이 부모 CPU 를 태워 꼬리를 못 밟는다"** — 표본을 늘리니 **기각**됐다.
결측 회차의 자식 최장 **5.5초** vs 기록된 회차 **13~24.5초** — 정반대다. 어제 23:00 한 회차
(enrich-company 10.3초)만 보고 세운 가설이었다. 원인은 아직 모른다.

**② 잠정 회차 요약을 만들려다 물렀다** — 같은 목적을 다른 세션이 `tail-bound.ts` 로 이미 풀었고
(꼬리에 상한 → 기록이 반드시 남음), **그쪽이 더 싸다**(내 안은 회차당 D1 쓰기 2배). 착수 전에
`writeTickSummary` 호출부를 찾다가 발견했다 — main 이 움직였는데 내 지도가 낡아 있었다.
⇒ **손대기 전에 그 파일의 현재 호출부를 먼저 보라.**

## 6) 곁가지 — `undici` 고 취약점(선재)

커밋이 npm audit 에 막혀서 알았다. **main 에도 있던 선재 취약점**이고 이 변경과 무관하다
(확인: origin/main 의 package-lock 으로도 동일 검출). 경로는 `wrangler → miniflare → undici`.

⚠️ **정공법(`wrangler@4.118.0`)은 쓰지 않았다** — peer 로 `@cloudflare/workers-types@5` 를 요구하는데
현재는 `^4.20240925.0` 이다. 워커 타입 **메이저 교체**라 이 PR 에 섞을 크기가 아니다.
⇒ `overrides` 로 `undici@7.29.0`(취약 범위 7.0.0–7.28.0 바로 위, 같은 메이저)만 올렸다. 우회(`[SKIP_AUDIT]`) 안 씀.

📌 다음: workers-types 4→5 + wrangler 상향은 **별건**으로 남는다(타입 전수 영향 확인 필요).

## 7) 대표 판단 대기

* **`ADS_COLLECT_ROUNDS = 8`** (현재 미설정 = 기본 4). 회전 2.1일 → 1.1일.
  라운드마다 **새 인보케이션 = 새 예산**이라 서브리퀘스트 천장과 무관하고, 네이버 쿼터는 25k/일 중 ~2%만 쓴다.
  ⚠️ 다만 **라운드가 실제로 4까지 가는지 확인이 안 된다** — `busy`(리스 보유) 면 즉시 끊기는데 그 깊이가
  어디에도 안 남는다. 8 로 올렸는데 회전이 안 빨라지면 그게 원인이다(그때 깊이 계측을 붙일 것).
* Workers 유료 전환 · 브랜치 보호(`Verify` 하나만).
