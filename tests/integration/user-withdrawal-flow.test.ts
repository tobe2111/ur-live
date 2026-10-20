/**
 * Integration Tests — 사용자 현금 출금 (user_withdrawals, migration 0274).
 *
 * 검증:
 *  - 최소 10,000딜 / 최대 10,000,000딜 강제
 *  - 8.8% 원천징수 (소득세 8% + 지방세 0.8%) 정확 계산
 *  - 계좌 정보 필수
 */

import { describe, it, expect } from 'vitest'

const baseValidBody = {
  amount: 50000,
  bank_name: '국민은행',
  bank_account: '123-45-67890',
  account_holder: '홍길동',
}

describe('POST /api/points/withdraw', () => {
  it('amount < 10,000 거부', async () => {
    const resp = await fetch('/api/points/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseValidBody, amount: 9999 }),
    })
    expect(resp.status).toBe(400)
    const body = await resp.json()
    expect(body.error).toMatch(/10,?000/)
  })

  it('amount > 10,000,000 거부', async () => {
    const resp = await fetch('/api/points/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseValidBody, amount: 10_000_001 }),
    })
    expect(resp.status).toBe(400)
  })

  it('NaN/string amount 거부', async () => {
    const resp = await fetch('/api/points/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseValidBody, amount: 'abc' }),
    })
    expect(resp.status).toBe(400)
  })

  it('bank_name 누락 시 400', async () => {
    const resp = await fetch('/api/points/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseValidBody, bank_name: '   ' }),
    })
    expect(resp.status).toBe(400)
  })

  it('정상 — 8.8% 원천징수 계산 + net_amount 정확', async () => {
    const resp = await fetch('/api/points/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseValidBody),
    })
    expect(resp.status).toBe(200)
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data.amount).toBe(50000)
    // 8.8% = 4,400 (floor)
    expect(body.data.withholding_tax).toBe(4400)
    expect(body.data.net_amount).toBe(45600)
    expect(body.data.status).toBe('requested')
  })

  it('최소 한도 (10,000) 에서도 정확 계산', async () => {
    const resp = await fetch('/api/points/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...baseValidBody, amount: 10000 }),
    })
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data.withholding_tax).toBe(880)  // 10000 * 0.088
    expect(body.data.net_amount).toBe(9120)
  })
})
