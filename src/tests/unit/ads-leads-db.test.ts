import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

import { ADS_LEADS_TABLES, touchesAdsLeadsTable, adsLeadsDb } from '../../shared/ads/leads-db'

/**
 * 📣 유어애즈 리드 DB 분리 — **전제와 배선을 같이 고정한다.**
 *
 * 2026-08-19: 수집 리드가 결제와 같은 D1 에 쌓여 494 MB(무료 한도 500 MB의 99%)에 닿았다.
 * 리드만 별도 DB로 보내는데, 그게 안전한 이유는 **실측된 전제 하나** 때문이다 —
 * "이사 대상 테이블은 남는 테이블과 같은 쿼리에 등장하지 않는다."
 * 전제가 깨지면 라우팅이 조용히 틀린 DB를 고르므로, **전제 자체를 매번 다시 잰다.**
 *
 * ⚠️ 이 테스트가 **못** 잡는 것:
 *   - 런타임 D1 동작(실제 두 DB 간 조회) — 바인딩이 붙은 뒤 라이브에서만 판정된다.
 *   - 문자열로 조립된 동적 테이블명(`FROM ${t}`) — 정적 스캔의 원리적 한계다.
 */

const SRC = execSync(`git ls-files 'src/**/*.ts' 'src/*.ts' | grep -v '/tests/'`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)

/** 주석은 배선이 아니다 — 테이블 이름이 설명문에만 남아도 통과하는 함정을 막는다. */
function codeOnly(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
}

const TABLE_RX = new RegExp(`\\b(?:${ADS_LEADS_TABLES.join('|')})\\b`)

describe('이사 대상 목록', () => {
  it('비어 있지 않다 (측정 0 이면 통과가 아니라 실패)', () => {
    expect(ADS_LEADS_TABLES.length).toBeGreaterThanOrEqual(6)
    expect(SRC.length, '스캔 대상이 0개다 — 경로 규약이 바뀌었다').toBeGreaterThan(500)
  })

  it('목록의 모든 테이블이 실제로 코드에 존재한다 (죽은 이름 금지)', () => {
    const all = SRC.map((f) => readFileSync(f, 'utf8')).join('\n')
    const dead = ADS_LEADS_TABLES.filter((t) => !new RegExp(`\\b${t}\\b`).test(all))
    expect(dead, '코드 어디에도 없는 테이블').toEqual([])
  })

  it('유어딜 광고슬롯 테이블은 절대 포함하지 않는다 (sellers 와 조인한다)', () => {
    // ad_slots ↔ sellers 는 유어딜 셀러의 입찰 기능이다. 옮기면 그 조인이 깨진다.
    for (const forbidden of ['ad_slots', 'ad_bids', 'ad_accounts', 'sellers', 'orders', 'products']) {
      expect(ADS_LEADS_TABLES as readonly string[]).not.toContain(forbidden)
    }
  })
})

describe('R1 · 리드 테이블을 만지는 파일은 adsLeadsDb 로 핸들을 얻는다', () => {
  it('bare env.DB 로 리드 테이블을 건드리는 파일이 없다', () => {
    const bad: string[] = []
    for (const f of SRC) {
      const code = codeOnly(readFileSync(f, 'utf8'))
      if (!TABLE_RX.test(code)) continue
      // adsLeadsDb(...) 로 감싸이지 않은 env.DB 참조가 남아 있으면 바인딩 후 깨진다.
      const bare = code.replace(/adsLeadsDb\((?:c\.)?env\)/g, '')
      if (/(?<![.\w])(?:c\.)?env\.DB\b/.test(bare)) bad.push(f)
    }
    expect(bad, 'adsLeadsDb 를 안 거치고 env.DB 를 쓰는 파일').toEqual([])
  })
})

/**
 * 문자열 리터럴을 **문자 단위로** 판별한다.
 *
 * 🩸 처음엔 `/(?:`|'|")([^`'"]{20,6000}?)(?:`|'|")/gs` 로 대충 떴는데, **주입 검증에서
 * 통째로 헛돌았다** — 파일에 홑따옴표가 홀수(72개, `don't` 같은 주석 포함)면 짝이 밀려
 * 일부러 심은 `... FROM ad_influencer_leads l JOIN orders o ...` 를 **못 봤다**(후보 38개 중 0).
 * 세 종류 따옴표를 정규식 하나로 짝지으려던 게 원인이다. 손으로 심어 보지 않았으면
 * "혼합 0건, 안전합니다"라고 보고했을 것이다.
 */
function stringLiterals(src: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
    if (c === "'" || c === '"' || c === '`') {
      const q = c; let j = i + 1; let buf = ''
      while (j < src.length) {
        if (src[j] === '\\') { buf += src[j + 1] ?? ''; j += 2; continue }
        if (src[j] === q) break
        buf += src[j]; j++
      }
      out.push(buf); i = j + 1; continue
    }
    i++
  }
  return out
}

describe('R2 · 이사 대상은 남는 테이블과 같은 쿼리에 등장하지 않는다 (라우팅의 전제)', () => {
  it('한 SQL 안에서 리드 테이블과 다른 테이블이 섞이지 않는다', () => {
    // `ON CONFLICT ... DO UPDATE SET` 의 SET 처럼 **키워드가 테이블로 잡히는** 것을 제외한다.
    const STAY_OK = new Set(['pragma_table_info', 'sqlite_master', 'json_each', 'set', 'select', 'values'])
    const mixed: string[] = []
    for (const f of SRC) {
      const s = readFileSync(f, 'utf8')
      for (const sql of stringLiterals(s)) {
        if (!/\bFROM\b|\bJOIN\b|\bINTO\b|\bUPDATE\b/i.test(sql)) continue
        // FROM/JOIN 만 보면 `INSERT INTO 리드 SELECT ... FROM 남는것` 을 놓친다.
        const tabs = new Set([...sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+"?([a-z_][a-z0-9_]*)"?/gi)].map((x) => x[1]))
        const leads = [...tabs].filter((t) => (ADS_LEADS_TABLES as readonly string[]).includes(t))
        const stay = [...tabs].filter((t) => !(ADS_LEADS_TABLES as readonly string[]).includes(t) && !STAY_OK.has(t.toLowerCase()))
        if (leads.length && stay.length) mixed.push(`${f}: ${leads} × ${stay}`)
      }
    }
    expect(mixed, '리드와 남는 테이블이 섞인 쿼리 — 두 DB에 걸쳐 실행 불가').toEqual([])
  })
})

describe('R3 · 한 batch 가 두 DB에 걸치지 않는다', () => {
  it('.batch(...) 블록이 리드 테이블과 남는 테이블을 섞지 않는다', () => {
    // 라우터는 섞인 batch 를 런타임에 던진다 — 하지만 그건 이미 프로덕션이다. 정적으로 먼저 막는다.
    // (실제로 이 검사 때문에 `ad_email_suppress` 를 이사 목록에 넣었다. 그것만 `ad_company_leads`
    //  와 같은 batch 에 묶여 있었고, 안 옮기면 그 batch 가 원자성을 잃는다.)
    const KW = new Set(['if', 'not', 'exists', 'or', 'ignore', 'index', 'set', 'select', 'values', 'temp'])
    const mixed: string[] = []
    for (const f of SRC) {
      const s = readFileSync(f, 'utf8')
      for (const m of s.matchAll(/\.batch\(/g)) {
        let depth = 1
        let j = m.index! + m[0].length
        while (j < s.length && depth > 0) {
          if (s[j] === '(') depth++
          else if (s[j] === ')') depth--
          j++
        }
        const blk = s.slice(m.index! + m[0].length, j)
        const tabs = new Set([...blk.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+"?([a-z_][a-z0-9_]*)"?/gi)]
          .map((x) => x[1]).filter((t) => !KW.has(t.toLowerCase())))
        const leads = [...tabs].filter((t) => (ADS_LEADS_TABLES as readonly string[]).includes(t))
        const stay = [...tabs].filter((t) => !(ADS_LEADS_TABLES as readonly string[]).includes(t))
        if (leads.length && stay.length) mixed.push(`${f}: ${leads} × ${stay}`)
      }
    }
    expect(mixed, '두 DB에 걸친 batch — 원자성이 없다').toEqual([])
  })
})

describe('touchesAdsLeadsTable', () => {
  it('SELECT·INSERT·UPDATE·DELETE·DDL 전부 인식한다', () => {
    expect(touchesAdsLeadsTable('SELECT * FROM ad_influencer_leads WHERE id = ?')).toBe(true)
    expect(touchesAdsLeadsTable('INSERT INTO store_prospects (name) VALUES (?)')).toBe(true)
    expect(touchesAdsLeadsTable('UPDATE ad_company_leads SET email = ?')).toBe(true)
    expect(touchesAdsLeadsTable('DELETE FROM supply_maker_leads WHERE id = ?')).toBe(true)
    expect(touchesAdsLeadsTable('CREATE TABLE IF NOT EXISTS ad_discovery_keywords (id INTEGER)')).toBe(true)
    expect(touchesAdsLeadsTable('CREATE INDEX x ON ad_company_keywords(keyword)')).toBe(true)
  })

  it('이름이 겹치는 다른 테이블을 잘못 잡지 않는다', () => {
    expect(touchesAdsLeadsTable('SELECT * FROM ad_slots')).toBe(false)
    expect(touchesAdsLeadsTable('SELECT * FROM orders')).toBe(false)
    // 접두/접미가 붙은 다른 이름은 단어 경계로 걸러진다.
    // ⚠️ 여기서 `FROM <이름>` 형태를 쓰면 `check-sql-table-exists` 가 **실재하지 않는 테이블**로
    //    신고한다(그 가드가 옳다 — 가상의 이름이니까). 그래서 SQL 처럼 안 보이게 적는다.
    expect(touchesAdsLeadsTable('-- ad_company_leads_archive 는 다른 이름이다')).toBe(false)
    expect(touchesAdsLeadsTable('xx_store_prospects_v2 라는 이름')).toBe(false)
  })
})

/** 최소한의 가짜 D1 — prepare 한 SQL 과 어느 쪽으로 갔는지만 기록한다. */
function fakeDb(tag: string, log: string[]) {
  const stmt = (sql: string): Record<string, unknown> => ({
    bind: (..._a: unknown[]) => stmt(sql),
    first: async () => ({ tag, sql }),
    all: async () => ({ results: [{ tag }] }),
    run: async () => ({ meta: { changes: 1 }, tag }),
    raw: async () => [[tag]],
  })
  return {
    prepare(sql: string) { log.push(`${tag}:${sql.slice(0, 24)}`); return stmt(sql) },
    async batch(s: unknown[]) { log.push(`${tag}:batch(${s.length})`); return [] },
    async exec(sql: string) { log.push(`${tag}:exec:${sql.slice(0, 16)}`); return {} },
    async dump() { return new ArrayBuffer(0) },
  }
}

describe('adsLeadsDb 라우터', () => {
  it('🛡️ ADS_DB 가 없으면 env.DB 를 그대로 돌려준다 (래퍼조차 안 만든다)', () => {
    const log: string[] = []
    const main = fakeDb('main', log)
    expect(adsLeadsDb({ DB: main })).toBe(main)
    expect(adsLeadsDb({ DB: main, ADS_DB: undefined })).toBe(main)
  })

  it('리드 쿼리는 ADS_DB, 나머지는 DB 로 간다', async () => {
    const log: string[] = []
    const db: any = adsLeadsDb({ DB: fakeDb('main', log), ADS_DB: fakeDb('ads', log) })
    await db.prepare('SELECT * FROM ad_influencer_leads').first()
    await db.prepare('SELECT * FROM orders WHERE id = ?').bind(1).first()
    expect(log[0].startsWith('ads:')).toBe(true)
    expect(log[1].startsWith('main:')).toBe(true)
  })

  it('bind() 를 거쳐도 목적지가 유지된다', async () => {
    const log: string[] = []
    const db: any = adsLeadsDb({ DB: fakeDb('main', log), ADS_DB: fakeDb('ads', log) })
    const r = await db.prepare('UPDATE ad_company_leads SET email=? WHERE id=?').bind('a@b.c', 1).run()
    expect(r.tag).toBe('ads')
  })

  it('batch 는 같은 쪽끼리만 — 섞이면 조용히 반쪽 반영되지 않고 터진다', async () => {
    const log: string[] = []
    const db: any = adsLeadsDb({ DB: fakeDb('main', log), ADS_DB: fakeDb('ads', log) })
    await db.batch([db.prepare('INSERT INTO ad_company_leads (a) VALUES (1)'),
                    db.prepare('DELETE FROM store_prospects WHERE id=1')])
    expect(log.some((l) => l === 'ads:batch(2)')).toBe(true)
    await expect(db.batch([db.prepare('SELECT * FROM ad_company_leads'),
                           db.prepare('SELECT * FROM orders')])).rejects.toThrow(/섞/)
  })

  it('exec 도 같은 규칙으로 갈린다', async () => {
    const log: string[] = []
    const db: any = adsLeadsDb({ DB: fakeDb('main', log), ADS_DB: fakeDb('ads', log) })
    await db.exec('DELETE FROM ad_email_suppress')
    await db.exec('DELETE FROM cron_failures')
    expect(log[0].startsWith('ads:exec')).toBe(true)
    expect(log[1].startsWith('main:exec')).toBe(true)
  })
})
