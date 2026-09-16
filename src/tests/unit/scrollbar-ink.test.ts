/**
 * 📜 2026-09-03 — 스크롤바 "안 1 (얇은 잉크)" (대표 확정)
 *
 * 배경: 유어딜은 스크롤바를 **한 번도 정의한 적이 없었다**(숨김 유틸만 있었다). 지역 선택창의
 * 두꺼운 회색 막대는 우리 것이 아니라 **OS 기본값**이고, 각진 17px 이 카드·시트의 둥근 모서리와
 * 부딪쳤다(대표 신고). 시안 4안 중 안 1 확정.
 *
 * 이 검사가 고정하는 것:
 *   ① 전역 규칙이 실제로 있다(숨김 유틸만 있던 상태로 되돌아가지 않는다)
 *   ② 두께 8px — 4px 은 마우스로 끌어 잡기 어렵다(윈도우 사용자는 막대를 끈다)
 *   ③ thumb 은 **잉크**다 — 브랜드 파랑은 주 행동의 자리이고, 스크롤바는 가구다(표면 규칙 ②)
 *   ④ 다크 대응 + 늘 밝은 표면(light-island)은 다크에서도 라이트 막대
 *   ⑤ 기존 숨김 유틸(no-scrollbar / scrollbar-hide)은 그대로 살아 있다
 *
 * ⚠️ 이 검사가 못 막는 것: 실제 렌더 두께·잡히는 느낌. 파이어폭스는 px 지정 자체가 안 된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const CSS = readFileSync('src/index.css', 'utf8')

describe('스크롤바 안 1 — 얇은 잉크 (2026-09-03 대표 확정)', () => {
  it('① 전역 스크롤바 규칙이 있다', () => {
    expect(CSS).toMatch(/^::-webkit-scrollbar \{/m)
    expect(CSS).toMatch(/^::-webkit-scrollbar-thumb \{/m)
  })

  it('② 두께는 8px (4px 로 얇아지면 마우스로 못 잡는다)', () => {
    const bar = CSS.match(/^::-webkit-scrollbar \{[^}]*\}/m)?.[0] || ''
    expect(bar).toMatch(/width:\s*8px/)
    expect(bar).toMatch(/height:\s*8px/)
  })

  it('③ thumb 은 잉크다 — 브랜드 파랑을 가구에 쓰지 않는다', () => {
    const thumb = CSS.match(/^::-webkit-scrollbar-thumb \{[^}]*\}/m)?.[0] || ''
    expect(thumb).toMatch(/rgb\(22 24 28/)          // 잉크
    expect(thumb).not.toMatch(/28 105 239|#1C69EF/i) // 브랜드 블루 금지
    expect(thumb).toMatch(/border-radius:\s*99px/)
  })

  it('④ 늘 밝은 표면 **다섯 곳 모두** 다크에서 잉크 막대를 쓴다', () => {
    expect(CSS).toMatch(/\.dark ::-webkit-scrollbar-thumb[,\s]/)
    // 🩸 처음엔 light-island 하나만 덮었다 — 대시보드(늘 라이트)는 흰 위 흰 막대로 안 보였다.
    //   이 목록은 위 라이트 입력 규칙과 **같은 다섯 개**여야 한다(한쪽만 늘면 또 갈린다).
    // 🩸 처음 이 검사는 `toContain('.dark .X ::-webkit-scrollbar-thumb')` 였는데, 바로 아래
    //   `:hover` 블록이 **같은 문자열을 품고 있어** 선택자를 지워도 초록이 떴다(되돌려-검증에서 발각).
    //   ⇒ 선택자 목록을 실제로 갈라서 **정확히 일치**하는 항목이 있는지 본다.
    const selectorsOf = (re: RegExp) =>
      (CSS.match(re)?.[0] || '').split('{')[0].split(',').map((x) => x.trim())
    const thumb = selectorsOf(/(^|\n)\.dark \.light-island ::-webkit-scrollbar-thumb[^{]*\{/)
    const hover = selectorsOf(/(^|\n)\.dark \.light-island ::-webkit-scrollbar-thumb:hover[^{]*\{/)
    const color = selectorsOf(/(^|\n)\.dark \.light-island \*[^{]*\{/)
    for (const w of ['light-island', 'force-light-theme', 'admin-light-theme', 'seller-light-theme', 'agency-light-theme']) {
      expect(thumb, `${w}: 다크 흰 막대가 그대로 이긴다`).toContain(`.dark .${w} ::-webkit-scrollbar-thumb`)
      expect(hover, `${w}: hover 만 흰색으로 남는다`).toContain(`.dark .${w} ::-webkit-scrollbar-thumb:hover`)
      expect(color, `${w}: 파이어폭스에서 흰 막대가 남는다`).toContain(`.dark .${w} *`)
    }
  })

  it('⑤ 숨김 유틸은 한 벌로 정의되고 옛 이름도 별칭으로 살아 있다', () => {
    const hide = CSS.match(/\.scrollbar-hide::-webkit-scrollbar[^}]*\}/)?.[0] || ''
    expect(hide).toMatch(/display:\s*none/)
    for (const alias of ['.no-scrollbar', '.noscroll']) {
      expect(CSS, `${alias} 별칭이 사라지면 남의 브랜치가 깨진다`).toContain(`${alias}::-webkit-scrollbar`)
    }
    // 파이어폭스 절반(scrollbar-width)이 빠지면 거기서만 막대가 남는다.
    expect(CSS).toMatch(/\.scrollbar-hide,[\s\S]{0,80}scrollbar-width:\s*none/)
  })

  it('⑥ 소스는 숨김을 `scrollbar-hide` 한 이름으로만 쓴다', () => {
    const files = walk('src').filter((f) => /\.(tsx|ts)$/.test(f) && !f.includes('src/tests/'))
    const bad: string[] = []
    for (const f of files) {
      const t = readFileSync(f, 'utf8')
      // 즉석 표기는 반쪽(웹킷만)인 경우가 실제로 있었고, 그 브라우저에서만 막대가 남는다.
      if (/webkit-scrollbar\]:hidden|scrollbarWidth|\[scrollbar-width:none\]/.test(t)) bad.push(`${f} (즉석 표기)`)
      if (/(?<![\w-])no-scrollbar(?![\w-])/.test(t)) bad.push(`${f} (옛 이름 no-scrollbar)`)
      if (/className="noscroll"/.test(t)) bad.push(`${f} (옛 이름 noscroll)`)
    }
    expect(bad, `숨김 표기가 다시 갈렸다:\n${bad.join('\n')}`).toEqual([])
  })

  it('⑦ ▲▼ 화살표 단추는 안 그린다 (스타일을 주면 플랫폼에 따라 기본 단추가 남는다)', () => {
    expect(CSS).toMatch(/::-webkit-scrollbar-button \{[^}]*display:\s*none/)
  })

  it('⑧ 유어애즈 대시보드도 같은 치수를 쓴다 (혼자 9px 이었다)', () => {
    const uad = readFileSync('src/components/MarketingDashboardShell.tsx', 'utf8')
    expect(uad).toMatch(/\.uad ::-webkit-scrollbar\{width:8px;height:8px\}/)
    expect(uad).toMatch(/border-radius:99px;border:2px solid transparent/)
  })
})
