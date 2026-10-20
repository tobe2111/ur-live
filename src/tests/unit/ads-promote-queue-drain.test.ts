import { describe, it, expect } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    exec: (sql: string) => void
    prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] }
  }
}
import { promoteHashtagKeywords, AUTO_PROMOTE_HITS, QUEUE_OVERFETCH } from '@/features/marketing/api/influencer-keyword-promote'

/**
 * 🚰 **대기 큐 배수** — 자리가 열렸을 때 *이번 회차에 우연히 섞인 태그*만이 아니라
 *   **대기 중인 최상위 후보**도 들어가는가.
 *
 * ## 왜 (2026-08-18 라이브 실측)
 * ```
 * 신규 테마(협찬·체험단)  39.8 저장/회차     기존 16.4/회차      ← 2.4배
 * 그 테마 후보 34개가 active=0 · last_run_at NULL 로 대기 중
 * 대기 후보 총 11,720개 — 그런데 승격 후보는 `keyword IN (이번 회차 top 50)` 으로 묶여 있었다
 * ```
 * 즉 대기 목록은 **큐가 아니었다.** 같은 태그가 우연히 다시 채굴될 때만 뽑혔다.
 *
 * ## 못 막는 것
 * - `hits DESC` 가 최선의 순서인지 — 수확 이력 기반 정렬은 별개 판단이다.
 * - 실제 수확이 오르는지 — 라이브 추이로만 알 수 있다(판정: 승격 수 · 일별 유입).
 */
function makeD1(): { db: D1Database; raw: ReturnType<typeof DatabaseSync.prototype.constructor> } {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE ad_discovery_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT UNIQUE, category TEXT, active INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0, source TEXT DEFAULT 'auto', found_total INTEGER DEFAULT 0,
    saved_total INTEGER DEFAULT 0, last_saved INTEGER DEFAULT 0, barren_streak INTEGER DEFAULT 0,
    last_run_at DATETIME, activated_at DATETIME, retired_at DATETIME,
    epoch_runs INTEGER DEFAULT 0, epoch_saved INTEGER DEFAULT 0)`)
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = d.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = d.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: d.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  const db = {
    prepare: (sql: string) => wrap(sql),
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => Promise.all(stmts.map(s => s.run())),
  } as unknown as D1Database
  return { db, raw: d as never }
}
/**
 * ⚠️ **키워드 이름이 곧 업종이다.** 승격 게이트는 저장된 `category` 컬럼이 아니라
 *   `promoCategory(키워드)` 로 판정한다(같은 판정을 두 벌로 두지 않으려는 기존 설계).
 *   그래서 픽스처는 **실제로 분류되는 이름**이어야 한다 — '대기0' 같은 이름은 전부 '자동' 으로
 *   떨어져 게이트에 막히고, 그러면 이 테스트는 *기능이 멀쩡해도* 빨간불이 된다(실제로 그랬다).
 */
const ins = (d: { prepare: (s: string) => { run: (...a: never[]) => unknown } }, kw: string, hits: number, cat = '맛집') =>
  d.prepare('INSERT INTO ad_discovery_keywords (keyword, category, active, hits, source) VALUES (?, ?, 0, ?, \'auto\')')
    .run(kw as never, cat as never, hits as never)
const activeKw = (d: { prepare: (s: string) => { all: (...a: never[]) => unknown[] } }) =>
  (d.prepare('SELECT keyword FROM ad_discovery_keywords WHERE active = 1 ORDER BY keyword').all() as Array<{ keyword: string }>).map(r => r.keyword)

describe('🩸 라이브 실측 — 대기 큐가 배수되지 않던 문제', () => {
  it('이번 회차에 안 나온 최상위 대기 후보도 남은 자리를 채운다', async () => {
    const { db, raw } = makeD1()
    // 대기 중인 고득점 후보(협찬 테마) — **이번 회차 해시태그에는 없다.**
    ins(raw as never, '제품 협찬', 40)
    ins(raw as never, '체험단 신청', 35)
    // 이번 회차에 채굴된 태그 하나(자리 3개 중 1개만 채운다)
    ins(raw as never, '서울맛집', 9)
    const r = await promoteHashtagKeywords(db, new Map([['서울맛집', 9]]), 3)
    expect(r.kwAuto).toMatchObject({ active: 0, room: 3, cap: 3 })
    // 예전 동작이면 '서울맛집' 하나만 승격되고 자리 2개가 빈 채로 끝났다.
    expect(activeKw(raw as never).sort()).toEqual(['서울맛집', '제품 협찬', '체험단 신청'].sort())
  })

  it('자리를 넘겨 승격하지 않는다 — 캡이 상한이다', async () => {
    const { db, raw } = makeD1()
    const kws = ['강남맛집', '홍대맛집', '성수맛집', '망원맛집', '연남맛집']
    kws.forEach((k, i) => ins(raw as never, k, 30 - i))
    const r = await promoteHashtagKeywords(db, new Map(), 2)
    expect(r.promoted).toHaveLength(2)
    expect(activeKw(raw as never).sort()).toEqual(['강남맛집', '홍대맛집'].sort()) // hits DESC
  })

  it('자리가 없으면 큐를 건드리지 않는다', async () => {
    const { db, raw } = makeD1()
    raw.prepare("INSERT INTO ad_discovery_keywords (keyword, category, active, hits, source) VALUES ('성수맛집', '맛집', 1, 1, 'auto')").run()
    ins(raw as never, '강남맛집', 99)
    const r = await promoteHashtagKeywords(db, new Map([['강남맛집', 99]]), 1)
    expect(r.promoted).toEqual([])
    expect(activeKw(raw as never)).toEqual(['성수맛집'])
  })

  it('게이트는 그대로다 — hits 미달과 업종 미적합은 큐에서도 안 뽑힌다', async () => {
    const { db, raw } = makeD1()
    ins(raw as never, '강남맛집', AUTO_PROMOTE_HITS - 1) // hits 미달
    ins(raw as never, '오늘의일기', 99) // 업종 미분류 → '자동' → canAutoPromote 가 막는다
    const r = await promoteHashtagKeywords(db, new Map(), 5)
    expect(r.promoted).toEqual([])
  })

  it('은퇴 쿨다운 중인 키워드는 큐에서도 안 되살아난다(승격↔은퇴 churn 차단)', async () => {
    const { db, raw } = makeD1()
    ins(raw as never, '강남맛집', 99)
    raw.prepare("UPDATE ad_discovery_keywords SET retired_at = datetime('now','-1 day') WHERE keyword = '강남맛집'").run()
    ins(raw as never, '홍대맛집', 10)
    const r = await promoteHashtagKeywords(db, new Map(), 5)
    expect(r.promoted).toEqual(['홍대맛집'])
  })

  it('승격은 두 경로 모두 에폭을 리셋한다 — 안 하면 다음 회차에 즉시 재은퇴(livelock)', async () => {
    const { db, raw } = makeD1()
    ins(raw as never, '강남맛집', 30)
    raw.prepare("UPDATE ad_discovery_keywords SET epoch_runs = 40, epoch_saved = 1 WHERE keyword = '강남맛집'").run()
    await promoteHashtagKeywords(db, new Map(), 1)
    const row = raw.prepare("SELECT epoch_runs er, epoch_saved es, activated_at a FROM ad_discovery_keywords WHERE keyword = '강남맛집'").get() as { er: number; es: number; a: string }
    expect([row.er, row.es]).toEqual([0, 0])
    expect(row.a).toBeTruthy()
  })

  it('업종 게이트에 걸릴 것을 감안해 넉넉히 뽑는다 — 딱 맞춰 뽑으면 자리가 빈 채 끝난다', async () => {
    const { db, raw } = makeD1()
    // 자리 1개인데 앞자리 다수가 부적합. overfetch 가 없으면 아무것도 못 뽑는다.
    for (let i = 0; i < QUEUE_OVERFETCH - 1; i++) ins(raw as never, `오늘의일기${i}`, 90 - i)
    ins(raw as never, '강남맛집', 10)
    const r = await promoteHashtagKeywords(db, new Map(), 1)
    expect(r.promoted).toEqual(['강남맛집'])
  })
})
