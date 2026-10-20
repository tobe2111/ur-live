/**
 * 💸 **결제된 주문인데 `payment_status` 가 안 찍히던 것** (2026-09-21)
 *
 * 공구·장바구니·checkout 경로가 `status='PAID'` 만 쓰고 `payment_status` 를 안 써서 컬럼 기본값
 * `'pending'` 에 머물렀다. 그 값을 `'approved'` 로 읽는 곳들이 그 주문을 **통째로 비켜 갔다**:
 *
 *   • 소비자 환불 요청이 400 으로 막힘 — `order.routes` *"결제가 완료되지 않은 주문입니다"*
 *     (돈은 이미 냈는데). 셀러가 대신 하는 `refundOrderFully` 경로엔 이 검사가 없어 됐다.
 *   • `ops-daily-digest`(어제 매출) · `seller-daily-report` · `seller-tier-eval` ·
 *     `anomaly-detect` · `daily-self-diagnostic` · 온보딩 `first_payment` 에서 누락.
 *
 * 쇼핑 경로는 2026-04-22 에 같은 이유로 이미 고쳐졌고(`order.repository` 주석 *"pending 인 채
 * 남아서 환불/정산 로직 오작동"*) **공구 경로만 안 고쳐져 있었다.**
 *
 * ## 이 테스트가 못 막는 것
 * - 실제 결제가 이 값을 남기는지는 **staging 실결제**만 판정한다(SQL 문자열만 본다).
 * - 라이브 CHECK 제약(`pending·approved·failed·cancelled·refunded`)은 D1 에만 있다 —
 *   여기선 그 허용 집합을 타입으로만 고정하고, 제약 위반은 `check-status-constraints` 가 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const code = (p: string) => stripComments(readFileSync(p, 'utf8'))

/** `INSERT INTO orders (...) VALUES (...)` 한 쌍을 컬럼↔값으로 짝지어 돌려준다. */
function orderInserts(src: string): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = []
  const re = /INSERT INTO orders\s*\(([^)]*)\)\s*(?:\r?\n\s*)?VALUES\s*\(([^)]*)\)/gi
  for (const m of src.matchAll(re)) {
    const cols = m[1].split(',').map((c) => c.trim())
    const vals = m[2].split(',').map((v) => v.trim())
    if (cols.length !== vals.length) continue
    out.push(Object.fromEntries(cols.map((c, i) => [c, vals[i]])))
  }
  return out
}

/** 결제가 실제로 일어난 INSERT 인가(= `status` 자리에 PAID 리터럴이 박혀 있는가). */
const isPaidInsert = (row: Record<string, string>) => /^'PAID'$/i.test(row.status || '')

/**
 * ⚠️ `checkout.ts` 는 여기 없다 — 그 파일만 `status` 를 리터럴이 아니라 `?` 로 바인드해서
 *   위 `isPaidInsert` 가 못 잡는다(테스트를 처음 쓸 때 실제로 빨간불로 알려 줬다).
 *   한 정규식으로 우겨넣는 대신 아래에 그 파일 모양에 맞는 검사를 따로 뒀다.
 */
const PAID_INSERT_FILES = [
  'src/features/group-buy/api/group-buy.routes.ts',
  'src/features/group-buy/api/cart-checkout.routes.ts',
]

describe('① 결제된 주문은 payment_status 를 남긴다', () => {
  it.each(PAID_INSERT_FILES)('%s 의 PAID INSERT 가 모두 approved 를 쓴다', (file) => {
    const paid = orderInserts(code(file)).filter(isPaidInsert)
    expect(paid.length).toBeGreaterThan(0) // 0건이면 통과가 아니라 **앵커가 낡은 것**이다
    for (const row of paid) {
      expect(row.payment_status).toBe("'approved'")
    }
  })

  it('checkout.ts 도 — 컬럼 목록과 bind 에 나란히 들어간다(이 파일만 status 가 바인드값)', () => {
    const c = code('src/worker/utils/checkout.ts')
    const ins = c.match(/INSERT INTO orders \(([^)]*)\)/)
    expect(ins).toBeTruthy()
    const cols = ins![1].split(',').map((x) => x.trim())
    expect(cols.indexOf('payment_status')).toBe(cols.indexOf('status') + 1)
    expect(c).toMatch(/\.bind\([^)]*'PAID',\s*'approved'/)
  })

  it('공구 경로에 PAID INSERT 가 둘 다 살아 있다(딜·카드)', () => {
    const paid = orderInserts(code('src/features/group-buy/api/group-buy.routes.ts')).filter(isPaidInsert)
    expect(paid.length).toBe(2)
  })

  it('0원 체험단은 건드리지 않는다 — 매출·first_payment 에 섞이면 안 된다', () => {
    const rows = orderInserts(code('src/features/group-buy/api/experience-campaign.routes.ts'))
    expect(rows.length).toBe(1)
    expect(rows[0].payment_status).toBeUndefined()
    expect(rows[0].payment_method).toBe("'experience'")
  })

  it('아직 결제 전인 INSERT 에 approved 를 찍지 않는다', () => {
    for (const f of ['src/features/orders/repositories/OrderRepository.ts', 'src/features/group-buy/api/stays-public.routes.ts']) {
      for (const row of orderInserts(code(f))) {
        if (/^'PENDING'$/i.test(row.status || '')) expect(row.payment_status ?? "'pending'").toBe("'pending'")
      }
    }
  })
})

describe('② 환불하면 되돌린다 (머니 룰 #2 — 적립엔 역전이 따른다)', () => {
  it('공유 환불 루틴의 CAS 전이가 payment_status 를 refunded 로 쓴다', () => {
    const c = code('src/worker/utils/order-refund.ts')
    const m = c.match(/transitionOrderStatus\([\s\S]{0,400}?extraSets:\s*\{([^}]*)\}/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/payment_status:\s*'refunded'/)
  })

  it('소비자 환불 요청 경로도 같이 되돌린다', () => {
    const c = code('src/worker/routes/order.routes.ts')
    const m = c.match(/updateStatusById\([^,]+,\s*'REFUNDED',\s*\{([\s\S]*?)\}\)/)
    expect(m).toBeTruthy()
    expect(m![1]).toMatch(/payment_status:\s*'refunded'/)
  })

  it('저장소가 그 값을 실제로 SET 한다 — 타입만 받고 버리면 조용히 안 된다', () => {
    const c = code('src/worker/repositories/order.repository.ts')
    expect(c).toMatch(/setFields\.push\('payment_status = \?'\)/)
  })
})

describe('③ 기존 행 backfill — 모르면 안 바꾼다', () => {
  const step = () => {
    const c = code('src/worker/routes/repair-schema/column-repairs.ts')
    const m = c.match(/backfill: orders\.payment_status[\s\S]*?sql:\s*`([\s\S]*?)`/)
    expect(m).toBeTruthy()
    return m![1]
  }

  it('결제 흔적이 있는 행만 고친다', () => {
    const sql = step()
    expect(sql).toMatch(/payment_key IS NOT NULL/)
    expect(sql).toMatch(/toss_payment_key IS NOT NULL/)
    expect(sql).toMatch(/payment_method = 'deal_points'/)
  })

  it('CANCELLED 는 건드리지 않는다 — 결제 전 취소와 결제 후 취소가 섞여 있다', () => {
    const sql = step()
    expect(sql).toMatch(/UPPER\(status\) IN \('PAID', 'DONE', 'DELIVERED'\)/)
    expect(sql).not.toMatch(/CANCELLED/)
  })

  it('멱등 — pending 인 행만 건드리므로 반복 실행해도 같다', () => {
    expect(step()).toMatch(/COALESCE\(payment_status, 'pending'\) = 'pending'/)
  })
})
