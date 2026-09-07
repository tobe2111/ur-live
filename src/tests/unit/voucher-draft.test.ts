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
/**
 * ✏️ 2026-09-02 — 임시저장 엔드포인트가 `seller-stores.routes.ts` 에서 **여기로 이사**했다
 *   (그 파일이 god-파일 래칫 600줄을 넘어 추출. 경로·동작은 불변).
 *   ⚠️ 이 테스트가 **이사를 잡아냈다** — CI 가 R2/R3/R5 를 빨간불로 세웠고, 그게 맞는 동작이다.
 *   아래 R6 은 그 반대 방향을 막는다: 파일만 남고 **등록이 빠지면** 세 엔드포인트가 통째로 사라진다
 *   (404 — 임시저장이 조용히 죽는다). 추출의 진짜 위험은 그쪽이다.
 */
const ROUTES = 'src/features/seller/api/seller-voucher-draft.routes.ts'
const HOST = 'src/features/seller/api/seller-stores.routes.ts'
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
  /**
   * ⚠️ 앵커를 못 찾으면 **통과가 아니라 실패**여야 한다. 종전엔 `s.slice(s.indexOf(...))` 였는데,
   *   라우터 변수명이 `app` → `draftApp` 으로 바뀌자 indexOf 가 -1 을 주고 `slice(-1)` 이 **마지막
   *   한 글자**('\n')를 돌려줬다 — 검사 대상이 사실상 빈 문자열이 된 것이다. 이번엔 그래서 빨간불이
   *   났지만, 반대로 "없는 것을 안 찾아서 통과"가 되기도 쉬운 모양이다(이 레포가 반복해 만난 클래스).
   *   ⇒ 변수명에 의존하지 않고 찾되, 못 찾으면 명시적으로 실패시킨다.
   */
  it('R2 upsert(ON CONFLICT) + 크기 상한이 있다', () => {
    const at = s.search(/\w+\.put\('\/voucher-draft'/)
    expect(at, "PUT /voucher-draft 핸들러를 못 찾았다 — 검사가 헛돌고 있다").toBeGreaterThan(-1)
    const block = s.slice(at)
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

describe('R6 추출된 라우트가 실제로 등록된다 (파일만 남고 안 붙으면 404)', () => {
  it('호스트가 registerVoucherDraftRoutes 를 부른다', () => {
    const h = read(HOST)
    expect(h, '등록 호출이 빠지면 /voucher-draft 3개가 통째로 사라진다')
      .toContain('registerVoucherDraftRoutes(app)')
    expect(h).toContain("from './seller-voucher-draft.routes'")
  })
  it('경로 문자열은 그대로 — 클라(draft-sync)는 한 줄도 안 바뀌었다', () => {
    const r = read(ROUTES)
    for (const m of ['get', 'put', 'delete']) {
      expect(r, `${m} /voucher-draft 가 사라졌다`).toContain(`draftApp.${m}('/voucher-draft'`)
    }
  })
})
