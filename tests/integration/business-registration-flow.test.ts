/**
 * Integration Tests — 사업자등록증 검증 e2e (submit → admin verify/reject).
 *
 * 2026-05-20 신규 기능. MSW 핸들러는 tests/mocks/handlers.ts 에 정의.
 */

import { describe, it, expect } from 'vitest'

describe('Business registration flow', () => {
  describe('POST /api/seller/business-registration/submit', () => {
    it('image_url 누락 시 400', async () => {
      const resp = await fetch('/api/seller/business-registration/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_number: '123-45-67890' }),
      })
      expect(resp.status).toBe(400)
      const body = await resp.json()
      expect(body.success).toBe(false)
    })

    it('잘못된 URL 형식 (data:/javascript:/...) 차단', async () => {
      const resp = await fetch('/api/seller/business-registration/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: 'javascript:alert(1)' }),
      })
      expect(resp.status).toBe(400)
    })

    it('정상 제출 시 status=pending', async () => {
      const resp = await fetch('/api/seller/business-registration/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: 'https://i.ibb.co/abc/biz.jpg',
          business_number: '123-45-67890',
        }),
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(body.status).toBe('pending')
    })
  })

  describe('PATCH /api/admin/sellers/:id/business-registration/verify', () => {
    it('숫자 아닌 ID 거부', async () => {
      const resp = await fetch('/api/admin/sellers/abc/business-registration/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      })
      expect(resp.status).toBe(400)
    })

    it('action 누락/잘못 — 400', async () => {
      const resp = await fetch('/api/admin/sellers/1/business-registration/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),  // 'verify' / 'reject' 만 허용
      })
      expect(resp.status).toBe(400)
    })

    it('reject 시 reason 필수', async () => {
      const resp = await fetch('/api/admin/sellers/1/business-registration/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      })
      expect(resp.status).toBe(400)
    })

    it('verify 정상 성공', async () => {
      const resp = await fetch('/api/admin/sellers/42/business-registration/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('승인')
    })

    it('reject + reason — 정상 성공', async () => {
      const resp = await fetch('/api/admin/sellers/42/business-registration/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: '이미지가 흐려서 식별 불가' }),
      })
      expect(resp.status).toBe(200)
      const body = await resp.json()
      expect(body.success).toBe(true)
      expect(body.message).toContain('반려')
    })
  })
})
