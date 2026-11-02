/**
 * 🩺 "표가 다 있나" 를 **한 번에** 묻는다 — `ensureXxxTables` 의 DDL 목록에서 자동으로 확인 질문을 만든다.
 *
 * 🐢 2026-11-02 대표 *"부분적으로 느린 경우들이 많아서 유저들이 헷갈려해"* — 생활(home-service)·팔아보기(seeding) 의
 *   `ensure…Tables` 가 서버(isolate)가 새로 켜질 때마다 DDL 을 **한 문장씩** 원본 DB(미국 동부)에 보냈다. 생활 34문장 ·
 *   팔아보기 19문장(ALTER 는 칸이 이미 있어 매번 실패하면서). 라이브 실측 `/api/home-service/config` 서버 시간 1,424ms ·
 *   `/api/seeding/offer/:id` 683ms(같은 서버 재요청은 수십 ms). 한국에서는 왕복 ~0.17초 × 문장 수.
 *   ⇒ 확인 질문을 **batch 한 번(=왕복 1회)** 으로 던지고, 다 통과하면 DDL 을 건너뛴다. 하나라도 실패하면(표·칸·색인이
 *   없다) 호출부가 종전처럼 DDL 을 전부 돈다 — 틀려도 느려질 뿐 표가 빠지는 일은 없다.
 *   색인은 개수로 본다 — UNIQUE 색인이 머니 멱등 키일 수 있어 "있겠지" 로 건너뛰면 안 된다.
 *   모르는 모양의 DDL 이 섞이면 빈 배열(= 확인 포기 → 종전대로 DDL 전부). 던지면 모듈 로드에서 워커가 죽는다.
 */
export interface SchemaProbe { sql: string; expect?: number }

export function buildSchemaProbe(sqls: readonly string[]): SchemaProbe[] {
  const tables = new Set<string>()
  const indexes = new Set<string>()
  const cols = new Map<string, Set<string>>()
  for (const raw of sqls) {
    const s = raw.replace(/\s+/g, ' ').trim()
    let m = /^CREATE TABLE IF NOT EXISTS (\w+)/i.exec(s)
    if (m) { tables.add(m[1]); continue }
    m = /^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/i.exec(s)
    if (m) { indexes.add(m[1]); continue }
    m = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/i.exec(s)
    if (m) { if (!cols.has(m[1])) cols.set(m[1], new Set()); cols.get(m[1])!.add(m[2]); continue }
    return []
  }
  const q = (xs: Iterable<string>) => [...xs].map((x) => `'${x}'`).join(',')
  const out: SchemaProbe[] = [{
    sql: `SELECT COUNT(*) AS n FROM sqlite_master WHERE (type = 'table' AND name IN (${q(tables)})) OR (type = 'index' AND name IN (${q(indexes)}))`,
    expect: tables.size + indexes.size,
  }]
  // 칸은 "그 칸을 고르는 빈 질의" 로 — 없으면 batch 가 통째로 실패한다(→ DDL 전체).
  for (const [t, cs] of cols) out.push({ sql: `SELECT ${[...cs].join(', ')} FROM ${t} LIMIT 0` })
  return out
}

/** 표·칸·색인이 전부 있으면 true. 묻다가 실패하면 false(모르는 것은 "없다" 쪽으로). */
export async function schemaComplete(DB: D1Database, probe: readonly SchemaProbe[]): Promise<boolean> {
  if (!probe.length) return false
  try {
    const rs = await DB.batch(probe.map((p) => DB.prepare(p.sql)))
    const n = Number((rs?.[0]?.results?.[0] as { n?: number } | undefined)?.n)
    return n === probe[0].expect
  } catch { return false }
}
