/**
 * 🩸 2026-08-31 — `sellers.introduced_by_influencer_id` 는 **`users.id`** 다.
 *
 * ## 실제로 있던 버그
 * 어드민 재배정 API 만 `sellers` 를 보고 검증하고 있었다(2026-05-21 작성 당시엔 영입자가 셀러였다).
 * 나머지 네 곳은 전부 `users.id` 로 읽는다:
 *   적립(`orders.user_id` 와 직접 비교) · 지급(`creditFreePoints({userId})`) ·
 *   조회(`JOIN users`) · 등록귀속(`SELECT id FROM users`)
 *
 * 두 id 공간이 **라이브에서 겹친다**(셀러 3·5·6 ↔ 유저 3·5·6). 어긋난 채로 지정하면
 * **에러 없이 엉뚱한 사람에게 2% 가 간다** — 가장 조용한 종류의 머니 사고다.
 *
 * ## 못 막는 것
 * 어드민이 옳은 번호를 넣는지. 그건 화면이 "이 사람이 맞나요?" 로 보여 주는 것으로만 줄인다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const ADMIN = codeOnly(readFileSync('src/features/admin/api/admin-sellers.routes.ts', 'utf-8'))

describe('영입자 id 공간이 한 가지다 (users.id)', () => {
  it('어드민 재배정이 users 로 검증한다', () => {
    const block = ADMIN.slice(ADMIN.indexOf("reassign-influencer"))
    expect(block.slice(0, 2000)).toMatch(/SELECT id FROM users WHERE id = \?/)
  })

  it('어드민 재배정이 sellers 로 검증하지 않는다', () => {
    // 회귀 모습: seller_type IN ('influencer','both') 로 되돌아가는 것.
    const block = ADMIN.slice(ADMIN.indexOf('reassign-influencer'))
    expect(block.slice(0, 2000)).not.toMatch(/FROM sellers WHERE id = \? AND seller_type/)
  })

  it('나머지 경로도 users 로 읽는 상태가 유지된다', () => {
    expect(codeOnly(readFileSync('src/features/seller/api/seller-stores.routes.ts', 'utf-8')))
      .toMatch(/SELECT id FROM users WHERE id = \?/)
    expect(codeOnly(readFileSync('src/worker/routes/internal-admin-tools.routes.ts', 'utf-8')))
      .toContain('LEFT JOIN users u ON u.id = s.introduced_by_influencer_id')
  })
})

describe('영입자 지정 화면', () => {
  const UI = readFileSync('src/pages/admin-merchant-commissions/IntroducerAssign.tsx', 'utf-8')

  it('매장 카드에 렌더된다', () => {
    expect(codeOnly(readFileSync('src/pages/AdminMerchantCommissionsPage.tsx', 'utf-8')))
      .toMatch(/<IntroducerAssign\b/)
  })

  it('확인해서 사람을 본 뒤에만 지정할 수 있다', () => {
    // 번호만 보고 저장하면 겹치는 id 공간에서 엉뚱한 사람이 박힌다.
    expect(codeOnly(UI)).toMatch(/disabled=\{busy \|\| !preview\}/)
  })

  it('셀러 번호가 아니라는 걸 화면이 말한다', () => {
    expect(UI).toContain('셀러 번호 아님')
  })

  it('사유 없이는 못 바꾼다 (감사 기록)', () => {
    expect(codeOnly(UI)).toMatch(/reason\.trim\(\)\.length < 5/)
  })
})
