/**
 * 🎨 시안 갤러리 `/design/variants` (2026-09-15, 대표 *"다른 디자인 시안들로 더 받을 수 있을까?"*).
 *
 * 무엇을 지키는가 — 이 화면은 **편의 도구**라 망가져도 아무도 안 죽지만, **새면 곤란하다**:
 *   · 소비자에게 노출되거나 색인되면 가짜 숫자가 검색에 뜬다
 *   · API 를 부르기 시작하면 "그냥 시안" 이 아니라 라이브를 건드릴 수 있는 화면이 된다
 *   · 소비자 번들에 얹히면 모두가 안 쓰는 코드를 내려받는다
 *
 * ⚠️ 이 테스트가 못 막는 것: 시안이 **좋은지**. 그건 대표가 눈으로 고르는 일이고, 그러라고 만든 화면이다.
 *
 * 주입 매니페스트: scripts/mutations/design-variants.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { SET_INDEX, SET_LOADERS } from '../../pages/design-variants/registry'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
const APP = read('src/App.tsx')
const PAGE = read('src/pages/design-variants/DesignVariantsPage.tsx')
const ROBOTS = readFileSync('public/robots.txt', 'utf8')
const SET_FILES = readdirSync('src/pages/design-variants/sets').filter(f => f.endsWith('.tsx'))

describe('① 새지 않는다 — 노출·색인 금지', () => {
  it('robots.txt 가 /design/ 을 막는다', () => {
    expect(ROBOTS).toMatch(/^Disallow: \/design\/$/m)
  })
  it('페이지가 스스로 noindex 를 선언한다 (robots 가 서빙 안 될 때의 두 번째 방어)', () => {
    // 🩸 2026-07-29 실측: 라이브 robots.txt 가 Cloudflare Managed 로 통째 대체돼 레포 규칙이 서빙되지
    //   않은 적이 있다. 그때 남는 방어가 이 한 줄이다.
    expect(PAGE).toMatch(/<SEO[^>]*noindex/s)
  })
  it('어디에서도 링크하지 않는다 — 라우트 선언과 시안 폴더 밖에 이 경로가 없다', () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`
        if (e.isDirectory()) { if (!p.includes('/design-variants') && !p.includes('/tests')) walk(p); continue }
        if (!/\.(ts|tsx)$/.test(e.name)) continue
        if (p === 'src/App.tsx') continue // 라우트 선언은 있어야 한다
        // 🩸 주석은 링크가 아니다 — 첫 판은 raw 로 읽어서 `MobileAppLayout` 의 **설명 주석**을 링크로 신고했다.
        //    지키려는 것은 "사용자가 닿는 길이 없다" 이므로 주석을 걷어내고 본다.
        if (stripComments(readFileSync(p, 'utf8')).includes('/design/variants')) hits.push(p)
      }
    }
    walk('src')
    expect(hits).toEqual([])
  })
})

describe('② 아무것도 망가뜨릴 수 없다 — 읽기 전용', () => {
  it('시안이 API 를 부르지 않는다 (가짜 데이터로만 그린다)', () => {
    for (const f of SET_FILES) {
      const src = read(`src/pages/design-variants/sets/${f}`)
      expect(src, f).not.toMatch(/\b(fetch|axios)\s*\(/)
      expect(src, f).not.toMatch(/from '@\/lib\/api'/)
    }
  })
  it('갤러리 껍데기도 API 를 부르지 않는다', () => {
    expect(PAGE).not.toMatch(/\b(fetch|axios)\s*\(/)
    expect(PAGE).not.toMatch(/from '@\/lib\/api'/)
  })
})

describe('③ 소비자 번들에 얹히지 않는다', () => {
  it('App.tsx 가 lazy 로만 부른다', () => {
    expect(APP).toMatch(/const DesignVariantsPage = lazy\(\(\) => import\('\.\/pages\/design-variants\/DesignVariantsPage'\)\)/)
    // 정적 import 로 바뀌면 모두가 이 코드를 내려받는다.
    expect(APP).not.toMatch(/^import DesignVariantsPage from/m)
  })
  it('라우트가 배선돼 있다', () => {
    expect(APP).toMatch(/path="\/design\/variants"/)
  })
})

describe('④ 두 목록이 갈리지 않는다 (lazy 라 이름은 미리 적어야 한다)', () => {
  it('SET_LOADERS 와 SET_INDEX 의 키가 정확히 같다', () => {
    expect(Object.keys(SET_LOADERS).sort()).toEqual(SET_INDEX.map(s => s.id).sort())
  })
  it('목록에 중복 id 가 없다', () => {
    expect(new Set(SET_INDEX.map(s => s.id)).size).toBe(SET_INDEX.length)
  })
})

describe('⑤ 세트 본문 — 실제로 불러와서 잰다', () => {
  it('세트마다 비교할 안이 둘 이상이고, 안 id 가 유일하다', async () => {
    for (const id of Object.keys(SET_LOADERS)) {
      const set = (await SET_LOADERS[id]()).default
      expect(set.id, id).toBe(id)                       // 등록 키와 본문 id 가 갈리면 URL 이 안 맞는다
      expect(set.variants.length, id).toBeGreaterThan(1) // 하나면 비교가 아니다
      expect(new Set(set.variants.map(v => v.id)).size, id).toBe(set.variants.length)
      expect(set.problem.length, id).toBeGreaterThan(10) // 무엇이 불편했는지 없으면 판단 기준이 없다
      for (const v of set.variants) expect(v.note.length, `${id}/${v.id}`).toBeGreaterThan(10)
    }
  })
  it('안 하나는 반드시 "지금" 이다 — 기준선이 없으면 좋아졌는지 알 수 없다', async () => {
    for (const id of Object.keys(SET_LOADERS)) {
      const set = (await SET_LOADERS[id]()).default
      expect(set.variants.some(v => v.label.includes('지금')), id).toBe(true)
    }
  })
})

describe('⑥ 데이터 스위치 — 이 도구의 핵심', () => {
  it('갤러리가 비어 있음 상태를 시안에 넘긴다', () => {
    // 대표가 불편해한 화면은 숫자가 전부 0 이었다. 데이터가 있을 때만 보면 그 문제를 못 본다.
    expect(PAGE).toMatch(/data: dataMode/)
    expect(PAGE).toMatch(/'empty'/)
  })
})
