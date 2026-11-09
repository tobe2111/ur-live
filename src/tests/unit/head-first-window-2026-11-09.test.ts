/**
 * 📦 첫 화면 앞 바이트를 서버의 첫 송신량 안에 (2026-11-09 대표 *"이 화면이 꽤 오래 지속되는데?"*).
 *   한국 손님은 LA 데이터센터로 붙는다(실사용 TTFB 1.1~2.4초 · 서버 몫 0.08초). 그 회선에서 첫 화면 앞 `<head>` 가
 *   압축 17KB 라 첫 송신량(약 14KB)을 넘어 왕복이 한 번 더 들었다. 손님에게 먼저 필요 없는 것을 뒤로 뺀다:
 *   ① 인라인 <style> 의 CSS 주석 ② head 의 JSON-LD → </body> 앞 ③ PC 전용 Pretendard 로더 → </body> 앞
 *   ④ 워커가 붙이는 표면 JSON-LD 도 head 가 아니라 body 에.
 *   ⚠️ 못 보는 것: 실제 회선의 첫 송신량(혼잡 창)은 Cloudflare 가 정한다 — 여기선 바이트를 줄이는 것만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// @ts-expect-error — .mjs 빌드 스크립트
import { slimHtml, stripStyleComments, moveHeadJsonLdToBody } from '../../../scripts/html-slim.mjs'

const id = async (c: string) => c

describe('첫 화면 앞 바이트 다이어트', () => {
  it('① <style> 안 CSS 주석을 걷는다(규칙은 그대로)', () => {
    expect(stripStyleComments('<style>a{x:1}/* 한글 설명 */b{y:2}</style>')).toBe('<style>a{x:1}b{y:2}</style>')
  })
  it('② head 의 JSON-LD 는 </body> 바로 앞으로 — 내용·순서는 그대로', () => {
    const h = '<html><head><script type="application/ld+json">{"a":1}</script><script type="application/ld+json">{"b":2}</script><meta x></head><body><div id="root"></div></body></html>'
    const out = moveHeadJsonLdToBody(h)
    const head = out.slice(0, out.indexOf('</head>'))
    expect(head).not.toContain('ld+json')
    expect(out.indexOf('{"a":1}')).toBeGreaterThan(out.indexOf('id="root"'))
    expect(out.indexOf('{"a":1}')).toBeLessThan(out.indexOf('{"b":2}'))
    expect(out.indexOf('{"b":2}')).toBeLessThan(out.indexOf('</body>'))
  })
  it('③ PC 전용 글꼴 로더도 body 끝으로', async () => {
    const out = await slimHtml('<html><head><script id="ur-pret-loader">(function(){})()</script></head><body><div id="root"></div></body></html>', id)
    expect(out.slice(0, out.indexOf('</head>'))).not.toContain('ur-pret-loader')
    expect(out.indexOf('ur-pret-loader')).toBeGreaterThan(out.indexOf('id="root"'))
  })
  it('④ slimHtml 이 ①②③ 을 실제로 부른다', async () => {
    const out = await slimHtml('<html><head><style>/* c */a{}</style><script type="application/ld+json">{}</script></head><body></body></html>', id)
    expect(out).toContain('<style>a{}</style>')
    expect(out.slice(0, out.indexOf('</head>'))).not.toContain('ld+json')
  })
  it('⑤ 워커가 붙이는 JSON-LD 는 head 가 아니라 body 에', () => {
    const meta = readFileSync('src/worker/utils/surface-ssr-meta.ts', 'utf8')
    expect(meta).toMatch(/if \(ld\) \{\s*withCanon = withCanon\.on\('body'/)
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).not.toMatch(/\.on\('head', \{[^}]*ld\+json/)
  })
  it('⑥ 실제 index.html 의 head 인라인 style 에 문자열 속 "/*" 가 없다(③ 정규식의 전제)', () => {
    const html = readFileSync('index.html', 'utf8')
    const head = html.slice(0, html.indexOf('</head>'))
    for (const m of head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      expect(/["'][^"'\n]*\/\*[^"'\n]*["']/.test(m[1])).toBe(false)
    }
  })
})
