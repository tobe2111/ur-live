/**
 * 🧱 **"1회만 도는" 마이그레이션은 기록이 남을 때만 돈다** — 2026-09-02 실사고.
 *
 * ## 무슨 일이 있었나 (라이브 실측)
 * 업체 리드 DB 에 **`platform_settings` 표가 없었다**:
 * ```
 *   sqlite_master → _cf_KV · ad_company_keywords · ad_company_leads · sqlite_sequence
 * ```
 * `ensureCompanySchema` 의 세 블록(키 v2 · 오수집 정리 · 카테고리 v3)은 전부 그 표의 플래그로
 * "이미 했다"를 기억한다. 표가 없으니 조회는 `no such table` → `.catch(() => null)` → "아직 안 했다",
 * 실행은 **전수 UPDATE/DELETE**(회당 409,697행), 플래그 쓰기도 실패 → **매 부팅마다 무한 반복.**
 * ```
 *   12시간 상위 6개가 전부 이것 — 약 1억 1,500만 행
 *   그날 계정의 D1 무료 일일 읽기 한도가 소진돼 유어애즈 DB 읽기가 전면 거부됐다.
 * ```
 * 원인은 `runDdlOnce` 가 `CREATE TABLE IF NOT EXISTS platform_settings` 를 **DDL 문장들 뒤**에 두었던 것.
 * 그 사이의 모든 플래그 조회가 실패한다.
 *
 * ## 이 시험이 지키는 것
 * 1. 설정 표를 **가장 먼저** 만든다(체크섬 조회보다 앞).
 * 2. 기록이 남았는지 **읽어서 확인**하고 `gateStuck` 으로 알린다 — 실패가 조용하면 안 된다.
 * 3. 기록이 안 남으면 호출부가 **비싼 마이그레이션을 아예 안 한다**(데이터는 그대로, 정리만 늦어진다).
 *
 * ⚠️ 못 보는 것: 왜 그 DB 에 표가 없었는지. 이 수리는 원인과 무관하게 **되풀이를 끊는다.**
 */
import { describe, it, expect } from 'vitest'
import { runDdlOnce } from '@/features/marketing/api/ads-schema-guard'
import { ensureCompanySchema } from '@/features/marketing/api/company-discovery'

/** 최소 D1 스텁 — 실행된 SQL 을 순서대로 기록한다. `settingsWorks=false` 면 그 표를 못 만드는 DB. */
function fakeDb(settingsWorks: boolean) {
  const log: string[] = []
  const store = new Map<string, string>()
  const isSettings = (s: string) => /platform_settings/i.test(s)
  const db = {
    prepare(sql: string) {
      const stmt = {
        bind: (...b: unknown[]) => ({
          first: async () => { log.push(sql); if (!settingsWorks && isSettings(sql)) throw new Error('no such table: platform_settings')
            return store.has(String(b[0])) ? { value: store.get(String(b[0])) } : null },
          run: async () => { log.push(sql); if (!settingsWorks && isSettings(sql)) throw new Error('no such table: platform_settings')
            if (/INSERT OR REPLACE INTO platform_settings/i.test(sql)) store.set(String(b[0]), String(b[1]))
            return { meta: {} } },
          all: async () => { log.push(sql); return { results: [] } },
        }),
        first: async () => { log.push(sql); if (!settingsWorks && isSettings(sql)) throw new Error('no such table: platform_settings'); return null },
        run: async () => { log.push(sql); if (!settingsWorks && isSettings(sql)) throw new Error('no such table: platform_settings'); return { meta: {} } },
        all: async () => { log.push(sql); return { results: [] } },
      }
      return stmt
    },
  }
  return { db: db as never, log }
}

describe('runDdlOnce — 설정 표를 먼저 만든다', () => {
  it('🔒 `platform_settings` 생성이 **체크섬 조회보다 앞**이다 (뒤에 있으면 그 사이 조회가 전부 실패한다)', async () => {
    const { db, log } = fakeDb(true)
    await runDdlOnce(db, 'k', ['CREATE TABLE t (a)'])
    const create = log.findIndex(s => /CREATE TABLE IF NOT EXISTS platform_settings/i.test(s))
    const select = log.findIndex(s => /SELECT value FROM platform_settings/i.test(s))
    expect(create, '설정 표 생성이 로그에 없다').toBeGreaterThanOrEqual(0)
    expect(create).toBeLessThan(select)
  })

  it('🔒 기록이 남으면 `gateStuck: true`, 두 번째 호출은 DDL 을 건너뛴다', async () => {
    const { db, log } = fakeDb(true)
    const a = await runDdlOnce(db, 'k', ['CREATE TABLE t (a)'])
    expect(a).toEqual({ ran: true, gateStuck: true })
    const before = log.length
    const b = await runDdlOnce(db, 'k', ['CREATE TABLE t (a)'])
    expect(b.ran, '체크섬이 같으면 다시 안 돈다').toBe(false)
    expect(log.slice(before).some(s => /CREATE TABLE t/.test(s)), 'DDL 이 다시 돌았다').toBe(false)
  })

  it('🔒 기록이 안 남으면 `gateStuck: false` — 조용히 성공한 척하지 않는다', async () => {
    const { db } = fakeDb(false)
    expect(await runDdlOnce(db, 'k', ['CREATE TABLE t (a)'])).toEqual({ ran: true, gateStuck: false })
  })
})

describe('ensureCompanySchema — 기억 못 하면 비싼 일을 안 한다', () => {
  const heavy = (log: string[]) => log.filter(s =>
    /DELETE FROM ad_company_leads/i.test(s) || /UPDATE (OR IGNORE )?ad_company_leads SET (company_key|category|active)/i.test(s))

  it('🩸 설정 표가 없는 DB 에서는 전수 UPDATE/DELETE 를 **한 번도** 실행하지 않는다', async () => {
    const { db, log } = fakeDb(false)
    await ensureCompanySchema(db)
    expect(heavy(log), `실행된 전수 문장: ${heavy(log).slice(0, 2).join(' | ')}`).toEqual([])
  })

  it('🔒 정상 DB 에서는 하던 대로 1회 실행한다 — 게이트가 일을 막아서는 안 된다', async () => {
    const { db, log } = fakeDb(true)
    await ensureCompanySchema(db)
    expect(heavy(log).length, '정상 DB 인데 마이그레이션이 안 돌았다').toBeGreaterThan(0)
  })
})
