import type { D1Database } from '@cloudflare/workers-types'
import { runDdlOnce } from './ads-schema-guard'

/**
 * 📥 **내보낸 리드에 도장을 찍는다 — "받은 건 다시 안 준다"** (2026-10-25 대표 지시)
 *
 * ## 대표 질문
 * *"인플루언서 DB 페이지나, 업체 DB 페이지나, 엑셀파일로 다운로드 받으면 받았다고 필터링이
 * 될 수 있나? 이후에 수집한 DB인지 구별이 안가잖아."*
 *
 * ## 왜 필요한가 (2026-10-25 라이브 실측)
 * ```
 *                전체      연락 가능          한 파일      받을 방법이 없던 분량
 *   인플루언서  445,026   이메일 83,677       60,000      23,677 (28%)
 *   업체        491,162   이메일 63,504        2,000      61,504 (97%)   ← 고지는 5,000 기준이라 안 떴다
 *   매장후보    360,999   전화  256,997        2,000     254,997 (99%)
 * ```
 * 세 문제가 겹쳐 있었다:
 *   1. **다운로드가 아무 표시를 안 남긴다.** 표시할 자리(`contacted_at`)는 있었지만 **손으로**
 *      눌러야 했고, 130만 행 중 **5번** 눌렸다(인플 3 · 업체 2 · 매장 0). 사실상 안 쓰이는 기능.
 *   2. 정렬이 점수순 고정이라 **다시 받으면 같은 상위 N행**. 아래쪽은 구조적으로 도달 불가.
 *   3. 잘렸다고 말하지 않는다 — 인플루언서는 고지 코드가 **아예 없고**, 업체는 고지가 5,000
 *      기준인데 `listCompanyLeads` 가 2,000 으로 클램프해 **한 번도 안 떴다**(무음 캡).
 *
 * ## 🩸 "지난 다운로드 이후 수집분만" 으로는 못 푼다 (이 설계의 핵심 근거)
 * 이메일 보유 인플루언서 85,214명의 수집↔측정 간격을 재니:
 * ```
 *   same_day 45,263 (53%)   d1_7 871   **d7_plus 38,897 (46%)**   unmeasured 191
 * ```
 * **46%가 수집 7일 이상 뒤에 측정돼 그때 이메일이 나왔다.** 몇 달 전 수집된 행이 오늘
 * 연락 가능해지는 구조다(CLAUDE.md: *"측정이 이메일을 만든다(17배)"*). `collected_at >
 * 지난 다운로드` 로 거르면 **새로 쓸 수 있게 된 리드의 절반을 영영 못 본다.**
 * ⇒ 기준은 수집 시점이 아니라 **행마다 "내가 받았는가"** 여야 한다.
 *
 * ## 🧱 왜 배치 테이블을 안 만드나
 * `adsLeadsDb` 는 **SQL 텍스트로 DB를 고르는 라우터**다(인플·매장 → leads DB, 업체 → company DB,
 * 그 외 → main). 새 표 `ad_export_batches` 는 라우터가 모르니 **main 으로 간다** — 리드와 다른
 * DB 에 이력이 쌓여 조인도 트랜잭션도 안 된다. 등록하면 되지만 그럴 필요가 없다:
 *
 *   **도장 시각 그 자체가 배치 id 다.** 한 다운로드가 자기 ≤500행에 같은 값을 찍으므로
 *   `GROUP BY exported_at` 이 곧 배치 목록이고, 취소는 `SET exported_at = NULL WHERE exported_at = ?`
 *   **UPDATE 한 줄**이다. 표가 없으니 두 DB 가 갈릴 일도 없다.
 *
 * ⚠️ **대가**: ① 같은 초에 두 번 받으면 한 배치로 합쳐진다(취소도 함께 — 1초 간격 두 다운로드를
 * 따로 되돌릴 이유는 없다고 봤다) ② **어떤 필터로 받았는지는 기록되지 않는다**(행수와 시각만).
 * 필터까지 남겨야 하면 그때 표를 만들고 라우터에 등록할 것.
 *
 * ## 🔓 되돌릴 수 있어야 한다
 * 다운로드가 끊기거나 파일을 잃으면 그 500명이 목록에서 사라진다. 그래서 도장은 **배치 단위로
 * 1클릭 취소**가 된다(`cancelExportBatch`). 이게 없으면 실수 한 번이 영구 손실이다.
 *
 * ## ⚠️ 이 모듈이 못 하는 것
 * - **도장은 행을 모은 직후 찍힌다** — 그 뒤 전송이 끊기면 "찍혔는데 파일은 없는" 상태가 된다.
 *   전송 완료를 서버가 알 방법이 없어서(브라우저가 받는다) 취소로 푼다.
 * - 같은 사람이 두 매체에 있으면(유튜브+블로그) **행이 둘이라 도장도 따로** 찍힌다.
 *   발송 중복은 `dedupeByEmail`(발송 큐와 같은 SSOT)이 파일 안에서 막는다.
 */

/** 한 번에 받는 행 수 — 대표 확정(2026-10-25). 수기 발송 한 주 작업량이고, 잘못 받아도 잃는 게 500행뿐. */
export const EXPORT_BATCH_ROWS = 500

/**
 * 도장을 찍을 수 있는 표 — **화이트리스트**. 표 이름이 SQL 에 문자열로 들어가므로 여기 없는 값은
 * 절대 통과시키지 않는다(인젝션 + `adsLeadsDb` 라우터가 엉뚱한 DB 를 고르는 것 둘 다 차단).
 */
export const EXPORT_POOLS = {
  influencer: { table: 'ad_influencer_leads', label: '인플루언서' },
  company: { table: 'ad_company_leads', label: '업체' },
  store: { table: 'store_prospects', label: '매장후보' },
} as const

export type ExportPoolKey = keyof typeof EXPORT_POOLS

/** 요청 문자열 → 풀 키. 화이트리스트 밖이면 null(호출부가 400 으로 돌려준다). */
export function exportPoolOf(raw: string | undefined): ExportPoolKey | null {
  return raw && Object.prototype.hasOwnProperty.call(EXPORT_POOLS, raw) ? (raw as ExportPoolKey) : null
}

/**
 * 도장 값 — **UTC-naive `'YYYY-MM-DD HH:MM:SS'`**. 이 레포의 D1 타임스탬프 규약과 같다
 * (`datetime('now')` 가 `Z` 없는 UTC 문자열을 준다 — CLAUDE.md 의 시각 규칙 참조).
 * ⚠️ `datetime('now')` 를 SQL 에서 쓰지 않는다 — 500행을 여러 statement 로 나눠 찍으므로
 *    SQL 안에서 시각을 만들면 **한 배치가 초 경계에서 둘로 쪼개진다**(그러면 취소가 반만 된다).
 */
export function exportBatchStamp(now: Date = new Date()): string {
  return now.toISOString().slice(0, 19).replace('T', ' ')
}

const DDL_KEYS: Record<ExportPoolKey, string> = {
  influencer: 'ads_ddl_export_stamp_influencer',
  company: 'ads_ddl_export_stamp_company',
  store: 'ads_ddl_export_stamp_store',
}

const _ensured = new Map<D1Database, Map<ExportPoolKey, Promise<void>>>()

/**
 * `exported_at` 컬럼 + 인덱스 보장. isolate 당 풀마다 1회(메모) — 요청마다 DDL 이 돌면
 * 쓰기 예산을 태운다(CLAUDE.md 머니 룰의 per-request DDL 금지).
 *
 * 인덱스는 **평범한 `(exported_at)` 하나**다. `exported_at IS NULL` 은 거의 전 행에 맞아
 * 인덱스가 도움이 안 되고(풀스캔이 맞다), 인덱스가 실제로 일하는 자리는 **배치 목록(GROUP BY)과
 * 취소(= 특정 값 찾기)** 다.
 */
export function ensureExportStamp(DB: D1Database, pool: ExportPoolKey): Promise<void> {
  let per = _ensured.get(DB)
  if (!per) { per = new Map(); _ensured.set(DB, per) }
  const hit = per.get(pool)
  if (hit) return hit
  const t = EXPORT_POOLS[pool].table
  const p = runDdlOnce(DB, DDL_KEYS[pool], [
    `ALTER TABLE ${t} ADD COLUMN exported_at TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_${t}_exported_at ON ${t}(exported_at)`,
  ]).then(() => undefined)
  per.set(pool, p)
  return p
}

/** 미다운로드만 거르는 조건 — 세 풀의 WHERE 빌더가 **같은 문자열**을 쓴다(두 벌이면 조용히 갈린다). */
export const NOT_EXPORTED_SQL = 'exported_at IS NULL'

/**
 * 모은 행에 도장을 찍는다. 반환 = 실제로 찍힌 행 수.
 *
 * ⚠️ **이미 찍힌 행은 덮어쓰지 않는다**(`WHERE exported_at IS NULL`) — 전체 덤프와 작업 묶음이
 *    섞여 호출돼도 첫 배치의 소유권이 유지된다. 그래서 `changes` 가 `ids.length` 보다 작을 수 있다.
 */
export async function stampExported(
  DB: D1Database, pool: ExportPoolKey, ids: readonly number[], stamp: string,
): Promise<number> {
  const clean = [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && n > 0))]
  if (!clean.length) return 0
  await ensureExportStamp(DB, pool)
  const t = EXPORT_POOLS[pool].table
  let changed = 0
  // D1 의 statement 당 바인딩 한도를 넉넉히 밑돌게 쪼갠다(100 × 5 = 500행).
  for (let i = 0; i < clean.length; i += 100) {
    const chunk = clean.slice(i, i + 100)
    const ph = chunk.map(() => '?').join(',')
    const r = await DB.prepare(
      `UPDATE ${t} SET exported_at = ? WHERE id IN (${ph}) AND ${NOT_EXPORTED_SQL}`,
    ).bind(stamp, ...chunk).run().catch(() => null)
    changed += r?.meta?.changes ?? 0
  }
  return changed
}

export type ExportBatch = { stamp: string; rows: number }

/** 배치 목록(최근 순) — 도장 시각이 곧 배치라 `GROUP BY` 가 이력이다. */
export async function listExportBatches(
  DB: D1Database, pool: ExportPoolKey, limit = 50,
): Promise<ExportBatch[]> {
  await ensureExportStamp(DB, pool)
  const t = EXPORT_POOLS[pool].table
  const n = Math.min(200, Math.max(1, Math.round(limit)))
  const r = await DB.prepare(
    `SELECT exported_at AS stamp, COUNT(*) AS rows FROM ${t}
      WHERE exported_at IS NOT NULL GROUP BY exported_at ORDER BY exported_at DESC LIMIT ?`,
  ).bind(n).all<ExportBatch>().catch(() => null)
  return r?.results || []
}

/**
 * 배치 취소 — 그 도장만 지워 목록으로 되돌린다. 반환 = 되돌린 행 수.
 * 다운로드가 끊겼거나 파일을 잃었을 때의 유일한 복구 경로다.
 */
export async function cancelExportBatch(
  DB: D1Database, pool: ExportPoolKey, stamp: string,
): Promise<number> {
  const s = String(stamp || '').trim()
  // 도장은 우리가 만든 포맷만 — 임의 문자열로 전 행을 되돌리는 것을 막는다.
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return 0
  await ensureExportStamp(DB, pool)
  const t = EXPORT_POOLS[pool].table
  const r = await DB.prepare(`UPDATE ${t} SET exported_at = NULL WHERE exported_at = ?`)
    .bind(s).run().catch(() => null)
  return r?.meta?.changes ?? 0
}

/**
 * 파일 맨 아래에 적는 안내 — **세 풀이 같은 문구**를 쓴다. 세 곳에 따로 쓰면 반드시 갈라지고,
 * 갈라진 안내는 "몇 명 남았나"를 풀마다 다르게 말한다.
 */
export function exportBatchNote(stamped: number, stamp: string, remaining: number): string {
  return `이 묶음 ${stamped}건에 "내보냄" 표시를 했습니다 (도장 ${stamp}) · 남은 미다운로드 ${remaining}건`
    + ` — 다시 받으면 그 다음 ${EXPORT_BATCH_ROWS}건이 나옵니다`
}

/**
 * 📥 묶음 내보내기 오케스트레이션 — **업체·매장 CSV 라우트 공용**.
 *   목록을 받아 도장을 찍고, 남은 건수를 **도장 뒤에** 세어 안내를 만든다.
 *   (인플루언서는 페이지 읽기 + xls 스트리밍이라 자기 경로에서 같은 순서를 지킨다.)
 *
 * `newOnly=false` 면 종전 전체 덤프와 **byte-동일**하게 군다 — 도장 0 · 안내 0.
 */
export async function runBatchExport<T extends { id: number }>(args: {
  DB: D1Database
  pool: ExportPoolKey
  newOnly: boolean
  /** 전체 덤프 상한 — **그 풀의 실제 클램프 값**이어야 한다(아니면 절단 고지가 안 뜬다). */
  fullCap: number
  list: (limit: number, notExported: boolean) => Promise<T[]>
  count: (notExported: boolean) => Promise<number>
}): Promise<{ rows: T[]; cap: number; notes: string[] }> {
  const cap = args.newOnly ? EXPORT_BATCH_ROWS : args.fullCap
  const rows = await args.list(cap, args.newOnly)
  if (!args.newOnly || !rows.length) return { rows, cap, notes: [] }
  const stamp = exportBatchStamp()
  const stamped = await stampExported(args.DB, args.pool, rows.map(r => r.id), stamp)
  const remaining = await args.count(true)
  return { rows, cap, notes: [exportBatchNote(stamped, stamp, remaining)] }
}
