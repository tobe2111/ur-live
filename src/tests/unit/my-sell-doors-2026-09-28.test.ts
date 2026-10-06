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

  /**
   * 🔁 **2026-09-30 재조준 — ④ 가 뒤집혔다** (대표 *"셀러 대시보드로 전환도 이젠 필요없잖아"*).
   *
   * 09-28 에 ④ 를 *"넓은 화면으로 가는 유일한 문"* 이라고 남겼는데, 그 판단의 전제는
   * **마이 안에서 할 수 없는 일이 있다** 였다. 그 뒤 §14("하는 것도 마이에서")가 도구를 전부
   * 마이 안 시트로 들여오면서 전제가 사라졌다 — 전환 버튼은 *같은 일을 하는 셋째 문*이 됐다.
   *
   * ⚠️ 그래도 **대시보드가 닿을 수 없는 화면이 되면 안 된다.** 그 책임은 이제 판매 구역이 진다:
   *   `enterSeat(to)` 가 좌석에 앉힌 뒤 `withMyReturn(to)` 로 보낸다(돌아오는 띠까지 달고).
   *   아래 두 단언이 짝이다 — 버튼이 없는 것만 보면 "문이 통째로 사라졌다" 를 못 잡는다.
   */
  it('④ 마이에 대시보드로 *나가는* 버튼이 없다 — 판매는 마이 안에서 한다', () => {
    expect(PAGE).not.toContain("localStorage.setItem('active_role', 'seller')")
    expect(PAGE).not.toContain("window.location.href = '/seller'")
  })

  it('④-2 그래도 대시보드는 닿는다 — 판매 구역이 좌석에 앉혀 보낸다', () => {
    const SELLER = readCode('src/pages/user-profile/SellerSection.tsx')
    // 🩸 첫 판에서 `enterSeat('/seller…')` 를 앵커로 썼다가 빨간불이 났다 — 그 문자열은 없었다.
    //   대시보드 주소는 **시트가 건네주고** `enterSeat` 는 받아서 보냈다.
    // 🧹 2026-10-01 철거: 손수 시트가 내려가 `onOpenPath` 가 사라졌다. 전체 도구 하나만 그걸 쓴다.
    //   불변식은 그대로다 — **판매 구역이 좌석에 앉혀 대시보드로 보낸다**(전체화면이든 시트든).
    expect(SELLER).toContain('withMyReturn(to)')
    expect(SELLER, '전체화면으로 나가는 길(전체 도구의 FULL_SCREEN_ONLY)이 좌석을 안 거친다')
      .toMatch(/setTool\(null\); enterSeat\(path\)/)
    expect(SELLER, '좌석을 맞춘 뒤 대시보드 화면을 시트로 여는 길이 없다')
      .toMatch(/async function openPage\(path: string, title: string/)
    expect(SELLER).toContain("'/seller/orders'") // 그 대시보드 주소가 살아 있다
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
