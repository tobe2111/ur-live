/**
 * 📎 통신판매 품목 **원문 승계** — `company-save.ts` 의 ON CONFLICT (2026-10-26)
 *
 * 왜 있나: `description` 은 수집기가 `대표 X · 영업상태 · 취급 … · 판매 …` 로 **조립**한 값인데
 * ON CONFLICT 갱신 목록에 없어서 **한 번 쓰이면 영영 그대로**였다. 그래서 detail(품목) 레코드가
 * 나중에 와도 업종(subcategory)만 승격되고 **원문은 안 남았다** — 수집기 자신의 주석이
 * "원문이 있어야 다음에 표를 고칠 수 있다" 고 적어 둔 그 의도가 조용히 깨져 있었다.
 *
 * 📏 라이브 실측(2026-10-26 · commerce 424,299행)이 규칙의 네 겹을 정했다:
 *   `취급없음 417,156` · `취급-숫자코드 5,713` · `취급-한글 1,430`
 *   그리고 한글이 든 1,430행은 **`대표 …` 도 함께** 갖고 있다(1,430/1,433) ⇒ detail 응답이
 *   대표자명도 들고 오므로 통째 교체가 **무손실**이다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: 공공 API 가 실제로 무엇을 주는지(이 환경에서 `data.go.kr` 은 막혀 있다 —
 *   위 1,430/1,433 이 그 간접 증거다) · 라이브에서 몇 행이 실제로 승계되는지(detail 커서가 닿아야 한다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readCode } from '../helpers/source-text'

// `node:sqlite` 를 그냥 import 하면 vite 가 번들하려다 시험이 아예 안 돈다(선례: legacy-seller-lookup).
const req = createRequire(import.meta.url)
type Sqlite = {
  exec(s: string): void
  prepare(s: string): { all(...a: unknown[]): unknown[]; run(...a: unknown[]): { changes: number } }
}

const SRC = 'src/features/marketing/api/company-save.ts'

/** 소스의 ON CONFLICT 문장을 **그대로 떼어** 진짜 SQLite 에 먹인다 — 손으로 베끼면 두 벌이 갈린다. */
function upsertSql(): string {
  const raw = readCode(SRC)
  const i = raw.indexOf('INSERT INTO ad_company_leads (company_key')
  expect(i).toBeGreaterThan(-1)
  const j = raw.indexOf('`', i)
  expect(j).toBeGreaterThan(i)
  const sql = raw.slice(i, j)
  // 🕳️ 헛돌지 않게: 떼어낸 SQL 에 승계 분기가 실제로 들어 있어야 한다.
  expect(sql).toMatch(/description = CASE/)
  expect(sql.length).toBeGreaterThan(800)
  return sql
}

function db(): Sqlite {
  const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (p: string) => Sqlite }
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE ad_company_leads (
    company_key TEXT PRIMARY KEY, company_name TEXT, name_norm TEXT, category TEXT, subcategory TEXT,
    tier INTEGER, region TEXT, website TEXT, email TEXT, phone TEXT, address TEXT, description TEXT,
    business_no TEXT, contact_source TEXT, source TEXT, source_keyword TEXT, active INTEGER,
    lead_type TEXT, classify_confidence TEXT, classified_v INTEGER, merged_into INTEGER)`)
  return d
}

/** 한 행을 넣고(또는 conflict 로 갱신하고) 저장된 description 을 돌려준다. */
function upsert(d: Sqlite, sql: string, o: { desc: string | null; source: string; sub?: string }): void {
  d.prepare(sql).run(
    'K', '업체', '업체', '온라인판매', o.sub ?? '통신판매', 4, '서울', null, 'a@b.c', null, '주소',
    o.desc, '1234567890', 'commerce', o.source, 'kw', 1, null, null, 10,
  )
}
function stored(d: Sqlite): string | null {
  const r = d.prepare('SELECT description FROM ad_company_leads WHERE company_key = ?').all('K') as Array<{ description: string | null }>
  return r[0]?.description ?? null
}

const KOREAN = '대표 김** · 정상영업 · 취급 종합몰 교육/도서/완구 · 판매 인터넷'
const CODED = '대표 김** · 정상영업 · 취급 01 02 · 판매 02'
const NOGOODS = '대표 김** · 정상영업'
// 🩸 크롤 소개문 픽스처는 **두 가지**가 필요하다. 첫 판은 "취급" 이 든 것 하나만 뒀는데, 그건
//   품목-있음 겹에 먼저 걸려 `대표 %` 겹을 **한 번도 밟지 않았다** — 그 겹을 지워도 시험이 초록이었고
//   주입이 그걸 잡았다. 실제 라이브 소개문은 대부분 "취급" 이 없다(아래 둘 다 webkr 실측값).
const CRAWL_GOODS = '애견용품 창고형 할인매장 경기도 시흥시 고양이 분양업체 정보. 취급 품종, 분양가를 확인하세요.'
const CRAWL_PLAIN = '#SNS마케팅 #광고대행 #광고대행사 #영상제작 #인스타광고 #콘텐츠제작 #제주항공 #제주도 #여행사 #SNS운영'

describe('① 승계된다 — 품목 원문이 비었거나 숫자코드일 때', () => {
  it('취급 없음 → 한글 품목이 오면 승계한다 (라이브 417,156행의 경우)', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: NOGOODS, source: 'commerce' })
    upsert(d, sql, { desc: KOREAN, source: 'commerce' })
    expect(stored(d)).toBe(KOREAN)
  })
  it('숫자코드 → 한글 품목이 오면 승계한다 (라이브 5,713행의 경우)', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: CODED, source: 'commerce' })
    upsert(d, sql, { desc: KOREAN, source: 'commerce' })
    expect(stored(d)).toBe(KOREAN)
  })
  it('비어 있으면 채운다', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: null, source: 'commerce' })
    upsert(d, sql, { desc: KOREAN, source: 'commerce' })
    expect(stored(d)).toBe(KOREAN)
  })
})

describe('② 승계되지 않는다 — 네 겹이 각각 일한다', () => {
  it('이미 한글 품목이 있으면 덮지 않는다(같은 값이 다시 와도 바꿀 이유가 없다)', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: KOREAN, source: 'commerce' })
    upsert(d, sql, { desc: CODED, source: 'commerce' })
    expect(stored(d)).toBe(KOREAN)   // 숫자코드가 한글을 되덮지 않는다
  })
  it('들어오는 값에 품목이 없으면(status 레코드) detail 이 채운 원문을 안 지운다', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: KOREAN, source: 'commerce' })
    upsert(d, sql, { desc: NOGOODS, source: 'commerce' })
    expect(stored(d)).toBe(KOREAN)
  })
  it('commerce 출처가 아니면 승계하지 않는다', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: NOGOODS, source: 'commerce' })
    upsert(d, sql, { desc: KOREAN, source: 'webkr' })
    expect(stored(d)).toBe(NOGOODS)
  })
  it('🔒 웹 크롤 소개문은 지킨다 — "취급" 이 든 소개문(품목-있음 겹이 막는다)', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: CRAWL_GOODS, source: 'webkr' })
    upsert(d, sql, { desc: KOREAN, source: 'commerce' })
    expect(stored(d)).toBe(CRAWL_GOODS)
  })
  it('🔒 웹 크롤 소개문은 지킨다 — "취급" 이 **없는** 소개문(`대표 ` 겹만이 막는다)', () => {
    // 이 경우가 `대표 %` 겹을 실제로 밟는 유일한 자리다. 품목이 없으니 다른 겹은 전부 통과시킨다.
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: CRAWL_PLAIN, source: 'webkr' })
    upsert(d, sql, { desc: KOREAN, source: 'commerce' })
    expect(stored(d)).toBe(CRAWL_PLAIN)
  })
})

describe('③ 보수적 실패를 숨기지 않는다', () => {
  it('한글 품목이 숫자로 시작하면 승계를 **건너뛴다**(덮어쓰지 않는 쪽으로 실패)', () => {
    const d = db(); const sql = upsertSql()
    const digitKorean = '대표 김** · 정상영업 · 취급 1인가구용품 · 판매 인터넷'
    upsert(d, sql, { desc: NOGOODS, source: 'commerce' })
    upsert(d, sql, { desc: digitKorean, source: 'commerce' })
    expect(stored(d)).toBe(NOGOODS)   // 데이터를 잃지는 않는다
  })
  it('그 한계가 소스 주석에 적혀 있다', () => {
    expect(readCode(SRC)).toMatch(/보수적 실패/)
  })
})

describe('④ 업종 승격은 그대로다 — 이 변경이 그걸 건드리지 않았다', () => {
  it('통신판매 → 구체 라벨로 승격되고, 사람이 고친 값은 보존된다', () => {
    const d = db(); const sql = upsertSql()
    upsert(d, sql, { desc: NOGOODS, source: 'commerce', sub: '통신판매' })
    upsert(d, sql, { desc: KOREAN, source: 'commerce', sub: '종합몰' })
    let r = d.prepare('SELECT subcategory FROM ad_company_leads WHERE company_key = ?').all('K') as Array<{ subcategory: string }>
    expect(r[0].subcategory).toBe('종합몰')
    upsert(d, sql, { desc: KOREAN, source: 'commerce', sub: '통신판매' })
    r = d.prepare('SELECT subcategory FROM ad_company_leads WHERE company_key = ?').all('K') as Array<{ subcategory: string }>
    expect(r[0].subcategory).toBe('종합몰')   // 총칭이 구체 라벨을 밀어내지 않는다
  })
})

describe('⑤ 수집기의 원문 보존 의도가 살아 있다', () => {
  it('수집기는 품목 원문을 description 에 조립한다', () => {
    const c = readCode('src/features/marketing/api/commerce-notify-collect.ts')
    expect(c).toMatch(/취급 \$\{goods\.slice/)
    expect(c).toMatch(/판매 \$\{method\.slice/)
  })
  it('한글 필드를 코드 필드보다 **먼저** 본다(2026-10-25 수리가 되돌아가지 않는다)', () => {
    const c = readCode('src/features/marketing/api/commerce-notify-collect.ts')
    const goodsLine = c.split('\n').find((l) => l.includes('const goods')) || ''
    expect(goodsLine).toMatch(/ntslPrdlstCn/)
    // 한글 별칭(ntslPrdlstCn)이 숫자코드 별칭(trtmntPrdlstNm)보다 앞에 있어야 한다.
    expect(goodsLine.indexOf('ntslPrdlstCn')).toBeLessThan(goodsLine.indexOf('trtmntPrdlstNm'))
  })
})
