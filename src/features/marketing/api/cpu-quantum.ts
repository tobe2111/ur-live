/**
 * 🧠 **CPU 사망을 학습해 회차당 작업량을 스스로 줄인다** (2026-08-04, 대표 승인 "응 하자").
 *
 * ## 왜 — 이미 있는 조절기에 이 신호만 안 물려 있었다
 *
 * 이 워커에는 자기교정 루프가 둘 있다. 서브리퀘스트 상한(`nextSubreqCap` — 한도를 치면 백오프,
 * 괜찮으면 가산 회복)과 회차당 레인 수(`lane-aimd`). **그런데 `Worker exceeded CPU time limit` 은
 * 어느 쪽에도 안 들어간다.** 실행 기록에 문장 그대로 남는데 아무도 읽지 않았다.
 *
 * 그래서 2026-08-04 에 사람이 손으로 줄였다: 재분류 5,000행 → 1,000행(#1054), 파트너 수집에
 * 벽시계 마감선(#1059). 둘 다 효과가 확인됐다(`ms=1,316` 사망 → `ms=5,681` 완주 ·
 * `run_ms 31,376 → 12,981`). **효과가 확인된 손작업은 자동화 후보다.**
 *
 * ## 무엇을 하는가
 * 레인이 CPU 로 죽으면 그 레인의 **작업량 배수**(0<q≤1)를 반으로 줄이고, 깨끗한 회차가
 * `CLEAN_RUNS` 만큼 쌓이면 한 단계 되돌린다. `nextSubreqCap` 과 **같은 모양**이다 —
 * 곱셈 백오프 · **가산** 회복(배율 회복은 백오프와 맞물려 2주기 진동한다, 그 파일의 실사고).
 *
 * ## ⚠️ 경계 — 이건 *값* 조정이지 *코드* 수정이 아니다
 * 08-04 의 수리 세 건은 전부 판단이 필요했다(상한을 어디에 걸지 · 커버리지가 보존되는지 ·
 * 어느 루프를 묶을지). 같은 날 가드가 **정상 코드에 네 번 빨간불**을 냈고 그때마다 "이건 검사
 * 범위 문제"라는 판단이 필요했다. ⇒ **코드 변경은 자동화하지 않는다.** 이 모듈이 만지는 것은
 * 이미 존재하는 상한의 *배수* 하나이고, 바닥·천장이 있어 되돌릴 수 있다.
 *
 * ## ⚠️ 이 설계가 못 하는 것
 * - **왜** CPU 를 태우는지는 모른다. 줄이면 살아나지만 근본 원인(무거운 파싱 등)은 그대로다.
 *   `q` 가 바닥(`Q_MIN`)에 붙어 있는 레인은 **사람이 봐야 한다** — 그게 이 값의 두 번째 용도다.
 * - 자기 하트비트를 쓰는 레인의 **성공**은 부모가 못 볼 수 있다. 반면 **CPU 사망은 항상 부모가
 *   기록한다**(죽은 레인은 자기 비트를 못 쓴다) — 그래서 백오프 신호는 놓치지 않는다.
 *   회복이 느려질 뿐이고, 그 방향의 오차는 안전하다.
 */

/** 작업량 배수의 바닥. 0 으로 내려가면 레인이 영영 아무것도 못 한다. */
export const Q_MIN = 0.2
/** 사망 시 곱하는 값(반토막) — `nextSubreqCap` 의 BACKOFF 와 같은 성격. */
export const Q_BACKOFF = 0.5
/** 회복 폭(가산). 배율로 되돌리면 백오프와 맞물려 진동한다. */
export const Q_RECOVER = 0.1
/** 이만큼 깨끗해야 한 단계 회복. */
export const Q_CLEAN_RUNS = 3
/** 학습 상태를 담는 단일 행 — `ads_lanes_learned` 와 같은 방식(레인마다 행을 만들지 않는다). */
export const CPU_QUANTA_KEY = 'ads_cpu_quanta'

/** 레인별 상태. **줄어든 레인만** 이 표에 있다(q===1 이면 지운다 — 표가 무한히 자라지 않게). */
export interface LaneQuantum { q: number; c: number }
export type CpuQuanta = Record<string, LaneQuantum>

/**
 * 하트비트 결과가 **CPU 한도 사망**인가.
 *
 * ⚠️ **`result` 는 문자열이 아니라 객체다** — `adsBeat` 이 실패를 이렇게 싣는다:
 *   `{ err: cronErrorCode(err), detail: 'Worker exceeded CPU time limit.' }`.
 *   첫 판이 `String(result)` 였는데 그러면 `"[object Object]"` 가 되어 **영영 안 잡힌다**
 *   — 에러도 안 나고 학습만 조용히 멈추는, 이 레포가 반복해 만난 바로 그 실패 모양이다.
 *   (호출부를 읽고서야 알았다. 타입이 `unknown` 이라 컴파일러도 안 잡아 준다.)
 *
 * ⚠️ 문구 매칭이다 — Cloudflare 가 문장을 바꾸면 조용히 안 잡힌다. 그래서 넓게 본다
 * (`cpu` + `limit` 이 같이 있으면 사망). 오탐 위험은 작다: 그 조합이 든 다른 실패도
 * 결국 "이 레인이 회차당 너무 많이 한다"는 같은 처방이 맞는다.
 * ⚠️ 반대로 서브리퀘스트 한도(`Too many subrequests`)는 `limit` 만 있고 `cpu` 가 없어 안 걸린다 —
 *   그건 이미 `nextSubreqCap` 이 따로 학습한다(두 조절기가 같은 신호를 두 번 먹으면 안 된다).
 */
export function isCpuDeath(result: unknown): boolean {
  if (result == null) return false
  let s: string
  if (typeof result === 'string') s = result
  else { try { s = JSON.stringify(result) || '' } catch { s = String(result) } }
  s = s.toLowerCase()
  return s.includes('cpu') && s.includes('limit')
}

/** 저장된 표를 안전하게 읽는다(손상/부재는 빈 표). */
export function parseQuanta(raw: string | null | undefined): CpuQuanta {
  try {
    const o = JSON.parse(String(raw || '{}')) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
    const out: CpuQuanta = {}
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const q = Number((v as LaneQuantum | undefined)?.q)
      const c = Number((v as LaneQuantum | undefined)?.c)
      if (Number.isFinite(q) && q > 0 && q < 1) out[k] = { q: clampQ(q), c: Number.isFinite(c) && c >= 0 ? Math.floor(c) : 0 }
    }
    return out
  } catch { return {} }
}

const clampQ = (q: number): number => Math.min(1, Math.max(Q_MIN, Math.round(q * 100) / 100))

/** 이 레인이 지금 쓸 배수. 표에 없으면 1(=제한 없음). */
export function quantumFor(state: CpuQuanta, lane: string): number {
  const v = state[lane]
  return v && Number.isFinite(v.q) ? clampQ(v.q) : 1
}

/**
 * 배수를 실제 상한에 적용한다. **바닥이 있다** — 0 이 되면 레인이 도는 의미가 없다.
 * @param base 원래 상한(행 수·키워드 수·ms 등)
 * @param min  이 아래로는 안 줄인다(기본 1)
 */
export function applyQuantum(base: number, q: number, min = 1): number {
  if (!Number.isFinite(base) || base <= 0) return base
  if (!Number.isFinite(q) || q >= 1) return Math.floor(base)
  return Math.max(min, Math.floor(base * clampQ(q)))
}

/**
 * 이미 읽어 둔 표 문자열에서 배수를 꺼낸다 — 레인이 **자기 부팅 조회에 키를 얹은** 경우.
 *
 * 여러 레인이 이미 `key IN (?,?,?)` 로 설정을 한 번에 읽는다. 거기에 `?` 하나만 더하면
 * **서브리퀘스트가 0 만큼 는다** — `readLaneSettings` 를 쓰려고 그 구조를 갈아엎는 것보다
 * 훨씬 작은 변경이고, 파싱은 여기 하나로 모여 두 경로가 갈라지지 않는다.
 */
export const quantumFromRaw = (raw: string | null | undefined, lane: string): number =>
  quantumFor(parseQuanta(raw), lane)

/** `readLaneSettings` 가 쓰는 최소 D1 모양 — 유닛이 가짜 DB 를 끼울 수 있게 구조 타입으로 둔다. */
export interface SettingsReader {
  prepare: (sql: string) => { bind: (...args: unknown[]) => { all: <T>() => Promise<{ results?: T[] } | null> } }
}

export interface LaneSettings {
  /** 요청한 키의 값(없으면 `undefined` — 기존 `.catch(() => null)` 와 같은 모양). */
  get: (key: string) => string | undefined
  /** 이 레인이 지금 쓸 작업량 배수. 학습이 없거나 읽기에 실패하면 **1**(=현행 그대로). */
  q: number
}

/**
 * 🔌 **레인이 쓰는 소비 진입점** — 한 번의 D1 조회로 설정들과 CPU 배수를 **함께** 읽는다.
 *
 * ## 왜 이런 모양인가 — 감지만 있고 소비가 없으면 그냥 no-op 이다
 * 2026-08-04 첫 판은 감지(`beat-batch`)와 소비(`reclassifyWorkPlan`) 한 쌍만 배선했다. 그래서
 * **다른 레인이 CPU 로 죽으면 표에 `q` 가 적히기만 하고 아무도 읽지 않았다** — 자동수리가 도는
 * 것처럼 보이는데 실제로는 그 레인에 아무 일도 일어나지 않는다. 이 레포가 반복해 만난
 * "조용한 no-op" 이 정확히 이 모양이라, 소비 진입점을 하나로 두고 레인마다 한 줄로 붙인다.
 *
 * ## 💸 비용이 0 인 이유 — 읽기를 늘리는 게 아니라 **합친다**
 * 레인들은 이미 `ads_subreq_cap_*`·커서·통계를 **각각** 조회한다. 그 키들을 이 함수에 함께 넘기면
 * `key IN (…)` 한 문장이 되어 서브리퀘스트가 **오히려 줄어든다**(hira: 2→1). 부모 꼬리는 지금
 * 예산이 빠듯한 자리라, 조절기를 붙이면서 비용을 더하면 그 자체가 새 문제가 된다.
 *
 * 🔒 **실패는 항상 안전한 방향**: 조회가 깨지면 `q=1` 이라 레인은 **오늘과 똑같이** 동작한다.
 *   조절기가 고장 나서 레인이 *더* 많이 하게 되는 경로는 없다.
 */
export async function readLaneSettings(
  DB: SettingsReader | null | undefined,
  keys: readonly string[],
  lane?: string,
): Promise<LaneSettings> {
  const want = lane ? [...keys, CPU_QUANTA_KEY] : [...keys]
  const map = new Map<string, string>()
  if (DB && want.length > 0) {
    const rows = await DB.prepare(`SELECT key, value FROM platform_settings WHERE key IN (${want.map(() => '?').join(',')})`)
      .bind(...want).all<{ key: string; value: string }>().catch(() => null)
    for (const r of rows?.results || []) if (r?.key != null) map.set(String(r.key), String(r.value ?? ''))
  }
  return { get: (k: string) => map.get(k), q: lane ? quantumFor(parseQuanta(map.get(CPU_QUANTA_KEY)), lane) : 1 }
}

export interface BeatOutcome { name: string; ok: boolean; result?: unknown }

/**
 * 이번 회차 결과로 표를 갱신한다. **순수함수** — 호출부가 `changed` 일 때만 쓴다(쓰기 절약).
 *
 * - CPU 사망 → 반토막(바닥 `Q_MIN`), 회복 카운터 리셋
 * - 성공 → **이미 줄어든 레인만** 카운트. 임계에 닿으면 한 단계 올리고, 1 에 닿으면 표에서 제거
 * - 그 외 실패(네트워크·API 오류 등) → **건드리지 않는다.** 작업량과 무관한 실패로 상한을
 *   내리면 멀쩡한 레인이 조용히 쪼그라든다
 */
export function reduceCpuQuanta(state: CpuQuanta, beats: readonly BeatOutcome[]): { next: CpuQuanta; changed: boolean } {
  const next: CpuQuanta = { ...state }
  let changed = false
  for (const b of beats) {
    if (!b.ok && isCpuDeath(b.result)) {
      const cur = next[b.name]?.q ?? 1
      const q = clampQ(cur * Q_BACKOFF)
      if (q !== cur || (next[b.name]?.c ?? 0) !== 0) changed = true
      next[b.name] = { q, c: 0 }
      continue
    }
    if (b.ok && next[b.name]) {
      const cur = next[b.name]
      const c = cur.c + 1
      if (c < Q_CLEAN_RUNS) { next[b.name] = { q: cur.q, c }; changed = true; continue }
      const q = clampQ(cur.q + Q_RECOVER)
      if (q >= 1) { delete next[b.name]; changed = true; continue }  // 완전 회복 — 표에서 뺀다
      next[b.name] = { q, c: 0 }
      changed = true
    }
  }
  return { next, changed }
}
