/**
 * 💸 2026-11-17 지급 금액을 셀 때 "이미 나간 돈" 조회 실패를 0 으로 치지 않는다 — 대표 승인 "고침".
 *
 * 0 으로 치면: 주간 생성은 모든 payee 에게 **전기간 누적액** pending 을 새로 만들고(중복 검사는 같은 기간만),
 * 승인 가드는 초과 지급을 통과시키고, 잔액 헬퍼는 과대 금액을 보여 준다.
 *
 * 못 막는 것: 다른 이름의 새 조회가 같은 `.catch(() => ({ total: 0 }))` 를 다는 것(파일별 고정만 한다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const GEN = read('src/worker/cron/payouts-generate.ts')
const ADM = read('src/features/admin/api/admin-payouts.routes.ts')
const LED = read('src/worker/utils/ledger.ts')

describe('지급 — 조회 실패는 0원이 아니다', () => {
  it('주간 생성: 지급분 조회가 실패를 빈 목록으로 삼키지 않는다', () => {
    const line = GEN.split('\n').find((l) => l.includes('DB.prepare(payoutPaidSql())')) || ''
    expect(line).not.toBe('')
    expect(line).not.toMatch(/\.catch\(/)
  })

  it('승인: 잔액을 못 쟀으면 503 으로 멈춘다(가드 건너뛰기 금지)', () => {
    // 🔀 2026-11-25: 판정이 `payout-sent.ts` `checkPayoutWithinReceivable` 로 옮겨졌다(일괄 승인·송금 완료·이체 파일 공용). 두 자리를 같이 본다.
    const SENT = read('src/worker/utils/payout-sent.ts')
    const fn = SENT.slice(SENT.indexOf('export async function checkPayoutWithinReceivable('), SENT.indexOf('export async function checkPayoutWithinReceivable(') + 1800)
    expect(fn).toMatch(/catch \{\s*return \{ ok: false, code: 'RECEIVABLE_CHECK_FAILED'/)
    expect(fn).not.toMatch(/first<\{ total: number \}>\(\)\.catch\(/)
    expect(ADM).toMatch(/within\.code === 'RECEIVABLE_CHECK_FAILED' \? 503 : 409/)
    expect(ADM).not.toMatch(/catch \{ \/\* getLedgerReceivable 실패 시 가드 skip/)
  })

  it('잔액 헬퍼 두 개가 지급분 실패를 0 으로 치지 않는다', () => {
    const fn = (name: string) => LED.slice(LED.indexOf(`export async function ${name}(`), LED.indexOf(`export async function ${name}(`) + 1400)
    for (const n of ['getUnsettledBalance', 'getPayablePending']) {
      expect(fn(n), n).not.toMatch(/\.catch\(\(\) => \(\{ total: 0 \}\)\)/)
    }
  })
})
