/**
 * 🔬 **판정 변화율 계측** — "재분류 랩을 좁혀도 되는가"에 답하기 위한 계수기 (2026-08-14).
 *
 * ## 왜 이게 필요한가
 * 재분류 랩은 규칙 버전이 오를 때마다 **전 행**(30만)을 다시 도장 찍는다. 시간당 250행이라
 * 한 바퀴에 38일이고, 그동안 규칙 수정은 화면에 안 닿는다. 좁히면 2일이 된다:
 *
 * ```
 * 등록부 소스(commerce·storeinfo·market·nara)  290,791  (96.1%)
 * 추측 소스(webkr·local)                        11,725  ( 3.9%)  →  11,725 ÷ 250 ÷ 24 ≈ 2일
 * ```
 *
 * 좁혀도 되는 근거는 `reclassify-priority.ts` 헤더의 *"등록부 소스는 규칙을 바꿔도 판정이
 * 거의 안 바뀐다"* 인데 — 🔴 **그건 주석의 주장이고 한 번도 측정된 적이 없다.**
 * 지금 코드가 세는 `updated` 는 *"도장 찍은 행 수"* 라서 전부 100% 로 보인다.
 *
 * ⚠️ **틀리면 방향이 반대가 되는 종류의 가정이다.** 등록부 판정이 실제로 자주 바뀐다면 좁히기는
 * "어떤 행이 영영 재판정 안 되는" 조용한 부재를 만든다 — 이 레포가 반복해 만난 사고 유형.
 * 그래서 **좁히기 전에 센다.** 이 모듈은 그 계수기이고, 그 자체로는 아무 동작도 바꾸지 않는다.
 *
 * ## 읽는 법
 * `ads_reclassify_stats.delta` 의 `reg_changed / reg_seen` 이 답이다.
 * - **낮다(≲2%)** → 좁히기(B) 정당. 등록부는 규칙 변화에 사실상 반응하지 않는다.
 * - **높다** → 좁히기는 위험. 예산을 키우는 쪽(A)만 남는다.
 */
import { REGISTRY_CATEGORY_SOURCES } from './company-classify'

/** 재판정 **전** 값(DB 에 있던 것). `RECLASSIFY_COLS` 가 이 셋을 읽어 온다. */
export interface VerdictBefore {
  category: string | null; subcategory: string | null; tier: number | null
  lead_type: string | null; classify_confidence: string | null
}
/** 재판정 **후** 값(`classifyLead` 결과). */
export interface VerdictAfter {
  category: string | null; subcategory: string | null; tier: number | null
  lead_type: string; confidence: string
}

/**
 * 이 행의 판정이 실제로 달라졌는가.
 *
 * ⚠️ **각 분기가 *실제로 쓰는* 컬럼만 본다.** `company-discovery.ts` 의 UPDATE 세 갈래와 1:1 이어야
 *   한다 — 안 쓰는 컬럼을 비교에 넣으면 안 바뀐 행이 "바뀌었다"로 새어 변화율이 부풀고, 그러면
 *   **좁히기가 부당해 보인다**(결론이 뒤집힌다).
 * ⚠️ `tier` 는 UPDATE 가 `COALESCE(tier, ?)` 라 **원래 값이 있으면 안 바뀐다** — 그 경우를
 *   변화로 세면 안 된다.
 */
export function verdictChanged(before: VerdictBefore, after: VerdictAfter, registryBranch: boolean): boolean {
  if (registryBranch) {
    // registry 분기: lead_type + confidence('registry' 고정) 만 쓴다. category 는 불가침이라 비교 대상 아님.
    return before.lead_type !== after.lead_type || before.classify_confidence !== 'registry'
  }
  if (after.confidence === 'evidence') {
    // evidence 분기: category·subcategory·lead_type·confidence + tier(COALESCE).
    return before.category !== after.category
      || before.subcategory !== after.subcategory
      || before.lead_type !== after.lead_type
      || before.classify_confidence !== after.confidence
      || (before.tier == null && after.tier != null)
  }
  // 그 외: lead_type + confidence 만 쓴다(업종은 기존 값 보존 — 대표 수동 분류 불가침).
  return before.lead_type !== after.lead_type || before.classify_confidence !== after.confidence
}

/** 누적 계수기. `seen` 은 **재판정한 행**만 센다(첫 분류는 제외 — 그건 변화가 아니라 최초 판정이다). */
export interface VerdictDelta {
  reg_seen: number; reg_changed: number
  guess_seen: number; guess_changed: number
  first: number
}

export const emptyDelta = (): VerdictDelta => ({ reg_seen: 0, reg_changed: 0, guess_seen: 0, guess_changed: 0, first: 0 })

/**
 * 행 하나를 계수기에 반영한다.
 *
 * @param classifiedV 이전 규칙 버전. `0`/`null` 이면 **첫 분류**라 변화율 분모에서 뺀다
 *   (안 빼면 새로 들어온 행이 전부 "바뀜"으로 잡혀 변화율이 통째로 거짓이 된다).
 * ⚠️ 등록부/추측 구분은 **소스**로 한다 — 분기(`registryBranch`)로 나누면 category 가 빈 등록부 행이
 *   추측 쪽으로 새어, 정작 묻고 있는 "등록부 소스가 규칙에 반응하는가"를 못 재게 된다.
 */
export function tallyVerdict(d: VerdictDelta, source: string | null, classifiedV: number | null, changed: boolean): void {
  if (!(Number(classifiedV) > 0)) { d.first++; return }
  const reg = REGISTRY_CATEGORY_SOURCES.has(source || '')
  if (reg) { d.reg_seen++; if (changed) d.reg_changed++ } else { d.guess_seen++; if (changed) d.guess_changed++ }
}

/** 누적 병합 — 회차마다 덮어쓰면 누적이 아니라 "마지막 회차"가 되어 표본이 250건에 갇힌다. */
export function mergeDelta(prev: unknown, add: VerdictDelta): VerdictDelta {
  const p = (prev && typeof prev === 'object' ? prev : {}) as Partial<VerdictDelta>
  return {
    reg_seen: (Number(p.reg_seen) || 0) + add.reg_seen,
    reg_changed: (Number(p.reg_changed) || 0) + add.reg_changed,
    guess_seen: (Number(p.guess_seen) || 0) + add.guess_seen,
    guess_changed: (Number(p.guess_changed) || 0) + add.guess_changed,
    first: (Number(p.first) || 0) + add.first,
  }
}

/**
 * 회차 통계 기록 — `company-discovery.ts` 에서 **이동**해 왔다(로직 동일 + `delta` 누적 추가).
 * 여기로 옮긴 이유: 계측이 이 모듈 소유라 통계 쓰기도 같이 두는 편이 갈라지지 않는다.
 */
export async function writeReclassifyStats(
  DB: D1Database, rulesVersion: number,
  s: { scanned: number; updated: number; removed: number; held: number; delta: VerdictDelta },
): Promise<void> {
  const remRow = await DB.prepare('SELECT COUNT(*) AS n FROM ad_company_leads WHERE merged_into IS NULL AND (classified_v IS NULL OR classified_v < ?)')
    .bind(rulesVersion).first<{ n: number }>().catch(() => null)
  const prevStat = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_reclassify_stats'").first<{ value: string }>().catch(() => null)
  let tot = { removed: 0, updated: 0 }
  let prevDelta: unknown = null
  try {
    const p = prevStat?.value ? JSON.parse(prevStat.value) : null
    if (p) { tot = { removed: p.total_removed || 0, updated: p.total_updated || 0 }; prevDelta = p.delta }
  } catch { /* 초기 */ }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_reclassify_stats', JSON.stringify({
    last_run: new Date().toISOString().slice(0, 19).replace('T', ' '), scanned: s.scanned, updated: s.updated, removed: s.removed, held: s.held,
    remaining_unclassified: Number(remRow?.n) || 0, total_removed: tot.removed + s.removed, total_updated: tot.updated + s.updated,
    delta: mergeDelta(prevDelta, s.delta),
  })).run().catch(() => null)
}
