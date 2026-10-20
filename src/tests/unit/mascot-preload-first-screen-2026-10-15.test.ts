/**
 * 🦦 유달이 로더 preload — 서버가 첫 화면을 그리는 표면에선 뺀다 (2026-10-15 대표 승인 "빼기").
 *
 * 대표 *"로딩페이지가 있어서 더 로딩이 걸리는건 아닌지 확인도 해봐"* → 라이브 실측(느린 4G · CPU 4배 · 8회 교차):
 *   로더 자체는 기다림을 늘리지 않는다(최소 표시 시간 없음 · 앱이 뜨면 바로 교체). 그런데 index.html 의
 *   유달이 `<link rel=preload as=image>` 가 **모든 페이지에서 최우선으로** 받아, 첫 화면을 서버가 그리는
 *   홈에서도 첫 화면 CSS 와 회선을 나눠 썼다 — 홈 첫 그림 1,104 → 1,040ms(빼면).
 *
 * 고정하는 것:
 *   ① 적용 표면(on)에선 그 preload 를 지운다 · 아닌 표면(로더가 첫 화면)에선 그대로 둔다
 *   ② 지우는 대상이 index.html 의 실제 preload 와 같은 주소다(어긋나면 아무것도 안 지우고 초록이다)
 *   ③ 다른 preload 는 건드리지 않는다
 * ⚠️ 못 막는 것: HTMLRewriter 런타임 셀렉터 매칭(워커 전용 API) · 실제 ms(배포 뒤 라이브 E4).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyCssFirstBoot, loaderImgPriorityAttr } from '@/worker/utils/css-first-boot'
import { UDAL_LOADER_SRC } from '@/shared/udal-loader'

type H = { element?: (el: FakeEl) => void }
class FakeEl {
  removed = false
  constructor(public attrs: Record<string, string>) {}
  getAttribute(k: string) { return this.attrs[k] ?? null }
  setAttribute(k: string, v: string) { this.attrs[k] = v }
  remove() { this.removed = true }
  prepend() {}
}
class FakeRw {
  handlers: Array<[string, H]> = []
  on(sel: string, h: H) { this.handlers.push([sel, h]); return this }
}
/** 아주 작은 셀렉터 판정 — `tag[attr="v"]...` 모양만. */
function matches(sel: string, tag: string, el: FakeEl): boolean {
  const m = sel.match(/^([a-z]+)((?:\[[^\]]+\])*)$/)
  if (!m || m[1] !== tag) return false
  return [...m[2].matchAll(/\[([a-z-]+)="([^"]*)"\]/g)].every(([, k, v]) => el.getAttribute(k) === v)
}
function run(on: boolean, tag: string, attrs: Record<string, string>) {
  const rw = new FakeRw()
  applyCssFirstBoot(rw as unknown as HTMLRewriter, 'n', on, '')
  const el = new FakeEl({ ...attrs })
  for (const [sel, h] of rw.handlers) if (matches(sel, tag, el)) h.element?.(el)
  return el
}

describe('① 적용 표면에서만 유달이 preload 를 지운다', () => {
  const mascot = { rel: 'preload', as: 'image', href: UDAL_LOADER_SRC }
  it('on → 지운다', () => {
    expect(run(true, 'link', mascot).removed, '첫 화면 표면에서 유달이가 최우선으로 회선을 나눠 쓴다').toBe(true)
  })
  it('off(로더가 첫 화면) → 그대로 둔다', () => {
    expect(run(false, 'link', mascot).removed, '로더가 첫 화면인 표면에서 유달이가 늦게 튀어나온다').toBe(false)
  })
})

describe('② 지우는 주소가 index.html 의 실제 preload 와 같다', () => {
  it('index.html 에 그 preload 가 실재한다', () => {
    const html = readFileSync('index.html', 'utf-8')
    expect(html, '주소가 어긋났다 — 재작성기가 아무것도 못 지우고 초록이 된다')
      .toContain(`<link rel="preload" as="image" href="${UDAL_LOADER_SRC}"`)
  })
})

describe('③ 다른 preload 는 건드리지 않는다', () => {
  it('히어로 사진 preload 는 남는다', () => {
    expect(run(true, 'link', { rel: 'preload', as: 'image', href: '/cdn-cgi/image/w=400/x.jpg' }).removed).toBe(false)
  })
})

describe('④ 첫 화면 아래 로더 그림은 낮은 우선순위(2026-10-20)', () => {
  // 🩸 첫 판은 재작성기 규칙이었고 라이브에서 한 번도 안 걸렸다 — 그 <img> 는 워커가 #root 에 넣는 마크업이라
  //   같은 HTMLRewriter 가 다시 파싱하지 않는다. 그래서 워커가 마크업에 직접 붙이는 것을 고정한다.
  it('on → fetchpriority="low" · off(로더가 첫 화면) → 없음', () => {
    expect(loaderImgPriorityAttr(true)).toBe(' fetchpriority="low"')
    expect(loaderImgPriorityAttr(false)).toBe('')
  })
  it('워커 로더 마크업이 그 속성을 cssFirst 로 붙인다(배선)', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8'), '로더가 LCP 사진보다 먼저 받아진다').toMatch(
      /<img src="\$\{UDAL_LOADER_SRC\}"\$\{loaderImgPriorityAttr\(cssFirst\)\}/,
    )
  })
  it('재작성기 img 규칙은 되살리지 않는다(삽입된 마크업엔 안 걸려 지키는 척만 한다)', () => {
    const src = readFileSync('src/worker/utils/css-first-boot.ts', 'utf8')
    expect(src).not.toMatch(/\.on\(`img\[src=/)
  })
})
