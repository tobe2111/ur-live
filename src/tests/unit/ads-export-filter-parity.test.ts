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
