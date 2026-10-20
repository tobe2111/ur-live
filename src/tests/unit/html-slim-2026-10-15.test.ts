/**
 * ✂️ 배포 HTML 다이어트 (2026-10-15 대표 *"아직 로딩 되게 긴데?"*).
 *   라이브 홈 `<head>` 압축 34KB 중 ~17KB 가 개발자용 주석이었다 — 빌드 산출물에서만 걷는다.
 *   지키는 것: ① HTML 주석 제거(조건부 주석은 남김) ② 일반 인라인 JS 만 압축 — JSON·ld+json·모듈·규칙·src 는 그대로
 *   ③ 압축 실패면 원문 유지 ④ 압축 코드 속 `$&` 를 치환 패턴으로 읽지 않는다 ⑤ vite 가 실제로 부른다
 *   ⑥ CSP 가 해시 방식이 아니다(해시면 압축이 허용을 깨뜨린다).
 *   ⚠️ 못 보는 것: 압축된 스크립트가 브라우저에서 같은 일을 하는지(렌더 스모크·브라우저 검사 몫).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// @ts-expect-error — .mjs 빌드 스크립트
import { slimHtml, isPlainInlineScript, stripHtmlComments } from '../../../scripts/html-slim.mjs'

const fakeMin = async (c: string) => c.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim()

describe('html-slim', () => {
  it('① HTML 주석을 걷고 조건부 주석은 남긴다', () => {
    const out = stripHtmlComments('<p>a</p><!-- 설명 --><!--[if IE]>x<![endif]--><b>b</b>')
    expect(out).toBe('<p>a</p><!--[if IE]>x<![endif]--><b>b</b>')
  })

  it('② 일반 인라인 JS 만 대상이다', () => {
    expect(isPlainInlineScript('')).toBe(true)
    expect(isPlainInlineScript(' nonce="x"')).toBe(true)
    expect(isPlainInlineScript(' type="text/javascript"')).toBe(true)
    for (const a of [' type="module" src="/a.js"', ' src="/a.js"', ' type="application/json" id="x"', ' type="application/ld+json"', ' type="speculationrules"', ' type="ur-module" src="/b.js"', ' type="module"'])
      expect(isPlainInlineScript(a), a).toBe(false)
  })

  it('② JSON·규칙 스크립트 본문은 한 글자도 안 바뀐다', async () => {
    const json = '<script id="__SSR_INITIAL_MAIN__" type="application/json">{"a": 1,   "b": "// 주석 아님"}</script>'
    const rules = '<script type="speculationrules">{ "prerender": [ ] }</script>'
    const out = await slimHtml(`<head>${json}${rules}<script>  // 설명\n var a = 1;  </script></head>`, fakeMin)
    expect(out).toContain(json)
    expect(out).toContain(rules)
    expect(out).toContain('<script>var a = 1;</script>')
  })

  it('③ 압축이 실패하면 원문을 유지한다', async () => {
    const src = '<script>var a = 1 // x\n</script>'
    const out = await slimHtml(src, async () => { throw new Error('boom') })
    expect(out).toBe(src)
  })

  it('④ 압축 코드 속 $& · $1 을 치환 패턴으로 읽지 않는다', async () => {
    const out = await slimHtml('<script>x</script>', async () => 'a.replace(/(b)/,"$1$&$$")')
    expect(out).toBe('<script>a.replace(/(b)/,"$1$&$$")</script>')
  })

  it('⑤ vite 빌드가 실제로 부른다(post · build 전용)', () => {
    const v = readFileSync('vite.config.ts', 'utf8')
    expect(v).toMatch(/name: 'ur-html-slim',\s*apply: 'build'/)
    expect(v).toMatch(/order: 'post'[\s\S]{0,80}slimHtml\(html,/)
  })

  it('⑥ CSP 는 해시가 아니라 nonce 다(압축이 허용을 깨지 않는다)', () => {
    for (const f of ['public/_headers', 'src/worker/index.ts']) {
      let t = ''; try { t = readFileSync(f, 'utf8') } catch { /* 없는 파일 */ }
      expect(t, f).not.toMatch(/'sha(256|384|512)-/)
    }
  })
})
