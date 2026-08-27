import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🚨 2026-08-27 — **딜 없는 상품에 추천 링크를 주지 않는다.**
 *
 * ## 왜 이 테스트가 있나 (실사고)
 * `/influencer/discover` 는 어필리에이트(누구나 공유 2%) 시절 산물이라 *아무 상품이나* 링크를
 * 발급했고, 화면은 **"자동 commission 적립 · 거부당한 경우 (드물게) 0"** 이라 안내했다.
 * 어필리에이트는 2026-08-22 에 종료됐는데 이 페이지만 남아, 안내가 **정반대**가 됐다 —
 * "드물게 0"이 아니라 **딜이 없으면 항상 0**이다(딜 0건 상태로 몇 달).
 *
 * 이건 버그보다 무겁다. 인플루언서가 링크를 뿌리고 첫 정산에서 0원을 보면 그 관계는 끝난다.
 *
 * ## 이 테스트가 막는 것
 *   ① 서버가 `my_deal_pct` 를 안 실어 보내는 회귀
 *   ② 딜 판정 조건이 결제 적립(`findActiveDealPct`)과 갈리는 회귀 — 갈리면 화면은 "N%"인데
 *      정산은 0 이 된다. 그게 이 클래스의 진짜 사고다
 *   ③ 화면이 딜 없이도 링크 버튼을 주는 회귀
 *   ④ "자동 적립" 류의 무조건 약속 문구 복귀
 *
 * ## 이 테스트가 **못** 막는 것
 *   - 런타임 동작(실제로 링크가 눌리는지). 문자열/구조 검사이지 렌더 테스트가 아니다.
 *   - 서버 쿼리가 문법적으로 맞는지. 조건 문자열이 같은지만 본다.
 */
// 2026-08-27: 파일크기 래칫으로 marketing.routes.ts 에서 분리됐다(이동만 — 로직 불변).
const ROUTES = 'src/features/group-buy/api/marketing/discovery.ts'
const PAGE = 'src/pages/InfluencerDiscoverPage.tsx'
const SSOT = 'src/worker/utils/influencer-deal.ts'
const read = (p: string) => readFileSync(p, 'utf-8')

/** 카탈로그 핸들러 본문만 잘라낸다 — 파일 전체를 보면 다른 라우트의 문자열에 걸린다. */
function discoverHandler(src: string): string {
  const start = src.indexOf("discoverApp.get('/products'")
  expect(start, '카탈로그 핸들러를 못 찾았다 — 라우트가 옮겨졌으면 이 테스트를 따라 옮길 것').toBeGreaterThan(-1)
  const body = src.slice(start)
  const end = body.indexOf('\nexport {')
  return end > 0 ? body.slice(0, end) : body
}

describe('/influencer/discover — 딜 없는 링크 차단', () => {
  it('① 서버가 상품마다 my_deal_pct 를 실어 보낸다', () => {
    const h = discoverHandler(read(ROUTES))
    expect(h, 'my_deal_pct 가 응답에서 사라졌다 — 화면이 딜 유무를 구분할 수 없게 된다').toContain('my_deal_pct')
    // ⚠️ 여기서 한 번 헛돌았다: `/SELECT[\s\S]*?p\.seller_id/` 로 썼더니 아래쪽
    //   `LEFT JOIN sellers s ON s.id = p.seller_id` 에 걸려, 컬럼 목록에서 seller_id 를
    //   지워도 초록이 떴다. **컬럼 목록(SELECT~FROM 사이)** 안에 있는지를 봐야 한다.
    const cols = h.slice(h.indexOf('SELECT'), h.indexOf('FROM products'))
    expect(cols, '딜 매칭 키인 seller_id 가 SELECT 컬럼 목록에 없으면 매칭이 항상 실패한다(무음)')
      .toContain('p.seller_id')
  })

  it('② 딜 판정 조건이 결제 적립(findActiveDealPct)과 같다', () => {
    const h = discoverHandler(read(ROUTES))
    const ssot = read(SSOT)
    // 세 조건 — 하나라도 빠지면 화면과 정산이 갈린다.
    for (const cond of ["status = 'active'", 'ends_at IS NULL OR ends_at', 'requires_content_proof']) {
      expect(ssot, `SSOT 전제 붕괴: ${cond}`).toContain(cond)
      expect(h, `카탈로그 조건이 결제와 갈렸다: ${cond}`).toContain(cond)
    }
  })

  it('③ 화면이 딜 있을 때만 링크 버튼을 준다', () => {
    const page = read(PAGE)
    // ⚠️ 여기서도 한 번 헛돌았다: `p.my_deal_pct != null` 은 **배지**(`&& (`)에도 있어서,
    //   버튼 삼항(`? (`)을 `true ? (` 로 바꿔도 배지 쪽에 걸려 초록이 떴다.
    //   **삼항 형태로 앵커**해야 버튼 분기를 실제로 검사한다.
    const TERNARY = 'p.my_deal_pct != null ? ('
    expect(page, '링크 버튼의 딜 분기가 사라졌다 — 딜 없는 상품에도 링크가 나간다').toContain(TERNARY)
    const branch = page.slice(page.indexOf(TERNARY))
    const elseAt = branch.indexOf(') : (')
    expect(elseAt, '삼항 분기 형태가 아니다').toBeGreaterThan(-1)
    const truthy = branch.slice(0, elseAt)
    expect(truthy, '링크 복사 버튼이 딜-있음 분기 밖으로 나갔다').toContain('copyLink')
    expect(truthy, 'SNS 공유 버튼이 딜-있음 분기 밖으로 나갔다').toContain('shareLink')
  })

  it('④ "자동 적립" 류 무조건 약속 문구가 없다', () => {
    const page = read(PAGE)
    // 코드 주석은 사고 경위를 설명하느라 그 문구를 인용한다 → 주석을 걷어내고 본다.
    const noComments = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const banned of ['자동 commission 적립', '자동 커미션 적립', '드물게']) {
      expect(noComments, `없는 보상을 약속하는 문구가 되살아났다: "${banned}"`).not.toContain(banned)
    }
  })
})
