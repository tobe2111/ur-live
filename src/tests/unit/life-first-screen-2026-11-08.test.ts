/**
 * 🏠 2026-11-08 대표 *"모두 최적화"* — 생활(`/life`) 첫 화면을 서버가 그린다.
 * 라이브 실측(느린 4G 흉내): FCP 1.9s(앱 코드가 다 와야 그렸다). 박스 실측(390×844): 서버 HTML 과 React 의
 * h1·주 버튼·묶음 제목 넷·타일·큰 줄 좌표가 전부 같았다.
 * ⚠️ 못 보는 것: 실제 프레임에서 안 튀는지(배포 뒤 라이브) · 마운트 뒤 실시간 한 줄이 끼어드는 것(종전과 같다).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildLifeFirstScreen } from '@/worker/utils/life-first-screen'
import { LIFE_GROUPS, LIFE_TILE_LABEL, LIFE_CLS } from '@/shared/life-page'
import { HOME_SERVICE_CATEGORIES } from '@/shared/home-service'
import { cssFirstApplies, criticalSurfaceOf } from '@/worker/utils/css-first-boot'

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8')
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

describe('① 그리는 것', () => {
  const html = buildLifeFirstScreen('<div style="min-height:100dvh">L</div>')
  it('첫 화면 노드 id · 로더는 아래로 줄인다', () => {
    expect(html.startsWith('<div id="ur-first-screen">')).toBe(true)
    expect(html).toContain('min-height:34dvh')
  })
  it('묶음 제목 넷 · 두 줄 타일 이름(줄바꿈 그대로)', () => {
    for (const g of LIFE_GROUPS) expect(html).toContain(`>${g.title}</h2>`)
    expect(html).toContain('후드·덕트\n청소')
    expect(html).toContain(LIFE_CLS.tileLabel) // whitespace-pre-line 이어야 줄바꿈이 산다
  })
  it('아이콘 그림(svg)은 그리지 않는다 — 빈 칸만', () => {
    expect(html).not.toContain('<svg')
  })
})

describe('② 화면과 같은 SSOT', () => {
  it('모든 업종에 타일 이름이 있다', () => {
    for (const d of HOME_SERVICE_CATEGORIES) expect(LIFE_TILE_LABEL[d.key], d.key).toBeTruthy()
  })
  it('화면이 같은 상수를 쓴다(손으로 적은 클래스·묶음이 되살아나지 않는다)', () => {
    const page = read('src/pages/life/LifePage.tsx')
    expect(page).toContain('const GROUPS = LIFE_GROUPS')
    expect(page).toContain('<div className={C.page}>')
    expect(page).toContain('<ul className={C.iconGrid}>')
    expect(page).not.toMatch(/\{ title: '가게 문 열 때'/)
    const hero = read('src/pages/life/LifeHero.tsx')
    expect(hero).toContain('<h1 className={C.h1}>{T.title1}<br className="lg:hidden" />{T.title2}</h1>')
    expect(read('src/pages/life/life-tiles.tsx')).toContain('signage: [LIFE_TILE_LABEL.signage,')
  })
  it('서버 첫 화면으로 부팅했으면 타일이 다시 떠오르지 않는다(깜빡임 방지)', () => {
    expect(read('src/pages/life/LifePage.tsx')).toContain("takeBootFirstScreen('/life') !== null")
  })
})

describe('③ 배선', () => {
  it('워커: 폰 UA 의 /life 만 · 크롤러 요약을 뒤에 붙인다', () => {
    const w = read('src/worker/index.ts')
    expect(w).toMatch(/url\.pathname === '\/life' && shouldRenderMobileFirstScreen\(c\.req\.header\('user-agent'\)\)\) \{ const lifeFirst = buildLifeFirstScreen\(urdealLoaderHtml\); const lifeNs = buildStaticSurfaceNoscript\(url\.pathname, crawlerPayload\);/)
  })
  it('CSS 먼저 + 전용 첫 화면 CSS', () => {
    expect(cssFirstApplies('/life', PHONE)).toBe(true)
    expect(criticalSurfaceOf('/life')).toBe('life')
    expect(read('scripts/generate-critical-css.mjs')).toContain("life: ['src/worker/utils/life-first-screen.ts']")
  })
})
