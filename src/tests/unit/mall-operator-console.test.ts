/**
 * 🏬 몰 운영자 콘솔(`/mall-admin`) 불변식 — 2026-08-10.
 *
 * 대상은 **공구 서비스의 몰 운영자**다(도매몰 아님 — `pickup-groupbuy-wholesale-link.md` §3 모드 A·B).
 *
 * ## 이 테스트가 지키는 것
 * 이 콘솔의 IDOR 방어는 **"URL 로 몰 id 를 받지 않는다 + 모든 몰-스코프 쿼리의 WHERE 에 mall_id 를
 * 동반한다"** 두 문장에 전부 걸려 있다. 둘 다 **사람이 한 줄 빼먹으면 조용히 뚫리는** 종류다
 * (에러가 안 나고, 테스트가 없으면 리뷰에서만 걸린다).
 *
 * ## ⚠️ 이 테스트가 **못 막는 것** (과신 금지)
 * - `requireAuth()` 미들웨어가 실제로 인증을 강제하는지 — 런타임 동작이라 여기선 못 본다.
 * - `resolveOperatorMall` 이 진짜로 남의 몰을 안 돌려주는지 — D1 실행이 필요하다.
 * - 어드민이 지정한 `operator_user_id` 가 저장되는지 — 실제 PATCH/INSERT 왕복이 필요하다.
 * ⇒ 위 셋은 **스테이징 실호출로만 판정된다**(핸드오프 스모크 6단계 참조).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MALL_OPERATOR_TERMS, MALL_OPERATOR_TERMS_VERSION } from '@/shared/mall/operator-terms'
import { RESERVED_SLUGS } from '@/shared/mall/slug'

const ROUTES = 'src/features/mall/api/mall-admin.routes.ts'
const src = readFileSync(ROUTES, 'utf-8')

describe('몰 운영자 약관(승낙형 전자계약)', () => {
  it('버전 문자열과 조항 본문이 존재한다', () => {
    expect(MALL_OPERATOR_TERMS_VERSION.trim()).not.toBe('')
    expect(MALL_OPERATOR_TERMS.length).toBeGreaterThan(0)
    // 요약만 보여주고 동의받지 않는다 — 각 조항이 실제 본문을 갖는다.
    for (const t of MALL_OPERATOR_TERMS) {
      expect(t.title.trim()).not.toBe('')
      expect(t.body.trim().length).toBeGreaterThan(20)
    }
  })

  it('서버가 버전을 찍는다 — 클라가 보낸 버전을 쓰지 않는다', () => {
    // 동의 기록의 버전 인자가 상수여야 한다. body.version 을 그대로 넘기면 위조 가능.
    expect(src).toContain('version: MALL_OPERATOR_TERMS_VERSION')
    expect(src).not.toMatch(/version:\s*(body|String\(body)/)
  })

  it('기록 실패를 성공으로 보고하지 않는다', () => {
    // recordTermsConsent 는 fail-soft(terms-consent.ts) — write 실패해도 throw 안 한다.
    // 재조회로 실재를 확인하지 않으면 화면은 "동의 완료"인데 /me 는 미동의 → 무한 반복.
    expect(src).toContain('CONSENT_NOT_RECORDED')
  })
})

describe('몰 스코프 격리 (IDOR)', () => {
  it('URL 파라미터로 몰 id 를 받지 않는다', () => {
    // `/notices/:nid` 는 있어도 되지만 `:mallId` 류가 생기면 남의 몰을 지목할 손잡이가 된다.
    const params = [...src.matchAll(/c\.req\.param\('([^']+)'\)/g)].map((m) => m[1])
    expect(params).not.toContain('mallId')
    expect(params).not.toContain('id')
    expect(new Set(params)).toEqual(new Set(['nid']))
  })

  it('mall_notices 를 만지는 모든 SQL 이 mall_id 를 동반한다', () => {
    // INSERT 는 컬럼 목록에, SELECT/UPDATE/DELETE 는 WHERE 에 mall_id 가 있어야 한다.
    const stmts = [...src.matchAll(/`([^`]*mall_notices[^`]*)`|'([^']*mall_notices[^']*)'/g)]
      .map((m) => (m[1] ?? m[2]).replace(/\s+/g, ' ').trim())
    expect(stmts.length).toBeGreaterThan(0) // 측정 대상 0건이면 통과가 아니라 실패
    for (const s of stmts) {
      expect(s, `mall_id 미동반 쿼리: ${s}`).toMatch(/mall_id/)
    }
  })

  it('운영자가 아니면 403 — 몰의 존재 여부를 알려주지 않는다', () => {
    expect(src).toContain("code: 'NOT_OPERATOR'")
    // 403 응답이 몰 이름·id 를 흘리면 열거(enumeration)가 된다.
    expect(src).not.toMatch(/NOT_OPERATOR[^}]*mall\.(name|slug)/)
  })

  it('머니 경로를 건드리지 않는다', () => {
    for (const t of ['ledger_entries', 'payouts', 'seller_credits', 'orders', 'credit_transactions']) {
      expect(src, `머니 테이블 접촉: ${t}`).not.toContain(t)
    }
  })
})

describe('라우트 ↔ 예약 슬러그 드리프트', () => {
  it("'mall-admin' 이 예약어에 있다", () => {
    // 몰 슬러그는 `urdeal.kr/{슬러그}` 자리에 앉는다 — 예약 안 하면 이 라우트가 몰에 가려진다.
    expect(RESERVED_SLUGS).toContain('mall-admin')
  })
})
