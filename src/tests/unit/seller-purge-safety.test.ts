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
// 🧱 2026-09-04: purge 라우트는 `admin-sellers/purge-seller.ts` 로 분리됐다(file-size 래칫).
//    ⚠️ 분리하면서 이 상수를 안 나누면 "낡은 지도"가 된다 — 실제로 분리 직후 이 시험이 통째로 빨간불이었다.
const PURGE = codeOnly(readFileSync('src/features/admin/api/admin-sellers/purge-seller.ts', 'utf-8'))

describe('매장 완전 삭제 — 서버가 직접 빈 매장을 확인한다', () => {
  it('purge 엔드포인트가 존재하고 라우터에 배선돼 있다', () => {
    expect(PURGE).toContain("adminSellersRoutes.delete('/sellers/:id/purge'")
    // 🔴 선언과 배선은 다른 일이다 — 등록 호출이 빠지면 모듈은 멀쩡한데 라우트가 없다.
    expect(SRC).toMatch(/registerSellerPurgeRoute\(adminSellersRoutes, safeAdminError\)/)
    expect(PURGE.length, 'purge 블록을 못 잘랐다 — 이 시험이 헛돈다').toBeGreaterThan(500)
  })

  it('super 권한 + 2FA 뒤에 있다', () => {
    // 되돌릴 수 없는 파괴적 작업이 일반 어드민 토큰만으로 실행되면 안 된다.
    // ⚠️ 파일 앞 400자는 import 다(분리 모듈이라). 라우트 선언에서 앵커를 잡는다.
    const at = PURGE.indexOf("adminSellersRoutes.delete('/sellers/:id/purge'")
    expect(at, '라우트 선언을 못 찾았다').toBeGreaterThan(0)
    const decl = PURGE.slice(at, at + 300)
    expect(decl).toMatch(/requireAdminRole\('super'\)/)
    expect(decl).toMatch(/require2FA\(\)/)
  })

  it('상품·주문·운영자·정산·원장을 전부 확인한다', () => {
    for (const t of ['products', 'orders', 'seller_operators', 'settlements', 'ledger_entries']) {
      expect(PURGE, `${t} 잔여물 검사가 없다`).toContain(t)
    }
  })

  it('🔴 돈이 오간 흔적은 cascade 로도 못 지운다', () => {
    // cascade 는 상품·운영자·유저연결만 덮는다. 주문·이용권·정산·원장·후원·교환권발송은 **분기 밖**에서
    // 검사돼야 하고, `if (!cascade)` 안으로 들어가면 cascade 한 번에 매출 있는 매장이 사라진다.
    const gate = PURGE.indexOf('if (!cascade) {')
    expect(gate, 'cascade 분기를 못 찾았다').toBeGreaterThan(0)
    for (const money of [
      '주문 ${ords}건', '이용권 ${vch}건', '정산 ${stl}건', '원장 ${led}건',
      '후원 ${dons}건', '교환권 발송 ${vord}건',
    ]) {
      const at = PURGE.indexOf(money)
      // 🩸 2026-09-06: 원래 `toBeLessThan(gate)` 만 봤는데, **없으면 -1 이라 그 조건이 참**이다.
      //   즉 push 줄을 통째로 지워도 초록이었다 — 주입 검증이 그걸 잡았다(가드가 지키는 척만 함).
      //   그래서 "있다"를 먼저 본다.
      expect(at, `${money} 검사 자체가 없다`).toBeGreaterThan(0)
      expect(at, `${money} 검사가 cascade 분기 뒤에 있다`).toBeLessThan(gate)
    }
  })

  /**
   * 🩸 2026-09-06 — **라이브에서 실제로 났다.** 대표 지시로 매장 10곳을 지우다 두 곳이 500 을 냈고,
   * 원인이 아래 둘이었다. 둘 다 "테스트가 없어서" 가 아니라 **테이블을 빠뜨려서** 생긴 구멍이다.
   */
  describe('라이브 실행이 드러낸 구멍 두 개', () => {
    it('🔴 후원·교환권 발송도 머니 잔여물로 센다', () => {
      // donations 는 FK 가 RESTRICT 라 DB 가 막아 500 이 났다 — **운이지 설계가 아니다.**
      // voucher_orders 는 ON DELETE CASCADE 라 매장과 함께 **조용히 사라진다**(더 나쁜 쪽).
      expect(PURGE, 'donations 검사가 없다').toMatch(/FROM donations WHERE seller_id/)
      expect(PURGE, 'voucher_orders 검사가 없다').toMatch(/FROM voucher_orders WHERE seller_id/)
    })

    it('🔴 seller_business_info 를 함께 지운다 (안 지우면 매장이 안 지워진다)', () => {
      // FK 에 ON DELETE 절이 없어 RESTRICT 다. 남아 있으면 sellers DELETE 가 던지고,
      // safeAdminError 가 "Internal server error" 로 덮어 원인이 안 보인다.
      const del = PURGE.indexOf('DELETE FROM seller_business_info')
      expect(del, 'seller_business_info 정리가 없다').toBeGreaterThan(0)
      expect(del, '매장 삭제보다 뒤에 있으면 소용없다').toBeLessThan(PURGE.indexOf('DELETE FROM sellers'))
    })

    it('🔴 부수 머니 삭제는 명시 플래그 + cascade 둘 다 있어야 한다', () => {
      // 2026-09-06 대표가 내용을 알고 다시 지시해 만든 문이다. 실수로 열리면 안 되므로
      // `cascade &&` 가 앞에 붙는다 — 플래그만 단독으로 붙여서는 아무 일도 안 일어난다.
      expect(PURGE).toMatch(/const purgeAncillary = cascade && \/\^\(1\|true\|yes\)/)
    })

    it('🔴 이 플래그로도 주문·이용권·정산·원장은 못 지운다', () => {
      // 후원·교환권 발송만 `if (!purgeAncillary)` 안에 있다. 나머지 다섯의 push 가 그 블록
      // **밖**에 있어야 한다 — 안으로 들어가면 플래그 하나로 정산 있는 매장이 사라진다.
      const soft = PURGE.indexOf('if (!purgeAncillary) {')
      const softEnd = PURGE.indexOf('}', PURGE.indexOf('교환권 발송 ${vord}건'))
      expect(soft, 'purgeAncillary 분기를 못 찾았다').toBeGreaterThan(0)
      const lines = PURGE.split('\n')
      for (const hard of ['주문 ${ords}건', '주문항목 ${items}건', '이용권 ${vch}건', '정산 ${stl}건', '원장 ${led}건']) {
        const at = PURGE.indexOf(hard)
        expect(at, `${hard} 검사 자체가 없다`).toBeGreaterThan(0)
        // ① 블록 **밖**에 있어야 한다.
        expect(at < soft || at > softEnd, `${hard} 가 purgeAncillary 블록 안으로 들어갔다`).toBe(true)
        // ② 🩸 위치만 보면 안 된다 — 주입 검증이 잡았다. 같은 줄에 `&& !purgeAncillary` 를
        //    끼워 넣으면 자리는 그대로인데 조건은 풀린다. **줄 자체**를 본다.
        const line = lines.find(l => l.includes(hard)) || ''
        expect(line, `${hard} 조건에 purgeAncillary 가 끼어들었다: ${line.trim()}`).not.toContain('purgeAncillary')
      }
    })

    it('🔴 지우기 전에 행 전문을 감사 로그에 박제한다 (사본 없이 안 지운다)', () => {
      // 개수가 아니라 **내용**이어야 한다 — 감사 로그가 유일한 사본이 된다.
      expect(PURGE).toMatch(/SELECT \* FROM donations WHERE seller_id/)
      expect(PURGE).toMatch(/SELECT \* FROM voucher_orders WHERE seller_id/)
      expect(PURGE).toMatch(/ancillary_money/)
      // 순서: 박제(writeAuditLog) → 삭제. 뒤집히면 실패 시 사본 없이 지운 것이 된다.
      const snap = PURGE.indexOf('SELECT * FROM donations')
      // ⚠️ 맨 위 import 줄에도 이 이름이 있다 — **호출부**로 앵커를 잡는다(실제로 한 번 걸렸다).
      const audit = PURGE.indexOf('writeAuditLog(c, {')
      const del = PURGE.indexOf('DELETE FROM donations')
      expect(snap, '스냅샷이 없다').toBeGreaterThan(0)
      expect(snap, '스냅샷이 감사 로그보다 뒤에 있다').toBeLessThan(audit)
      expect(audit, '삭제가 감사 로그보다 앞에 있다').toBeLessThan(del)
    })

    it('🔴 마지막 매장 삭제 실패를 삼키지 않는다 (500 대신 이유를 말한다)', () => {
      // 500 은 "우리가 모른다"는 뜻이다. 모르는 채로 다시 누르게 하면 부분 적용이 쌓인다
      // (실제로 매장 5는 상품 9건이 지워진 채 매장만 남았다).
      const tail = PURGE.slice(PURGE.indexOf('DELETE FROM seller_business_info'))
      expect(tail, '마지막 DELETE 가 try 로 감싸여 있지 않다').toMatch(/try\s*\{[\s\S]{0,200}DELETE FROM sellers/)
      expect(tail).toMatch(/products_deleted/)
    })
  })

  it('cascade 로 상품을 지우다 남으면 매장 삭제를 중단한다 (고아 상품 방지)', () => {
    expect(PURGE).toMatch(/products_left/)
    expect(PURGE.indexOf('products_left')).toBeLessThan(PURGE.indexOf('DELETE FROM sellers'))
  })

  it('잔여물이 있으면 409 로 거부한다 (지우지 않는다)', () => {
    expect(PURGE).toMatch(/blockers\.length > 0/)
    expect(PURGE).toMatch(/\}, 409\)/)
    // 거부 분기가 DELETE 보다 **앞**에 있어야 한다 — 뒤면 이미 지운 뒤다.
    expect(PURGE.indexOf('409')).toBeLessThan(PURGE.indexOf('DELETE FROM sellers'))
  })

  it('연결된 유저 계정은 기본 거부, cascade 에서만 통과한다', () => {
    const gate = PURGE.indexOf('if (!cascade) {')
    expect(PURGE.indexOf('seller.linked_user_id')).toBeGreaterThan(gate)
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
