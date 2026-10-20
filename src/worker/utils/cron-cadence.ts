/**
 * ⏱️ **cron 주기 계산 — 순수함수만** (`cron-heartbeat.ts` 에서 분리, 2026-08-25).
 *
 * 가른 기준은 크기가 아니라 **층**이다:
 *   - `cron-heartbeat.ts` = *기록·조회*(D1 을 읽고 쓴다)
 *   - 이 파일             = *계산*(식 → 기대주기 → 관용). I/O 가 하나도 없다.
 *
 * 그래서 이 파일은 **워커 밖에서도, 테스트에서도 그냥 부를 수 있다** — 실제로 유닛 대부분이
 * 여기만 쓴다. 그리고 ur-ads 가 같은 공식을 복제하는데(별도 워커), 그 동치성을 테스트가 고정한다.
 *
 * ⚠️ 호환을 위해 `cron-heartbeat.ts` 가 **재수출**한다 — 기존 import 경로를 깨지 않는다.
 *   새 코드는 이 파일에서 직접 가져오는 편이 낫다(I/O 를 딸려오게 하지 않는다).
 */

/** 하트비트가 남긴 사망 카운터 → 위험 등급. 최근일수록 위험. 기록이 없으면 `null`(모른다). */
export function cpuRiskFromDeaths(deaths?: number | null, lastAt?: string | null, nowMs = 0): 'warn' | 'danger' | null {
  const n = Number(deaths) || 0
  if (n <= 0) return null
  const t = lastAt ? Date.parse(lastAt) : NaN
  if (!Number.isFinite(t) || !nowMs) return 'warn'
  const days = (nowMs - t) / 86_400_000
  if (days <= 7) return 'danger'      // 최근 일주일에 죽었다 = 지금 위험하다
  return days <= 30 ? 'warn' : null   // 한 달 넘었으면 흘려보낸다(옛 사고가 영원히 붉게 남지 않도록)
}

/**
 * cron 식으로부터 **"이 시간을 넘기면 이상하다"** 기준(분)을 계산한다. 순수함수 — 테스트 가능.
 *
 * 넉넉하게 잡는다(기대주기 × 2 + 30분 여유): 배포·재시도·지연으로 한두 번 밀리는 것까지
 * 경보로 올리면 곧 아무도 안 본다. "확실히 이상한 것만" 울리는 게 목적이다.
 * 해석 불가한 식은 null → **경보하지 않는다**(모르면 조용히 있는 편이 오탐보다 낫다).
 */
/**
 * ⏰ **슬롯 작업의 오탐** (2026-08-13 실측 — 대표 "굳이 필요없는 알람은 없애줘").
 *
 *   소비자 cron 은 대부분 **5분 캐리어**(매 5분 트리거)에 얹혀 `slotDue(...)` 로 자기 시각에만 돈다.
 *   그런데 하트비트에 기록되는 건 캐리어 식이라 이 함수가 **40분**(5×2+30)을 기대치로 내놓고,
 *   하루 1회 작업은 그 뒤 23시간 내내 `stale` 이 된다. 라이브 실측: `cron 실패 24h 8건`이
 *   **전부** 이 오탐이었다(stay-reminder·meal-voucher-expire·district-coupon-expire 등 18:40 KST 일 1회).
 *   ⚠️ 매일 울리는 경보는 곧 아무도 안 읽는 경보가 된다 — 이 모듈이 반복해 경고하는 그 병이다.
 *   ⇒ `scheduled.ts` 의 `slotCron(expr)` 이 **자기 슬롯을 cron 식으로 표현해** 이 함수에 넘긴다.
 *     기대치 규칙은 여기 한 곳뿐이라 두 벌로 갈라지지 않는다.
 */
export function expectedMaxAgeMinutes(cronExpr?: string | null): number | null {
  if (!cronExpr || typeof cronExpr !== 'string') return null
  const f = cronExpr.trim().split(/\s+/)
  if (f.length !== 5) return null
  const [min, hour, dom, , dow] = f
  let base: number
  const everyN = /^\*\/(\d{1,3})$/.exec(min || '')
  if (everyN && hour === '*') base = Math.max(1, Number(everyN[1]))
  // 🕓 분 목록(`5,20,35,50 * * * *`)은 **시간당 그 개수만큼** 돈다. 예전엔 이걸 "매시 1회"로 읽어
  //   기대 간격이 4배 느슨해졌다 — 15분마다 도는 작업이 2시간 멈춰도 조용했다는 뜻이다.
  //   단일 분(`50 * * * *`)이면 목록 길이 1 이라 종전과 **같은 값**이 나온다(하위호환).
  else if (hour === '*') base = Math.max(1, Math.floor(60 / Math.max(1, (min || '').split(',').length)))
  else if (dow !== '*') base = 60 * 24 * 7      // 주간
  else if (dom !== '*') base = 60 * 24 * 31     // 월간
  else base = 60 * 24                           // 매일
  return staleToleranceMinutes(base)
}

/**
 * 🩸 **관용은 주기에 비례해야 한다** (2026-08-25 실사고로 신설).
 *
 * ## 무엇이 있었나
 *
 * 규칙이 주기와 무관하게 `기대주기 × 2 + 30분` 이었다. 잦은 작업에는 옳다 — 5분 작업이 한두 틱
 * 밀리는 건 노이즈고, 매번 울리면 아무도 안 본다(이 모듈이 반복해 경고하는 병).
 *
 * **그런데 하루 1회 작업에 ×2 를 쓰면 "하루를 통째로 건너뛰어도 조용하다"는 뜻이 된다.**
 * 그건 관용이 아니라 실명이다. 2026-08-25 실측:
 *
 * ```
 * 0 18 * * * 블록 17개 전부 — 마지막 실행 08-23 18:00 (37시간 전)
 *   ledger-reconcile · ledger-integrity-check · auto-settlement
 *   supplier-settlement-mature · affiliate-mature · referral-mature · expired-voucher-refund …
 * 08-24 회차가 통째로 없었는데 경보 0건. 허용이 48.5시간이라 37시간은 '정상'이었다.
 * ```
 * 정산 cron 이 하루 안 돈 것을 **사람이 하트비트를 손으로 세어서** 알았다. 다음에 또 나면 또 그래야 한다.
 *
 * ## 규칙
 *
 * - **하루 이상 주기**: `주기 + min(주기/4, 6시간)` — 한 회차를 건너뛰면 **반드시 보인다**.
 *   (일간 30h · 주간 7.25일 · 월간 31.25일. 늦게라도 그 회차가 돌면 조용하다.)
 * - **그 미만**: 종전 `× 2 + 30분` 유지 — 잦은 작업의 오탐을 늘리지 않는다.
 *
 * ⚠️ **이 함수가 못 보는 것**: "돌긴 도는데 내부에서 조기 return" — 그건 하트비트 `result` 로만 보인다.
 *   그리고 **두 회차 연속 누락과 한 회차 누락을 구분하지 않는다**(둘 다 그냥 stale). 필요해지면
 *   기대 발화 시각을 역산해 누락 횟수를 세야 하는데, 지금은 "한 번이라도 빠지면 보인다"로 충분하다.
 */
/**
 * ⏳ **이 값은 하트비트에 *기록 시점*으로 박힌다** — 규칙을 고쳐도 각 작업이 *다음에 뛸 때*까지
 *   옛 값이 남는다. 그래서 배포 직후 어드민에서 옛 임계가 보이는 것은 **정상**이다.
 *
 *   🩸 2026-08-25 에 이걸로 5분을 헛썼다: 배포 직후 라이브에서 `ads:weekly-report gap=20190`
 *   (= 옛 `×2+30`)을 보고 *"ur-ads 에 배포가 안 됐다"* 고 판정했는데, 실제로는 배포는 09:49 에
 *   성공했고 그 레인이 **월요일에 마지막으로 뛴 뒤 아직 안 뛴 것**뿐이었다.
 *   ⇒ 배포 여부는 이 값이 아니라 **워크플로 실행 기록**으로 판정할 것.
 *
 *   자기치유 주기는 작업의 주기와 같다(일간 하루 · 주간 최대 7일). 그 창 동안은 **옛(더 느슨한)**
 *   임계로 판정되므로 놓치는 쪽이 아니라 **늦게 우는 쪽**으로 기운다 — 안전한 방향이라 그대로 둔다.
 */
export function staleToleranceMinutes(baseMinutes: number): number {
  const base = Math.max(1, Math.floor(baseMinutes))
  if (base >= 60 * 24) return base + Math.min(Math.floor(base / 4), 6 * 60)
  return base * 2 + 30
}
