/**
 * 🛡️ 2026-06-20 Pending-Auth fragment 채널 단위 테스트 (iOS 대시보드 로그인 자매수정).
 *
 * 서버 encodePendingAuth → 클라(auth-callback-bootstrap) 디코드 로직 round-trip 검증.
 * 한글 값(seller_name) UTF-8 보존 + 빈 값 제외 + 허용목록 게이트.
 */
import { describe, it, expect } from 'vitest'
import { encodePendingAuth } from '@/worker/utils/pending-auth'

// 클라 디코드 로직 미러 (auth-callback-bootstrap.ts 와 동일)
function decode(b64url: string): Record<string, unknown> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=')
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return JSON.parse(new TextDecoder().decode(bytes))
}
function applyAllowlist(obj: Record<string, unknown>): Record<string, string> {
  const ALLOW = /^(seller_|agency_|supplier_|is_distributor$|user_handle$|linked_seller_username$)/
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && ALLOW.test(k)) out[k] = v
  }
  return out
}

describe('Pending-Auth fragment 채널 (iOS-safe 역할 토큰 전달)', () => {
  it('seller 토큰 round-trip + 한글 이름(UTF-8) 보존', () => {
    const enc = encodePendingAuth({
      seller_token: 'eyJ.aaa.bbb',
      seller_id: 42,
      seller_name: '유어딜 가게',
      seller_username: 'mystore',
      is_distributor: '1',
    })
    expect(enc).not.toBe('')
    expect(enc).not.toMatch(/[+/=]/) // base64url (no +,/,=)
    const obj = decode(enc)
    expect(obj.seller_token).toBe('eyJ.aaa.bbb')
    expect(obj.seller_id).toBe('42') // 숫자→문자열 정규화
    expect(obj.seller_name).toBe('유어딜 가게')
    expect(obj.seller_username).toBe('mystore')
    expect(obj.is_distributor).toBe('1')
  })

  it('agency 토큰 + refresh round-trip', () => {
    const enc = encodePendingAuth({ agency_token: 'A.t', agency_refresh_token: 'A.r', agency_id: 7, agency_name: '에이전시' })
    const obj = decode(enc)
    expect(obj.agency_token).toBe('A.t')
    expect(obj.agency_refresh_token).toBe('A.r')
    expect(obj.agency_id).toBe('7')
  })

  it('빈/누락 값 제외, 전부 비면 빈 문자열', () => {
    expect(encodePendingAuth({})).toBe('')
    expect(encodePendingAuth({ seller_token: '', seller_id: undefined, seller_name: null })).toBe('')
    const obj = decode(encodePendingAuth({ seller_token: 'x', seller_name: '' }))
    expect(obj.seller_token).toBe('x')
    expect('seller_name' in obj).toBe(false)
  })

  it('허용목록: seller_/agency_/supplier_ 네임스페이스 + 명시 키만 통과 (미래 역할 자동)', () => {
    const enc = encodePendingAuth({
      seller_token: 'ok',
      supplier_token: 'ok2',       // 미래 네임스페이스 — 자동 통과
      is_distributor: '1',
      admin_token: 'EVIL',         // 비허용 — 차단되어야
      arbitrary_key: 'EVIL',       // 비허용 — 차단
    } as Record<string, string>)
    const applied = applyAllowlist(decode(enc))
    expect(applied.seller_token).toBe('ok')
    expect(applied.supplier_token).toBe('ok2')
    expect(applied.is_distributor).toBe('1')
    expect('admin_token' in applied).toBe(false)
    expect('arbitrary_key' in applied).toBe(false)
  })
})
