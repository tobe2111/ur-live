/**
 * 🔗 canonical 은 문서에 **정확히 하나** (2026-10-12, 대표 "응 모두 해줘") — 가드.
 *
 * ## 무엇이 결함이었나 (배포 후 라이브 실측, Googlebot UA)
 * 서빙 문서의 `<link rel="canonical">` 이 **전 표면에서 2개**였다 — 홈·`/blog`·`/vouchers`·`/browse`
 * ·`/u/:handle` 전부. 검색봇은 `app.get('*')` 의 **봇 셸**을 받는데 그 템플릿이 자기 canonical 을 이미
 * 갖고 있고, 메타 빌더들은 `<head>` 에 하나를 **더 붙이기만** 했다(`el.append`).
 *
 * 🩸 **두 값이 같아서 몇 달간 무해했다.** 그런데 #18(숙소 정본 단일화)이 `/pass/:id` 의 canonical 을
 * `/stays/:id` 로 옮긴 순간 `/pass/2887` 이 `[/pass/2887, /stays/2887]` 을 함께 내보냈다 —
 * **모순되는 canonical 을 받으면 구글은 둘 다 무시하고 자기가 고른다.** 즉 그 작업의 효과가 0 이었다
 * (빌드 성공 · 테스트 초록 · 화면 정상 — 재 본 사람만 안다).
 *
 * ## 이 가드가 못 보는 것
 * - 한 응답에 메타 빌더가 **둘** 걸리는 경우(각자 하나씩 붙여 2개가 된다). 지금은 분기가 상호배타지만
 *   정적으로 증명하지 않는다 — 판정은 배포 후 라이브 실측이다.
 * - HTMLRewriter 런타임 동작(`remove()`/`append()` 의 실제 순서) — 워커 전용 API 라 유닛 밖.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { applyCanonical, applySurfaceMeta } from '@/worker/utils/surface-ssr-meta'
import { stripComments } from '../helpers/source-text'

const WORKER = 'src/worker/index.ts'
const code = () => stripComments(readFileSync(WORKER, 'utf-8'))
const raw = () => readFileSync(WORKER, 'utf-8')

function fake() {
  const appended: string[] = []
  const removed: string[] = []
  const attrs: Array<{ selector: string; name: string; value: string }> = []
  const rb = {
    on(selector: string, handlers: { element(el: unknown): void }) {
      handlers.element({
        setInnerContent: () => {},
        setAttribute: (name: string, value: string) => attrs.push({ selector, name, value }),
        append: (c: string) => appended.push(c),
        remove: () => removed.push(selector),
      })
      return rb
    },
  }
  return { rb, appended, removed, attrs }
}

const canonTags = (xs: string[]) => xs.join('').match(/<link rel="canonical"/g) ?? []

describe('🔗 canonical 은 정확히 하나', () => {
  it('① applyCanonical — 기존 태그를 지우고 하나만 붙인다', () => {
    const f = fake()
    applyCanonical(f.rb, 'https://urdeal.kr/stays/2887')
    // 지운다: 봇 셸이 이미 갖고 있는 것
    expect(f.removed).toContain('link[rel="canonical"]')
    // 붙인다: index.html 엔 그 태그가 없으므로 append 가 필요하다
    expect(canonTags(f.appended)).toHaveLength(1)
    expect(f.appended.join('')).toContain('href="https://urdeal.kr/stays/2887"')
  })

  it('①-2 setAttribute 로 제자리 교체하지 않는다 (태그 부재 경로에서 canonical 0 이 된다)', () => {
    const f = fake()
    applyCanonical(f.rb, 'https://urdeal.kr/x')
    expect(f.attrs.filter(a => a.name === 'href')).toHaveLength(0)
  })

  it('①-3 속성 이스케이프 — 탐침 값으로 동작 판정', () => {
    const f = fake()
    applyCanonical(f.rb, 'https://urdeal.kr/a"><b>&c')
    const out = f.appended.join('')
    expect(out).not.toContain('"><b>')
    expect(out).toContain('&quot;&gt;&lt;b&gt;&amp;c')
  })

  it('② applySurfaceMeta 도 그 한 길을 지난다 (canonical 1개 + remove 등록)', () => {
    const f = fake()
    applySurfaceMeta(f.rb, {
      pageTitle: 't', title: 't', description: 'd',
      canonical: 'https://urdeal.kr/vouchers', jsonLd: '{"@type":"WebPage"}',
    })
    expect(f.removed).toContain('link[rel="canonical"]')
    expect(canonTags(f.appended)).toHaveLength(1)
    // jsonLd 는 그대로 붙는다(한쪽을 고치며 다른 쪽을 떨어뜨리지 않게)
    expect(f.appended.join('')).toContain('application/ld+json')
  })

  it('③ 워커에 canonical 을 손으로 append 하는 자리가 없다', () => {
    const c = code()
    const appends = c.match(/\.append\(`<link rel="canonical"[^`]*`/g) ?? []
    expect(appends, `손으로 붙이면 봇 셸의 것과 2개가 된다: ${appends.join(' | ')}`).toHaveLength(0)
  })

  it('④ 워커에 canonical 을 setAttribute 로 교체하는 자리가 없다', () => {
    const c = code()
    // `.on('link[rel="canonical"]', ...)` 안에서 href 를 setAttribute 하는 패턴
    const inplace = c.match(/link\[rel="canonical"\][\s\S]{0,120}?setAttribute\('href'/g) ?? []
    expect(inplace, '그 패턴은 "태그가 이미 있다" 는 전제다 — 사람 경로엔 없어 canonical 0 이 된다').toHaveLength(0)
  })

  it('⑤ applyCanonical 호출이 실제로 배선돼 있다 (0건이면 통과가 아니라 고장)', () => {
    const calls = code().match(/\brb = applyCanonical\(rb,/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(4)
  })

  it('⑥ 반대 방향 — 봇 셸은 자기 canonical 을 계속 갖는다', () => {
    // rewriter 를 안 타는 응답(메타 빌더가 없는 표면)의 self-canonical 보존.
    // 이걸 지우면 그 표면들의 `?utm=` 변형 통합 신호가 사라진다.
    expect(raw()).toContain('<link rel="canonical" href="${esc(canonical)}" />')
  })
})
