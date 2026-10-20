import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] }; exec: (sql: string) => void }
}
import { EPOCH_MIN_RUNS, EPOCH_MIN_YIELD, PROMOTE_COOLDOWN_SQL, buildEpochRetireSql } from '@/features/marketing/api/influencer-keyword-epoch'
import { AUTO_RETIRE_WHERE, PROMOTE_NOT_RETIRABLE_SQL } from '@/features/marketing/api/influencer-keyword-rotation'

/**
 * 🔄 **에폭 은퇴** — 슬롯을 쥔 채 말라붙은 키워드를 실제로 내보내는가.
 *
 * 술어를 JS 로 흉내 내면 검증이 아니라 재구현이라 **실제 SQLite** 로 돌린다.
 *
 * ## 못 막는 것
 * - 임계값(8회·2.0)이 옳은지 — 그건 라이브 은퇴/승격 추이를 봐야 안다.
 * - 회차 카운터가 런타임에 실제로 증가하는지 — 배선 앵커로 SQL 문자열만 확인한다.
 */
const FRESH = "last_run_at IS NOT NULL AND last_run_at >= datetime('now','-30 days')"

function db() {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE ad_discovery_keywords (
    id INTEGER PRIMARY KEY, keyword TEXT, source TEXT DEFAULT 'auto', active INTEGER DEFAULT 1,
    hits INTEGER DEFAULT 0, found_total INTEGER DEFAULT 0, saved_total INTEGER DEFAULT 0,
    last_saved INTEGER DEFAULT 0, barren_streak INTEGER DEFAULT 0, last_run_at DATETIME,
    epoch_runs INTEGER DEFAULT 0, epoch_saved INTEGER DEFAULT 0, retired_at DATETIME)`)
  return d
}
/** 라이브에서 본 행을 그대로 넣는다(last_run_at 은 신선). */
function seed(d: ReturnType<typeof db>, id: number, kw: string, o: Record<string, number>) {
  const cols = Object.keys(o)
  d.prepare(`INSERT INTO ad_discovery_keywords (id, keyword, last_run_at, ${cols.join(',')})
    VALUES (?, ?, datetime('now','-1 hour'), ${cols.map(() => '?').join(',')})`)
    .run(id as never, kw as never, ...(cols.map(c => o[c]) as never[]))
}
const matches = (d: ReturnType<typeof db>, where: string) =>
  (d.prepare(`SELECT keyword FROM ad_discovery_keywords WHERE active = 1 AND ${where} ORDER BY id`).all() as Array<{ keyword: string }>).map(r => r.keyword)

describe('🩸 라이브 실측 — 평생 누계가 준 영구 면역을 에폭이 깬다', () => {
  it('말라붙은 키워드를 잡고, 회복 중인 키워드는 살린다', () => {
    const d = db()
    // 실측값: 맛집 871회/591건(회당 0.68) · 여행 288/746(2.59) · 피부관리 453/561(1.24)
    //   에폭(최근 8회)에서는 전부 저수율이라 은퇴 대상이 된다.
    seed(d, 1, '맛집', { hits: 871, found_total: 1153, saved_total: 591, epoch_runs: 10, epoch_saved: 7 })
    seed(d, 2, '피부관리', { hits: 453, found_total: 1020, saved_total: 561, epoch_runs: 9, epoch_saved: 11 })
    // 인테리어: 평생 평균 2.94 라 '평생 평균으로 자르기'였다면 죽었을 행. 직전 35건 → 에폭 수율 높음 → 생존.
    seed(d, 3, '인테리어', { hits: 170, found_total: 947, saved_total: 500, last_saved: 35, epoch_runs: 8, epoch_saved: 60 })
    // 신선한 키워드: 표본 미달이라 아직 판정하지 않는다.
    seed(d, 4, '신규', { hits: 2, found_total: 20, saved_total: 1, epoch_runs: 2, epoch_saved: 1 })

    expect(matches(d, buildEpochRetireSql(FRESH))).toEqual(['맛집', '피부관리'])
  })

  it('🔴 기존 3조건은 그 행들을 하나도 못 잡는다 — 이 갭이 신설 사유다', () => {
    const d = db()
    seed(d, 1, '맛집', { hits: 871, found_total: 1153, saved_total: 591, epoch_runs: 10, epoch_saved: 7 })
    for (const w of [AUTO_RETIRE_WHERE.f30, AUTO_RETIRE_WHERE.barren, AUTO_RETIRE_WHERE.yield]) {
      expect(matches(d, w)).toEqual([])
    }
  })

  it('표본(8회) 미달이면 수율이 0 이어도 안 자른다', () => {
    const d = db()
    seed(d, 1, '아직', { epoch_runs: EPOCH_MIN_RUNS - 1, epoch_saved: 0 })
    expect(matches(d, buildEpochRetireSql(FRESH))).toEqual([])
  })

  it('임계 경계 — 수율이 딱 임계면 자르지 않는다(미만일 때만)', () => {
    const d = db()
    seed(d, 1, '경계', { epoch_runs: 10, epoch_saved: 10 * EPOCH_MIN_YIELD })
    seed(d, 2, '미달', { epoch_runs: 10, epoch_saved: 10 * EPOCH_MIN_YIELD - 1 })
    expect(matches(d, buildEpochRetireSql(FRESH))).toEqual(['미달'])
  })
})

describe('🕊️ 자가치유 — 영구 배제가 아니다', () => {
  it('🔴 epoch 는 승격 차단(NOT ...)에 들어가면 안 된다 — 넣으면 30일 영구 배제가 된다', () => {
    expect(PROMOTE_NOT_RETIRABLE_SQL).not.toContain('epoch_runs')
    expect(PROMOTE_NOT_RETIRABLE_SQL).not.toContain('epoch_saved')
  })

  it('쿨다운은 갓 은퇴한 것만 막고 기간이 지나면 푼다', () => {
    const d = db()
    d.exec("INSERT INTO ad_discovery_keywords (id, keyword, active, retired_at) VALUES (1,'방금',0,datetime('now'))")
    d.exec("INSERT INTO ad_discovery_keywords (id, keyword, active, retired_at) VALUES (2,'오래전',0,datetime('now','-30 days'))")
    d.exec("INSERT INTO ad_discovery_keywords (id, keyword, active, retired_at) VALUES (3,'은퇴이력없음',0,NULL)")
    const ok = (d.prepare(`SELECT keyword FROM ad_discovery_keywords WHERE active = 0 AND ${PROMOTE_COOLDOWN_SQL} ORDER BY id`).all() as Array<{ keyword: string }>).map(r => r.keyword)
    expect(ok).toEqual(['오래전', '은퇴이력없음'])
  })
})

describe('🔌 배선 — 카운터가 실제로 돌고, 승격이 백지로 되돌린다', () => {
  const collect = readFileSync('src/features/marketing/api/influencer-auto-collect.ts', 'utf8')
  const promote = readFileSync('src/features/marketing/api/influencer-keyword-promote.ts', 'utf8')
  const store = readFileSync('src/features/marketing/api/influencer-keyword-store.ts', 'utf8')

  it('판정된 회차에만 에폭이 오른다', () => {
    expect(collect).toMatch(/epoch_runs = COALESCE\(epoch_runs, 0\) \+ 1, epoch_saved = COALESCE\(epoch_saved, 0\) \+ \?/)
    // 굶은 회차(starved) 분기는 수확만 누적하고 판정 카운터를 안 건드린다 — 에폭도 같아야 한다.
    //   삼항의 **참 가지만** 잘라 본다(`? …` 부터 `: DB.prepare(` 직전까지). 경계를 barren_streak 로
    //   잡으면 거짓 가지 앞부분이 딸려 와 늘 실패한다(초안이 실제로 그랬다).
    const from = collect.indexOf('starvedIds.has(id)')
    const starved = collect.slice(from, collect.indexOf(': DB.prepare(', from))
    expect(starved).toContain('found_total = found_total + ?')   // 슬라이스가 비어 있지 않음을 먼저 고정
    expect(starved).not.toContain('epoch_runs')
  })

  it('🔴 승격이 에폭을 리셋한다 — 안 하면 재승격자가 즉시 재은퇴(livelock)', () => {
    expect(promote).toMatch(/SET active = 1, activated_at = datetime\('now'\), epoch_runs = 0, epoch_saved = 0/)
  })

  it('승격 후보 쿼리가 쿨다운을 본다', () => {
    expect(promote).toContain('PROMOTE_COOLDOWN_SQL')
  })

  it('은퇴가 retired_at 을 찍는다(안 찍으면 쿨다운이 무력)', () => {
    expect(store).toMatch(/SET active = 0, retired_at = datetime\('now'\)[\s\S]{0,400}\$\{where\.epoch\}/)
  })

  it('은퇴는 회차당 3개 상한 — 한꺼번에 비우면 수확이 몰려 요동한다', () => {
    const seg = store.slice(store.indexOf('${where.epoch}'))
    expect(seg.slice(0, 200)).toContain('LIMIT 3')
  })
})
