import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SURFACE_COPY, surfaceCopyFor } from '@/shared/seo/surface-copy'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'

/**
 * ⚖️ 2026-10-14 — sitemap 이 제출하는 **법정 문서 둘**(`/privacy`·`/refund`)의 크롤러 본문.
 *
 * ## 실측 (Googlebot UA, 라이브)
 *
 *     /privacy  200 · index, follow · 본문 6자 · sitemap 제출
 *     /refund   200 · index, follow · 본문 6자 · sitemap 제출
 *     /terms    200 · index, follow · 본문 323자            ← 같은 빌더, 같은 문서 종류
 *
 * `sitemap.routes.ts` 가 스스로 적어 둔 규율은 *"본문이 있는 것만 넣는다"* 인데 이 둘이 그 짝
 * 주장을 깨고 있었다. 게다가 description 도 동어반복이었다(`유어딜 개인정보처리방침입니다.` 14자).
 *
 * ## 이 시험이 **새로** 지키는 것 (중복 잠금을 피했다)
 *
 * 아래 넷은 기존 가드가 **안 보는** 것만 골랐다. 이미 덮인 것 — 줄이 페이지 소스에 실재하는가
 * (클로킹) · 본문 길이 바닥 · 빌더가 실제로 내는가 · 요율 숫자 금지 · 서버 메타 보유 — 은
 * `thin-surface-copy-2026-10-12.test.ts` 가, 꺼져 있는 기능 금지는
 * `refund-policy-truth-2026-10-13.test.ts` 가 맡는다. 같은 것을 두 곳에서 잠그면 **어느 쪽도
 * 출력으로 판정할 수 없다**(2026-10-11 에 값을 치르고 배운 규칙).
 *
 * ## ⚠️ 못 보는 것
 * - 문장이 **실제로 렌더되는지**(소스 실재만 본다 — 조건부 JSX 안에 있을 수 있다)
 * - 문구가 법적으로 충분한가(법무 검토는 코드 밖이다)
 * - 구글이 색인하는지(수일~수주 · 서치콘솔은 대표만 본다)
 */
const PRIVACY_PAGE = 'src/pages/PrivacyPolicyPage.tsx'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8')
const flat = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('① `/privacy` 는 국문 블록에서만 고른다', () => {
  // 🔑 그 페이지는 `isKorea()` 로 갈린다(`{!isKR && (` 영문 · `{isKR && (` 국문). 라이브 호스트는
  //   `urdeal.kr` 하나라 **보이는 것은 국문뿐**이다(GLOBAL 은 미런칭·폐기 #804).
  //   클로킹 가드는 *같은 파일 안*에 있으면 통과시키므로 **영문 절을 골라도 빨간불이 안 난다** —
  //   아무도 못 보는 글을 크롤러에게 주는 셈이고, 그 구멍을 여기서 닫는다.
  const src = read(PRIVACY_PAGE)
  const en = src.indexOf('{!isKR && (')
  const ko = src.indexOf('{isKR && (')

  it('두 블록 경계를 실제로 찾았다 (못 찾으면 통과가 아니라 측정 고장)', () => {
    expect(en, '영문 블록 경계를 못 찾았다 — 페이지 구조가 바뀌었다').toBeGreaterThan(0)
    expect(ko, '국문 블록 경계를 못 찾았다').toBeGreaterThan(en)
  })

  it('모든 줄이 국문 블록 안에 있다', () => {
    const koBlock = flat(src.slice(ko))
    const enBlock = flat(src.slice(en, ko))
    for (const line of surfaceCopyFor('/privacy')!.lines) {
      expect(koBlock, `"${line.slice(0, 40)}…" 가 국문 블록에 없다`).toContain(flat(line))
      expect(enBlock, `"${line.slice(0, 40)}…" 를 영문 블록에서 골랐다 — 라이브에선 아무도 못 본다`)
        .not.toContain(flat(line))
    }
  })

  it('영문 절 제목을 크롤러 본문에 쓰지 않는다', () => {
    const body = buildStaticSurfaceNoscript('/privacy')
    for (const bad of ['Information We Collect', 'How We Use Your Information', 'Data Retention']) {
      expect(body, `영문 절(${bad})이 크롤러 본문에 샜다`).not.toContain(bad)
    }
  })
})

describe('② 평탄화 부스러기가 섞이지 않는다', () => {
  // 🩸 가드의 평탄화는 태그를 **공백으로** 바꾼다 ⇒ `<span>결제 금액 전액</span>이` →
  //   `결제 금액 전액 이`. 그 모양을 그대로 SSOT 에 붙이면 **클로킹 가드는 통과하는데**
  //   사람이 읽을 수 없는 글이 크롤러에게 나간다(그래서 그 문장은 일부러 뺐다).
  //   한국어 조사는 붙여 쓰므로 **홀로 선 조사**가 곧 그 부스러기의 지문이다.
  //   ⚠️ 거짓 양성 가능: `① 이 방침은…` 처럼 홀로 선 지시어 `이`. 실측 13표면 0건이라 지금은
  //      예외가 없다 — 정말 필요해지면 그 줄만 예외로 적고 **검사를 지우지 말 것**.
  const STRAY = / (이|은|는|을|를|가|도|의|에|로) /

  it('전 표면 — 홀로 선 조사 0', () => {
    const bad: string[] = []
    for (const [path, copy] of Object.entries(SURFACE_COPY))
      for (const line of copy.lines) if (STRAY.test(line)) bad.push(`${path}: ${line.slice(0, 50)}`)
    expect(bad, `평탄화 부스러기로 보이는 줄: ${bad.join(' / ')}`).toEqual([])
  })

  it('검사가 실제로 발화한다 (헛도는 가드가 아니다)', () => {
    expect(STRAY.test('따로 신청하지 않아도 결제 금액 전액 이 자동으로 환불됩니다.')).toBe(true)
    expect(STRAY.test('카드로 결제했으면 카드 결제가 취소되고 딜로 결제했으면 딜로 돌아갑니다.')).toBe(false)
  })
})

describe('③ sitemap 짝 주장 — 제출하면 본문이 있다', () => {
  const sm = read(SITEMAP)

  it.each(['/privacy', '/refund'])('%s — 제출하고 본문도 있다', path => {
    expect(sm, `${path} 가 sitemap 에서 빠졌다`).toContain(`loc: '${path}'`)
    const text = flat(buildStaticSurfaceNoscript(path))
    expect(text.length, `${path} 를 제출하는데 본문이 ${text.length}자다`).toBeGreaterThan(200)
  })
})

describe('④ description 이 제목을 한 번 더 말하지 않는다', () => {
  // 라이브 실측 — `/privacy` 14자 · `/refund` 21자였고 둘 다 제목의 되풀이였다. 검색결과
  // 스니펫 자리라 그 줄이 곧 클릭 여부를 가른다. 형제 `/terms` 는 76자로 내용을 말한다.
  it.each(['/privacy', '/refund', '/terms'])('%s', path => {
    const e = CONSUMER_SURFACE_SEO[path]
    expect(e, `${path} 가 SEO 표에서 빠졌다`).toBeTruthy()
    const d = e.description ?? ''
    expect(d.length, `${path} description 이 ${d.length}자다 — 동어반복으로 되돌아갔다`)
      .toBeGreaterThanOrEqual(60)
    // 제목만 반복하는 모양(`유어딜 {제목}입니다.`)을 직접 막는다.
    expect(d, `${path} description 이 제목의 되풀이다`).not.toBe(`유어딜 ${e.title}입니다.`)
  })
})

describe('⑤ 반대 방향 — 둘은 여전히 색인 대상이다', () => {
  // 🔴 본문을 주는 수선이 "그냥 noindex 로 가린다" 로 뒤집히지 않게 못 박는다. 법정 문서는
  //   사람이 검색으로 찾는 문서이고, 푸터 링크와 sitemap 제출이 그 전제다.
  it.each(['/privacy', '/refund'])('%s — noindex 아님 · crumb 보유(h1 이 생긴다)', path => {
    const e = CONSUMER_SURFACE_SEO[path]
    expect(e.noindex ?? false, `${path} 가 noindex 로 돌아갔다`).toBe(false)
    expect(e.crumb, `${path} 의 crumb 이 사라졌다 — 크롤러 본문에 h1 이 없어진다`).toBeTruthy()
    expect(buildStaticSurfaceNoscript(path), `${path} 본문에 h1 이 없다`).toContain('<h1')
  })
})
