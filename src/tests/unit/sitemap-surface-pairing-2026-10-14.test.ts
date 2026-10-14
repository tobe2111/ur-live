import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { surfaceCopyFor } from '@/shared/seo/surface-copy'

/**
 * 🔗 2026-10-14 — **sitemap 제출 ↔ 색인 의도 ↔ 본문 출처** 의 짝 주장을 *전수*로 잠근다.
 *
 * ## 왜 전수여야 하나 — 같은 클래스가 **네 번** 돌아왔다
 *
 *     2026-10-12  제출 facet 3건이 본문 8자                  (#36)
 *     2026-10-13  제출 thin 표면 6건 154~288자               (#24)
 *     2026-10-13  색인 대상인데 미제출 5건                    (#43)
 *     2026-10-14  제출하는 /privacy·/refund 가 본문 6자       (#65)
 *
 * 🔑 **매번 고친 것은 그때 손댄 표면뿐이었다.** `thin-surface-copy` 의 FLOOR 는 *`SURFACE_COPY` 에
 * 들어온 표면*만 보고, `legal-surface-body` ③ 은 *그 두 경로*만 본다 ⇒ 표에 **새로 들어오는**
 * 표면은 아무 바닥도 없이 시작한다. `/privacy`·`/refund` 가 정확히 그 상태였다(제출 O · 항목 X ·
 * 바닥 X · 아무도 안 봄). 그래서 여기서는 **표면 하나가 아니라 관계**를 잠근다.
 *
 * ## 세 주장
 *
 *   R1  색인 대상(표에 있고 noindex 아님)  ⇒  sitemap 정적 제출
 *   R2  noindex                          ⇒  제출하지 않는다
 *   R3  제출                             ⇒  **본문 출처가 있다**
 *
 * 🔴 **R3 은 길이를 재지 않는다 — 그건 FLOOR 의 일이다**(중복 잠금 금지). 여기서 보는 것은
 * *"그 표면의 본문을 만드는 기계가 존재하는가"* 다. 길이는 데이터에 따라 변하지만(쇼핑 카탈로그가
 * 1건이면 `/browse` 는 43자다 — 결재 `2026-10-14-browse-sitemap-priority.md`) **기계의 부재는
 * 언제나 결함**이다.
 *
 * ## ⚠️ 못 보는 것
 * - 본문이 **얼마나** 긴지(FLOOR 가 본다) · 내용이 좋은지
 * - 동적 제출분(상품·지역·블로그 상세) — 여기서는 **정적 loc** 만 본다
 * - 구글이 실제로 색인하는지(수일~수주 · 서치콘솔은 대표만 본다)
 */
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const NOSCRIPT = 'src/worker/utils/crawler-noscript.ts'
const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8')

/** sitemap 소스의 정적 `loc:` 목록. */
const staticLocs = (): string[] =>
  [...read(SITEMAP).matchAll(/loc: '([^']+)'/g)].map(m => m[1])

/**
 * 시드에서 본문을 만드는 표면 — `crawler-noscript.ts` **소스에서 파생한다**(손으로 적으면
 * 그 목록이 낡고, 낡은 목록은 "출처 없음" 을 "출처 있음" 으로 읽는다).
 */
const seedDrivenPaths = (): Set<string> => {
  const src = read(NOSCRIPT)
  const out = new Set<string>()
  // ① 목록 표면 — `LIST_SURFACE_KEEP` 의 키
  const block = src.slice(src.indexOf('LIST_SURFACE_KEEP'))
  const end = block.indexOf('\n}')
  for (const m of block.slice(0, end > 0 ? end : 2000).matchAll(/'(\/[^']*)':/g)) out.add(m[1])
  // ② 전용 분기 — `path === '/xxx'`
  for (const m of src.matchAll(/path === '(\/[^']*)'/g)) out.add(m[1])
  return out
}

/** 본문이 **다른 파일**에서 오는 표면. 각 파일의 배선을 함께 단언한다(목록만 두면 낡는다). */
const ELSEWHERE: Readonly<Record<string, { file: string; wiring: RegExp }>> = {
  // 홈은 워커가 첫 화면을 그린다(`<noscript>` 가 아니라 실제 마크업).
  '/': { file: 'src/worker/utils/home-first-screen.ts', wiring: /export function buildHomeFirstScreen/ },
  // 블로그 목록은 자기 본문 빌더가 낸다(워커가 `buildBlogListBody` 로 부른다).
  //   🩸 2026-10-14 — 여기 처음 `worker/utils/blog-ssr-meta.ts` 라고 **지어 적었다.** 실재하지
  //   않는 경로였고 이 파일의 마지막 단언이 바로 잡았다(같은 날 다른 가드에서 한 번 밟은 클래스 —
  //   가드가 가리키는 고정 경로는 **실재해야 한다**). 그래서 목록만 두지 않고 배선까지 단언한다.
  '/blog': { file: 'src/features/blog/api/blog-ssr-body.ts', wiring: /export function buildBlogListBody/ },
}

describe('R0 측정이 실제로 됐다 (0건이면 통과가 아니라 고장)', () => {
  it('정적 loc · 표 · 시드 표면을 다 읽어 냈다', () => {
    expect(staticLocs().length, '정적 loc 파싱 실패').toBeGreaterThanOrEqual(20)
    expect(Object.keys(CONSUMER_SURFACE_SEO).length, 'SEO 표 파싱 실패').toBeGreaterThanOrEqual(25)
    expect(seedDrivenPaths().size, '시드 표면 파싱 실패 — 빈 집합이면 R3 이 통째로 헛돈다')
      .toBeGreaterThanOrEqual(5)
  })
})

describe('R1 색인 대상 ⇒ sitemap 제출', () => {
  it('미제출 색인 대상 0건', () => {
    const locs = new Set(staticLocs())
    const missing = Object.entries(CONSUMER_SURFACE_SEO)
      .filter(([p, e]) => !e.noindex && !locs.has(p))
      .map(([p]) => p)
    expect(missing, `색인 대상인데 sitemap 이 제출하지 않는다: ${missing.join(' · ')}`).toEqual([])
  })
})

describe('R2 noindex ⇒ 제출하지 않는다', () => {
  it('서로 반대되는 신호 0건', () => {
    const locs = new Set(staticLocs())
    const bad = Object.entries(CONSUMER_SURFACE_SEO)
      .filter(([p, e]) => e.noindex && locs.has(p))
      .map(([p]) => p)
    // 색인 말라고 해 놓고 색인해 달라고 제출하는 것은 서로 반대되는 신호다.
    expect(bad, `noindex 인데 sitemap 이 제출한다: ${bad.join(' · ')}`).toEqual([])
  })

  it('noindex 표면이 실재한다 (표가 비어 R2 가 헛돌지 않게)', () => {
    const n = Object.values(CONSUMER_SURFACE_SEO).filter(e => e.noindex).length
    expect(n, 'noindex 표면이 0개 — 표를 못 읽었거나 전부 색인 대상이 됐다').toBeGreaterThanOrEqual(5)
  })
})

describe('R3 제출 ⇒ 본문 출처가 있다', () => {
  // 🩸 이 주장이 없어서 `/privacy`·`/refund` 가 **제출 O · 본문 기계 X** 로 몇 달을 버텼다.
  //   길이가 아니라 **출처의 존재**를 본다(길이는 FLOOR 의 일 — 중복 잠금 금지).
  const seeded = seedDrivenPaths()

  it.each(staticLocs())('%s — 본문을 만드는 기계가 있다', loc => {
    const why =
      surfaceCopyFor(loc) ? 'surface-copy'
      : seeded.has(loc) ? 'seed/builder'
      : ELSEWHERE[loc] ? 'elsewhere'
      : null
    expect(
      why,
      `${loc} 를 sitemap 이 제출하는데 본문 출처가 없다 — 크롤러에게 빈 문서를 색인해 달라고 ` +
      `요청하는 셈이다(soft-404). shared/seo/surface-copy.ts 에 항목을 넣거나, 시드 기반 표면이면 ` +
      `crawler-noscript.ts 에 배선할 것.`,
    ).not.toBeNull()
  })

  it('다른 파일에서 오는 표면은 그 배선이 살아 있다', () => {
    for (const [loc, { file, wiring }] of Object.entries(ELSEWHERE)) {
      expect(read(file), `${loc} 의 본문 빌더(${file})가 사라졌다`).toMatch(wiring)
    }
  })
})
