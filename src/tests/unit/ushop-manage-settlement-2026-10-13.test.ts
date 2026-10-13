import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '@/tests/helpers/source-text'

/**
 * 🧭 2026-10-13 대표 — *"유어샵에 관리페이지 들어가면 플로우가 복잡하게 되어있네. 인플루언서 정산이랑 페이지 UI
 *   개선해야겠어. 그리고 유어샵 관리 페이지에서 프로필 편집에서 버튼 부분 누르면 그냥 프로필 수정처럼 아래에서
 *   위로 올라오게끔 … 프로필 편집에서 가 아니라 그냥 편집 이라고 해두면 되지. 전체적으로 이상적이질 못해"*
 *
 * ## 무엇이었나 (코드 지도)
 * 관리 화면: '순서 바꾸기'·'담은 이용권 관리' 두 줄이 **같은 모드**를 열었고, 수익 화면(`/creator` = `/u/me/earnings`)이
 * 위 카드와 아래 '대시보드' 줄로 **두 번** 링크됐고, 그 줄은 '내 가게' 밑이라 가게 대시보드처럼 읽혔다.
 * 프로필 줄은 마이로 화면을 통째로 넘겼고 시트를 열지도 않았다.
 * 정산 화면: 제목이 쓰지 않기로 한 이름이었고, 뒤로 가는 길이 없었고, 문의가 `prompt()` 세 번(첫 번째는 영문 코드를
 * 치라고 했다)이었고, 받을 돈보다 입력칸 여섯 개가 먼저 보였다.
 *
 * ⚠️ 못 보는 것: 화면이 실제로 덜 복잡하게 **느껴지는지**(그려서 봐야 한다) · 시트 안 입력의 다크 대비(브라우저 가드).
 */
const code = (p: string) => stripComments(readFileSync(p, 'utf8'))
const MANAGE = 'src/pages/UShopManagePage.tsx'
const SETTLE = 'src/pages/InfluencerSettlementPage.tsx'
const INFO = 'src/pages/influencer-settlement/SettleInfoSheet.tsx'
const DISPUTE = 'src/pages/influencer-settlement/DisputeSheet.tsx'
const STRIP = 'src/pages/curator-page/OwnerEarningsStrip.tsx'

describe('유어샵 관리 — 줄마다 할 일 하나', () => {
  const m = code(MANAGE)

  it('프로필 줄은 화면을 넘기지 않고 그 자리에서 시트를 연다 · 이름은 "편집"', () => {
    expect(m).not.toContain('to="/user/profile"')
    expect(m).toMatch(/onClick=\{\(\) => setEditOpen\(true\)\}/)
    expect(m).toMatch(/defaultValue: '편집'/)
    expect(m).not.toContain('프로필 편집에서')
  })

  it('정리 모드를 여는 줄은 하나뿐이다', () => {
    expect((m.match(/setReorder\(true\)/g) || []).length).toBe(1)
  })

  it('수익 화면으로 가는 입구는 적립 카드 하나 — 같은 화면 링크를 줄로 또 두지 않는다', () => {
    expect(m).not.toContain('/u/me/earnings')
    expect(m).not.toContain("to=\"/creator\"")
    expect(m).not.toContain('curator.dashboardBtn')
    expect(code(STRIP)).toContain('to="/u/me/earnings"')
  })

  it('정산 화면 줄이 수익과 같은 묶음에 있다', () => {
    const money = m.indexOf("defaultValue: '수익과 정산'")
    expect(money).toBeGreaterThan(0)
    expect(m.indexOf('to="/influencer/settlement"')).toBeGreaterThan(money)
    expect(m.indexOf('<OwnerEarningsStrip')).toBeGreaterThan(money)
  })

  it('목록은 마이와 같은 문법(list-grammar)으로 그린다', () => {
    expect(m).toContain("from './user-profile/list-grammar'")
    expect(m).toMatch(/<ListRow\b/)
  })
})

describe('매장 소개 정산 — 받을 돈이 먼저, 폼은 시트로', () => {
  const s = code(SETTLE)

  it('화면 글자에 쓰지 않기로 한 이름이 없다', () => {
    for (const f of [SETTLE, INFO, DISPUTE, 'src/pages/InfluencerAnalyticsPage.tsx']) {
      expect(code(f), f).not.toMatch(/인플루언서|인플\b|크리에이터|큐레이터/)
    }
  })

  it('뒤로 가는 길이 있다', () => {
    expect(s).toMatch(/aria-label="뒤로"/)
  })

  it('🔴 prompt() 로 묻지 않는다 — 문의는 시트', () => {
    expect(s).not.toMatch(/\bprompt\(/)
    expect(code(DISPUTE)).toContain("api.post('/api/influencer-settlement/disputes'")
    expect(code(DISPUTE)).not.toMatch(/unfair_block \/ commission_dispute/)
  })

  it('받을 돈이 맨 위에 있고, 입력칸은 화면에 없다(시트에 있다)', () => {
    const hero = s.indexOf('balance?.available_amount')
    expect(hero).toBeGreaterThan(0)
    expect(hero).toBeLessThan(s.indexOf('<DealsAndCodesSection'))
    expect(s).not.toMatch(/<input\b|<select\b/)
    expect(code(INFO)).toMatch(/<input\b/)
  })

  it('저장 계약은 그대로 — 같은 엔드포인트, 같은 폼', () => {
    expect(s).toContain("api.put('/api/influencer-settlement/me', form)")
    for (const k of ['business_number', 'tax_type', 'bank_name', 'bank_account', 'account_holder', 'payout_method', 'ranking_public']) {
      expect(code(INFO), k).toContain(k)
    }
  })

  it('이모지 타일·그라디언트를 쓰지 않는다', () => {
    expect(s).not.toMatch(/[🏆📊🛍️]/u)
    expect(s).not.toContain('bg-gradient')
  })

  it('브라우저 대비 가드가 시트를 열어서 잰다', () => {
    expect(readFileSync('scripts/check-dark-contrast.mjs', 'utf8')).toContain(`route: '/influencer/settlement', name: '정산 신청', auth: 'user', fill: true, open: '[data-testid="settle-info-open"]'`)
    expect(s).toContain('testId="settle-info-open"')
  })

  it('검사 대상이 실제로 있다', () => {
    for (const f of [MANAGE, SETTLE, INFO, DISPUTE, STRIP]) expect(existsSync(f), f).toBe(true)
  })
})
