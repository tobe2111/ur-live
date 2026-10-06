/**
 * 🪦 **깨진 화면의 문을 닫는다** — `/seller/consignment` (2026-09-28)
 *
 * 라이브 D1 에 `consignment_partnerships` **테이블이 없다**(마이그레이션 `0236` 은 레포에 있으나
 * D1 마이그레이션이 CI 에서 안 돈다 — `TECHNICAL_DEBT.md` 의 알려진 부채, `repair-schema` 에도 없다).
 * ⇒ 페이지를 열면 API 일곱 개가 전부 `no such table` 로 죽는다.
 * 진입점이 0이라 아무도 신고하지 않았을 뿐이다.
 *
 * ## ⚠️ 이 시험이 **고정하지 않는 것** (중요)
 * 기능을 없앤 게 아니라 **문만 닫았다.** API 5개 · `checkout.ts` 자동 매핑 · 정비 cron ·
 * 어드민 모니터링 · 운영 가이드 두 절(분배율 포함)은 **그대로 살아 있어야 한다** —
 * 살릴지 없앨지는 대표 판단이고(`docs/decisions/2026-09-28-dead-seller-screens.md`)
 * 위탁 정산은 머니 경로다. 그래서 아래 마지막 두 건이 **"지우지 말 것"** 을 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const ROUTES = readCode('src/routes/seller.routes.tsx')
const CHECKOUT = readCode('src/worker/utils/checkout.ts')

describe('위탁 판매 — 문만 닫았다', () => {
  it('🔴 `/seller/consignment` 은 페이지 대신 리다이렉트다', () => {
    expect(ROUTES).toMatch(/path="\/seller\/consignment" element=\{<Navigate to="\/seller" replace \/>\}/)
  })

  it('🔴 깨진 페이지를 더 이상 싣지 않는다', () => {
    expect(ROUTES).not.toContain('SellerConsignmentPage')
  })

  it('🛡️ 결제 경로의 자동 매핑은 **그대로 있다** (기능을 없앤 게 아니다)', () => {
    // ⚠️ 부분일치로 재면 `consignment_partnerships_REMOVED` 같은 개명이 통과한다(주입이 잡았다).
    expect(CHECKOUT).toMatch(/\bFROM consignment_partnerships\b/)
    expect(CHECKOUT).toMatch(/\bconsignment_id\b/)
  })

  it('🛡️ 그 조회는 테이블이 없어도 결제를 안 깨뜨린다 (오늘 안전한 이유)', () => {
    // `catch` 가 사라지면 테이블 없는 환경에서 **주문 생성이 통째로 실패**한다.
    // ⚠️ 주석으로 앵커하지 않는다 — `readCode` 가 주석을 걷어낸다(첫 판이 그래서 헛돌았다).
    //    try 블록 **안에** 그 조회가 있는지 구조로 본다.
    const at = CHECKOUT.indexOf('consignment_partnerships')
    expect(at, '조회 자체가 사라졌다').toBeGreaterThan(0)
    // ⚠️ 파일 어딘가의 `try` 를 주워 오면 안 된다 — 이 조회를 **감싸는** try 여야 한다.
    //    (주입 `try {` → `if (true) {` 가 그 느슨함을 잡았다: 앞쪽 다른 try 를 집어 통과했다.)
    const before = CHECKOUT.slice(Math.max(0, at - 400), at)
    expect(before, '이 조회를 감싸는 try 가 없다').toContain('try {')
    expect(before.slice(before.lastIndexOf('try {'))).not.toContain('catch')
    expect(CHECKOUT.slice(at)).toMatch(/^[\s\S]{0,900}\}\s*catch/) // 그 뒤에 catch 가 닫는다
  })
})
