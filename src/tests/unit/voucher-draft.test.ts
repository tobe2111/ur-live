/**
 * 💾 이용권 임시저장 — 기기 간 이어쓰기 불변식 (2026-08-23)
 *
 * 지키는 것:
 *   R1 pickNewerDraft — 로컬 vs 서버 중 더 최근 것이 이긴다(빈 드래프트는 후보가 아니다).
 *   R2 서버 드래프트는 upsert(ON CONFLICT) + 크기 상한 — 무한 성장/행 중복 금지.
 *   R3 서버 updated_ms 는 epoch(ms) 로 내려온다 — 클라가 DB 문자열을 Date 파싱하면
 *      UTC-naive 오해석 클래스(check-utc-date-parse)가 재발한다.
 *   R4 제출 성공/새로 작성 시 로컬·서버 **둘 다** 지운다 — 한쪽만 지우면 유령 복원 배너.
 *   R5 드래프트를 seller_meta 에 넣지 않는다 — getSellerMeta 가 전 키를 읽어
 *      수백 KB 드래프트가 모든 meta 조회에 끌려다닌다.
 *
 * 이 테스트가 못 막는 것: 실제 D1 upsert 동작(라이브), 브라우저 localStorage 동작.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pickNewerDraft, emptyVoucherForm, type VoucherDraft } from '@/pages/seller-meal-voucher/voucher-form'

const read = (p: string) => readFileSync(p, 'utf-8')
const ROUTES = 'src/features/seller/api/seller-stores.routes.ts'
const PAGE = 'src/pages/SellerMealVoucherNewPage.tsx'

const draft = (over: Partial<VoucherDraft['form']>, savedAt: number): VoucherDraft => ({
  form: { ...emptyVoucherForm(), ...over }, savedAt, sellerId: 1,
})

describe('R1 pickNewerDraft — 최근 것이 이긴다', () => {
  it('서버가 더 최근이면 서버', () => {
    const l = draft({ name: '로컬' }, 1000)
    const s = draft({ name: '서버' }, 2000)
    expect(pickNewerDraft(l, s)?.form.name).toBe('서버')
  })
  it('로컬이 더 최근이면 로컬 (동시각은 로컬 — 기기 손맛 우선)', () => {
    const l = draft({ name: '로컬' }, 2000)
    const s = draft({ name: '서버' }, 2000)
    expect(pickNewerDraft(l, s)?.form.name).toBe('로컬')
  })
  it('한쪽만 있으면 그쪽, 둘 다 없으면 null', () => {
    const s = draft({ name: '서버' }, 1)
    expect(pickNewerDraft(null, s)?.form.name).toBe('서버')
    expect(pickNewerDraft(s, null)?.form.name).toBe('서버')
    expect(pickNewerDraft(null, null)).toBeNull()
  })
  it('빈(저장 가치 없는) 드래프트는 최근이어도 후보가 아니다', () => {
    const empty = draft({}, 9999)
    const real = draft({ name: '진짜' }, 1)
    expect(pickNewerDraft(empty, real)?.form.name).toBe('진짜')
    expect(pickNewerDraft(empty, null)).toBeNull()
  })
})

describe('R2~R3 서버 드래프트 라우트 계약', () => {
  const s = read(ROUTES)
  it('R2 upsert(ON CONFLICT) + 크기 상한이 있다', () => {
    const block = s.slice(s.indexOf("app.put('/voucher-draft'"))
    expect(block, 'upsert 가 사라지면 셀러당 행이 중복된다').toContain('ON CONFLICT(seller_id) DO UPDATE')
    expect(block, '크기 상한이 없으면 base64 이미지로 행이 무한 성장한다').toContain('DRAFT_MAX_BYTES')
  })
  it('R3 updated_ms 를 epoch 로 내린다 (클라 Date 파싱 금지 계약)', () => {
    expect(s).toContain("strftime('%s', updated_at)")
    const sync = read('src/pages/seller-meal-voucher/draft-sync.ts')
    expect(sync, '클라가 updated_at 문자열을 Date 파싱하면 UTC 오해석 재발').not.toMatch(/new Date\(/)
  })
  it('R5 드래프트가 seller_meta 로 새지 않는다', () => {
    const block = s.slice(s.indexOf('voucher-draft'), s.indexOf("app.get('/stores/context'"))
    expect(block, '드래프트를 setSellerMeta 로 저장하면 전 meta 조회가 수백 KB 를 끌고 다닌다')
      .not.toContain('setSellerMeta')
  })
})

describe('R4 제출/폐기 시 양쪽 모두 삭제', () => {
  const p = read(PAGE)
  it('제출 성공 경로에 clearVoucherDraft + deleteServerDraft 가 나란히 있다', () => {
    const at = p.indexOf('clearVoucherDraft()\n        deleteServerDraft()')
    expect(at, '한쪽만 지우면 다음 진입에서 유령 복원 배너가 뜬다').toBeGreaterThan(-1)
  })
  it('새로 작성(폐기)도 서버까지 지운다', () => {
    expect(p).toMatch(/clearVoucherDraft\(\); deleteServerDraft\(\); setPendingDraft\(null\)/)
  })
})
