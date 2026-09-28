/**
 * 🚪 **판매로 가는 문은 둘이다** (2026-09-28 대표 확정 — "끝까지 해줘")
 *
 * ## 무엇이 문제였나 (실측)
 * 마이 페이지를 위에서 아래까지 세 보니 사업자 유저에게 **판매로 가는 문이 넷**이었고 그중 셋이
 * 서로를 복제하고 있었다:
 *   ① 맨 위 '내 가게' 섹션(`SellerSection`) — 오늘 숫자 + 사용처리 + 도구 여덟
 *   ② `RoleCtaGrid` 의 '셀러 대시보드' 타일 → `/seller`
 *   ③ 최하단 '내 매장 · 이용권·정산' 버튼 → `/my-store`(297줄 별도 페이지, 타일 여섯을 자기 손으로)
 *   ④ 최하단 '판매자 모드로 전환' 버튼 → `/seller`
 *
 * **②④ 는 목적지가 같고**(`/seller`) **①③ 은 같은 일을 다른 화면으로** 한다. 게다가 ③④ 가
 * **로그아웃·탈퇴 바로 위**라, 하루에 가장 많이 쓰는 도구가 페이지 맨 끝에 있었다.
 *
 * ## 남긴 둘
 * - **① 맨 위 '내 가게' 섹션** = 매일 하는 일(폰에서 한 손으로).
 * - **④ 최하단 전환 버튼** = 넓은 화면 대시보드로 가는 **유일한** 문(앉아서 하는 일).
 *
 * ⚠️ 이 시험이 **못 막는 것**: 새 문이 *다른 파일*에 생기는 것. 여기서 보는 것은 마이 페이지와
 * `RoleCtaGrid` 뿐이다(`SellOnUrdealRow` 같은 비사업자용 유입은 문이 아니라 가입 권유라 대상 아님).
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw } from '../helpers/source-text'

const PAGE = readCode('src/pages/UserProfilePage.tsx')
const GRID = readCode('src/pages/user-profile/RoleCtaGrid.tsx')

describe('판매 문 정리 — 넷에서 둘로', () => {
  it('③ `/my-store` 로 가는 버튼이 마이에 없다', () => {
    expect(PAGE).not.toContain('/my-store')
  })

  it('② `RoleCtaGrid` 에 `/seller` 로 가는 타일이 없다', () => {
    // 목적지 문자열로 앵커한다 — 라벨(`roleCta.sellerDash`)만 보면 번역 키를 바꿔 되살릴 수 있다.
    expect(GRID).not.toContain("to: '/seller'")
  })

  it('④ 최하단 전환 버튼은 살아 있다 (넓은 화면으로 가는 유일한 문)', () => {
    // 이 문이 사라지면 대시보드가 **닿을 수 없는 화면**이 된다 — ②③ 을 지운 지금은 여기 하나뿐이다.
    expect(PAGE).toContain("localStorage.setItem('active_role', 'seller')")
    expect(PAGE).toContain("window.location.href = '/seller'")
  })

  it('① 맨 위 판매 섹션은 살아 있다 (매일 쓰는 도구)', () => {
    expect(PAGE).toMatch(/<SellerSection\b/)
  })

  it('🔴 `/my-store` **라우트**는 남아 있다 — 이미 나간 링크가 있다', () => {
    // 버튼을 없애는 것과 페이지를 지우는 것은 다른 일이다. 라우트를 함께 지우면 옛 링크가 404 가 된다.
    expect(readRaw('src/App.tsx')).toContain('path="/my-store"')
  })

  it('🔴 이 시험이 헛돌지 않는다 — 검사 대상이 실제로 읽혔다', () => {
    // 경로가 낡아 빈 문자열을 검사하면 위 `not.toContain` 이 전부 통과한다(조용한 부재).
    expect(PAGE.length).toBeGreaterThan(5000)
    expect(GRID.length).toBeGreaterThan(1000)
    expect(PAGE).toContain('userProfile.logout')
  })
})
