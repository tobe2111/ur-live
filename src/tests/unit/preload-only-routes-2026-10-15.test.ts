/**
 * 🏨 색인 진입점 청크 미리받기 (2026-10-15 — /stays 폭포 실측: 엔트리 1.4초 → 화면 청크 2.6초 출발).
 *
 * `PRELOAD_ONLY_ROUTES` 는 **미리받기에만** 쓰고 vite 청크 묶음(`ROUTES`)엔 안 넣는다 — 넣었더니 묶음이 다시 짜이며
 * `lz-browse-vouchers ↔ lz-common` 순환이 생겼다(빌드 게이트가 멈췄다).
 * ⚠️ 못 막는 것: 실제 ms(라이브) · 매니페스트 키 실재(빌드 때 생성기가 경고를 찍는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const worker = stripComments(readFileSync('src/worker/index.ts', 'utf8'))
const vite = readFileSync('vite.config.ts', 'utf8')
const gen = readFileSync('scripts/generate-route-chunk-map.mjs', 'utf8')
/** 생성기 소스에서 표 하나를 읽는다(.mjs 를 import 하면 타입 선언이 필요하고, 그 계약 시험이 템플릿 속 export 를 오인한다). */
function table(name: string): Record<string, string[]> {
  const start = gen.indexOf(`export const ${name} = {`)
  const body = gen.slice(start, gen.indexOf('\n}', start))
  const out: Record<string, string[]> = {}
  for (const m of body.matchAll(/^  (\w+): \[([^\]]*)\]/gm)) out[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])
  return out
}
const ROUTES = table('ROUTES')
const PRELOAD_ONLY_ROUTES = table('PRELOAD_ONLY_ROUTES')

describe('미리받기 전용 표면', () => {
  it('표 읽기가 헛돌지 않는다', () => { expect(Object.keys(ROUTES).length).toBeGreaterThan(5) })
  it('표면 다섯이 있고 진입 파일이 실재한다', () => {
    expect(Object.keys(PRELOAD_ONLY_ROUTES).sort()).toEqual(['blog', 'blogPost', 'region', 'stayDetail', 'stays'])
    for (const files of Object.values(PRELOAD_ONLY_ROUTES)) for (const f of files) expect(existsSync(f), f).toBe(true)
  })
  it('묶음용 ROUTES 와 겹치지 않는다(겹치면 묶음이 다시 짜인다)', () => {
    for (const k of Object.keys(PRELOAD_ONLY_ROUTES)) expect(k in ROUTES, k).toBe(false)
    expect(vite).toMatch(/import \{ ROUTES as SURFACE_ROUTES \}/)
    expect(vite).not.toMatch(/PRELOAD_ONLY_ROUTES/)
  })
  it('생성기가 두 표를 함께 쓴다', () => {
    expect(gen).toContain('Object.entries({ ...ROUTES, ...PRELOAD_ONLY_ROUTES })')
  })
  it('워커가 각 표면을 고른다', () => {
    const blk = worker.slice(worker.indexOf('const chunkSurface ='), worker.indexOf('const routeChunks'))
    for (const k of Object.keys(PRELOAD_ONLY_ROUTES)) expect(blk, k).toContain(`'${k}'`)
    expect(blk).toMatch(/\/\^\\\/stays\\\/\\d\+\\\/\?\$\/\.test\(url\.pathname\) \? 'stayDetail'/)
  })
  it('🈯 한국어 번역 청크도 라우트 청크와 함께 미리 받는다', () => {
    expect(gen).toMatch(/k\.includes\('locales\/ko\/translation\.json'\) && k\.endsWith\('\?i18n-core'\)/)
    expect(gen).toContain('export const BOOT_JS: string[] = ${JSON.stringify(bootJs)}')
    expect(worker).toMatch(/for \(const f of \[\.\.\.routeChunks\.js, \.\.\.BOOT_JS\]\)/)
  })
})
