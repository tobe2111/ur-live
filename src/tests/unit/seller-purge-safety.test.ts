/**
 * 🗑️ 2026-09-04 — 매장 **완전 삭제**(`DELETE /api/admin/sellers/:id/purge`)의 안전 규칙.
 *
 * 대표 *"매장 홍대돈가스 말고는 다 삭제해"* 로 만든 도구다. 되돌릴 수 없는 작업이라
 * **"빈 매장이다"를 서버가 직접 확인**해야 한다 — 호출자(어드민 화면·스크립트)의 판단을 믿지 않는다.
 *
 * ## 이 테스트가 못 막는 것
 * 실제 SQL 이 옳은지(런타임)는 못 본다 — 소스에 그 검사가 **있는지**만 본다.
 * 잔여물 종류가 늘어나면(예: 새 정산 테이블) 여기와 라우트 둘 다 고쳐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const SRC = codeOnly(readFileSync('src/features/admin/api/admin-sellers.routes.ts', 'utf-8'))
const PURGE = SRC.slice(SRC.indexOf("adminSellersRoutes.delete('/sellers/:id/purge'"))

describe('매장 완전 삭제 — 서버가 직접 빈 매장을 확인한다', () => {
  it('purge 엔드포인트가 존재한다', () => {
    expect(SRC).toContain("adminSellersRoutes.delete('/sellers/:id/purge'")
    expect(PURGE.length, 'purge 블록을 못 잘랐다 — 이 시험이 헛돈다').toBeGreaterThan(500)
  })

  it('super 권한 + 2FA 뒤에 있다', () => {
    // 되돌릴 수 없는 파괴적 작업이 일반 어드민 토큰만으로 실행되면 안 된다.
    expect(PURGE.slice(0, 400)).toMatch(/requireAdminRole\('super'\)/)
    expect(PURGE.slice(0, 400)).toMatch(/require2FA\(\)/)
  })

  it('상품·주문·운영자·정산·원장을 전부 확인한다', () => {
    for (const t of ['products', 'orders', 'seller_operators', 'settlements', 'ledger_entries']) {
      expect(PURGE, `${t} 잔여물 검사가 없다`).toContain(t)
    }
  })

  it('잔여물이 있으면 409 로 거부한다 (지우지 않는다)', () => {
    expect(PURGE).toMatch(/blockers\.length > 0/)
    expect(PURGE).toMatch(/\}, 409\)/)
    // 거부 분기가 DELETE 보다 **앞**에 있어야 한다 — 뒤면 이미 지운 뒤다.
    expect(PURGE.indexOf('409')).toBeLessThan(PURGE.indexOf('DELETE FROM sellers'))
  })

  it('연결된 유저 계정이 있으면 거부한다', () => {
    expect(PURGE).toMatch(/seller\.linked_user_id/)
  })

  it('🔴 count 조회 실패를 0 으로 읽지 않는다 (모르면 안 지운다)', () => {
    // `.catch(() => 0)` 같은 패턴이면 테이블 오류가 "잔여물 없음"으로 둔갑해 지워 버린다.
    expect(PURGE).toMatch(/no such table/)
    expect(PURGE).toMatch(/확인 실패/)
  })

  it('감사 로그를 남긴다', () => {
    expect(PURGE).toMatch(/action: 'purge_seller'/)
    expect(PURGE.indexOf("purge_seller")).toBeLessThan(PURGE.indexOf('DELETE FROM sellers'))
  })

  it('기존 soft delete(정지)는 그대로 산다', () => {
    // 매출 이력이 있는 매장은 여전히 정지만 가능해야 한다.
    expect(SRC).toMatch(/adminSellersRoutes\.delete\('\/sellers\/:id', cors\(\)/)
    expect(SRC).toContain("status = 'suspended'")
  })
})
