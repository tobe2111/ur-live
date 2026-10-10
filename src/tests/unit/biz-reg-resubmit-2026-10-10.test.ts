/**
 * 🪪 등록증 (재)제출 — 반려 뒤에도 돌아올 길이 있는가 (2026-10-10 사장님·중개사 플로우 전수조사)
 *
 * **실제 SQLite** 에 넣고 `submitBizRegistration` 이 바꾸는 행을 센다.
 *  ① 우리 등록증 자리만 받는다(남의 서버 주소 금지) · 우리 도메인 절대 주소는 경로로 바꿔 저장
 *  ② 반려된 매장은 서류를 다시 내면 심사 큐(pending)로 돌아간다 — 이력도 남는다
 *  ③ 정지된 매장은 서류를 낸다고 풀리지 않는다 · 승인된 매장은 그대로
 *  ④ 배선 — 대시보드 두 업로드가 등록증 전용 자리로 · 배너가 등록증만 반려된 경우를 구분
 * ⚠️ 못 보는 것: 업로드 자체(R2) · 어드민 화면 렌더.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { normalizeBizCertUrl, submitBizRegistration } from '@/features/seller/api/seller-settlements/biz-reg-submit'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }

let raw: InstanceType<typeof DatabaseSync>
let DB: Parameters<typeof submitBizRegistration>[0]
function d1(db: InstanceType<typeof DatabaseSync>) {
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as Parameters<typeof submitBizRegistration>[0]
}
const CERT = '/api/media/uploads/biz-cert/2026-10/abc.jpg'

beforeEach(() => {
  raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT, business_number TEXT, updated_at TEXT,
      business_registration_image_url TEXT, business_registration_status TEXT, business_registration_reject_reason TEXT);
    CREATE TABLE seller_status_history (seller_id INTEGER, prev_status TEXT, new_status TEXT, reason TEXT);
    INSERT INTO sellers (id, status, business_registration_status, business_registration_reject_reason) VALUES
      (1, 'rejected', 'rejected', '흐림'), (2, 'suspended', 'rejected', NULL), (3, 'approved', NULL, NULL), (4, 'pending', 'rejected', '잘림');
  `)
  DB = d1(raw)
})
const row = (id: number) => raw.prepare('SELECT status, business_registration_status brs, business_registration_image_url u, business_registration_reject_reason rr FROM sellers WHERE id=?').get(id as never) as { status: string; brs: string; u: string; rr: string | null }

describe('① 주소 검증', () => {
  it('우리 등록증 자리만', () => {
    expect(normalizeBizCertUrl(CERT)).toBe(CERT)
    expect(normalizeBizCertUrl('https://urdeal.kr' + CERT)).toBe(CERT)
    expect(normalizeBizCertUrl('https://evil.example' + CERT)).toBeNull()
    expect(normalizeBizCertUrl('https://urdeal.kr/api/media/uploads/2026-10/product.jpg')).toBeNull()
    expect(normalizeBizCertUrl('http://urdeal.kr' + CERT)).toBeNull()
    expect(normalizeBizCertUrl('')).toBeNull()
  })
  it('잘못된 주소는 아무것도 바꾸지 않는다', async () => {
    const r = await submitBizRegistration(DB, 1, { image_url: 'https://evil.example/x.jpg' })
    expect(r.ok).toBe(false)
    expect(row(1).status).toBe('rejected')
  })
})

describe('② ③ 재제출', () => {
  it('반려 매장 → 심사 큐로 복귀 + 이력 + 등록증 대기', async () => {
    const r = await submitBizRegistration(DB, 1, { image_url: 'https://urdeal.kr' + CERT })
    expect(r).toEqual({ ok: true, resubmittedStore: true })
    expect(row(1)).toEqual({ status: 'pending', brs: 'pending', u: CERT, rr: null })
    expect(raw.prepare("SELECT COUNT(*) n FROM seller_status_history WHERE seller_id=1 AND new_status='pending'").get()).toEqual({ n: 1 })
  })
  it('정지 매장은 풀리지 않는다', async () => {
    const r = await submitBizRegistration(DB, 2, { image_url: CERT })
    expect(r).toEqual({ ok: true, resubmittedStore: false })
    expect(row(2).status).toBe('suspended')
  })
  it('승인 매장·대기 매장의 상태는 그대로(등록증만 갱신)', async () => {
    await submitBizRegistration(DB, 3, { image_url: CERT })
    await submitBizRegistration(DB, 4, { image_url: CERT })
    expect([row(3).status, row(4).status, row(4).brs]).toEqual(['approved', 'pending', 'pending'])
  })
})

describe('④ 배선', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  it('제출 라우트가 이 모듈을 쓴다', () => {
    expect(read('src/features/seller/api/seller-settlements.routes.ts')).toMatch(/const r = await submitBizRegistration\(db, sellerId, body\)/)
  })
  it('대시보드 업로드 두 곳이 등록증 전용 자리로 간다', () => {
    expect(read('src/pages/SellerBusinessInfoPage.tsx')).toMatch(/api\.post\('\/api\/upload\/business-cert', fd/)
    expect(read('src/pages/seller-settlements/BizRegSubmitModal.tsx')).toMatch(/<BusinessCertUpload\b/)
  })
  it('배너가 등록증만 반려된 경우를 "심사 중" 으로 말하지 않는다', () => {
    const b = read('src/components/seller/SellerApprovalBanner.tsx')
    expect(b).toMatch(/const certRejected = !rejected && s\.cert_status === 'rejected'/)
    expect(read('src/features/auth/api/seller.routes.ts')).toMatch(/cert_status: row\?\.business_registration_status \?\? null/)
  })
  it('어드민 알림 링크가 실재하는 화면을 가리킨다', () => {
    expect(read('src/features/seller/api/seller-settlements.routes.ts')).not.toMatch(/'\/admin\/sellers'\)/)
    expect(read('src/features/seller/api/seller-registration.routes.ts')).not.toMatch(/'\/admin\/sellers'\)/)
  })
})
