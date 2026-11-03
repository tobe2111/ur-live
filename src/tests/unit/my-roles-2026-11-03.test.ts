/**
 * 👤 마이 — 사장님 표시 · 에이전시 로그인 입구 · 에이전시 구분선 · 사장님 버튼 (2026-11-03 대표 확정 "제안대로도 해줘").
 * 시안: `docs/design/my-roles-2026-11-03.md`
 *
 * 지키는 것:
 *   ① '에이전시 운영' 줄(FlatRow)이 마이(폰) 평면 규칙에 걸린다 — 선이 사라져 '맡은 매장' 줄과 같은 모양
 *   ② 에이전시 로그인이 없을 때만 맨 아래 "에이전시이신가요? 에이전시 로그인" → /agency/login
 *   ③ 가게가 있으면 이름 옆 `사장님 · 매장 N곳` (조회 중엔 안 그린다) + 판 위 '사장님 · 내 가게'(에이전시 없을 때)
 *   ④ 일반 유저의 사장님 입구 이름 = '사장님이세요? › 내 가게 이용권 팔기'(목적지 /store/new 그대로)
 *
 * ⚠️ 못 보는 것: 실제 화면 모양(그려서 봐야 한다) · 라이브에서 대표 계정의 매장 수가 맞는지(E4).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { readCode } from '../helpers/source-text'

const PAGE = readCode('src/pages/UserProfilePage.tsx')
const PANEL = readCode('src/pages/agency-console/AgencyStoresPanel.tsx')
const GRID = readCode('src/pages/user-profile/RoleCtaGrid.tsx')
const CSS = readFileSync('src/index.css', 'utf8')
const KO = JSON.parse(readFileSync('public/locales/ko/translation.json', 'utf8'))

describe('마이 역할 표시', () => {
  it('① 에이전시 운영 줄이 폰 마이의 평면 규칙에 걸린다', () => {
    expect(PANEL).toContain("${last ? '' : 'border-b border-rule last:border-b-0'}")
    expect(CSS).toMatch(/\.ur-my-flat \.border-b\.border-rule\.last\\:border-b-0 \{ border-bottom-width: 0; \}/)
  })
  it('② 에이전시 로그인 줄은 에이전시 로그인이 없을 때만, /agency/login 으로', () => {
    expect(PAGE).toMatch(/\{showMe && !agencyPresence\.on && \(\s*<p data-testid="my-agency-login"[\s\S]{0,400}?<Link to="\/agency\/login"/)
  })
  it('③ 사장님 칩은 가게가 있고 조회가 끝났을 때만', () => {
    expect(PAGE).toMatch(/\{!sellerSeats\.loading && sellerSeats\.stores\.length > 0 && \(\s*<span data-testid="my-owner-chip"/)
    expect(PAGE).toContain("defaultValue: '사장님 · 매장 {{n}}곳', n: sellerSeats.stores.length")
  })
  it('③ 판 위 제목은 에이전시가 없을 때 — 자리 예약(hasSeats)을 따른다', () => {
    expect(PAGE).toContain("{!tabbed && !agencyPresence.on && hasSeats && <SectionTitle>{t('userProfile.ownerTitle', { defaultValue: '사장님 · 내 가게' })}</SectionTitle>}")
  })
  it('④ 일반 유저의 사장님 입구', () => {
    expect(GRID).toContain("defaultValue: '사장님이세요?'")
    expect(GRID).toContain("defaultValue: '내 가게 이용권 팔기'")
    expect(GRID).toContain("to: '/store/new'")
    expect(KO.roleCta.myShortcuts).toBe('사장님이세요?')
    expect(KO.roleCta.openShop).toBe('내 가게 이용권 팔기')
  })
})
