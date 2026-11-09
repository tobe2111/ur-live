/**
 * 🔒 HSTS preload 유지 조건 (2026-11-09 대표가 hstspreload.org 에 urdeal.kr 제출 — "pending inclusion").
 *   목록에 남으려면 사이트가 **계속** 이 헤더를 보내야 한다. 빠지거나 약해지면 크롬 팀이 목록에서 뺀다
 *   (그러면 http 로 들어오는 손님이 다시 LA 왕복을 한 번 더 한다).
 *   조건: max-age ≥ 31536000 · includeSubDomains · preload — 워커와 정적 _headers 둘 다.
 *   ⚠️ 못 보는 것: http→https 301(Cloudflare 엣지가 한다) · 새 하위 도메인의 인증서(Cloudflare 프록시면 자동).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

function check(v: string | undefined, where: string) {
  expect(v, `${where}: HSTS 헤더가 없다`).toBeTruthy()
  const age = Number(/max-age=(\d+)/.exec(v!)?.[1] ?? 0)
  expect(age, `${where}: max-age 1년 미만`).toBeGreaterThanOrEqual(31536000)
  expect(v, `${where}: includeSubDomains 없음`).toMatch(/includeSubDomains/)
  expect(v, `${where}: preload 없음`).toMatch(/\bpreload\b/)
}

describe('HSTS preload 조건', () => {
  it('워커가 https 응답에 preload 조건을 만족하는 HSTS 를 붙인다', () => {
    const w = readFileSync('src/worker/index.ts', 'utf8')
    check(/c\.header\('Strict-Transport-Security', '([^']+)'\)/.exec(w)?.[1], 'worker/index.ts')
  })
  it('정적 _headers 도 같은 조건', () => {
    const h = readFileSync('public/_headers', 'utf8')
    check(/Strict-Transport-Security:\s*([^\n]+)/.exec(h)?.[1], 'public/_headers')
  })
})
