/**
 * 🩸 2026-11-18 alias 없는 SELECT 가 라이브에 없는 칸을 읽던 곳 — 대표 "남은 과제도 다 해주고 개선할 것들 더 찾아줘".
 *
 * 라이브 5xx 1위(`GET /api/seller/public/:id` — `kakao_chat_link`)를 쫓다가 같은 모양 42건을 찾았다.
 * 전부 라이브 D1 에서 `EXPLAIN` 으로 `no such column` 을 확인했다. 그중 사람이 쓰는 기능:
 *  - 전액 환불(손님 취소·어드민·셀러 공용 `refundOrderFully`)이 `orders.amount` 로 **매번 실패**(대표 승인 "고침")
 *  - 전화번호 입력창(PATCH /api/auth/profile)이 저장 뒤 `users.avatar_url` 로 실패처럼 보임
 *  - 상품 옵션이 늘 빈 목록 · 공구 영수증 메일 0통 · 체험단 이용권 셀러 null · FAQ 봇이 DB 를 못 읽음
 *
 * 지키는 것: ① 컬럼 가드(strict)가 초록 ② 고친 줄이 라이브 칸 이름을 쓴다.
 * 못 막는 것: 선택 목록에 함수·괄호·점이 섞인 문장(가드가 일부러 건너뛴다) · 동적 SQL.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const R = (p: string) => fs.readFileSync(p, 'utf8')

describe('alias 없는 SELECT 의 없는 칸', () => {
  it('컬럼 가드(strict)가 통과한다', () => {
    const out = execFileSync('node', ['scripts/check-sql-column-exists.mjs', '-s'], { encoding: 'utf8' })
    expect(out).toMatch(/존재하지 않는 컬럼 참조 없음/)
  })

  it('고친 줄이 라이브 칸 이름을 쓴다', () => {
    expect(R('src/worker/utils/order-refund.ts')).toMatch(/total_amount, toss_payment_key, payment_key, payment_method/)
    expect(R('src/features/seller/api/seller-management.routes.ts').match(/kakao_chat_url AS kakao_chat_link, status, created_at/g)?.length).toBe(2)
    expect(R('src/worker/routes/auth.routes.ts').match(/profile_image AS avatar_url/g)?.length).toBe(2)
    expect(R('src/features/products/api/products.routes.ts')).toMatch(/stock AS stock_quantity/)
    expect(R('src/features/group-buy/api/group-buy.routes.ts')).toMatch(/SELECT email, name AS display_name FROM users/)
    expect(R('src/features/guides/api/faq-bot.routes.ts')).toMatch(/section_title AS title, content_md AS content/)
  })
})
