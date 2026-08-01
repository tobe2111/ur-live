/**
 * 🔴 2026-08-01 (대표: "우리 저 아이콘 디자인이 적용이 안됐네? 지구본모양으로 남아있는 상태야")
 *
 * 구글 검색결과에 유어딜 아이콘 대신 **지구본**이 떴다. 원인은 디자인이 아니라 **서빙**이었다:
 *   `/favicon.ico` 가 **404**(구글 파비콘 폴백 경로) — 파일도 없었고,
 *   설령 파일을 넣었어도 `public/_routes.json` 의 `exclude` 에 없으면 요청이 워커로 가서
 *   **SPA 셸/404** 가 돌아간다(루트 정적 파일은 확장자 와일드카드 금지 정책이라 명시 등록만 통한다).
 *
 * 즉 이 레포에서 루트 아이콘이 살아 있으려면 **세 가지가 동시에** 맞아야 한다:
 *   ① index.html 이 선언 ② public/ 에 파일 존재 ③ _routes.json exclude 에 등재.
 * 셋 중 하나만 빠져도 **에러 없이** 조용히 아이콘만 사라진다 — 이 레포가 반복해 만난 "실패가 아니라 부재".
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 구글이 언제 다시 가져가는지, 그리고 아이콘 그림 자체가 예쁜지.
 *    배포 후 판정은 `curl -I https://urdeal.kr/favicon.ico` 가 200 인지로만 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'

const INDEX = readFileSync('index.html', 'utf8')
const ROUTES = JSON.parse(readFileSync('public/_routes.json', 'utf8')) as { exclude: string[] }

/** index.html 이 선언한 루트 정적 아이콘 경로(하위 디렉터리 없는 것만 — 그건 별도 규칙). */
function declaredRootIcons(): string[] {
  const out = new Set<string>()
  for (const m of INDEX.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]*>/g)) {
    const href = /href="([^"]+)"/.exec(m[0])?.[1]
    if (href && /^\/[^/]+$/.test(href)) out.add(href)
  }
  return [...out]
}

describe('루트 아이콘 — 선언·파일·서빙 3자 동기화', () => {
  const icons = declaredRootIcons()

  it('index.html 이 아이콘을 실제로 선언한다 (0개면 통과가 아니라 실패)', () => {
    expect(icons.length).toBeGreaterThanOrEqual(5)
  })

  it.each(icons.map(i => [i]))('%s — public/ 에 파일이 있다', (href) => {
    expect(existsSync(`public${href}`), `public${href} 없음 — 선언만 있고 파일이 없다`).toBe(true)
  })

  it.each(icons.map(i => [i]))('%s — _routes.json exclude 에 등재돼 Pages 가 직접 서빙한다', (href) => {
    expect(ROUTES.exclude, `${href} 가 exclude 에 없다 → 워커로 가서 SPA 셸/404 가 나간다`).toContain(href)
  })

  it('`/favicon.ico` 는 구글 폴백 경로 — 반드시 존재한다', () => {
    expect(existsSync('public/favicon.ico')).toBe(true)
    expect(INDEX).toContain('href="/favicon.ico"')
  })

  it('favicon.ico 가 실제 ICO 컨테이너다 (PNG 를 이름만 바꿔 넣는 사고 방지)', () => {
    const b = readFileSync('public/favicon.ico')
    expect(b.readUInt16LE(0), 'reserved 는 0').toBe(0)
    expect(b.readUInt16LE(2), 'type 은 1(ICO)').toBe(1)
    const n = b.readUInt16LE(4)
    expect(n).toBeGreaterThanOrEqual(1)
    // 각 엔트리의 오프셋/크기가 파일 안에 실재하는지 — 잘린 ICO 는 브라우저가 조용히 무시한다.
    for (let i = 0; i < n; i++) {
      const size = b.readUInt32LE(6 + 16 * i + 8)
      const off = b.readUInt32LE(6 + 16 * i + 12)
      expect(off + size, `엔트리 ${i} 가 파일 밖을 가리킨다`).toBeLessThanOrEqual(b.length)
    }
  })

  it('48px 배수 아이콘을 하나 이상 선언한다 (구글 파비콘 요건)', () => {
    const sizes = [...INDEX.matchAll(/rel="icon"[^>]*sizes="(\d+)x\1"/g)].map(m => Number(m[1]))
    expect(sizes.some(s => s % 48 === 0), `선언된 크기: ${sizes.join(',')} — 48 배수가 없다`).toBe(true)
  })
})
