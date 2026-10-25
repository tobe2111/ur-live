/**
 * 🤝 생활 견적 — 카테고리 확대 + 제휴 업체(간판) (2026-10-25 대표 "일단 다 하자 · 간판은 특히 잘 해야해. 이미 제휴사가 있거든").
 *
 * 지키는 것:
 *  - 제휴 업체는 그 카테고리 요청을 **지역과 무관하게** 받는다(요청함·상세 열람·알림 모두).
 *  - 제휴는 **그 카테고리만** — 다른 카테고리 요청이 새지 않는다.
 *  - 제휴 견적은 참여권을 쓰지 않고 반환도 없다(2026-10-24 승인된 직영·협력 업체 규칙). 손님 화면은 "유어딜 제휴".
 *  - 간판 요청서는 업체가 첫 통화에서 묻는 것(일·종류·크기·다는 곳·디자인·신고·예산)을 받는다.
 *
 * ⚠️ 못 보는 것: 알림톡이 실제로 나가는지(템플릿 승인) · 제휴 업체가 실제로 견적을 내는지(운영).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import { readCode } from '../helpers/source-text'
import {
  HS_TABLES_SQL, OPEN_REQUESTS_FOR_PRO_SQL, creditBalance, refundAllQuotes, sendHouseQuoteAtomic,
} from '@/features/home-service/api/home-service-db'
import { categoryDef, parsePartners, partnerCategoriesCsv, requestSummary, validateRequest } from '@/shared/home-service'
import { parseRegionFromAddress } from '@/shared/constants/region-slugs'

type Raw = { exec(s: string): void; prepare(s: string): { run(...a: never[]): { changes: number | bigint }; get(...a: never[]): unknown; all(...a: never[]): unknown[] } }
const req = createRequire(import.meta.url)

function makeD1(): { DB: D1Database; raw: Raw } {
  const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (p: string) => Raw }
  const raw = new DatabaseSync(':memory:')
  const stmt = (sql: string, args: unknown[] = []) => ({
    sql, args,
    bind: (...a: unknown[]) => stmt(sql, a),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...(args as never[])).changes) } }),
    first: async () => raw.prepare(sql).get(...(args as never[])) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...(args as never[])) }),
  })
  const DB = {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: { sql: string; args: unknown[] }[]) => {
      raw.exec('BEGIN')
      try {
        const out = list.map((x) => ({ meta: { changes: Number(raw.prepare(x.sql).run(...(x.args as never[])).changes) } }))
        raw.exec('COMMIT'); return out
      } catch (e) { raw.exec('ROLLBACK'); throw e }
    },
  } as unknown as D1Database
  raw.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT, phone TEXT, name TEXT, business_name TEXT)`)
  for (const s of HS_TABLES_SQL) raw.exec(s)
  return { DB, raw }
}

function addRequest(raw: Raw, category: string, sido = '부산', sigungu = '금정구'): number {
  raw.prepare(
    `INSERT INTO home_service_requests (user_id, category, details, summary, sido, sigungu, desired_date, contact_phone)
     VALUES (1, ?, '{}', 's', ?, ?, '2099-01-01', '01012345678')`,
  ).run(...([category, sido, sigungu] as never[]))
  return Number((raw.prepare(`SELECT MAX(id) AS id FROM home_service_requests`).get() as { id: number }).id)
}

let DB: D1Database, raw: Raw
beforeEach(() => { ({ DB, raw } = makeD1()) })

const PARTNER = 50
const openFor = async (sid: number, csv: string) => {
  const { results } = await DB.prepare(OPEN_REQUESTS_FOR_PRO_SQL).bind(sid, '2026-10-25', csv, sid, sid, 50).all<{ id: number }>()
  return (results ?? []).map((r) => r.id)
}

describe('🤝 제휴 업체 — 지역과 무관하게, 그 카테고리만', () => {
  it('등록 지역이 없어도 제휴 카테고리 요청은 요청함에 뜬다', async () => {
    raw.prepare(`INSERT INTO sellers (id, status, phone, name) VALUES (?, 'approved', '010', 'p')`).run(...([PARTNER] as never[]))
    const sign = addRequest(raw, 'signage', '제주', '서귀포시')
    expect(await openFor(PARTNER, 'signage')).toEqual([sign])
  })
  it('제휴가 아니면(쉼표 목록 비어 있음) 지역이 안 맞는 요청은 안 뜬다', async () => {
    addRequest(raw, 'signage', '제주', '서귀포시')
    expect(await openFor(PARTNER, '')).toEqual([])
  })
  it('제휴는 그 카테고리만 — 다른 카테고리 요청은 새지 않는다', async () => {
    addRequest(raw, 'store_pest', '제주', '서귀포시')
    expect(await openFor(PARTNER, 'signage')).toEqual([])
  })
  it('카테고리 이름이 다른 이름의 일부여도 섞이지 않는다(쉼표 경계)', async () => {
    // 'move' 는 'move_in_clean' 의 앞부분이다 — 쉼표 경계가 없으면 입주청소 제휴가 이사 요청을 받는다.
    addRequest(raw, 'move', '제주', '서귀포시')
    expect(await openFor(PARTNER, 'move_in_clean')).toEqual([])
  })
  it('제휴 견적은 참여권 없이 · partner=1 · 반환 대상 아님', async () => {
    const rid = addRequest(raw, 'signage')
    const r = await sendHouseQuoteAtomic(DB, rid, PARTNER, 3_000_000, '현장 실측 후 시안 드립니다', true)
    expect(r.ok).toBe(true)
    const q = raw.prepare(`SELECT is_house, partner FROM home_service_quotes WHERE request_id = ?`).get(...([rid] as never[])) as { is_house: number; partner: number }
    expect(q).toEqual({ is_house: 1, partner: 1 })
    expect(await creditBalance(DB, PARTNER)).toBe(0)
    expect(await refundAllQuotes(DB, rid, '테스트')).toBe(0)
  })
  it('직영 견적은 그대로 partner=0', async () => {
    const rid = addRequest(raw, 'signage')
    await sendHouseQuoteAtomic(DB, rid, 9, null, '직영 견적입니다')
    const q = raw.prepare(`SELECT partner FROM home_service_quotes WHERE request_id = ?`).get(...([rid] as never[])) as { partner: number }
    expect(q.partner).toBe(0)
  })
})

describe('🤝 제휴 표 파싱', () => {
  it('없는 카테고리·잘못된 번호는 버린다', () => {
    expect(parsePartners('{"signage":12,"nope":3,"store_pest":"x","move":-1}')).toEqual({ signage: 12 })
    expect(parsePartners('깨진 JSON')).toEqual({})
    expect(parsePartners(null)).toEqual({})
    expect(parsePartners('[1,2]')).toEqual({})
  })
  it('한 매장의 제휴 카테고리를 쉼표로', () => {
    expect(partnerCategoriesCsv({ signage: 12, store_pest: 12, move: 3 }, 12)).toBe('signage,store_pest')
    expect(partnerCategoriesCsv({ signage: 12 }, 3)).toBe('')
  })
})

describe('🪧 간판 요청서', () => {
  const parse = (s: string) => { const r = parseRegionFromAddress(s); return r ? { sido: r.sido, sigungu: r.sigungu } : null }
  it('업체가 첫 통화에서 묻는 것을 전부 받는다', () => {
    const keys = categoryDef('signage')!.fields.map((f) => f.key)
    for (const k of ['address', 'work', 'kind', 'size', 'spot', 'design', 'permit', 'budget', 'date']) expect(keys).toContain(k)
  })
  it('정상 입력이 통과하고 요약에 종류·일·크기·예산이 실린다', () => {
    const v = validateRequest('signage', {
      address: '부산 금정구 청룡동', biz: '식당', work: '교체', kind: '채널(입체 글자)', size: '5~10m', spot: '1층 정면',
      design: '시안부터 필요해요', permit: '대신 해 주세요', budget: '300~500만 원', date: '2099-01-01',
    }, parse, '2026-10-25')
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(requestSummary('signage', v.value.details)).toBe('부산 금정구 청룡동 · 채널(입체 글자) 교체 · 가로 5~10m · 예산 300~500만 원')
  })
  it('가게 시설 수리에는 간판·냉장 설비·에어컨이 더 없다(전용 카테고리로 갔다)', () => {
    const kinds = categoryDef('store_repair')!.fields.find((f) => f.key === 'kind')!.options!
    for (const k of ['간판', '냉장·냉동 설비', '에어컨']) expect(kinds).not.toContain(k)
  })
})

describe('🏗️ 인테리어', () => {
  it('가게·집 둘 다 예산과 착공일을 받고, 가게 인테리어는 간판을 함께 권한다', () => {
    for (const k of ['store_interior', 'home_interior']) {
      const keys = categoryDef(k)!.fields.map((f) => f.key)
      expect(keys).toContain('budget'); expect(keys).toContain('pyeong'); expect(keys).toContain('date')
    }
    expect(categoryDef('store_interior')!.crossSell?.to).toBe('signage')
  })
})

describe('🔌 배선', () => {
  const notify = readCode('src/features/home-service/api/home-service-notify.ts')
  const pro = readCode('src/features/home-service/api/home-service-pro.routes.ts')
  it('새 요청 알림은 제휴 업체에게도(판매 승인된 매장만)', () => {
    const i = notify.indexOf('loadPartners(DB))[req.category]')
    expect(i).toBeGreaterThan(0)
    expect(notify.slice(i, i + 500)).toContain(`s.status IN ('approved', 'active')`)
  })
  it('제휴 업체 견적은 참여권 없는 경로로', () => {
    expect(pro).toMatch(/isPartner\s*\n?\s*\?\s*await sendHouseQuoteAtomic\(DB, id, sid, price, message, true\)/)
  })
  it('요청함·열람·가입 직후 보내기가 모두 제휴 목록을 넘긴다', () => {
    expect(pro).toContain('partnerCategoriesCsv(partners, sid), sid, sid, 50')
    expect(pro).toContain(').bind(requestId, sid, csv, sid, sid, sid, sid).first()' /* 2026-10-25 공유 기록 조건이 sid 둘을 더 받는다 */)
    expect(notify).toContain('.bind(sellerId, todayYmd, csv, sellerId, sellerId, 5)')
  })
})
