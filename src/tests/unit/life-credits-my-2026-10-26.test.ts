/**
 * 🏠 생활 견적 참여권 — 사장님 마이에서 잔액, `/life/pro` 에서 내역 (2026-10-26 대표
 *   *"그 참여권은 해당 생활 관련 서비스 사장님의 마이 페이지에서 갯수라던지 차감 히스토리라던지 확인할 수 있는건가?"*).
 * + 공유 페이지에서 로그인 전 업체가 누르면 **바로 카카오 로그인** → 업체 가입 화면.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

describe('마이 — 생활 업체면 참여권 잔액 줄', () => {
  const sum = readCode('src/features/seller/api/seller-operators.routes.ts')
  const sec = readCode('src/pages/user-profile/SellerSection.tsx')
  it('요약이 생활 업체 행에서만 잔액을 싣고, 아니면 null', () => {
    expect(sum).toMatch(/FROM home_service_pros p LEFT JOIN home_service_credit_balance b/)
    expect(sum).toMatch(/life_credits: lMap\.has\(s\.seller_id\) \? lMap\.get\(s\.seller_id\)! : null/)
  })
  it('테이블이 없는 DB 에서도 요약 전체가 실패하지 않는다', () => {
    expect(sum).toMatch(/home_service_credit_balance b ON[\s\S]{0,400}\.catch\(\(\) => \[\]/)
  })
  it('마이는 생활 업체일 때만, 판매 판 **밖** 별도 판으로 그린다', () => {
    expect(sec).toMatch(/\{store\?\.life_credits != null && \(\s*<div className=\{`\$\{LIST_PLATE_CLS\} mt-3`\}>/)
    expect(sec).toMatch(/hint=\{`참여권 \$\{formatNumber\(store\.life_credits\)\}장`\}\s*to="\/life\/pro"/)
  })
})

describe('/life/pro — 참여권 내역', () => {
  const credits = readCode('src/pages/life/pro/ProCredits.tsx')
  it('원장 줄(me.history)을 그린다 — 무료·충전·차감·반환', () => {
    expect(credits).toMatch(/<CreditHistory rows=\{me\.history \?\? \[\]\} \/>/)
    for (const k of ['grant', 'charge', 'spend', 'refund']) expect(credits).toContain(`${k}:`)
  })
  it('장수 안내가 "1건에 1장" 으로 고정돼 있지 않다(업종별 장수)', () => {
    expect(credits).not.toContain('견적 1건에 1장')
  })
})

describe('공유 페이지 — 로그인 전이면 바로 카카오 로그인', () => {
  const share = readCode('src/pages/life/LifeSharePage.tsx')
  it('업종·지역을 세션에 맡기고 /login?returnUrl=/life/pro 로 간다', () => {
    expect(share).toMatch(/if \(!isLoggedInSync\(\)\) \{[\s\S]{0,200}sessionStorage\.setItem\(JOIN_KEY, q\.toString\(\)\)[\s\S]{0,200}navigate\(`\/login\?returnUrl=\$\{encodeURIComponent\('\/life\/pro'\)\}`\)/)
  })
})
