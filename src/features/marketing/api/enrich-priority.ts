/**
 * 🧭 **이메일 보강 — 생활·전문직 업종 줄** (2026-11-17 대표 *"다 이상적으로 해줘"*).
 *
 * ## 왜
 * 실측(2026-11-17): 이사 3,443곳 중 이메일 184 · 청소 3,232 중 208 · 전문서비스 27,620 중 879 — 전화는 거의 다 있는데
 * 이메일이 3~6% 다. 보강 레인의 정렬 첫 키가 "사이트 보유" 라 지역 언론사 같은 사이트 보유 행이 늘 앞줄을 차지했고,
 * 회차는 마감선 때문에 앞의 **10건 남짓**만 실제로 처리한다(그날 64회 전부 deadline). 줄 순서가 곧 배분이다.
 * ⇒ 업종 줄을 따로 뽑아 일반 줄과 **번갈아** 세운다. 처리량·비용은 그대로, 순서만 바뀐다.
 *
 * ## 🩸 왜 일반 쿼리에 `category IN (…)` 을 붙이지 않나 (라이브 실측)
 * 일반 쿼리는 정렬 인덱스(`idx_company_leads_enrich_order_v2`)를 타서 회당 약 3.7만 행을 읽는다. 거기에 업종 조건을
 * 붙인 쿼리는 그 인덱스를 못 타고 **회당 69,563행**을 읽었다(LIMIT 10 이든 200 이든 같다 — 임시 정렬이라서).
 * 하루 64회면 445만 행이다. 대신 업종마다 `(category, id)` 인덱스(`idx_company_leads_cat`)를 **커서로 내려가면**
 * 정렬이 필요 없어 **34행**만 읽는다(같은 날 실측, 5개 업종 × 3건).
 *
 * ## 커서 규칙
 * - 업종마다 `id < 커서` 를 큰 id 부터 본다. 회차가 끝나면 **큰 id 부터 연속으로 손댄(도장 찍힌) 데까지만** 내려간다.
 *   뽑기만 하고 손대지 못한 행은 다음 회차에 다시 나온다(마감선·동시 처리로 잘린 행을 건너뛰지 않는다).
 * - 더 내려갈 행이 없으면(0건) 커서를 지워 맨 위부터 다시 돈다 — 7일 지난 행은 그때 다시 대상이 된다.
 * - 커서는 설정 1행(`ads_enrich_prio_cursor`) — 회당 읽기 1 · 바뀔 때만 쓰기 1.
 */

/** 업종 줄 대상 — 유어딜 생활 칩 넷 + 전문직. 이름은 `COMPANY_CATEGORIES` 의 키와 같아야 한다(시험 대조). */
export const ENRICH_PRIORITY_CATEGORIES = ['이사', '청소', '방역·소독', '수리·설치', '전문서비스'] as const
/** 업종마다 한 회차에 뽑는 수 — 처리는 회당 10건 남짓이라 5×3 이면 충분하다. */
export const PRIO_PER_CATEGORY = 3
export const PRIO_CURSOR_KEY = 'ads_enrich_prio_cursor'

export type PrioCursor = Record<string, number>

export function parsePrioCursor(raw: unknown): PrioCursor {
  try {
    const v = JSON.parse(String(raw ?? ''))
    const out: PrioCursor = {}
    if (v && typeof v === 'object') for (const c of ENRICH_PRIORITY_CATEGORIES) { const n = Number(v[c]); if (Number.isInteger(n) && n > 0) out[c] = n }
    return out
  } catch { return {} }
}

/** 업종별 `(category, id)` 인덱스 탐색을 UNION ALL 로 한 문장에(서브리퀘스트 1). 바인딩 = 업종 수 × 2. */
export function priorityTargetsSql(cursor: PrioCursor, crawlRulesVersion: number): { sql: string; binds: unknown[] } {
  const v = Math.max(0, Math.floor(Number(crawlRulesVersion) || 0))
  const parts: string[] = []
  const binds: unknown[] = []
  for (const c of ENRICH_PRIORITY_CATEGORIES) {
    parts.push(`SELECT * FROM (SELECT id, company_name, category, region, address, website, phone, email, source, source_keyword, status
      FROM ad_company_leads WHERE category = ? AND id < ? AND (email IS NULL OR email = '') AND merged_into IS NULL
        AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days') OR COALESCE(enrich_v, 0) < ${v})
      ORDER BY id DESC LIMIT ${PRIO_PER_CATEGORY})`)
    binds.push(c, cursor[c] ?? Number.MAX_SAFE_INTEGER)
  }
  return { sql: parts.join(' UNION ALL '), binds }
}

/** 업종을 고르게 — 각 업종 1등, 그다음 2등 … (한 업종이 앞자리를 다 먹지 않게). */
export function roundRobinByCategory<T extends { category: string | null }>(rows: T[]): T[] {
  const by = new Map<string, T[]>()
  for (const r of rows) { const k = r.category || ''; if (!by.has(k)) by.set(k, []); by.get(k)!.push(r) }
  const lists = [...by.values()]
  const out: T[] = []
  for (let i = 0; out.length < rows.length; i++) for (const l of lists) if (l[i]) out.push(l[i])
  return out
}

/** 두 줄을 번갈아 세운다(우선 → 일반 → 우선 …). 같은 id 는 한 번만. 한쪽이 바닥나면 다른 쪽이 나머지를 채운다. */
export function interleaveTargets<T extends { id: number }>(prio: T[], general: T[], cap: number): T[] {
  const out: T[] = []
  const seen = new Set<number>()
  let i = 0, j = 0
  while (out.length < cap && (i < prio.length || j < general.length)) {
    const takePrio = (out.length % 2 === 0 && i < prio.length) || j >= general.length
    const next = takePrio ? prio[i++] : general[j++]
    if (next && !seen.has(next.id)) { seen.add(next.id); out.push(next) }
  }
  return out
}

/** 다음 커서 — 손댄 행의 최소 id 로 내려가고, 뽑힌 게 0건인 업종은 맨 위로 되돌린다. */
export function nextPrioCursor(prev: PrioCursor, fetched: Array<{ id: number; category: string | null }>, stamped: ReadonlySet<number>): PrioCursor {
  const out: PrioCursor = { ...prev }
  for (const c of ENRICH_PRIORITY_CATEGORIES) {
    const rows = fetched.filter(r => r.category === c)
    if (!rows.length) { delete out[c]; continue }
    // 큰 id 부터 **연속으로** 손댄 데까지만 — 동시 처리로 중간 행이 빠졌으면 그 행부터 다시 본다(건너뛰지 않는다).
    let low: number | null = null
    for (const r of [...rows].sort((a, b) => b.id - a.id)) { if (!stamped.has(r.id)) break; low = r.id }
    if (low !== null) out[c] = low
  }
  return out
}
