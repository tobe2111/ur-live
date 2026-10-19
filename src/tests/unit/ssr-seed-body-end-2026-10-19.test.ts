/**
 * 📦 2026-10-19 [UNLOCK_LOADING] (대표 "승인은 모두 해줄게") — SSR 시드를 `</body>` 앞으로.
 *
 * 라이브 홈: HTML 144KB 중 첫 화면(#root)이 132KB 지점이었다 — 그 앞에 첫 화면 CSS 49KB + MAIN 시드 44KB.
 *   시드는 모듈 스크립트(문서 파싱 뒤 실행)만 읽으므로 head 에 있을 이유가 없다. 사진 preload 도 시드 뒤에
 *   있어 그만큼 늦게 출발했다. 실험실 A/B(같은 HTML, 시드만 이동): 첫 그림 728 → 612ms(중앙값 4회).
 *
 * 지키는 것: ① 시드는 body 핸들러에서만 붙는다 ② head 핸들러엔 시드가 없다(사진 preload 만)
 *   ③ 엔트리는 파싱 뒤 실행(css-first 경로도 DOMContentLoaded) — 그래야 시드가 먼저 있다.
 * ⚠️ 못 보는 것: HTMLRewriter 런타임(워커 전용) · 실제 체감(배포 후 라이브 재측정).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const W = readCode('src/worker/index.ts')
const head = W.slice(W.indexOf(".on('head', {"), W.indexOf(".on('body', {"))
const body = W.slice(W.indexOf(".on('body', {"), W.indexOf('\n      });', W.indexOf(".on('body', {")))

describe('SSR 시드는 </body> 앞', () => {
  it('① body 핸들러가 두 시드를 붙인다', () => {
    expect(W.indexOf(".on('body', {")).toBeGreaterThan(W.indexOf(".on('head', {"))
    expect(body).toMatch(/<script id="\$\{scriptId\}" type="application\/json">\$\{ssrPayload\}<\/script>/)
    expect(body).toMatch(/__SSR_INITIAL_\$\{ssrExtra\?\.slot \?\? 'SECTIONS'\}__/)
  })
  it('② head 핸들러엔 시드가 없고 사진 preload 는 있다', () => {
    expect(head.length).toBeGreaterThan(500)
    expect(head).not.toMatch(/type="application\/json"/)
    expect(head).toMatch(/buildHomeCardPreloadLinks\(ssrExtraPayload\)/)
    expect(head).toMatch(/buildDetailHeroPreloadLink\(/)
  })
  it('③ css-first 엔트리는 DOMContentLoaded 뒤에 꽂힌다(시드를 읽기 전에 실행되지 않는다)', () => {
    const boot = readCode('src/worker/utils/css-first-boot.ts')
    expect(boot).toMatch(/if\(d\.readyState==='loading'\)d\.addEventListener\('DOMContentLoaded',entry/)
  })
})
