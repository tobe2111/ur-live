/**
 * 🧭 색인 대상인데 크롤러 본문이 **6자**인 표면 셋 (2026-10-14)
 *
 * 대표 *"다 해주고 머지 후 또 개선점 찾아"*.
 *
 * ## 실측 (Googlebot UA 로 라이브)
 *
 *     /gdpr                 200 · 본문 6자 · index, follow · 제목 OK
 *     /influencer/rankings  200 · 본문 6자 · index, follow · 제목 OK
 *     /partnership          200 · 본문 6자 · index, follow · **제네릭 홈 제목**(표에 없었다)
 *     (대조) /business      301 → /partners                 ← 결함 아님
 *     (대조) /videos        200 · 본문 6자 · noindex         ← 의도대로
 *
 * 🩸 **`/business` 는 결함이 아니었다.** 처음 "제네릭 홈 제목 + 본문 6자" 로 보고했는데, 그건 제
 *    프로브에 `-L` 이 없어 **301 의 빈 본문**을 읽은 것이었다(`consumer-redirects.ts` 가 이미
 *    `/business → /partners` 를 301 로 돌린다). 리다이렉트를 따라가지 않는 측정으로 "본문이 없다"
 *    를 말하면 안 된다. 그 오보를 같은 날 정정했고, 이 시험 ④가 그 301 을 못 지우게 잠근다.
 *
 * ## 처방이 표면마다 다르고, 가르는 기준은 **본문을 정직하게 채울 수 있는가** 다
 *
 * - **`/gdpr` → 본문을 준다.** 8개 절을 가진 **진짜 문서**이고 문장이 `<p>` 안에 통째로 있다
 *   (단일 언어 · 보간 없음) ⇒ 요약을 *쓰는* 게 아니라 *옮기는* 것이라 `surface-copy` 의 규율
 *   (클로킹 금지)을 지킨다. 6자 → **382자**.
 * - **`/influencer/rankings` → noindex.** 그 화면의 글자는 제목(= 그 표의 title 과 같은 말) ·
 *   `지역별 매출 Top` · 표 머리뿐이라 합쳐 **20자**다. `surface-copy` 의 바닥은 110자이고 그걸
 *   채우려면 **문장을 지어내야** 한다 — 2026-10-13 `/urshorts` 를 같은 이유로 뺀 그 판단이다.
 * - **`/partnership` → noindex.** 4줄 문의 **폼**이고(하나는 입력 안내, 하나는 접수 토스트)
 *   같은 의도(*매장 입점*·*제휴*)는 `/partners`(237자 · 색인 · sitemap 제출)가 이미 받는다.
 *
 * ## 🔴 이 시험이 잠그는 것 = **다른 가드가 안 보는 것만**
 *
 * 중복 잠금은 각 잠금을 시험 불가능하게 만든다(이 레포가 2026-10-11 에 값을 치른 규칙). 그래서
 * 아래 둘은 **일부러 여기서 단언하지 않는다** — 이미 일반 규칙으로 잠겨 있다:
 *   · *noindex 표면엔 `crumb` 가 없다* → `surface-list-jsonld-2026-10-11.test.ts`(전수 순회)
 *   · *noindex 표면을 sitemap 이 제출하지 않는다* → `seo-region-encoding-availability-2026-10-13.test.ts`(전수 순회)
 *   · *`/gdpr` 본문 길이 바닥(380자)* → `thin-surface-copy-2026-10-12.test.ts` 의 FLOOR 표
 *
 * ## ⚠️ 못 보는 것
 *
 * - 구글·네이버가 실제로 색인에서 빼는지(수일~수주 · 서치콘솔은 **대표만** 본다)
 * - HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖)
 * - `/gdpr` 법정 문구의 **정확성** — "6. Data Transfers" 가 `Firebase (Google Cloud)` 를 드는데
 *   Firebase 클라이언트는 2026-08-04 에 전면 삭제됐다(#804). 그래서 그 줄은 **SSOT 로 승격하지
 *   않았고**(⑤가 그 결정을 잠근다) 문구 수정 자체는 법정 문서라 **대표 확인**이다(별건).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { resolveConsumerAlias } from '@/shared/seo/consumer-redirects'
import { SURFACE_COPY } from '@/shared/seo/surface-copy'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { readCode } from '../helpers/source-text'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')
/** 크롤러가 실제로 읽는 글자(엔티티 디코드 — `thin-surface-copy` 와 같은 이유). */
const crawlerText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()

describe('① /partnership — 표에 들어왔고(제네릭 홈 제목 아님) noindex 다', () => {
  it('표에 항목이 있다 — 없으면 서버가 홈 제목을 준다', () => {
    const e = CONSUMER_SURFACE_SEO['/partnership']
    expect(e, '/partnership 이 표에서 사라졌다 — 서버 메타가 제네릭 홈으로 돌아간다').toBeTruthy()
    expect(e!.title).toContain('제휴')
    // 홈 기본 제목이 새어 들어오지 않았는지(이 결함의 정체)
    expect(e!.title).not.toContain('돈버는 쇼핑')
  })

  it('noindex 다 — 4줄 문의 폼이고 같은 의도는 /partners 가 받는다', () => {
    expect(CONSUMER_SURFACE_SEO['/partnership']!.noindex).toBe(true)
  })

  it('본문을 지어내지 않았다 — surface-copy 에 넣지 않는다', () => {
    // 폼 화면에 110자가 없으므로 넣으려면 문장을 만들어야 한다. noindex 가 정직한 처방이다.
    expect(SURFACE_COPY['/partnership']).toBeUndefined()
    expect(buildStaticSurfaceNoscript('/partnership')).toBe('')
  })
})

describe('② /influencer/rankings — noindex (본문을 정직하게 채울 수 없다)', () => {
  it('noindex 다', () => {
    expect(CONSUMER_SURFACE_SEO['/influencer/rankings']!.noindex).toBe(true)
  })

  it('surface-copy 에 넣지 않는다 — 110자를 채우려면 지어내야 한다', () => {
    expect(SURFACE_COPY['/influencer/rankings']).toBeUndefined()
  })

  it('전제가 실재한다 — 그 화면에 산문이 없다', () => {
    // 🔑 처방의 **근거**를 잠근다. 페이지에 문단이 생기면 이 단언이 빨간불이 되고, 그때
    //   noindex 를 되돌릴지 다시 판단하게 된다(처방을 영구화하지 않는다).
    const page = read('src/pages/InfluencerRankingsPage.tsx')
    // 🩸 첫 판은 `>([^<>{}]{10,})<` 로 **아무 텍스트 노드**를 집었는데, `.tsx` 에는 `=>` 와
    //   `useState<` 때문에 그 모양이 **코드 안에도** 생긴다 — `('month') const [metric, setMetric]
    //   = useState` 를 48자 "산문" 으로 읽어 **코드는 멀쩡한데 빨간불**이 났다. 재는 쪽이 틀렸다.
    //   ⇒ **한글이 든 텍스트 노드만** 센다(이 화면은 한국어다).
    const texts = [...page.matchAll(/>([^<>{}]*[가-힣][^<>{}]*)</g)].map(m => m[1].trim()).filter(Boolean)
    expect(texts.length, '한글 텍스트를 한 건도 못 읽었다 — 0건이면 통과가 아니라 측정 고장이다')
      .toBeGreaterThanOrEqual(5)
    const longest = texts.reduce((a, b) => (b.length > a.length ? b : a), '')
    // 실측 2026-10-14: 가장 긴 줄이 `지역별 매출 Top — 매월 1일 리셋`(21자)이고 나머지는 표 머리·상태 문구다.
    expect(longest.length, `산문이 생겼다(가장 긴 줄 ${longest.length}자: "${longest}") — noindex 를 재검토할 것`)
      .toBeLessThan(40)
  })
})

describe('③ 반대 방향 — 그 의도를 받는 랜딩은 색인 대상으로 남는다', () => {
  // 🔴 **이 방향이 더 비싸다.** thin 표면을 빼는 것은 작은 이득이지만, 그 의도를 받는 랜딩까지
  //   noindex 가 되면 *"유어딜 입점"*·*"딜 소개로 수익"* 질의에 아무것도 안 서게 된다.
  it.each(['/partners', '/influencer'])('%s 는 index 이고 crumb 가 있다', path => {
    const e = CONSUMER_SURFACE_SEO[path]
    expect(e, `${path} 표 항목이 사라졌다`).toBeTruthy()
    expect(e!.noindex, `${path} 가 noindex 가 됐다 — 이 처방이 기대는 랜딩이다`).not.toBe(true)
    expect(e!.crumb, `${path} 의 crumb 가 비었다`).toBeTruthy()
  })

  it.each(['/partners', '/influencer'])('%s 는 크롤러 본문을 갖는다 (noindex 처방의 전제)', path => {
    const text = crawlerText(buildStaticSurfaceNoscript(path))
    expect(text.length, `${path} 본문 ${text.length}자 — 이 표면이 thin 이면 처방의 전제가 사라진다`)
      .toBeGreaterThan(150)
  })
})

describe('④ /business 는 301 이다 (결함 아님 — 측정 오류였다)', () => {
  it('별칭 301 이 살아 있다', () => {
    expect(resolveConsumerAlias('/business')).toBe('/partners')
  })

  it('표에 넣지 않는다 — 301 되는 주소에 메타를 주면 서로 반대되는 신호다', () => {
    expect(CONSUMER_SURFACE_SEO['/business']).toBeUndefined()
  })
})

describe('⑤ /gdpr — 본문을 얻었고, 일부러 뺀 것이 되살아나지 않는다', () => {
  const copy = SURFACE_COPY['/gdpr']

  it('항목이 있고 색인 대상이다', () => {
    expect(copy, '/gdpr surface-copy 항목이 사라졌다').toBeTruthy()
    expect(CONSUMER_SURFACE_SEO['/gdpr']!.noindex).not.toBe(true)
  })

  it('🔒 이메일을 본문에 싣지 않는다 — 수확 표면만 늘고 색인 보탬은 0', () => {
    for (const line of copy!.lines) expect(line, line).not.toMatch(/@/)
  })

  it('🔒 낡았을 수 있는 법정 문구(Firebase)를 SSOT 로 승격하지 않는다', () => {
    // Firebase 클라이언트는 2026-08-04 전면 삭제(#804). 그 줄을 넣는 것은 낡은 주장을 키우는 일이다.
    for (const line of copy!.lines) expect(line, line).not.toMatch(/Firebase/i)
    // 전제가 실재한다 — 페이지엔 아직 그 줄이 있다(고쳐지면 이 단언이 빨간불 → 함께 판단).
    expect(read('src/pages/GDPRPage.tsx')).toContain('Firebase')
  })

  it('h1 과 같은 말을 두 번 하지 않는다', () => {
    const h1 = CONSUMER_SURFACE_SEO['/gdpr']!.crumb
    expect(h1).toBeTruthy()
    for (const line of copy!.lines) expect(line).not.toBe(h1)
    // 빌더가 crumb 로 h1 을 내므로 본문이 그 글자를 되풀이하면 중복이 된다.
    expect(buildStaticSurfaceNoscript('/gdpr')).toContain(`<h1>${h1}</h1>`)
  })

  it('짝 주장 — 본문을 얻었으니 sitemap 이 제출한다', () => {
    // 🔑 `/urshorts` 와 **같은 순서**다: 본문 실측이 먼저, 제출은 그다음. 반대로 하면 soft-404 를 쌓는다.
    expect(readCode('src/worker/routes/sitemap.routes.ts')).toContain("loc: '/gdpr'")
  })
})

describe('⑥ 반대 방향 — robots 가 noindex 를 읽을 수 있어야 한다', () => {
  // 🔴 폐기·색인제외 URL 처리의 **가장 흔한 실수**: `Disallow` 로 막으면 크롤러가 그 noindex 를
  //   **읽을 수 없어** 이미 색인된 URL 이 영구히 남는다. 색인을 뺄 때는 크롤을 **열어 둬야** 한다.
  const robots = read('public/robots.txt').split('\n').filter(l => !l.trimStart().startsWith('#')).join('\n')

  it('Allow: /influencer/rankings 가 살아 있다 (/influencer/ 는 Disallow 라 이 예외가 필수)', () => {
    expect(robots).toMatch(/^Disallow: \/influencer\/$/m)
    expect(robots, 'Allow 예외가 사라지면 noindex 를 못 읽어 색인에 영구히 남는다')
      .toMatch(/^Allow: \/influencer\/rankings$/m)
  })

  it('/partnership 을 Disallow 하지 않는다', () => {
    expect(robots).not.toMatch(/^Disallow: \/partnership/m)
  })
})
