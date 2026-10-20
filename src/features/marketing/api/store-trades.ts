/**
 * 🎛️ **매장 수집 업태를 DB 로** — 배포 없이 켜고 끈다 (2026-08-02 대표 "페이지에서 직접 설정").
 *
 * ## 왜 업태만 테이블로 두나 (키워드를 materialize 하지 않는 이유)
 * 파트너 풀은 (지역 × 업종) 4,546행을 실제 행으로 갖는다. 매장도 그렇게 하면 235 × 19 = 4,465행인데,
 * **이 레인은 이미 서브리퀘스트 기아 상태**다(회차당 예산 26, `stopped_by: budget` 로 끝난다).
 * 파트너가 쓰는 시드 마라톤(회당 500행 × 10회차)을 여기서 돌리면 그동안 수집이 0 이 된다.
 * ⇒ **업태만**(≈19행) 저장하고 지역과의 곱은 지금처럼 런타임 생성. 사람이 만지는 단위도 업태다.
 *
 * ## 커서와의 관계 (⚠️ 알고 쓰는 트레이드오프)
 * 커서는 (지역 × 업태) 배열의 **인덱스**다. 업태를 켜고 끄면 배열 길이가 바뀌어 커서가 가리키던
 * 자리가 점프한다. 하지만 `rotationWindow` 가 total 로 모듈로를 돌리므로 **영구 건너뜀은 없다**
 * — 파트너 풀이 이미 같은 조건을 수용하고 있다(활성 집합에 대한 OFFSET). 새 구조를 발명하지 않는다.
 *
 * ## 폴백 규칙 (여기가 제일 틀리기 쉽다)
 * - 읽기 실패 / 테이블이 통째로 비었다 → **코드 상수로 폴백**. 설정 조회가 실패했다고 수집을 멈추면 안 된다.
 * - 읽었는데 그 블록의 활성 업태가 0 → **폴백하지 않는다.** 그건 고장이 아니라 **대표의 선택**이고,
 *   여기서 상수로 되돌리면 끈 것이 조용히 되살아난다(설정이 무력화되는 가장 나쁜 실패).
 */
import { UNMANNED_TRADES, VOUCHER_TRADES } from './store-kakao-collect'

export const STORE_TRADE_BLOCKS = ['voucher', 'unmanned'] as const
export type StoreTradeBlock = (typeof STORE_TRADE_BLOCKS)[number]

export interface StoreTradeRow {
  id: number; block: string; kw: string; category: string; active: number
  found_total: number; saved_total: number; last_run_at: string | null; source: string
}

const SEED_KEY = 'ads_store_trades_seed'

/** 코드 상수 = 시드 원본. 순서가 곧 `id` 순서가 되고 커서가 그 순서에 의존한다. */
export function seedStoreTrades(): Array<{ block: StoreTradeBlock; kw: string; category: string }> {
  return [
    ...VOUCHER_TRADES.map(t => ({ block: 'voucher' as const, kw: t.kw, category: t.category })),
    ...UNMANNED_TRADES.map(t => ({ block: 'unmanned' as const, kw: t.kw, category: t.category })),
  ]
}

/** 시드 지문 — 코드 상수가 바뀔 때만 다시 넣는다(매 회차 INSERT 를 날리지 않기 위해). */
export function seedFingerprint(rows = seedStoreTrades()): string {
  let h = 0x811c9dc5
  for (const r of rows) for (const ch of `${r.block}|${r.kw}|${r.category}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}

/**
 * 테이블 보장 + 시드. `INSERT OR IGNORE`(kw UNIQUE) 라 **어드민이 끈 행을 되살리지 않는다**
 * (재시드가 `active` 를 덮으면 설정이 매 배포마다 날아간다).
 * @returns 이번 호출이 쓴 서브리퀘스트 수 — 호출부가 예산에서 빼야 조용히 천장을 넘지 않는다.
 */
export async function ensureStoreTrades(DB: D1Database): Promise<number> {
  const rows = seedStoreTrades()
  const sum = seedFingerprint(rows)
  const cur = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(SEED_KEY).first<{ value: string }>().catch(() => null)
  if (cur?.value === sum) return 1
  await DB.batch([ // batch = 1 서브리퀘스트(문장 수 무관)
    DB.prepare(`CREATE TABLE IF NOT EXISTS ad_store_trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block TEXT NOT NULL,
      kw TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      found_total INTEGER NOT NULL DEFAULT 0,
      saved_total INTEGER NOT NULL DEFAULT 0,
      last_run_at DATETIME,
      source TEXT NOT NULL DEFAULT 'seed',
      created_at DATETIME DEFAULT (datetime('now'))
    )`),
    ...rows.map(r => DB.prepare('INSERT OR IGNORE INTO ad_store_trades (block, kw, category) VALUES (?, ?, ?)').bind(r.block, r.kw, r.category)),
  ]).catch(() => null)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(SEED_KEY, sum).run().catch(() => null)
  return 3
}

/** 전체 업태(비활성 포함) — 화면용. `id` 순서가 커서의 의미이므로 정렬을 바꾸지 말 것. */
export async function listStoreTrades(DB: D1Database): Promise<StoreTradeRow[]> {
  await ensureStoreTrades(DB)
  const r = await DB.prepare('SELECT id, block, kw, category, active, found_total, saved_total, last_run_at, source FROM ad_store_trades ORDER BY id')
    .all<StoreTradeRow>().catch(() => null)
  return r?.results || []
}

/**
 * 수집 레인용 — **활성 업태만**, 블록별로.
 * @returns `null` = 읽기 실패/테이블 비었음(호출부가 코드 상수로 폴백해야 한다).
 *          비어 있지 않은 객체 = DB 가 진실(블록이 빈 배열이면 그건 **의도적으로 끈 것**).
 */
export async function loadActiveStoreTrades(DB: D1Database): Promise<Record<string, Array<{ kw: string; category: string }>> | null> {
  const r = await DB.prepare('SELECT block, kw, category FROM ad_store_trades ORDER BY id')
    .all<{ block: string; kw: string; category: string }>().catch(() => null)
  const all = r?.results
  if (!all || !all.length) return null // 시드 전이거나 조회 실패 — 상수 폴백
  const act = await DB.prepare('SELECT block, kw, category FROM ad_store_trades WHERE active = 1 ORDER BY id')
    .all<{ block: string; kw: string; category: string }>().catch(() => null)
  const out: Record<string, Array<{ kw: string; category: string }>> = {}
  for (const b of STORE_TRADE_BLOCKS) out[b] = []
  for (const t of (act?.results || [])) (out[t.block] ||= []).push({ kw: t.kw, category: t.category })
  return out
}

export type StoreTradeToggle = { ok: true; changed: number } | { ok: false; error: string }

/**
 * 업태 on/off.
 * 🛡️ **마지막 활성 업태는 끄지 못한다** — 전부 끄면 레인이 키워드 0개로 돌아 수집이 **에러 없이** 멈추고
 *   하트비트는 초록으로 남는다. 블록 하나를 통째로 끄는 것(예: "무인은 그만")은 허용한다 — 그건 정당한 선택이다.
 */
export async function setStoreTradeActive(DB: D1Database, kw: string, active: boolean): Promise<StoreTradeToggle> {
  const k = (kw || '').trim()
  if (!k || k.length > 60) return { ok: false, error: 'INVALID_TRADE' }
  await ensureStoreTrades(DB)
  if (!active) {
    const row = await DB.prepare('SELECT COUNT(*) AS n FROM ad_store_trades WHERE active = 1').first<{ n: number }>().catch(() => null)
    const self = await DB.prepare('SELECT active FROM ad_store_trades WHERE kw = ?').bind(k).first<{ active: number }>().catch(() => null)
    if (Number(self?.active) === 1 && (Number(row?.n) || 0) <= 1) return { ok: false, error: 'LAST_ACTIVE_TRADE' }
  }
  const r = await DB.prepare('UPDATE ad_store_trades SET active = ? WHERE kw = ?').bind(active ? 1 : 0, k).run().catch(() => null)
  const changed = Number(r?.meta?.changes) || 0
  return changed ? { ok: true, changed } : { ok: false, error: 'TRADE_NOT_FOUND' }
}

/** 어드민이 새 업태 추가 — 다음 회차부터 전 지역에 적용된다(런타임 곱). */
export async function addStoreTrade(DB: D1Database, block: string, kw: string, category: string): Promise<StoreTradeToggle> {
  const k = (kw || '').trim(); const c = (category || '').trim()
  if (!k || k.length > 60 || !c || c.length > 40) return { ok: false, error: 'INVALID_TRADE' }
  if (!(STORE_TRADE_BLOCKS as readonly string[]).includes(block)) return { ok: false, error: 'INVALID_BLOCK' }
  await ensureStoreTrades(DB)
  const r = await DB.prepare("INSERT OR IGNORE INTO ad_store_trades (block, kw, category, source) VALUES (?, ?, ?, 'manual')")
    .bind(block, k, c).run().catch(() => null)
  const changed = Number(r?.meta?.changes) || 0
  return changed ? { ok: true, changed } : { ok: false, error: 'DUPLICATE_TRADE' }
}

/** 회차 수확을 업태별로 누적 — 어느 업태가 값을 만드는지 화면이 보여줄 수 있어야 끌 결정을 한다. */
export async function bumpStoreTradeStats(DB: D1Database, per: Map<string, { found: number; saved: number }>): Promise<void> {
  if (!per.size) return
  await DB.batch([...per.entries()].map(([kw, v]) => DB.prepare(
    "UPDATE ad_store_trades SET found_total = found_total + ?, saved_total = saved_total + ?, last_run_at = datetime('now') WHERE kw = ?",
  ).bind(v.found, v.saved, kw))).catch(() => null)
}

// ── ③ 회차 조건 — 지역 권역 · 블록 비중 · 페이지 · 예산 ────────────────────────────
//
//   ⚠️ **화면이 정할 수 있는 것과 없는 것을 서버가 가른다.** 슬라이스를 UI 로 무제한 올릴 수 있게
//   만들면 그건 *CPU 한도로 죽는 문을 화면에 다는 것*이다 — NEIS 6→3 · NPS 100→40 이 그 전례이고,
//   둘 다 올린 날 죽어서 되돌렸다. 그래서 모든 값은 **서버에서 clamp** 하고, 코드가 허용한 범위를
//   넘길 방법을 두지 않는다. 대신 그 효과(`elapsed_ms`/`stopped_by`)를 같은 화면에 띄운다.

const CONFIG_KEY = 'ads_store_kakao_config'

export interface StoreCollectConfig {
  /** 권역 이름(REGION_GROUPS 키). 빈 배열 = 전국. */
  regions: string[]
  /** 우선업종 블록 몫 (0.1~0.9). */
  voucher_share: number
  /** 키워드당 최대 페이지 (1~3). 낮추면 넓게, 높이면 깊게. */
  max_pages: number
  /** 회차 서브리퀘스트 예산 (5~60). 학습 상한·플랫폼 천장과 min 이라 이게 상한을 뚫지는 못한다. */
  budget: number
}

export const STORE_CONFIG_DEFAULT: StoreCollectConfig = { regions: [], voucher_share: 0.7, max_pages: 3, budget: 30 }

/**
 * ⚠️ `Number(null)` · `Number([])` · `Number('')` 은 전부 **0** 이다. 그대로 clamp 하면 "값이 없음"이
 *   조용히 **하한**으로 바뀐다 — 기본값이 아니라. 이 레포는 같은 함정으로 `{amount: []}` 가
 *   **0원 환불**로 통과한 적이 있다(#941). 그래서 숫자/숫자문자열만 받고 나머지는 기본값으로 떨군다.
 *   (이 줄은 시험이 잡아서 고쳤다 — 처음엔 `Number(v)` 하나였다.)
 */
const clampNum = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const ok = (typeof v === 'number' && Number.isFinite(v))
    || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)))
  if (!ok) return dflt
  return Math.min(hi, Math.max(lo, Number(v)))
}

/** 어떤 입력이 와도 **코드가 허용한 범위 안**의 설정을 돌려준다(순수 — 시험이 여기만 보면 된다). */
export function clampStoreConfig(raw: unknown, groups: string[]): StoreCollectConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<StoreCollectConfig>
  const regions = Array.isArray(o.regions)
    ? [...new Set(o.regions.filter(r => typeof r === 'string' && groups.includes(r)))] // 모르는 권역은 버린다(오타로 전국이 0 이 되면 안 된다)
    : []
  return {
    regions,
    voucher_share: clampNum(o.voucher_share, 0.1, 0.9, STORE_CONFIG_DEFAULT.voucher_share),
    max_pages: Math.round(clampNum(o.max_pages, 1, 3, STORE_CONFIG_DEFAULT.max_pages)),
    budget: Math.round(clampNum(o.budget, 5, 60, STORE_CONFIG_DEFAULT.budget)),
  }
}

export async function getStoreConfig(DB: D1Database, groups: string[]): Promise<StoreCollectConfig> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CONFIG_KEY).first<{ value: string }>().catch(() => null)
  let parsed: unknown = null
  try { parsed = row?.value ? JSON.parse(row.value) : null } catch { parsed = null }
  return clampStoreConfig(parsed, groups)
}

export async function setStoreConfig(DB: D1Database, raw: unknown, groups: string[]): Promise<StoreCollectConfig> {
  const cfg = clampStoreConfig(raw, groups) // 저장 시점에도 clamp — 나중에 읽는 쪽만 믿지 않는다
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CONFIG_KEY, JSON.stringify(cfg)).run().catch(() => null)
  return cfg
}
