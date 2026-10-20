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
/**
 * 재판정 **후 DB 에 실제로 들어가는** 값.
 *
 * 🩸 **v1 은 여기서 틀렸다(2026-08-17 라이브에서 잡힘).** `classifyLead` 의 **날것** 결과를 비교했는데,
 *   호출부는 그걸 그대로 안 쓴다 — registry 분기는 `unknown → partner` 로 **매핑해서** 쓰고
 *   그 외 분기는 webkr 의심 이름을 `none` 으로 **강등해서** 쓴다. 그래서 등록부 행 대부분
 *   (`classifyLead`=unknown → 기록값 partner, 원래도 partner)이 **"바뀜"으로 오계상**됐다:
 *
 *   ```
 *   v1 측정   reg 8,333/8,500 = 98.0%   ← 거짓. 실제로 lead_type 은 partner 그대로였다
 *             (등록부 316,410행이 이미 partner · v9 재판정분도 전부 partner)
 *   ```
 *
 *   ⇒ **비교는 반드시 "바인드에 들어가는 그 값"과 해야 한다.** 그래서 이 인터페이스는
 *   `classifyLead` 결과가 아니라 **기록값**을 받는다. 이름이 `VerdictAfter` 가 아니라
 *   `VerdictWritten` 인 이유다 — 헷갈리면 같은 실수를 또 한다.
 */
export interface VerdictWritten {
  category: string | null; subcategory: string | null; tier: number | null
  lead_type: string; confidence: string
}

/** UPDATE 세 갈래. 어느 컬럼을 실제로 쓰는지가 분기마다 다르다. */
export type VerdictBranch = 'registry' | 'evidence' | 'other'

/**
 * 이 행의 판정이 실제로 달라졌는가.
 *
 * ⚠️ **각 분기가 *실제로 쓰는* 컬럼만 본다.** `company-discovery.ts` 의 UPDATE 세 갈래와 1:1 이어야
 *   한다 — 안 쓰는 컬럼을 비교에 넣으면 안 바뀐 행이 "바뀌었다"로 새어 변화율이 부풀고, 그러면
 *   **좁히기가 부당해 보인다**(결론이 뒤집힌다).
 * ⚠️ `tier` 는 UPDATE 가 `COALESCE(tier, ?)` 라 **원래 값이 있으면 안 바뀐다** — 그 경우를
 *   변화로 세면 안 된다.
 */
export function verdictChanged(before: VerdictBefore, written: VerdictWritten, branch: VerdictBranch): boolean {
  if (branch === 'evidence') {
    // evidence 분기만 업종까지 덮어쓴다: category·subcategory·lead_type·confidence + tier(COALESCE).
    return before.category !== written.category
      || before.subcategory !== written.subcategory
      || before.lead_type !== written.lead_type
      || before.classify_confidence !== written.confidence
      || (before.tier == null && written.tier != null)
  }
  // registry·other: lead_type + confidence 만 쓴다(업종은 불가침 / 기존 값 보존).
  return before.lead_type !== written.lead_type || before.classify_confidence !== written.confidence
}

/** 누적 계수기. `seen` 은 **재판정한 행**만 센다(첫 분류는 제외 — 그건 변화가 아니라 최초 판정이다). */
export interface VerdictDelta {
  v: number
  reg_seen: number; reg_changed: number
  guess_seen: number; guess_changed: number
  first: number
}

/**
 * 계측 세대. **비교 규칙이 바뀌면 반드시 +1** — 안 올리면 옛 세대의 오염된 누계 위에 새 값이 얹혀
 * 영영 안 씻긴다(v1 은 날것 비교라 등록부 98% 라는 거짓 값을 쌓았다).
 */
export const VERDICT_DELTA_VERSION = 2

export const emptyDelta = (): VerdictDelta => ({ v: VERDICT_DELTA_VERSION, reg_seen: 0, reg_changed: 0, guess_seen: 0, guess_changed: 0, first: 0 })

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

/**
 * 누적 병합 — 회차마다 덮어쓰면 누적이 아니라 "마지막 회차"가 되어 표본이 250건에 갇힌다.
 * ⚠️ **세대가 다르면 이전 누계를 버린다** — 옛 규칙으로 센 값과 새 규칙으로 센 값을 더하면
 *   비율이 두 세대의 혼합이 되어 어느 쪽도 아닌 숫자가 된다(그걸로 38일짜리 구조를 바꾸게 된다).
 */
export function mergeDelta(prev: unknown, add: VerdictDelta): VerdictDelta {
  const raw = (prev && typeof prev === 'object' ? prev : {}) as Partial<VerdictDelta>
  const p = Number(raw.v) === VERDICT_DELTA_VERSION ? raw : {}
  return {
    v: VERDICT_DELTA_VERSION,
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
