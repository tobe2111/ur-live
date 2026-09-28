/**
 * 🪦 2026-09-28 (대표 결재 `2026-09-28-dead-seller-screens.md` — *"3번은 모두 없애줘"*)
 *    죽은 셀러 화면 둘을 은퇴시켰다. 이 시험은 **되살아나는 것**과 **잘못 은퇴하는 것** 둘 다 막는다.
 *
 * ■ 무엇이 죽어 있었나 (라이브 D1 실측 2026-09-28)
 *   | 화면 | 상태 |
 *   |---|---|
 *   | `/seller/consignment` | 테이블 `consignment_partnerships` **없음** → API 일곱 개가 `no such table` |
 *   | `/seller/youtube-growth` | 테이블은 있으나 주문 **0건 · 매출 0원**, 진입점이 자기 성공 페이지뿐 |
 *
 * ■ 지키는 것
 *   ① 두 주소가 **404 가 되지 않는다** — 나간 링크·북마크가 있다(`/my-store` 와 같은 방식).
 *   ② `replace` 다 — 안 그러면 뒤로가기가 은퇴한 주소로 되돌아와 **무한 왕복**이 된다.
 *   ③ 화면 파일이 **없다** — 남겨 두면 도구가 하나 늘 때 두 곳을 고쳐야 하고 반드시 한쪽을 잊는다.
 *   ④ **API 는 그대로 있다** — 위탁 정산도 유튜브 성장도 **머니 경로**라 제거는 단독 세션 + staging 이
 *      붙는다. 이번 결재는 "화면을 없앤다" 이지 "결제 코드를 지운다" 가 아니다.
 *      ⚠️ 이 단언은 **일부러 반대 방향**이다 — 다음 세션이 "죽은 기능이니 API 도 지우자" 로
 *         나아가는 것을 막는다. 지우려면 결재를 다시 받을 것.
 *   ⑤ 가이드가 **죽은 주소를 안내하지 않는다** — 화면을 내렸는데 가이드가 계속 그 주소를 알려주면
 *      셀러가 리다이렉트를 타고 "왜 딴 데로 가지" 하게 된다.
 *
 * ■ 이 시험이 **못** 하는 것
 *   - 라이브에서 실제로 리다이렉트가 도는지는 브라우저 몫이다(배포 후 주소를 쳐 보는 것이 판정).
 *   - 가이드 **DB** 가 갱신됐는지는 못 본다 — `GUIDE_SEED_VERSION` 이 올라가야 재시드된다.
 *     그 상수가 올랐는지만 `check-seed-version-monotonic` 이 본다.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const ROUTES = 'src/routes/seller.routes.tsx'
const GUIDE = 'src/features/guides/api/guide-seed-seller.ts'

const routes = stripComments(readFileSync(ROUTES, 'utf-8'))
const guideRaw = readFileSync(GUIDE, 'utf-8')

const RETIRED = ['/seller/consignment', '/seller/youtube-growth', '/seller/youtube-growth/success']

describe('① 은퇴한 주소가 404 가 되지 않는다', () => {
  it('측정이 비어 있지 않다', () => {
    expect(routes.length).toBeGreaterThan(3000)
    expect(routes).toContain('path="/seller/more"')
  })

  it.each(RETIRED)('%s 가 라우트로 남아 있다', (p) => {
    expect(routes, `${p} 라우트`).toContain(`path="${p}"`)
  })

  it.each(RETIRED)('%s 는 리다이렉트이고 replace 다', (p) => {
    const i = routes.indexOf(`path="${p}"`)
    const line = routes.slice(i, i + 160)
    expect(line, '리다이렉트').toContain('<Navigate to=')
    // replace 가 없으면 뒤로가기가 은퇴 주소로 되돌아와 무한 왕복이 된다.
    expect(line, 'replace').toContain('replace')
  })
})

describe('② 화면은 실제로 없앴다', () => {
  it.each([
    'src/pages/SellerConsignmentPage.tsx',
    'src/pages/SellerYoutubeGrowthPage.tsx',
    'src/pages/SellerYoutubeGrowthSuccessPage.tsx',
  ])('%s 파일이 없다', (f) => {
    expect(existsSync(f), `${f} 가 되살아났다`).toBe(false)
  })

  it('lazy import 도 남지 않았다', () => {
    // 참조가 남으면 빌드는 되는데 청크만 커진다(죽은 코드가 번들에 실린다).
    expect(routes).not.toContain('SellerConsignmentPage')
    expect(routes).not.toContain('SellerYoutubeGrowth')
  })
})

describe('③ API 는 그대로 둔다 (머니 경로라 제거는 별도 결재)', () => {
  it('위탁 API 파일이 살아 있다', () => {
    expect(existsSync('src/features/seller/api/consignment.routes.ts')).toBe(true)
  })

  it('유튜브 성장 API 파일이 살아 있다', () => {
    expect(existsSync('src/features/youtube-growth/api/youtube-growth.routes.ts')).toBe(true)
  })

  it('워커에 위탁 API 가 그대로 마운트돼 있다', () => {
    const worker = stripComments(readFileSync('src/worker/index.ts', 'utf-8'))
    expect(worker).toContain("app.route('/api/seller/consignment'")
  })
})

describe('④ 가이드가 죽은 주소를 안내하지 않는다', () => {
  it('두 위탁 섹션이 "문 닫았습니다" 로 바뀌었다', () => {
    // ⚠️ 섹션을 **지우면 안 된다** — 시드에서 빠진 섹션은 삭제되지 않아 라이브 DB 에 옛 내용이 남는다.
    //    본문을 바꿔야 재시드가 반영한다.
    expect(guideRaw).toContain("key: 'consignment'")
    expect(guideRaw).toContain("key: 'consignment-seller'")
    expect(guideRaw, '은퇴 표시').toMatch(/문 닫았습니다[\s\S]{0,400}consignment/)
  })

  it('가이드가 셀러를 죽은 화면으로 보내지 않는다', () => {
    // 은퇴 안내 안에서 주소를 **한 번** 언급하는 것은 맥락 설명이라 허용하되,
    // "여기서 관리하세요" 식 안내(정산 조회 경로)는 남으면 안 된다.
    expect(guideRaw).not.toContain('/seller/consignment/settlements')
    expect(guideRaw).not.toContain('products?type=consignment')
  })
})
