/**
 * ↩️ **운영자 반품 큐** 불변식 〔세션 ⑤, 체크리스트 §5.4 🟡〕
 *
 * `GET /api/returns/seller` 는 **있는데 소비 화면이 0건**이었다 — 오늘만 세 번째로 만난
 * *"만들어졌는데 아무도 못 쓰는"* 클래스(3분 폼 진입점 · 이것 · O9 문의처).
 *
 * ## 🔴 승인/거절은 상태 전이, 환불은 돈 — 한 화면에 섞지 않는다
 * 여기서 금액을 만지면 **§C7(보관구분 부분환불) 정책이 정해지기 전에 돈이 움직인다.**
 * 환불 실행은 `AdminReturnsPage` 의 `/:id/refund`(머니 경로)에 그대로 둔다.
 *
 * ⚠️ 못 막는 것: 실제 렌더·권한(서버 `user.type !== 'seller'` → 403 이 지킨다) · 반품 정책 자체.
 */
import { describe, it, expect } from 'vitest'
import { readCode, usesSymbol, sliceFrom } from '../helpers/source-text'

const page = readCode('src/pages/SellerReturnsPage.tsx')
const routes = readCode('src/routes/seller.routes.tsx')
const layout = readCode('src/components/SellerLayout.tsx')

describe('🔴 돈을 만지지 않는다', () => {
  it('환불 API 를 호출하지 않는다', () => {
    // ⚠️ `/refund/i` 로 쓰면 **상태 라벨 `refunded: '환불완료'`** 에 걸린다(오늘 두 번째로 밟은
    //   "X 를 안 쓴다" 과잉 범위). 지킬 것은 **호출**이지 단어가 아니다.
    expect(page).not.toMatch(/api\.(put|post)\([^)]*refund/i)
    expect(page).not.toMatch(/\/refund['"`]/)
  })

  it('승인·거절만 호출한다', () => {
    expect(page).toMatch(/'approve' \| 'reject'/)
  })
})

describe('🔴 조회 실패를 "0건" 으로 위장하지 않는다', () => {
  it('에러 상태를 따로 갖는다', () => {
    // 빈 배열로 삼키면 운영자가 "반품 요청이 없다" 고 믿는다 — check-query-iserror 가 지키는 클래스.
    // ⚠️ **목록 조회 블록으로 앵커한다.** `setError(true)` 는 `act()` 에도 있어서
    //   파일 전체로 찾으면 조회 쪽을 지워도 통과한다(되돌려-검증에서 실제로 그랬다).
    const loadBlock = sliceFrom(page, "api.get('/api/returns/seller')", '.finally(', 400)
    expect(loadBlock, '목록 조회 블록을 못 찾았다').not.toBe('')
    expect(loadBlock).toContain('setError(true)')
    // ⚠️ **어미에 묶지 않는다.** 원래 `/불러오지 못했습니다/` 였는데 2026-08-02 시안이 문구를
    //   ~어요체로 통일하면서(`못했어요`) 깨졌다 — 지킬 것은 *실패를 말하는 문구가 있는가*이지
    //   문장 끝이 아니다. 말투는 앞으로도 바뀔 수 있고, 그때마다 이 테스트가 빨개지면 안 된다.
    expect(page).toMatch(/불러오지 못했/)
  })

  it('재시도 경로가 있다 — 막다른 에러 화면을 만들지 않는다', () => {
    expect(page).toMatch(/다시 시도/)
  })
})

describe('🔴 도달 가능하다 — 화면만 만들고 안 붙이면 없는 것과 같다', () => {
  it('라우트가 있다', () => {
    // JSX 는 큰따옴표(`path="/seller/returns"`)라 작은따옴표로 찾으면 못 만난다.
    expect(routes).toContain('/seller/returns')
    expect(usesSymbol(routes, 'SellerReturnsPage')).toBe(true)
  })

  it('셀러 네비에 항목이 있다 — URL 을 아는 사람만 쓰는 화면이 되지 않게', () => {
    expect(layout).toContain("'/seller/returns'")
  })
})
