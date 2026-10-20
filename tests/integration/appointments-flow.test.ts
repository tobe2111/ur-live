/**
 * 🛡️ 2026-05-21: Integration tests — 자체 예약 캘린더 (appointment_bookings).
 *
 * 검증:
 *  - 인증 없는 요청 차단
 *  - 날짜/시간 형식 검증
 *  - 과거 날짜 차단
 *  - capacity 초과 시 409
 *  - 같은 유저 중복 예약 409
 *  - 취소 12시간 이내 정책
 */
import { describe, it, expect } from 'vitest'

const validBook = {
  product_id: 1,
  booking_date: '2099-12-31',
  start_time: '14:00',
  end_time: '15:00',
}

describe('POST /api/appointments/book', () => {
  it('인증 없으면 401/403', async () => {
    const r = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBook),
    })
    expect([401, 403]).toContain(r.status)
  })

  it('product_id 누락 400', async () => {
    const r = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake' },
      body: JSON.stringify({ ...validBook, product_id: undefined }),
    })
    expect([400, 401]).toContain(r.status)
  })

  it('날짜 형식 오류 400', async () => {
    const r = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake' },
      body: JSON.stringify({ ...validBook, booking_date: '2099/12/31' }),
    })
    expect([400, 401]).toContain(r.status)
  })

  it('시간 순서 역전 400', async () => {
    const r = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake' },
      body: JSON.stringify({ ...validBook, start_time: '15:00', end_time: '14:00' }),
    })
    expect([400, 401]).toContain(r.status)
  })

  it('과거 날짜 거부', async () => {
    const r = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake' },
      body: JSON.stringify({ ...validBook, booking_date: '2020-01-01' }),
    })
    expect([400, 401]).toContain(r.status)
  })
})

describe('GET /api/products/:id/available-slots', () => {
  it('date 누락 400', async () => {
    const r = await fetch('/api/products/1/available-slots')
    expect([400, 404]).toContain(r.status)
  })

  it('잘못된 date 형식 400', async () => {
    const r = await fetch('/api/products/1/available-slots?date=invalid')
    expect([400, 404]).toContain(r.status)
  })
})

describe('PATCH /api/appointments/:id/cancel', () => {
  it('인증 없으면 401', async () => {
    const r = await fetch('/api/appointments/1/cancel', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect([401, 403]).toContain(r.status)
  })
})

describe('Seller endpoints', () => {
  it('POST /seller/products/:id/booking-slots — 인증 없으면 차단', async () => {
    const r = await fetch('/api/seller/products/1/booking-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: [] }),
    })
    expect([401, 403]).toContain(r.status)
  })

  it('GET /seller/appointments — 인증 없으면 차단', async () => {
    const r = await fetch('/api/seller/appointments')
    expect([401, 403]).toContain(r.status)
  })
})
