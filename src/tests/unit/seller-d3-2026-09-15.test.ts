/**
 * 🧮 셀러 대시보드 2차 — D3 밀도·데이터 + A2 매장이 제목 + B2 합계·매장별 + C 정산 안의 소개 수익 (2026-09-15 대표 확정).
 *   시안·근거: docs/design/seller-dashboard-2nd-directions-2026-09.md
 *   ⚠️ 이 테스트가 못 보는 것: 실제 픽셀(렌더 하네스가 본다) · 어드민 화면이 정말 종전과 같은지(변수 폴백 값만 고정한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf8')
const CSS = read('src/index.css')
const LAYOUT = read('src/components/SellerLayout.tsx')
const SWITCHER = read('src/components/seller/StoreSwitcher.tsx')
const TICKET = read('src/pages/seller-page/TodayTicket.tsx')
const RAIL = read('src/pages/seller-page/MyVouchersRail.tsx')
const HOOK = read('src/pages/seller-page/useSellerHome.ts')
const OPS = read('src/features/seller/api/seller-operators.routes.ts')
const SETTLE = read('src/pages/SellerSettlementsPage.tsx')
const REF = read('src/pages/seller-settlements/ReferralEarningsCard.tsx')

describe('D3 토큰 — 셀러 스코프에서만, 공용 부품은 변수를 읽는다(어드민은 폴백)', () => {
  it('셀러 래퍼가 D3 토큰을 선언한다', () => {
    const i = CSS.indexOf('.seller-light-theme {')
    const block = CSS.slice(i, CSS.indexOf('}', i))
    for (const v of ['--dash-radius: 8px', '--dash-h1: 17px', '--dash-stat: 22px', '--dash-pad-x: 16px']) expect(block, v).toContain(v)
    expect(CSS).toMatch(/\.dash-num \{ font-family: ui-monospace/)
  })
  it('공용 부품 셋이 폴백 있는 변수로 그린다 — 어드민이 종전 값(16px·19px·24px)을 유지하는 근거', () => {
    expect(read('src/components/dashboard/DashboardCard.tsx')).toContain('rounded-[var(--dash-radius,16px)]')
    expect(read('src/components/dashboard/DashboardPageHeader.tsx')).toContain('text-[length:var(--dash-h1,19px)]')
    expect(read('src/components/dashboard/DashboardPageHeader.tsx')).toContain('dash-page-title')
    expect(read('src/components/dashboard/DashboardStatCard.tsx')).toContain('text-[length:var(--dash-stat,24px)]')
    // 어드민 래퍼는 이 변수를 선언하지 않는다 — 선언하는 순간 어드민도 D3 가 된다(의도라면 이 줄을 고칠 것).
    const j = CSS.indexOf('.seller-light-theme,\n.admin-light-theme {')
    expect(CSS.slice(j, CSS.indexOf('}', j))).not.toContain('--dash-radius')
  })
})

describe('A2 — 매장이 헤더 제목', () => {
  it('폰 헤더 제목 자리 = StoreSwitcher(variant="title"), PC = 브레드크럼 `매장 / 제목`', () => {
    const src = stripComments(LAYOUT)
    expect(src).toMatch(/<StoreSwitcher variant="title" \/>/)
    expect(src).toMatch(/<span className="text-gray-300">\/<\/span>\s*<h1 className="truncate text-\[13px\] font-bold text-gray-900">\{title\}<\/h1>/)
    expect(src).toContain('dash-phone-title')
    expect(src).toContain('w-[224px]')
  })
  it('제목형은 매장 1곳이어도 그린다(이름이 곧 제목) — 드롭다운은 2곳 미만이면 없다', () => {
    const src = stripComments(SWITCHER)
    expect(src).toMatch(/if \(!canSwitch && variant === 'menu'\) return null/)
    expect(src).toMatch(/export async function switchStore\(sellerId: number, label: string/)
    expect(src).toMatch(/api\.post\(`\/api\/seller\/stores\/\$\{sellerId\}\/token`\)/)
  })
})

describe('B2 — 전 매장 합계 + 매장별', () => {
  it('요약 API 는 앉을 수 있는 좌석만, 오늘 판정 규칙은 /dashboard/stats 와 같다', () => {
    const src = stripComments(OPS)
    const i = src.indexOf("app.get('/my-stores/summary'")
    expect(i).toBeGreaterThan(0)
    const body = src.slice(i, i + 3000)
    expect(body).toMatch(/\.filter\(s => s\.status === 'active' \|\| s\.status === 'approved'\)/)
    expect(body).toMatch(/status IN \('PAID','DONE'\) AND DATE\(created_at, '\+9 hours'\) = \?/)
    expect(body).toMatch(/current_seller_id/)
    // 사람 기준 — 좌석 토큰이 아니라 resolveActorUserId 로 판정한다.
    expect(body).toMatch(/const userId = await resolveActorUserId\(c\)/)
  })
  it('홈은 요약이 2곳 이상일 때만 합계로 전환하고, 행을 누르면 같은 switchStore 로 좌석을 바꾼다', () => {
    const src = stripComments(TICKET)
    expect(src).toMatch(/const multi = !!summary && summary\.stores\.length >= 2/)
    expect(src).toMatch(/await switchStore\(sellerId, name\)/)
    expect(stripComments(HOOK)).toMatch(/\/api\/seller\/my-stores\/summary/)
    expect(stripComments(read('src/pages/SellerPage.tsx'))).toMatch(/summary=\{home\.storesSummary\}/)
  })
  it('내 이용권은 표다(레일 아님) · 숫자 칸은 dash-num', () => {
    const src = stripComments(RAIL)
    expect(src).toMatch(/<table className="w-full border-collapse/)
    expect(src).not.toMatch(/overflow-x-auto/)
    expect((src.match(/dash-num/g) || []).length).toBeGreaterThanOrEqual(4)
  })
})

describe('C — 정산 탭 안의 소개 수익', () => {
  it('정산 페이지가 카드를 그리고, 카드는 세션 없으면 자기가 안 그린다(같은 RQ 키)', () => {
    expect(stripComments(SETTLE)).toMatch(/<ReferralEarningsCard \/>/)
    const src = stripComments(REF)
    expect(src).toMatch(/\['curator', 'dashboard'\],\s*'\/api\/curator\/me\/dashboard'/)
    expect(src).toMatch(/if \(!stats\) return null/)
    expect(src).not.toMatch(/api\.post|withdraw/i) // 출금은 여기서 하지 않는다 — 머니 경로 무접촉
  })
})

describe('세부 페이지 정리 — 옛 패턴 0 (래칫)', () => {
  const files = execSync("git ls-files 'src/pages/Seller*.tsx' 'src/pages/seller-*/**/*.tsx' 'src/components/seller/*.tsx'", { encoding: 'utf8' }).trim().split('\n')
  it('대상 파일이 충분히 있다 — 경로가 낡으면 통과가 아니라 실패', () => { expect(files.length).toBeGreaterThan(60) })
  it('그림자 카드 · 검은 토글 · rounded-2xl 이 셀러 표면에 없다', () => {
    const bad: string[] = []
    for (const f of files) {
      const s = stripComments(read(f))
      if (/\bbg-white rounded-(?:lg|xl|2xl) shadow/.test(s)) bad.push(`${f}: bg-white rounded shadow`)
      if (/\bbg-gray-(?:900|800) text-white\b/.test(s)) bad.push(`${f}: bg-gray-900 text-white`)
      if (/\brounded-2xl\b/.test(s)) bad.push(`${f}: rounded-2xl`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})
