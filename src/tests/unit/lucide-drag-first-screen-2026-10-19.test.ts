/**
 * 🧳 2026-10-19 — 아이콘 몇 개가 첫 화면에 lucide 봉투(br 10.2KB)를 끌고 오던 세 화면.
 *
 * `lucide` 봉투는 셸·홈·PC 네비 목록에 없는 아이콘이 **하나라도** 쓰이면 통째로 온다.
 * 장바구니는 `PackageCheck`(합배송)·`ImageOff`(사진 없음), 숙소 목록은 `Calendar`·`CalendarDays`,
 * 로그아웃 마이·마이는 설정의 `Monitor`·`Sun`·`Moon`·`Globe` 때문에 그 10KB 를 받았다
 * (빌드 모듈 그래프로 확인 — 각 화면 정적 폐쇄에서 lucide 봉투로 들어가는 간선이 이것뿐이었다).
 *
 * 처방: 상자·가방은 유어딜 세트(BoxIcon·BagIcon, 이미 첫 화면에 있다). 달력·화면·해·달·지구본은
 *   **쓰는 파일 안에서** 그린다 — 공용 세트에 넣으면 모든 화면 첫 페인트가 무거워진다.
 * 결과(정적 폐쇄 brotli): 장바구니 187.2 → 177.4 · 숙소 목록 180.6 → 171.0 · 로그아웃 마이 189.0 → 179.4.
 *
 * ⚠️ 이 시험이 못 보는 것: 바이트 자체 — 그건 `check-surface-budgets.mjs` 가 잠근다(되돌아오면 +10KB 로 빨간불).
 *   이 시험은 **어느 이름이** 되돌아왔는지를 바로 말해 주는 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (f: string) => readFileSync(f, 'utf8')
function lucideNames(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'lucide-react'/g))
    for (const raw of m[1].split(',')) {
      const x = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (x) out.push(x)
    }
  return out
}

const CASES: Array<[string, string[]]> = [
  ['src/pages/CartPage.tsx', ['PackageCheck']],
  ['src/components/cart/CartItem.tsx', ['ImageOff']],
  ['src/pages/StaysSearchPage.tsx', ['Calendar', 'CalendarDays']],
  ['src/components/settings/ThemeToggleSection.tsx', ['Monitor', 'Sun', 'Moon']],
  ['src/components/settings/LanguageSection.tsx', ['Globe']],
]

describe('첫 화면이 lucide 봉투를 끌지 않는다 — 장바구니·숙소 목록·마이 설정', () => {
  for (const [file, banned] of CASES) {
    it(`${file} 는 ${banned.join('·')} 를 lucide 에서 부르지 않는다`, () => {
      const names = lucideNames(read(file))
      for (const b of banned) expect(names, `${b} 가 lucide import 로 되돌아왔다 — 그 화면이 lucide 봉투(10KB)를 다시 받는다`).not.toContain(b)
    })
  }

  it('합배송·사진 없음은 유어딜 세트(상자·가방)로 그린다', () => {
    expect(read('src/pages/CartPage.tsx')).toMatch(/<BoxIcon className="w-3 h-3" aria-hidden \/>합배송/)
    expect(read('src/components/cart/CartItem.tsx')).toMatch(/<BagIcon [^>]*aria-label="이미지 없음"/)
  })

  it('파일 안에서 그린 그림은 유어딜 세트와 같은 획(1.6)이다', () => {
    for (const f of ['src/pages/StaysSearchPage.tsx', 'src/components/settings/ThemeToggleSection.tsx', 'src/components/settings/LanguageSection.tsx']) {
      const s = read(f)
      expect(s, `${f}: 로컬 그림이 없다`).toMatch(/<svg viewBox="0 0 24 24"[^>]*strokeWidth=\{1\.6\}/)
    }
    // 숙소 목록은 두 자리(기간 칩 · 판매 방식 알약)가 같은 달력을 쓴다
    const stays = read('src/pages/StaysSearchPage.tsx')
    expect(stays).toMatch(/<CalendarGlyph className="w-3 h-3" \/>/)
    expect(stays).toMatch(/Icon: CalendarGlyph \}/)
  })
})
