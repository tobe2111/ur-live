/**
 * 🧰 파트너 풀 개선 묶음 (2026-11-02 대표 *"개선할 것들 최대한 알아봐"* → *"2번 빼고 일단 다 해줘"*).
 *
 *   ① 보강 레인이 이메일 있는 행에 하루 5만 슬롯을 썼다(skip_email 99.6%) → 대상 조건에서 뺀다
 *   ③ 빈 페이지 제목·도어웨이(벌초대행·묘지이장)는 업체가 아니다 → 새로는 안 받고, 있던 행은 **지우지 않고 보류**
 *   ④ 카카오 전화 스윕 시간당 1 → 3 (`ads-lane-alarm.test.ts` 가 값을 고정)
 *   ⑤ 결과는 찾는데 신규가 0 인 키워드는 포화 휴식(active=2) → 60일 뒤 복귀
 *   ⑥ 프랜차이즈 저장 실패 원문을 진단줄에 남긴다(라이브에서만 나는 실패 — 원인을 보려고)
 *   ⑦ 국세청 폐업 조회를 회차당 여러 묶음으로(550일 → 55일 주기)
 *   ⑨ 중국 무료메일 온라인판매는 보류(지우지 않음)
 *
 * ⚠️ 못 보는 것: 라이브에서 실제로 얼마나 나아지는지(보강 `enriched`·카카오 `found`·폐업 `closed` 계수로 판정) ·
 *   ⑥ 의 진짜 원인(이번 수리는 원인을 *보이게* 할 뿐이다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { classifyLead } from '@/features/marketing/api/company-classify'
import { keywordRestSql, KEYWORD_RESTING, REST_MIN_FOUND } from '@/features/marketing/api/company-keyword-rest'
import { hygieneStatements } from '@/features/marketing/api/company-lead-hygiene'
import { HYGIENE_SUSPECT_SQL } from '@/features/marketing/api/company-hygiene-sweep'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (s: string) => { run: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[]; get: (...a: unknown[]) => unknown } }
}
const src = (p: string) => readFileSync(`src/features/marketing/api/${p}`, 'utf8')

describe('① 보강 대상에 이메일 있는 행이 없다', () => {
  it('대상 WHERE 가 이메일 없는 행만 고른다(active=0 으로 끌려오지 않는다)', () => {
    const s = src('enrich-lane.ts')
    const where = s.slice(s.indexOf('const targets = (await DB.prepare('), s.indexOf('ORDER BY (CASE WHEN website'))
    expect(where).toContain("WHERE (email IS NULL OR email = '')")
    expect(where).not.toMatch(/active = 0 OR email/)
  })
})

describe('③ 빈 페이지 제목·도어웨이', () => {
  const w = (company_name: string) => classifyLead({ company_name, source: 'webkr' })
  it.each(['사이트 수정중입니다', '403 Forbidden', 'site move', 'LED채널 1 페이지', '남양주 벌초대행', '가평 묘지이장', '대구역사문화대전'])('%s → 업체 아님', n => {
    expect(w(n).ok).toBe(false)
  })
  it('진짜 상호는 통과한다(이장님·이사장·페이지원 같은 오탐 없음)', () => {
    for (const n of ['마을이장 정육점', '한빛 페이지원', '대성종합광고기획']) expect(w(n).ok, n).toBe(true)
  })
  it('등록부·지도 상호에는 적용하지 않는다 — 진짜 벌초 사업자는 그대로', () => {
    expect(classifyLead({ company_name: '한결벌초', source: 'commerce', category: '온라인판매' }).ok).toBe(true)
    expect(classifyLead({ company_name: '한결벌초', source: 'local' }).ok).toBe(true)
  })
  it('재분류는 이 사유를 지우지 않고 보류한다', () => {
    const s = src('company-discovery.ts')
    const branch = s.slice(s.indexOf('if (!c.ok) {'), s.indexOf("else { stmts.push(DB.prepare('DELETE"))
    expect(branch).toMatch(/HOLD_NOT_DELETE_REASONS\.has\(c\.reason/)
    expect(branch).toMatch(/SET active = 0, lead_type = 'unknown'/)
    expect(src('company-classify.ts')).toMatch(/HOLD_NOT_DELETE_REASONS[^\n]*new Set\(\['PLACEHOLDER_TITLE', 'DOORWAY_SPAM'\]\)/)
  })
})

describe('⑤ 포화 휴식 — 진짜 SQLite', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ad_company_keywords (id INTEGER PRIMARY KEY, keyword TEXT, active INTEGER, source TEXT,
    found_total INTEGER, saved_total INTEGER, last_run_at TEXT)`)
  const ins = db.prepare('INSERT INTO ad_company_keywords VALUES (?, ?, ?, ?, ?, ?, NULL)')
  ins.run(1, '포화', 1, 'seed', 20, 0)      // 이번 회차 +30 찾고 신규 0 → 쉰다
  ins.run(2, '신규 나옴', 1, 'seed', 20, 0)  // 이번 회차 신규 1 → 계속
  ins.run(3, '사람이 넣음', 1, 'manual', 20, 0)
  ins.run(4, '덜 봄', 1, 'seed', 0, 0)       // 아직 판정 근거 부족
  const upd = db.prepare(`UPDATE ad_company_keywords SET found_total = found_total + ?, saved_total = saved_total + ?, last_run_at = datetime('now'),
    active = ${keywordRestSql('?', '?')} WHERE id = ?`)
  upd.run(30, 0, 0, 30, 1); upd.run(30, 1, 1, 30, 2); upd.run(30, 0, 0, 30, 3); upd.run(10, 0, 0, 10, 4)
  const act = (id: number) => (db.prepare('SELECT active FROM ad_company_keywords WHERE id = ?').get(id) as { active: number }).active

  it(`찾은 게 ${REST_MIN_FOUND}건 이상인데 신규 0 이면 쉰다`, () => expect(act(1)).toBe(KEYWORD_RESTING))
  it('신규가 나오면 계속 돈다', () => expect(act(2)).toBe(1))
  it('사람이 넣은 키워드는 안 쉰다', () => expect(act(3)).toBe(1))
  it('근거가 모자라면 판정하지 않는다', () => expect(act(4)).toBe(1))
  it('회전은 active=1 만 돈다(쉬는 키워드가 섞이지 않는다)', () => {
    for (const f of ['company-keyword-pick.ts', 'company-collect.ts', 'webkr-collect.ts']) expect(src(f)).toMatch(/FROM ad_company_keywords WHERE active = 1/)
  })
  it('60일 뒤 다시 돈다', () => {
    expect(src('company-keyword-rest.ts')).toMatch(/SET active = 1\s+WHERE active = \$\{KEYWORD_RESTING\} AND \(last_run_at IS NULL OR last_run_at < datetime\('now', '-\$\{REST_DAYS\} days'\)\)/)
    expect(src('company-collect.ts')).toContain('await paroleRestingKeywords(DB)')
  })
})

describe('⑥ 프랜차이즈 저장 실패를 삼키지 않는다', () => {
  it('저장 catch 가 원문을 잡아 diag.save_error 로 남긴다', () => {
    const s = src('franchise-collect.ts')
    expect(s).not.toMatch(/saveCompanyLeadsCounted\([^)]*\)\.catch\(\(\) => \(\{ inserted: 0/)
    expect(s).toMatch(/save_error: saveErr/)
  })
})

describe('⑦ 국세청 폐업 조회 — 여러 묶음', () => {
  const s = src('business-status-sweep.ts')
  it('호출당 100건 × 기본 10묶음, 상한 20', () => {
    expect(s).toMatch(/const NTS_PER_CALL = 100/)
    expect(s).toMatch(/const NTS_DEFAULT_BATCHES = 10/)
    expect(s).toMatch(/const NTS_MAX_BATCHES = 20/)
  })
  it('조회가 실패한 묶음에서 커서를 멈춘다(예전엔 실패해도 넘어가 그 행들이 빠졌다)', () => {
    expect(s).toMatch(/break \/\/ 이 묶음은 조회 못 했다/)
    expect(s).toMatch(/bind\(CURSOR_KEY, String\(lastDone\)\)/)
  })
})

describe('⑨ 중국 무료메일 온라인판매 — 보류', () => {
  const stmts = (r: Record<string, unknown>) => hygieneStatements({ id: 1, company_name: 'x', phone: null, email: null, website: null, category: null, contact_source: null, ...r } as never, sql => ({ bind: (..._a: unknown[]) => sql }))
  it('온라인판매 + 163.com → 보류 문장', () => {
    expect(stmts({ email: '18822489716@163.com', category: '온라인판매' }).some(s => /SET active = 0 WHERE id = \? AND active = 1/.test(String(s)))).toBe(true)
  })
  it('다른 업종·국내 메일은 건드리지 않는다', () => {
    expect(stmts({ email: 'a@163.com', category: '대행사' })).toHaveLength(0)
    expect(stmts({ email: 'a@naver.com', category: '온라인판매' })).toHaveLength(0)
    expect(stmts({ email: 'a@my163.com', category: '온라인판매' })).toHaveLength(0)
  })
  it('백로그 스윕의 좁히개도 같은 행을 집는다', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, company_name TEXT, phone TEXT, email TEXT, active INTEGER, category TEXT)')
    db.prepare("INSERT INTO ad_company_leads VALUES (1, 'a', NULL, 'x@qq.com', 1, '온라인판매'), (2, 'b', NULL, 'x@naver.com', 1, '온라인판매'), (3, 'c', NULL, 'x@qq.com', 0, '온라인판매')").run()
    const ids = (db.prepare(`SELECT id FROM ad_company_leads WHERE ${HYGIENE_SUSPECT_SQL}`).all() as Array<{ id: number }>).map(r => r.id)
    expect(ids).toEqual([1])
  })
})
