/**
 * 🎛️ **수집 업종을 화면에서 켜고 끈다** — 계약 (2026-08-02 대표 "페이지에서 직접 설정").
 *
 * ## 왜 업종 단위인가 (라이브 실측)
 * ```
 *   ad_company_keywords 4,546개  ↔  업종 32개
 * ```
 * 키워드는 (지역 235 × 업종)의 곱이다. 개별 토글이면 "카페 그만" 이 235번의 클릭이 된다.
 *
 * ## 이 시험이 지키는 것
 * 1. **집계와 토글이 같은 식을 쓴다** — 화면에서 본 줄과 실제로 꺼지는 행이 어긋나면
 *    대표가 끈 줄 알았는데 계속 캐고 있게 된다. 두 벌로 두면 반드시 갈라진다.
 * 2. **마지막 활성 업종은 못 끈다** — 전부 끄면 회전 쿼리가 0행을 받아 수집이 **에러 없이** 멈추고
 *    하트비트는 초록으로 남는다(레인은 정상 실행되고 할 일이 없을 뿐이다). 이 레포가 하루에
 *    세 번 만난 "침묵이 성공처럼 보인다" 가 여기서도 성립한다.
 * 3. **끄면 실제로 안 돈다** — 수집 회전이 `active = 1` 을 보고 있어야 이 스위치가 의미를 갖는다.
 *    (스위치를 만들어 놓고 수집이 그 값을 안 보면 화면만 바뀌고 아무 일도 안 일어난다.)
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 D1 동작(발행 SQL 의 문자열만 본다). 라이브 판정은 어드민 화면의 `active_kw` 변화로.
 * - 업종 이름이 사람에게 말이 되는지 — 그건 데이터 품질이지 계약이 아니다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TRADE_EXPR } from '@/features/marketing/api/company-trades'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const TRADES = SRC('src/features/marketing/api/company-trades.ts')
const COLLECT = SRC('src/features/marketing/api/company-collect.ts')
const ROUTES = SRC('src/features/marketing/api/partner-pool.routes.ts')
const TRADE_ROUTES = SRC('src/features/marketing/api/partner-pool-trades.routes.ts')
const PANEL = SRC('src/pages/admin/partner-pool/TradePanel.tsx')
const PAGE = SRC('src/pages/admin/AdminPartnerPoolPage.tsx')

describe('업종 키 — 집계와 토글이 갈라지지 않는다', () => {
  it('🔒 업종 식이 **상수 하나**이고, 집계·토글·가드가 전부 그것을 쓴다', () => {
    expect(TRADE_EXPR).toContain('subcategory')
    expect(TRADE_EXPR).toContain('category')
    // 상수를 안 쓰고 식을 복붙한 자리가 있으면 그 순간 갈라진다.
    const inlined = TRADES.split('\n')
      .filter(l => !l.includes('export const TRADE_EXPR') && l.includes("COALESCE(NULLIF(subcategory"))
    expect(inlined, `식을 복붙한 줄: ${inlined.join(' | ')}`).toHaveLength(0)
  })

  it('🔒 SELECT(집계) · UPDATE(토글) · 마지막-1개 가드가 모두 ${TRADE_EXPR} 보간을 쓴다', () => {
    expect(TRADES).toMatch(/SELECT \$\{TRADE_EXPR\} AS trade/)
    expect(TRADES).toMatch(/UPDATE ad_company_keywords SET active = \? WHERE \$\{TRADE_EXPR\} = \?/)
    expect(TRADES).toMatch(/COUNT\(DISTINCT \$\{TRADE_EXPR\}\)/)
  })
})

describe('전부 끄면 수집이 조용히 멈춘다 — 서버가 막는다', () => {
  it('🔒 마지막 활성 업종 끄기는 거부되고 **사유를 돌려준다**', () => {
    expect(TRADES).toMatch(/LAST_ACTIVE_TRADE/)
    // 켜는 방향은 막지 않는다(가드가 켜기까지 막으면 복구 불가가 된다).
    // ⚠️ `const r = await DB.prepare` 는 위 집계 함수에도 있다 — 앞쪽 것을 잡으면 구간이 비어
    //   **아무 검사도 안 하면서 초록**이 뜬다(첫 작성이 실제로 그랬다). 가드 블록 시작에서 앞으로 자른다.
    const at = TRADES.indexOf('if (!active) {')
    expect(at, '가드 블록이 없다').toBeGreaterThan(0)
    const guard = TRADES.slice(at, at + 900)
    expect(guard).toMatch(/activeTrades <= 1/)
    expect(guard, '이 업종이 이미 꺼져 있으면 거부할 이유가 없다').toMatch(/self\?\.n\) \|\| 0\) > 0/)
  })

  it('🔒 사유가 화면에 **사람 말로** 뜬다 — 코드만 보여 주면 대표는 왜 안 되는지 모른다', () => {
    expect(PANEL).toMatch(/LAST_ACTIVE_TRADE: '[^']+/)
    expect(PANEL).toMatch(/조용히 멈춥니다|수집이 조용히/)
  })
})

describe('스위치가 실제로 수집을 가른다', () => {
  it('🔒 수집 회전이 `active = 1` 을 본다 — 안 보면 화면만 바뀌고 계속 캔다', () => {
    expect(COLLECT).toMatch(/FROM ad_company_keywords WHERE active = 1/)
    expect(COLLECT, '총 개수도 활성 기준이어야 커서 창이 맞는다').toMatch(/COUNT\(\*\) AS n FROM ad_company_keywords WHERE active = 1/)
  })
})

describe('배선 — 서버가 있어도 누를 데가 없으면 없는 기능이다', () => {
  it('🔒 라우트가 마운트돼 있다', () => {
    expect(ROUTES).toMatch(/app\.route\('\/keyword-trades', tradeRoutes\)/)
    expect(TRADE_ROUTES).toMatch(/app\.get\('\/'/)
    expect(TRADE_ROUTES).toMatch(/app\.patch\('\/'/)
  })

  it('🔒 패널이 페이지에 렌더된다 — 파일만 있고 안 붙이면 아무도 못 본다', () => {
    expect(PAGE).toMatch(/<TradePanel \/>/)
    expect(PAGE).toMatch(/import TradePanel from '\.\/partner-pool\/TradePanel'/)
  })

  it('🔒 패널이 **같은 엔드포인트**를 부른다(경로 오타 = 조용한 404)', () => {
    expect(PANEL).toMatch(/api\.get\('\/api\/admin\/partner-pool\/keyword-trades'\)/)
    expect(PANEL).toMatch(/api\.patch\('\/api\/admin\/partner-pool\/keyword-trades'/)
  })

  it('수확 순 정렬 — 어느 업종이 값을 만드는지 보여야 끌 결정을 한다', () => {
    expect(TRADES).toMatch(/ORDER BY saved DESC/)
  })
})
