/**
 * 🔤 깨진 상호(`�`) — 2026-11-02 라이브 실측 222행(전부 webkr, 11월에도 계속 생기던 중).
 *
 * 원인 둘: ① 보강 크롤이 `res.text()`(무조건 UTF-8)로 EUC-KR 사이트를 읽어 `<title>` 이 뭉개졌고 그게
 * 이름 치유로 상호가 됐다 ② 네이버 웹검색이 EUC-KR 사이트 제목을 이미 뭉갠 채 돌려준다.
 * 이 시험이 지키는 것: 디코더 · 두 입구의 거름망 · 이미 저장된 행의 수리 경로.
 * ⚠️ 못 보는 것: Workers 런타임이 `euc-kr` 디코더를 실제로 주는지(안 주면 거름망이 막아 상호가 빈칸 대신
 *   도메인이 된다 — 허위는 0). 라이브 판정은 `broken_renamed` / `broken_to_host` 계수와 깨진 행 수로 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { decodeHtmlBytes, declaredCharset, hasBrokenText } from '@/features/marketing/api/html-decode'

const read = (p: string) => readFileSync(`src/features/marketing/api/${p}`, 'utf8')
// "한국" 의 EUC-KR 바이트
const HANGUK_EUCKR = [0xc7, 0xd1, 0xb1, 0xb9]
const page = (meta: string) => new Uint8Array([
  ...new TextEncoder().encode(`<html><head>${meta}<title>`), ...HANGUK_EUCKR, ...new TextEncoder().encode('</title>'),
])

describe('html-decode', () => {
  it('깨진 글자를 알아본다', () => {
    expect(hasBrokenText('��기획')).toBe(true)
    expect(hasBrokenText('대명종합광고기획')).toBe(false)
    expect(hasBrokenText(null)).toBe(false)
  })

  it('헤더가 meta 보다 먼저다', () => {
    expect(declaredCharset('text/html; charset=EUC-KR', page('<meta charset="utf-8">'))).toBe('euc-kr')
    expect(declaredCharset(null, page('<meta http-equiv="Content-Type" content="text/html; charset=ks_c_5601-1987">'))).toBe('ks_c_5601-1987')
    expect(declaredCharset('text/html', page(''))).toBeNull()
  })

  it('EUC-KR 이라고 밝힌 페이지는 한글로 읽는다', () => {
    expect(decodeHtmlBytes(page('<meta charset="euc-kr">'))).toContain('<title>한국</title>')
    expect(decodeHtmlBytes(page(''), 'text/html; charset=cp949')).toContain('한국')
  })

  it('선언이 없으면 UTF-8 이고, 그 결과의 깨진 글자는 거름망이 잡는다', () => {
    const out = decodeHtmlBytes(page(''))
    expect(hasBrokenText(out)).toBe(true)
    expect(decodeHtmlBytes(new TextEncoder().encode('<title>유어딜</title>'))).toContain('유어딜')
  })
})

describe('입구와 수리 경로', () => {
  it('크롤러는 text() 가 아니라 문자셋을 보고 읽는다', () => {
    const src = read('contact-enrich.ts')
    const fetchHtml = src.slice(src.indexOf('const fetchHtml'), src.indexOf('let originResolved'))
    expect(fetchHtml).toContain('decodeHtmlBytes(')
    expect(fetchHtml).not.toMatch(/r\.text\(\)/)
  })

  it('사이트 이름 후보에 깨진 글자가 있으면 채택하지 않는다', () => {
    expect(read('contact-enrich.ts')).toMatch(/!hasBrokenText\(cand\)[^\n]*siteName = cand/)
  })

  it('네이버 제목이 깨져 있으면 도메인으로 둔다', () => {
    expect(read('webkr-search.ts')).toMatch(/const name = [^\n]*!hasBrokenText\(cut\) \? cut : host/)
  })

  it('이미 저장된 깨진 상호를 집어 고친다(실명 또는 도메인, 사람이 손댄 행은 제외)', () => {
    const src = read('enrich-name-heal.ts')
    expect(src).toContain('await repairBrokenNames(')
    const fn = src.slice(src.indexOf('async function repairBrokenNames'))
    expect(fn).toMatch(/instr\(company_name, char\(65533\)\) > 0/)
    expect(fn).toMatch(/status = 'new'/)
    expect(fn).toMatch(/const name = real \|\| host/)
    expect(fn).toMatch(/!hasBrokenText\(c\.siteName\)/)
  })
})

/**
 * 🩸 같은 날 발견한 두 번째 구멍 — 재분류 벌크 전진이 소수 규칙을 건너뛰었다(`정민법무사사무소` 가 `세무사`,
 * `세무·기장` 4,162행이 v10 도장을 받고도 그대로). 진짜 SQLite 에 조건을 먹여, 고쳐야 할 행이 벌크 대상에서
 * 빠지는지 확인한다.
 */
describe('재분류 벌크 전진은 규칙이 바꿀 행을 건너뛰지 않는다', async () => {
  const { fastPathWhere } = await import('@/features/marketing/api/reclassify-registry-fastpath')
  const { classifyProfession, CANON_SUBCATEGORY, PROFESSION_NAME_HINTS } = await import('@/features/marketing/api/company-taxonomy')
  const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
    DatabaseSync: new (p: string) => { exec: (sql: string) => void; prepare: (sql: string) => { run: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] } }
  }
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, company_name TEXT, subcategory TEXT, category TEXT,
    source TEXT, classify_confidence TEXT, classified_v INTEGER, merged_into INTEGER)`)
  const rows: Array<[number, string, string]> = [
    [1, '정민법무사사무소', '세무사'],       // 자격명 → 법무사로 바뀌어야 함
    [2, '김밥천국 역삼점', '한식'],          // 안전 — 벌크 OK
    [3, '한빛 세무회계', '세무·기장'],        // 중복 라벨 + 자격명
    [4, '동네공인중개사', '회계'],            // 중복 라벨만
    [5, '아다모인테리어필름', '인테리어·시공'], // 안전
  ]
  for (const [id, n, sub] of rows) db.prepare(`INSERT INTO ad_company_leads VALUES (?, ?, ?, '전문서비스', 'storeinfo', 'registry', 10, NULL)`).run(id, n, sub)
  const ids = (db.prepare(`SELECT id FROM ad_company_leads WHERE ${fastPathWhere("'storeinfo'")} ORDER BY id`).all(11, 0) as Array<{ id: number }>).map(r => r.id)

  it('고쳐야 할 행은 빠지고 안전한 행만 남는다', () => {
    expect(ids).toEqual([2, 5])
  })
  it('낱말 목록은 규칙에서 뽑으므로 규칙이 맞히는 상호는 전부 덮는다', () => {
    for (const n of ['윤순혁세무회계사무소', '노동법률사무소', '법무법인 한결', '특허법인 다래', '감정평가법인']) {
      expect(classifyProfession(n)).not.toBeNull()
      expect(PROFESSION_NAME_HINTS.some(w => n.replace(/\s+/g, '').includes(w))).toBe(true)
    }
    expect(Object.keys(CANON_SUBCATEGORY)).toContain('세무·기장')
  })
})
