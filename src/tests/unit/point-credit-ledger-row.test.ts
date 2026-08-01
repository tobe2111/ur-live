/**
 * 💸 2026-08-01 — **적립했는데 거래 기록이 없는 유저**가 생기던 자리.
 *
 * `creditFreePoints` 는 ① 잔액 upsert ② `point_transactions` INSERT 를 **따로** 한다.
 * ②가 실패해도 `catch {}` 로 삼키고 `true` 를 돌려줬다 → 잔액만 늘고 원장 행이 없다.
 * 라이브 실측으로 정확히 그 모양인 유저 3명을 확인했다(각 3,000·3,000·100딜, 거래합 0).
 * 정합 검사 cron 이 매일 잡아냈지만 원인을 못 찾던 이유가 이 catch 였다.
 *
 * 원인: 확장 컬럼(`points_amount`·`balance_after`·`order_id`·`free_delta`)이 base CREATE 에 없고
 * repair-schema 에도 `free_delta` 만 있었다 → 컬럼이 없는 배포 창에서 INSERT 가 통째로 실패.
 *
 * 그래서 **최소 컬럼 폴백**을 넣었다. 이 테스트는 그 폴백이 실제로 도는지 고정한다.
 *
 * ⚠️ 못 막는 것: 테이블 자체가 없으면 폴백도 실패한다(그건 repair-schema 소관). 그리고 이미
 *    어긋난 3명의 잔액은 **고치지 않는다** — 머니 교정은 사람이 판단할 일이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/worker/utils/point-buckets.ts', 'utf8')
const REPAIR = readFileSync('src/worker/routes/repair-schema.routes.ts', 'utf8')

describe('creditFreePoints — 잔액만 늘고 원장 행이 없는 사태 방지', () => {
  it('원장 INSERT 실패를 그냥 삼키지 않는다 (빈 catch 금지)', () => {
    // 예전 코드: `} catch { /* audit fail-soft */ }` — 이게 3명을 만들었다.
    expect(SRC.includes('catch { /* audit fail-soft */ }'),
      '빈 catch 가 되살아났다 — 적립만 되고 기록이 사라진다').toBe(false)
  })

  it('실패 시 최소 컬럼으로 다시 INSERT 한다 (SSOT 헬퍼 위임도 인정)', () => {
    // 폴백이 4곳에 복붙되던 것을 `recordPointTxMinimal`(point-ledger SSOT)로 모았다.
    // 호출부는 위임만 하면 되고, **실제 INSERT 는 SSOT 에 있어야** 한다(아래 테스트가 그걸 본다).
    const inlineOrDelegate = /INSERT INTO point_transactions \(user_id, type, amount, description\)|recordPointTxMinimal\s*\(/
    expect(inlineOrDelegate.test(SRC), '최소 컬럼 폴백도, SSOT 위임도 없다').toBe(true)
  })

  it('SSOT(`recordPointTxMinimal`)가 실제로 최소 컬럼 INSERT 를 한다', () => {
    // 위임만 하고 SSOT 가 비어 있으면 전부 무의미해진다 — 위임 검사와 짝이다.
    const ledger = readFileSync('src/worker/utils/point-ledger.ts', 'utf8')
    expect(ledger, 'recordPointTxMinimal 이 없다').toContain('export async function recordPointTxMinimal')
    expect(ledger, 'SSOT 에 최소 컬럼 INSERT 가 없다')
      .toContain('INSERT INTO point_transactions (user_id, type, amount, description)')
  })

  it('기록 SSOT `recordPointTransaction` 도 실패를 그냥 삼키지 않는다', () => {
    // 이 함수가 `catch { return false }` 로 끝나던 것이 같은 사고의 상류였다.
    const ledger = readFileSync('src/worker/utils/point-ledger.ts', 'utf8')
    const tail = ledger.slice(ledger.indexOf('export async function recordPointTransaction'))
    expect(tail.slice(0, 1600), 'catch 에서 폴백 없이 false 만 돌려준다').toContain('recordPointTxMinimal(')
  })

  it('폴백이 base CREATE 가 보장하는 컬럼만 쓴다 (그래야 항상 성공한다)', () => {
    const create = /CREATE TABLE IF NOT EXISTS point_transactions \(([\s\S]*?)\)` \}/.exec(REPAIR)
    expect(create, 'repair-schema 에 point_transactions CREATE 가 없다').not.toBeNull()
    const cols = create![1]
    for (const c of ['user_id', 'type', 'amount', 'description']) {
      expect(cols.includes(c), `base CREATE 에 ${c} 가 없다 — 폴백이 실패할 수 있다`).toBe(true)
    }
  })

  it('전체 INSERT 가 쓰는 확장 컬럼이 전부 repair-schema 에 등록돼 있다', () => {
    // 등록이 빠지면 컬럼이 없는 환경에서 매번 폴백으로 떨어진다(= 정보 손실).
    for (const c of ['points_amount', 'balance_after', 'order_id', 'free_delta']) {
      expect(REPAIR.includes(`ADD COLUMN ${c}`), `point_transactions.${c} 가 repair-schema 에 없다`).toBe(true)
    }
  })
})

describe('원장 불일치 조사 경로 — 데이터가 없으면 아무도 못 고친다', () => {
  it('cron 이 상세를 DB 에 남긴다 (예전엔 콘솔로만 가서 몇 주간 조사 불가였다)', () => {
    const cron = readFileSync('src/worker/cron/ledger-integrity-check.ts', 'utf8')
    expect(cron).toContain('INSERT INTO frontend_errors (message, stack,')
  })

  it('cron 과 조회 API 가 같은 SQL 모듈을 쓴다 (두 벌이면 갈라진다)', () => {
    const cron = readFileSync('src/worker/cron/ledger-integrity-check.ts', 'utf8')
    const api = readFileSync('src/features/admin/api/admin-misc.routes.ts', 'utf8')
    expect(cron).toContain('ledger-integrity-checks')
    expect(api).toContain('ledger-integrity-checks')
  })
})
