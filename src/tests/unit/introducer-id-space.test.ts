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
// 🧱 2026-08-31: 두 재배정 핸들러는 글자 단위 복제본이었고 파일크기 래칫에 걸려 이 SSOT 로 합쳤다.
//   그래서 검증 대상도 여기다 — 라우트는 위임만 한다(아래 세 번째 it 이 그 위임을 고정).
const REASSIGN = codeOnly(readFileSync('src/features/admin/api/admin-sellers/reassign-introducer.ts', 'utf-8'))
const INFLUENCER_SPEC = REASSIGN.slice(REASSIGN.indexOf('influencer: {')).slice(0, 900)

describe('영입자 id 공간이 한 가지다 (users.id)', () => {
  it('어드민 재배정이 users 로 검증한다', () => {
    expect(INFLUENCER_SPEC).toMatch(/existsTable:\s*'users'/)
    // 선언만 하고 안 쓰면 무의미하므로, 그 값이 실제 존재확인 쿼리에 박히는 것까지 본다.
    expect(REASSIGN).toMatch(/SELECT id FROM \$\{spec\.existsTable\} WHERE id = \?/)
  })

  it('어드민 재배정이 sellers 로 검증하지 않는다', () => {
    // 회귀 모습: existsTable 이 sellers 로 돌아가거나, seller_type 필터가 되살아나는 것.
    expect(INFLUENCER_SPEC).not.toMatch(/existsTable:\s*'sellers'/)
    expect(REASSIGN).not.toMatch(/FROM sellers WHERE id = \? AND seller_type/)
  })

  it('라우트 두 개가 이 SSOT 로 위임한다 (복제본 부활 차단)', () => {
    // 복제본이 둘이면 한쪽만 고쳐지는 사고가 난다 — 이 버그가 정확히 그렇게 났다.
    expect(ADMIN).toMatch(/reassign-agency'.*reassignIntroducer\(c, 'agency'/)
    expect(ADMIN).toMatch(/reassign-influencer'.*reassignIntroducer\(c, 'influencer'/)
    expect(ADMIN).not.toMatch(/SELECT id FROM sellers WHERE id = \? AND seller_type/)
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
