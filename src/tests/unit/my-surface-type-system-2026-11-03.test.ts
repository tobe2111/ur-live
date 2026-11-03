/**
 * 🧱 마이 안 부품도 글자·아이콘 체계 안에 있다 — 2026-11-03 대표 *"마이에서 글자 모양이나 그런 거 통일이 되어야…
 *   어떤 건 아이콘을 쓰고 통일감이 없어. 글자도 체계적으로 마이 페이지가 아니라도 모두 관리가 되어야 하고"*.
 *
 * 🩸 왜 생겼나: 굵기·크기·아이콘·카드 가드 넷이 파일 **이름**에 seller/agency 가 있으면 대시보드로 보고 뺐다.
 *   그래서 마이의 '내 가게' 판(`SellerSection`)과 에이전시 구역(`agency-console/*`) 41개 파일이 체계 밖이었고
 *   (굵기 위반 104곳), 에이전시 줄만 아이콘이 없었다.
 * 지키는 것: ① 네 가드가 마이·에이전시 콘솔을 이름과 무관하게 넣는다 ② 에이전시 줄(`FlatRow`)이 마이 줄과 같은 문법이다.
 * ⚠️ 못 보는 것: 그려 본 모양(간격·정렬) · `src/components/seller/*` 처럼 대시보드와 같이 쓰는 부품(여전히 이름으로 빠진다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const GUARDS = [
  'src/tests/unit/consumer-type-scale-2026-09-29.test.ts',
  'src/tests/unit/consumer-icon-system-2026-09-29.test.ts',
  'src/tests/unit/weight-scale-2026-10-25.test.ts',
  'src/tests/unit/card-border-to-lift-2026-09-29.test.ts',
]

describe('① 네 가드가 마이 부품을 넣는다', () => {
  for (const g of GUARDS) {
    it(g.split('/').pop()!, () => {
      const s = readFileSync(g, 'utf8')
      expect(s).toContain('const MY_SURFACE = /^src\\/pages\\/(user-profile|agency-console)\\//')
      expect(s).toMatch(/\.filter\(\(f\) => MY_SURFACE\.test\(f\) \|\| !\//)
    })
  }
})

describe('② 에이전시 줄 = 마이 줄 문법', () => {
  const P = readFileSync('src/pages/agency-console/AgencyStoresPanel.tsx', 'utf8')
  it('아이콘이 필수이고 제목은 ROW_LABEL_CLS', () => {
    expect(P).toMatch(/export function FlatRow\(\{ icon, label,/)
    expect(P).toMatch(/  icon: ReactNode\n  label: string/)
    expect(P).toContain('<span className={ROW_LABEL_CLS}>{label}</span>')
  })
  it('모든 FlatRow 호출이 아이콘을 넘긴다', () => {
    const files = ['src/pages/agency-console/AgencyStoresPanel.tsx', 'src/pages/agency-console/AgencySection.tsx']
    let n = 0
    for (const f of files) {
      const s = readFileSync(f, 'utf8')
      for (const m of s.matchAll(/<FlatRow\b([\s\S]*?)\/>/g)) { n++; expect(m[1], `${f}: 아이콘 없는 줄`).toMatch(/icon=\{</) }
    }
    expect(n, '줄을 못 셌다 — 헛도는 검사').toBeGreaterThanOrEqual(8)
  })
})

describe('③ 에이전시 이름은 흐리게 쓰지 않는다 (2026-11-03 대표 "왜 회색이야")', () => {
  it('합친 구역 제목(PC)·에이전시 탭 머리 — 이름은 진한 잉크, 아래 줄은 600', () => {
    const t = readFileSync('src/pages/user-profile/AgencyMergedTitle.tsx', 'utf8')
    expect(t).toMatch(/text-\[17px\] font-bold[^"]*text-gray-900 dark:text-white[^"]*">\{agencyName/)
    expect(t).not.toContain('<SectionTitle>')
    expect(t).toContain('text-[13px] text-gray-600 dark:text-gray-300')
    const h = readFileSync('src/pages/user-profile/AgencyHead.tsx', 'utf8')
    expect(h).toContain('text-[13px] text-gray-600 dark:text-gray-300 truncate">{meta}')
  })
})
