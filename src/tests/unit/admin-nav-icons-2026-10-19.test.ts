/**
 * 🪶 2026-10-19 — 어드민 첫 화면이 손님 화면 봉투를 아이콘 하나 때문에 받던 것.
 *
 * 어드민 좌측 메뉴(`admin-nav-config.ts`)가 쓰던 lucide `Wrench`·`MapPin`·`Play`·`History` 는 묶음기가
 * 손님 화면 봉투(교환권 `lz-vouchers` · 유어샵 `lz-linkshop2` · 쇼츠 `lz-home-homePc-urshorts` · 지도 `lz-gbDetail-map`)
 * 안에 둔다 — 그 화면들이 쓰기 때문이다. 어드민이 아이콘 하나를 import 하면 그 봉투 전체와, 그 봉투가 다시 끄는
 * 봉투들(교환권 → 홈·쇼핑·유어샵)까지 첫 화면에 실렸다. 에러는 0 이다.
 * 처방: 어드민이 이미 받는 `lucide` 봉투 안의 아이콘으로(Gauge·Activity·Landmark·Video·Film·KeyRound).
 * 결과(정적 폐쇄 brotli): dash:admin 274.0 → 256.4 · 손님 화면 변화 0.
 *
 * ⚠️ 못 보는 것: 앞으로 어떤 아이콘이 손님 봉투로 옮겨갈지(묶음기가 정한다). 그 경우는 `check-surface-budgets`
 *   dash:admin 이 늘어난 청크 이름을 대며 빨간불을 낸다 — 이 시험은 *이미 겪은* 넷이 되돌아오는 것만 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const lucideNames = (file: string) => {
  const src = readFileSync(file, 'utf8')
  return [...src.matchAll(/import\s+\{([^}]*)\}\s*from\s*'lucide-react'/g)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim().replace(/^type\s+/, '')))
    .filter(Boolean)
}
// 손님 화면 봉투에 사는 아이콘(2026-10-19 빌드 실측) — lucide 별칭까지 함께.
const IN_CONSUMER_ENVELOPES = ['Wrench', 'MapPin', 'Play', 'History', 'CheckCircle2', 'CircleCheck']
const ADMIN_FIRST_SCREEN = [
  'src/components/admin/admin-nav-config.ts',
  'src/components/AdminLayout.tsx',
  'src/pages/AdminPage.tsx',
  'src/pages/admin-page/AdminActivityFeed.tsx',
  'src/pages/admin-page/AdminAlertBanner.tsx',
  'src/pages/admin-page/SellersTable.tsx',
]

describe('어드민 첫 화면은 손님 봉투의 아이콘을 쓰지 않는다', () => {
  it('검사 대상 파일이 실제로 lucide 를 import 한다(헛돌지 않는다)', () => {
    const total = ADMIN_FIRST_SCREEN.reduce((n, f) => n + lucideNames(f).length, 0)
    expect(total).toBeGreaterThan(40)
  })
  for (const f of ADMIN_FIRST_SCREEN) {
    it(f, () => {
      const hit = lucideNames(f).filter((n) => IN_CONSUMER_ENVELOPES.includes(n))
      expect(hit, `${f} 가 손님 화면 봉투의 아이콘을 import 한다 — 그 봉투를 통째로 받는다`).toEqual([])
      // import 밖에서 쓰는 자리도 본다(`icon: Wrench` · `<Play`) — import 를 고치고 사용처를 남기면 다음 사람이 import 를 되살린다.
      const body = stripComments(readFileSync(f, 'utf8')).replace(/import\s+\{[^}]*\}\s*from\s*'lucide-react'/g, '')
      const used = IN_CONSUMER_ENVELOPES.filter((n) => new RegExp(`(icon:\\s*${n}\\b|<${n}[\\s/>]|Icon:\\s*${n}\\b)`).test(body))
      expect(used, `${f} 가 손님 봉투 아이콘을 쓴다`).toEqual([])
    })
  }
  it('메뉴 항목은 그대로 남아 있다(아이콘만 바뀌었다)', () => {
    const nav = readFileSync('src/components/admin/admin-nav-config.ts', 'utf8')
    for (const p of ['/admin/env-readiness', '/admin/region-density', '/admin/visit-rewards', '/admin/replay', '/admin/login-history', '/admin/kakao-test', '/admin/kakao-login-diag', '/admin/youtube-quota']) {
      expect(nav).toContain(`path: '${p}'`)
    }
  })
})
