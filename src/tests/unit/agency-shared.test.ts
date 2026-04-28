/**
 * 🛡️ 2026-04-28: agency-shared / seller-shared helper 단위 테스트
 *
 * 13개 분할 파일에서 자체 정의했던 helper 들을 lib/* 로 추출. 통합 후 동작
 * 동등성 검증 — verifyAgencyToken / getBearerToken / getSellerIdFromToken.
 */
import { describe, it, expect } from 'vitest'
import { sign } from 'hono/jwt'
import { verifyAgencyToken, getBearerToken } from '@/lib/agency-shared'
import { getSellerIdFromToken } from '@/lib/seller-shared'

const SECRET = 'test-secret-for-shared-helpers'

async function makeAgencyToken(id: number, email: string, type = 'agency'): Promise<string> {
  return sign({ sub: String(id), email, type, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
}

async function makeSellerToken(seller_id: number): Promise<string> {
  return sign({ seller_id, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
}

describe('verifyAgencyToken', () => {
  it('정상 토큰 → payload 반환', async () => {
    const tok = await makeAgencyToken(42, 'a@b.com')
    const r = await verifyAgencyToken(SECRET, tok)
    expect(r?.id).toBe(42)
    expect(r?.email).toBe('a@b.com')
  })

  it('잘못된 secret → null', async () => {
    const tok = await makeAgencyToken(42, 'a@b.com')
    const r = await verifyAgencyToken('wrong-secret', tok)
    expect(r).toBe(null)
  })

  it('type !== agency → null (셀러 토큰 거부)', async () => {
    const tok = await makeAgencyToken(42, 'a@b.com', 'seller')
    const r = await verifyAgencyToken(SECRET, tok)
    expect(r).toBe(null)
  })

  it('빈 토큰 → null', async () => {
    expect(await verifyAgencyToken(SECRET, '')).toBe(null)
  })

  it('garbage 토큰 → null', async () => {
    expect(await verifyAgencyToken(SECRET, 'not.a.jwt')).toBe(null)
  })
})

describe('getBearerToken', () => {
  it('"Bearer xyz" → "xyz"', () => {
    expect(getBearerToken('Bearer abc123')).toBe('abc123')
  })

  it('Bearer prefix 없음 → null', () => {
    expect(getBearerToken('abc123')).toBe(null)
    expect(getBearerToken('Basic abc123')).toBe(null)
  })

  it('undefined → null', () => {
    expect(getBearerToken(undefined)).toBe(null)
  })
})

describe('getSellerIdFromToken', () => {
  it('정상 토큰 → seller_id', async () => {
    const tok = await makeSellerToken(99)
    const r = await getSellerIdFromToken('Bearer ' + tok, SECRET)
    expect(r).toBe(99)
  })

  it('Bearer prefix 없음 → null', async () => {
    const tok = await makeSellerToken(99)
    expect(await getSellerIdFromToken(tok, SECRET)).toBe(null)
  })

  it('undefined → null', async () => {
    expect(await getSellerIdFromToken(undefined, SECRET)).toBe(null)
  })

  it('seller_id 없는 payload → null', async () => {
    const tok = await sign({ user_id: 1, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
    expect(await getSellerIdFromToken('Bearer ' + tok, SECRET)).toBe(null)
  })

  it('잘못된 secret → null', async () => {
    const tok = await makeSellerToken(99)
    expect(await getSellerIdFromToken('Bearer ' + tok, 'wrong')).toBe(null)
  })
})
