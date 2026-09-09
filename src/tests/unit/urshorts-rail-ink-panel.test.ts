/**
 * 🌑 유어쇼츠 레일 = **잉크 패널** (2026-09-08 대표 확정 — 시안 "안 2")
 *
 * 대표: *"지금 유어쇼츠 섹션 부분 바탕도 다른 이용권들 섹션이랑 똑같잖아. 그래서 구별이 안된달까?"*
 * 홈의 모든 섹션이 같은 흰 패널(`.ur-home-panel light-island`)이라, 세로 9:16 카드인데도
 * 담긴 그릇이 위아래와 똑같아 "또 같은 섹션"으로 읽혔다. 이 한 칸만 색면(`--home-field`)으로 세운다.
 *
 * ## 🔴 이 테스트의 존재 이유 — 조용히 안 보이게 되는 조합이 있다
 * `light-island` 은 **안쪽 `dark:` 유틸을 전부 끄는** 장치다(tailwind.config darkMode variant).
 * 배경만 잉크로 바꾸고 그 클래스를 남기면 **라이트 모드에서 `text-gray-900` 이 살아나
 * 잉크 위 잉크색 글자**가 된다 — 에러도 경고도 없고, 다크에서 보면 멀쩡해서 못 본다.
 * 그래서 (a) 두 클래스의 공존을 금지하고 (b) 패널 안에 라이트 회색 글자 토큰이 없음을 고정한다.
 *
 * ## 못 막는 것
 * - 실제 대비(잉크 위 글자가 읽히는지) — `scripts/check-dark-contrast.mjs` 가 브라우저로 잰다.
 * - **다크에서 이 안이 약하다는 사실**: 페이지(#11141C) vs 패널(#16181C) 명도차가 미세하다.
 *   대표가 트레이드오프를 알고 고른 안이고, 더 센 안은 `docs/design/urshorts-rail-surface-2026-09.md`.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8')
/** 주석은 className 이 아니다 — 블록 주석을 **먼저 통째로** 지운다(줄 단위로 지우면 가운데 줄이 남는다). */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const RAIL = 'src/components/home/UrShortsRail.tsx'
const CSS = 'src/index.css'

describe('① 레일 섹션은 잉크 패널이다', () => {
  const s = code(read(RAIL))
  it('ur-panel-ink 를 쓴다', () => {
    expect(s).toMatch(/className="ur-home-panel ur-panel-ink"/)
  })
  it('light-island 과 같이 쓰지 않는다(라이트에서 잉크 위 잉크 글자가 된다)', () => {
    expect(s, 'light-island 이 되살아났다').not.toMatch(/light-island/)
  })
})

describe('② 색은 이미 있는 색면 토큰이다 — 새 hex 를 발명하지 않는다', () => {
  const css = read(CSS)
  it('.ur-panel-ink 가 --home-field 를 배경으로 쓴다', () => {
    const m = css.match(/\.ur-panel-ink\s*\{[\s\S]*?\}/)
    expect(m, '.ur-panel-ink 규칙이 사라졌다').toBeTruthy()
    expect(m![0]).toMatch(/background:\s*var\(--home-field\)/)
  })
  it('잉크 위 파랑은 다크 표면용 값으로 국소 치환한다(--brand 는 3.3:1)', () => {
    const m = css.match(/\.ur-panel-ink\s*\{[\s\S]*?\}/)
    expect(m![0]).toMatch(/--brand-text:\s*#4D8DF5/)
    expect(code(read(RAIL)), 'text-brand 는 잉크 위에서 안 읽힌다').toMatch(/text-brand-text/)
  })
})

describe('③ 잉크 위에는 라이트 회색 글자를 두지 않는다', () => {
  it('text-gray-900/800/700/600/500 이 레일에 없다', () => {
    const s = code(read(RAIL))
    const found = s.match(/(?<![\w-:])text-gray-(900|800|700|600|500)\b/g) || []
    expect(found, `잉크 위에서 안 읽히는 글자색: ${found.join(', ')}`).toEqual([])
  })
  it('배경도 흰 값이 남아 있지 않다(카드 자리·화살표)', () => {
    const s = code(read(RAIL))
    expect(s).not.toMatch(/(?<![\w-:])bg-white\b(?!\/)/)
    expect(s).not.toMatch(/(?<![\w-:])bg-gray-200\b/)
  })
})
