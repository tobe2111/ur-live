/**
 * 📤 **내보내기가 화면 필터를 따른다** — 계약 (2026-08-03 실측 후 신설).
 *
 * ## 무엇이 있었나
 * 두 풀의 CSV 내보내기가 **필터를 통째로 무시**하고 무필터 상위 N행을 뱉었다.
 *
 * ```
 *   매장 풀 52,000건 중 학원 49,315(95%)   ← 인허가 레인이 죽어 음식점·카페·미용·숙박은 0
 *   파트너 풀 174,000건 중 이메일 보유 12%  ← 나머지는 지금 제안을 보낼 수 없다
 * ```
 * 그래서 대표가 화면에서 *"카페 + 전화 보유"* 로 좁혀도 파일은 사실상 전부 학원이었고,
 * *"이메일 있음"* 으로 좁혀도 파일엔 보류(active=0)까지 섞여 나왔다.
 * **화면과 파일이 다른데 경고가 없다** — 이 레포가 반복해 당한 "조용한 부재".
 *
 * ## 왜 지표 문제인가
 * 이 DB 의 성공 지표는 총 인원이 아니라 **"제안 보낼 수 있는 리드 수"** 다(CLAUDE.md 방향).
 * 화면은 그 정의로 세는데 내보내기가 안 따르면, 지표가 **화면에만 있고 손에는 안 잡힌다.**
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 실제 CSV 내용(D1 없이 라우트를 못 돌린다). **배선**만 본다.
 * - 필터 의미가 서버에서 옳은지(그건 `buildLeadWhere`/`buildProspectWhere` 소관).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const PARTNER_API = SRC('src/features/marketing/api/partner-pool.routes.ts')
const STORE_API = SRC('src/features/marketing/api/store-prospects.routes.ts')
const SHARED = SRC('src/features/marketing/api/pool-export.ts')
const PARTNER_UI = SRC('src/pages/admin/AdminPartnerPoolPage.tsx')
const STORE_UI = SRC('src/pages/admin/AdminStoreProspectsPage.tsx')

const exportBlock = (src: string) => {
  const i = src.indexOf("app.get('/export'")
  expect(i, '내보내기 라우트를 못 찾았다').toBeGreaterThan(0)
  return src.slice(i, i + 3200)
}

describe('서버 — 내보내기가 필터를 읽는다', () => {
  // ⚠️ 2026-08-03: 파싱이 **`pool-export.ts` 로 이동**했다(파일크기 래칫). 지켜야 할 것은 위치가 아니라
  //   "화면과 같은 키를 읽고, 읽은 것을 실제로 넘긴다" 이므로 두 곳으로 나눠 본다.
  it('🔒 파트너: 공용 파서가 화면과 같은 필터 키를 읽는다', () => {
    for (const k of ['category', 'region', 'status', 'hasEmail', 'hasContact', 'leadType', 'q']) {
      expect(SHARED, `${k} 필터가 파서에서 빠졌다`).toContain(`read('${k}')`)
    }
  })

  it('🔒 파트너: 라우트가 그 파서를 쓰고 결과를 **넘긴다** — 만들어 놓고 안 넘기면 아무 일도 안 일어난다', () => {
    const b = exportBlock(PARTNER_API)
    expect(b).toMatch(/parseCompanyExportFilter\(k => c\.req\.query\(k\), intParam\)/)
    expect(b).toMatch(/listCompanyLeads\(c\.env\.DB, \{ \.\.\.filter/)
  })

  it('🔒 매장: 화면과 같은 필터 키를 읽는다 — 📞 전화 필터가 핵심이다(이메일 8건 · 전화 27,831건)', () => {
    const b = exportBlock(STORE_API)
    for (const k of ['category', 'region', 'status', 'hasPhone', 'hasEmail', 'q']) {
      expect(b, `${k} 필터가 내보내기에서 빠졌다`).toContain(`c.req.query('${k}')`)
    }
    expect(b).toMatch(/listProspects\(c\.env\.DB, \{ \.\.\.filter/)
  })

  it('🔒 **조용히 자르지 않는다** — 상한에 닿으면 파일 안에 적는다(공용 `csvResponse`)', () => {
    expect(SHARED, '절단 고지가 없으면 사용자는 "이게 전부"로 읽는다').toMatch(/opts\.rows\.length >= opts\.cap/)
    expect(SHARED, '무엇을 하라는지가 있어야 한다').toMatch(/필터를 더 좁혀/)
    for (const [name, b] of [['파트너', exportBlock(PARTNER_API)], ['매장', exportBlock(STORE_API)]] as const) {
      expect(b, `${name}: 상한을 안 넘기면 고지가 영영 안 뜬다`).toMatch(/cap: EXPORT_MAX/)
    }
  })

  it('🔒 파트너 `includeHeld` 기본값이 **비-필터 파라미터에 흔들리지 않는다**', () => {
    expect(SHARED, '화면 버튼이 붙이는 format=csv 때문에 기본값이 뒤집히면 안 된다').toMatch(/hasAnyFilter\(read, COMPANY_FILTER_KEYS\)/)
    expect(SHARED, 'searchParams 전체를 세면 format=csv 가 섞인다').not.toMatch(/searchParams\.keys\(\)\]\.length > 0/)
  })
})

describe('화면 — 목록과 내보내기가 **같은 조립**을 쓴다', () => {
  it('🔒 조립이 한 곳에 있다 — 두 벌이면 반드시 갈라진다(이번 사고가 그 결과다)', () => {
    for (const [name, ui] of [['파트너', PARTNER_UI], ['매장', STORE_UI]] as const) {
      expect(ui, `${name}: buildQuery 추출이 없다`).toMatch(/const buildQuery = useCallback\(\(\): URLSearchParams/)
      expect(ui, `${name}: 목록이 그 조립을 써야 한다`).toMatch(/const p = buildQuery\(\)/)
    }
  })

  it('🔒 내보내기 호출이 그 조립을 실어 보낸다', () => {
    expect(PARTNER_UI).toMatch(/partner-pool\/export\?format=csv&\$\{buildQuery\(\)\.toString\(\)\}/)
    expect(STORE_UI).toMatch(/store-prospects\/export\?\$\{buildQuery\(\)\.toString\(\)\}/)
  })

  it('🔒 `buildQuery` 에 **페이지네이션이 없다** — 들어가면 내보내기가 1페이지만 나간다', () => {
    for (const [name, ui] of [['파트너', PARTNER_UI], ['매장', STORE_UI]] as const) {
      const i = ui.indexOf('const buildQuery = useCallback')
      const body = ui.slice(i, ui.indexOf('return p', i))
      expect(body, `${name}: buildQuery 안에 limit/offset 이 있으면 안 된다`).not.toMatch(/p\.set\('(limit|offset)'/)
    }
  })
})

/**
 * 📊 **수집 루트별 도달 수율이 화면에 보인다** (2026-08-03 신설).
 *
 * 총계만 보이면 *"5만 건 모았다"* 로 읽힌다. 실측은 다른 이야기를 한다:
 * ```
 *   neis_academy  49,315 · 이메일     7 · 전화 27,831   ← 풀의 95%
 *   kakao_place    1,485 · 이메일     1
 *   hira_hospital  1,200 · 이메일     0
 * ```
 * ⇒ ① 이 풀의 도달 채널은 **전화**다 ② 대표 우선업종은 **0건**이다(인허가 레인 사망).
 * 둘 다 **총계로는 절대 안 보인다.** 어디에 예산을 더 쓸지는 이 표로만 판단된다.
 *
 * ⚠️ 파트너 풀엔 같은 것이 이미 있었다(`bySource`) — 매장 풀만 없었다.
 */
describe('수집 루트별 수율 — 총계가 아니라 "연락 가능한 수"로 본다', () => {
  const STORE_LIB = SRC('src/features/marketing/api/store-prospects.ts')

  it('🔒 매장 통계가 `opn_svc_id`(수집 루트)별로 도달 수를 센다', () => {
    // ⚠️ **파일 전체에서 찾으면 안 된다** — `with_phone` 은 전체 통계 쿼리에도 있어서, bySource 에서
    //   집계를 통째로 지워도 초록불이 뜬다(첫 작성이 실제로 그랬고 주입 검증이 잡았다).
    //   "가드가 막는다고 주장하는 그 자리"로 범위를 좁힌다.
    const at = STORE_LIB.indexOf('const bySource = ')
    expect(at, 'bySource 집계를 못 찾았다').toBeGreaterThan(0)
    const block = STORE_LIB.slice(at, STORE_LIB.indexOf('.all<', at))
    expect(block).toMatch(/GROUP BY opn_svc_id/)
    // ⚠️ **이름만 보면 안 된다** — `COUNT(*) AS with_any` 로 바꿔도 이름은 그대로 남는다(주입 검증이 잡았다).
    //   지켜야 할 것은 "연락 가능한 수를 **조건부로** 센다"이지 컬럼이 존재한다가 아니다.
    for (const col of ['with_phone', 'with_email', 'with_any']) {
      const at = block.indexOf(`AS ${col}`)
      expect(at, `${col} 집계가 없다`).toBeGreaterThan(0)
      // 그 컬럼 **자기 식**만 본다 — 앞 컬럼의 `AS` 까지 되돌아가면 옆 식의 SUM 을 자기 것으로 착각한다.
      const own = block.slice(0, at)
      const expr = own.slice(own.lastIndexOf(',') + 1)
      expect(expr, `${col} 이 조건부 집계가 아니다 — COUNT(*) 면 "몇 건 모았나"만 남는다`).toMatch(/SUM\(CASE WHEN/)
    }
    expect(block, '전화·이메일 둘 다 봐야 한다 — 이 풀은 전화가 도달 채널이다').toMatch(/phone[\s\S]*email/)
  })

  it('🔒 응답에 실려 나간다 — 계산만 하고 안 보내면 없는 기능이다', () => {
    expect(STORE_LIB).toMatch(/\}, byCategory, bySource,/)
  })

  it('🔒 화면이 그것을 읽어 띄운다', () => {
    expect(STORE_UI).toMatch(/setBySource\(r\.data\.bySource \|\| \[\]\)/)
    expect(STORE_UI, '루트 이름이 보여야 어느 루트인지 안다').toMatch(/\{r\.source\}/)
    expect(STORE_UI, '📞 도달 채널 안내가 있어야 이메일만 찾다 끝나지 않는다').toMatch(/도달 채널은 <b>전화<\/b>/)
  })
})

/**
 * 🎯 **두 사업의 "오늘 쓸 수 있는 명단"이 맨 위에 있다** (2026-08-03 대표 확정 후 신설).
 *
 * 대표 확정: **온라인판매 = 페이백 사업 · 대행사 = 제휴 사업.**
 * 총계는 17만이고 그중 지금 보낼 수 있는 건 얼마 안 된다 — 총계는 판단에 도움이 안 되고
 * *"지금은 복잡함"* 이라는 인상만 만든다. 이 DB 의 성공 지표는 **"제안 보낼 수 있는 리드 수"** 다.
 *
 * ```
 *   💸 페이백   온라인판매 18,155 중 이메일 18,088(99.6%)  ← 준비 완료
 *   🤝 제휴     대행사      1,989 중 연락처   111(5.6%)   ← 새 수집 루트 필요
 * ```
 *
 * ⚠️ 못 보는 것: 화면 렌더·클릭 동작(배선만 본다). 숫자가 0 이어도 고장이 아니다.
 */
describe('두 사업 명단 — 총계가 아니라 "지금 보낼 수 있는 수"', () => {
  const BREAKDOWN = SRC('src/features/marketing/api/company-breakdown.ts')
  const SEG_UI = SRC('src/pages/admin/partner-pool/BusinessSegments.tsx')

  it('🔒 두 명단을 **각각 조건부로** 센다 — COUNT(*) 면 "몇 건 있나"만 남는다', () => {
    for (const col of ['payback_ready', 'agency_ready']) {
      const at = BREAKDOWN.indexOf(`AS ${col}`)
      expect(at, `${col} 집계가 없다`).toBeGreaterThan(0)
      const own = BREAKDOWN.slice(0, at)
      expect(own.slice(own.lastIndexOf(',') + 1), `${col} 이 조건부 집계가 아니다`).toMatch(/SUM\(CASE WHEN/)
    }
  })

  it('🔒 **보류는 명단이 아니다** — active=1 로 좁히지 않으면 연락처 없는 행까지 센다', () => {
    const at = BREAKDOWN.indexOf('payback_ready')
    expect(BREAKDOWN.slice(at, at + 700)).toMatch(/active = 1/)
  })

  it('🔒 페이백은 **이메일**, 제휴는 **전화 또는 이메일** — 도달 채널이 다르다', () => {
    const at = BREAKDOWN.indexOf('AS payback_ready')
    const payback = BREAKDOWN.slice(BREAKDOWN.lastIndexOf('SUM(CASE WHEN', at), at)
    expect(payback, '페이백은 이메일 발송이라 전화만으로는 명단이 아니다').not.toMatch(/phone/)
    const at2 = BREAKDOWN.indexOf('AS agency_ready')
    const agency = BREAKDOWN.slice(BREAKDOWN.lastIndexOf('SUM(CASE WHEN', at2), at2)
    expect(agency, '대행사는 전화도 도달 채널이다').toMatch(/phone/)
  })

  it('🔒 화면이 두 명단을 읽고, 클릭하면 **그 필터로 좁힌다** — 좁히지 않으면 카드가 장식이다', () => {
    expect(PARTNER_UI).toMatch(/setSegments\(r\.data\.segments \|\| null\)/)
    expect(PARTNER_UI).toMatch(/<BusinessSegments segments=\{segments\} onPick=/)
    expect(SEG_UI).toMatch(/onPick\('온라인판매', 'email'\)|'온라인판매', 'email'/)
    expect(SEG_UI).toMatch(/'대행사', 'contact'/)
  })
})
