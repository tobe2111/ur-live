/**
 * 🔎 **크롤러가 우리 본문을 보는가 — 네이버 본문 · 브랜드 이름 · 매장 엔티티**
 * (2026-10-11 대표 *"네이버도 해주고 … 언제나 최상단에 노출이 될 수 있게끔 … 특히 이용권 페이지들은 더욱"*)
 *
 * ## 이 파일이 고정하는 세 가지 (전부 라이브 실측에서 나온 결함이다)
 *
 * **① 네이버가 본문을 본다** — Yeti UA 로 재니 `/` 6자 · `/u/:handle` 6자 · `/pass/:id` 49자였다.
 *    홈·유어샵 첫 화면이 `isMobileUserAgent` 게이트 뒤였고 Yeti UA 엔 `Mobi|Android|iPhone` 이
 *    하나도 없다. Googlebot 은 스마트폰 크롤러라 **우연히** 보고 있었다(363자/242자).
 *
 * **② 사이트 이름이 브랜드다** — 구글이 `urdeal.kr`(도메인)로 쓰고 있었다. 사이트 이름의 1순위
 *    소스는 **홈페이지의 `WebSite` JSON-LD `name`** 이다. 🩸 이 항목에서 제가 **두 번** 틀렸다:
 *    처음 *"홈 JSON-LD 가 0건"* → 그 뒤 *"`index.html` 에 이미 있으니 내 코드는 중복"* → 마지막에
 *    **UA 별 라이브 실측**으로 결판났다 — `index.html` 에 있는 건 사실이지만 **크롤러는 그 문서를
 *    받지 않는다**(봇 UA 는 `app.get('*')` 의 손으로 쓴 최소 HTML). 즉 `WebSite.name = 유어딜` 은
 *    어떤 검색 크롤러도 한 번도 받은 적이 없었다. ⇒ **파일에 있다 ≠ 크롤러가 받는다.**
 *
 * **③ 매장이 검색엔진에 전달된다** — `address`·`geo` 가 `Product` 안에 있었다. 그 둘은 Product 의
 *    표준 속성이 **아니라서** 구글이 버린다. 즉 "전주 덕진구의 돈가스집" 이라는 사실이 한 번도
 *    전달된 적이 없다 — 로컬 검색이 본류인 서비스에서.
 *
 * ## ⚠️ 이 테스트가 **못** 하는 것
 * - 실제로 색인되는지는 못 잰다(구글·네이버의 몫이고 수일~수주 걸린다). 여기서 보는 것은
 *   **"우리가 줄 것을 주고 있는가"** 까지다. E4 판정은 배포 후 서치콘솔·서치어드바이저다.
 * - 리치 결과로 **표시**될지도 못 잰다(구글이 고른다). 스키마가 유효한지까지다.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { readCode } from '../helpers/source-text'
import { isSearchCrawlerUA, shouldRenderMobileFirstScreen } from '@/shared/seo/crawler-ua'
import { buildDetailNoscript, buildCuratorNoscript } from '../../worker/utils/crawler-noscript'
import { resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { buildDetailMeta } from '../../worker/utils/detail-ssr-meta'

const ORIGIN = 'https://urdeal.kr'

// 라이브에서 실제로 받은 UA 들 — 지어낸 문자열로 재면 현실과 갈린다.
const UA = {
  yeti: 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)',
  googlebotSmart:
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googlebotDesk:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/137.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  pcChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
}

describe('① 검색 크롤러 판정 — 네이버가 데스크톱으로 분류되던 것', () => {
  it('국내 검색이 전부 잡힌다 — 이게 이 수리의 본체다', () => {
    expect(isSearchCrawlerUA(UA.yeti), '네이버 Yeti 를 놓치면 수리가 통째로 무의미하다').toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; DaumOA/4.1; +http://cs.daum.net/robot)')).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; NaverBot/1.0)')).toBe(true)
  })

  it('글로벌 검색·AI 검색도 잡는다', () => {
    for (const ua of [UA.googlebotSmart, UA.googlebotDesk]) expect(isSearchCrawlerUA(ua)).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)')).toBe(true)
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe(true)
  })

  /**
   * 🤖 2026-10-12 — 라이브에서 UA 만 바꿔 `#root` 안쪽 글자를 세니 **이 여섯만 로더**였다
   * (`/` 34자 · `/u/jiwon1228` 20자 ↔ 형제들 395·419자). 대표가 이름을 댄 넷 중 하나가
   * 그록인데 홈이 34자였고, 여섯 다 **이미 HTML 200 을 받는다** — 막혀서 못 본 게 아니라
   * 우리가 그릴 수 있는데 안 그려 줬다.
   */
  it('AI 검색·인용 봇 전부 — 그록·Meta·Mistral·You 가 빠져 있었다', () => {
    const CITING = [
      'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
      'Mozilla/5.0 (compatible; ChatGPT-User/1.0)',
      'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +claudebot@anthropic.com)',
      'Mozilla/5.0 (compatible; Claude-User/1.0)',
      'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
      'Mozilla/5.0 (compatible; Perplexity-User/1.0)',
      'Mozilla/5.0 (compatible; xAI-Bot/1.0)',
      'Mozilla/5.0 (compatible; Grokbot/1.0)',
      'meta-webindexer/1.0',
      'Mozilla/5.0 (compatible; MistralAI-Index/1.0)',
      'Mozilla/5.0 (compatible; MistralAI-User/1.0)',
      'Mozilla/5.0 (compatible; YouBot/1.0)',
    ]
    expect(CITING.length).toBeGreaterThanOrEqual(12)
    for (const ua of CITING) {
      expect(isSearchCrawlerUA(ua), `${ua} 가 본문을 못 받는다`).toBe(true)
      expect(shouldRenderMobileFirstScreen(ua), `${ua} 에 첫 화면이 안 그려진다`).toBe(true)
    }
  })

  it('🔴 학습 전용 토큰은 여기 섞지 않는다 — `Meta-ExternalAgent` ≠ `meta-webindexer`', () => {
    // 🩸 둘은 **다른 봇**이다(하나는 학습이라 robots 로 막혀 있고 하나는 검색이다). `/Meta/i`
    //    처럼 넓게 잡으면 한 줄로 둘을 같이 삼켜, 막아 둔 쪽에 본문을 그려 주게 된다.
    for (const ua of ['Meta-ExternalAgent/1.0', 'GPTBot/1.1', 'ClaudeBot/1.0', 'CCBot/2.0', 'Google-Extended']) {
      expect(isSearchCrawlerUA(ua), `${ua} 는 학습 전용인데 본문 대상이 됐다`).toBe(false)
    }
    // 반대 방향 — Applebot 본체(Siri·Spotlight)는 검색이므로 **반드시** 잡혀야 한다.
    expect(isSearchCrawlerUA('Mozilla/5.0 (compatible; Applebot/0.1)')).toBe(true)
    // 🩸 `Applebot-Extended` 는 위 금지 목록에 **넣지 않는다** — 첫 판에서 넣었다가 이 시험이
    //    잡았고, 코드가 아니라 내 단언이 틀렸다. 애플은 그 토큰을 **robots.txt 로만** 쓴다
    //    (크롤러가 보내는 UA 는 늘 `Applebot`). 그래서 ① 실재하지 않는 UA 라 첫 화면을 그려 줄
    //    기회가 애초에 없고 ② `/Applebot/i` 를 좁혀 가르려 하면 **애플 검색 색인이 통째로 막힌다**
    //    (`bot-detection.ts` 가 같은 이유로 같은 금지를 적어 뒀다). 학습 거부는 robots 가 한다.
    expect(isSearchCrawlerUA('Applebot-Extended'), 'Applebot 본체를 좁히면 Siri·Spotlight 가 막힌다').toBe(true)
  })

  it('🔴 사람 브라우저는 크롤러가 아니다 — 여기서 true 가 나오면 PC 에 모바일 레이아웃이 깔린다', () => {
    expect(isSearchCrawlerUA(UA.pcChrome)).toBe(false)
    expect(isSearchCrawlerUA(UA.mac)).toBe(false)
    expect(isSearchCrawlerUA(UA.iphone)).toBe(false)
    expect(isSearchCrawlerUA('')).toBe(false)
    expect(isSearchCrawlerUA(null)).toBe(false)
    expect(isSearchCrawlerUA(undefined)).toBe(false)
  })

  it('🔴 첫 화면 조건 = 폰 ∪ 크롤러. PC 브라우저는 종전대로 로더', () => {
    expect(shouldRenderMobileFirstScreen(UA.iphone)).toBe(true)
    expect(shouldRenderMobileFirstScreen(UA.yeti)).toBe(true)
    expect(shouldRenderMobileFirstScreen(UA.pcChrome)).toBe(false)
    expect(shouldRenderMobileFirstScreen(UA.mac)).toBe(false)
  })

  it('🔴 사진 폭 SSOT 를 오염시키지 않았다 — `isMobileUserAgent` 는 그대로', () => {
    // 그 술어는 히어로 preload 폭을 정한다. 크롤러를 거기 섞으면 한 함수가 "몇 px 로 받나" 와
    // "본문을 그려 주나" 두 질문에 동시에 답하게 되고, 한쪽을 고치면 다른 쪽이 조용히 움직인다.
    const hero = readCode('src/shared/detail-hero-image.ts')
    expect(hero, '사진 폭 술어에 크롤러가 섞였다').not.toMatch(/Yeti|Googlebot|bingbot|crawler/i)
    const worker = readCode('src/worker/index.ts')
    expect(worker, '히어로 preload 는 사진 폭 술어를 그대로 써야 한다')
      .toContain('isMobileUserAgent(c.req.header(\'user-agent\'))')
  })
})

describe('② `<noscript>` 본문 — 네이버가 49자로 보던 것', () => {
  const seed = {
    name: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트',
    description: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트',
    price: 7500,
    original_price: 14500,
    discount_rate: 0,
    restaurant_name: '홍대돈까스',
    restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10',
    restaurant_phone: '063-251-6785',
  }

  it('가격·주소·전화가 들어간다 — 로컬 검색이 걸릴 수 있는 유일한 텍스트다', () => {
    const html = buildDetailNoscript(seed)
    expect(html).toContain('<noscript>')
    expect(html).toContain('7,500원')
    expect(html).toContain('14,500원')
    expect(html, '할인율은 선언값이 0 이어도 계산값으로 나와야 한다(priceDisplay SSOT)').toContain('48% 할인')
    expect(html).toContain('전북특별자치도 전주시 덕진구 가리내10길 10')
    expect(html).toContain('063-251-6785')
  })

  it('🔴 규율 ② — 첫 화면이 이미 그린 제목·매장명을 반복하지 않는다', () => {
    const html = buildDetailNoscript(seed)
    expect(html, '제목이 반복됐다 — 크롤러에게 같은 문구를 두 번 주는 셈').not.toContain(seed.name)
    // 설명이 제목과 같으면 버린다(시드 실측상 흔하다).
    expect(html.match(/돈가스/g) || [], '같은 낱말이 여러 번 — 반복은 정보가 아니다').toHaveLength(0)
  })

  it('🔴 값이 없으면 줄을 만들지 않는다 — 빈 라벨은 없는 것보다 나쁘다', () => {
    expect(buildDetailNoscript({ name: 'x' })).toBe('')
    expect(buildDetailNoscript(null)).toBe('')
    expect(buildDetailNoscript(undefined)).toBe('')
    const onlyPrice = buildDetailNoscript({ name: 'x', price: 1000 })
    expect(onlyPrice).toContain('1,000원')
    expect(onlyPrice, '주소가 없는데 라벨만 남았다').not.toContain('주소')
    expect(onlyPrice, '전화가 없는데 라벨만 남았다').not.toContain('전화')
  })

  it('🔴 주입 방어 — 매장명·주소의 꺾쇠가 escape 된다', () => {
    const html = buildDetailNoscript({
      name: 'a', price: 100,
      restaurant_address: '<script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('유어샵 — 소개와 진열 목록이 들어간다(핀은 **평평한** 구조)', () => {
    const html = buildCuratorNoscript({
      curator: { name: '정지원', bio: '동네 맛집 모음' },
      pins: [
        { product_name: '치즈돈가스', price: 7500, restaurant_name: '홍대돈까스' },
        { product_name: '아메리카노', price: 2000, restaurant_name: '메가커피' },
      ],
    })
    expect(html).toContain('동네 맛집 모음')
    expect(html).toContain('치즈돈가스')
    expect(html).toContain('홍대돈까스')
    expect(html).toContain('7,500원')
    expect(html, '이름은 첫 화면이 이미 그린다').not.toContain('정지원')
  })

  it('🔴 핀 구조를 중첩으로 바꾸면 조용히 비는 것을 잡는다', () => {
    // 처음 이 모듈을 쓸 때 `pins[].product.name` 으로 가정했다 — 전부 undefined 가 되는데
    // 에러가 안 난다. 그 실수를 테스트가 기억한다.
    const wrong = buildCuratorNoscript({ curator: { bio: '' }, pins: [{ product_name: null, price: 1 } as never] })
    expect(wrong, '이름 없는 핀은 줄을 만들지 않는다').toBe('')
  })
})

describe('③ 브랜드 — 사이트 이름 신호는 `index.html` 정적 블록 한 곳뿐이다', () => {
  // 🩸 2026-10-11, 값을 치르고 배운 것: 제가 *"홈 JSON-LD 가 0건이라 사이트 이름이 도메인으로
  //    떨어졌다"* 고 진단하고 `shared/seo/brand-jsonld.ts` 를 새로 만들었다. **라이브를 재 보니
  //    틀렸다** — `index.html` 에 `Organization`+`WebSite` 가 이미 있고 `name` 이 `유어딜` 이고
  //    `@id` 까지 똑같았다(`https://urdeal.kr/#organization` · `#website`). 즉 제 코드는 같은
  //    `@id` 의 노드를 **두 벌** 내보내는 중복이었다(머지 전에 되돌렸다).
  //    ⇒ 이 describe 는 그 신규 모듈을 검사하던 것에서 **진짜 출처를 지키는 쪽**으로 재조준했다.
  //       그 블록은 `<head>` 에 정적으로 박혀 있어서 그때까지 어떤 가드도 보지 않았다.
  const html = readCode('index.html')

  function homeGraph(): Array<Record<string, unknown>> {
    const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(m, 'index.html 의 JSON-LD 블록이 사라졌다 — 사이트 이름 신호의 유일한 출처다').toBeTruthy()
    // 🩸 **주석을 지우고 파싱하지 말 것.** 2026-10-11 에 제가 설명 주석을 JSON 블록 *안*에 넣어
    //    그 JSON-LD 를 통째로 무효로 만들었는데, 확인 스크립트가 주석을 먼저 지우고 파싱해서
    //    "OK" 가 떴다. 브라우저도 구글도 주석을 지워 주지 않는다 — **원문 그대로** 파싱해야
    //    그 결함이 보인다(에러도 경고도 없이 조용히 무효가 되는 클래스다).
    expect(m![1], 'JSON 블록 안에 주석이 있다 — 그 JSON-LD 는 통째로 무효다').not.toContain('<!--')
    const parsed = JSON.parse(m![1]) as { '@graph'?: Array<Record<string, unknown>> }
    const g = parsed['@graph']
    expect(Array.isArray(g), '@graph 가 아니다 — 구조가 바뀌었으면 이 가드를 함께 고칠 것').toBe(true)
    return g!
  }

  it('홈 `WebSite.name` 이 브랜드다 — 구글이 사이트 이름의 1순위로 읽는 값', () => {
    const g = homeGraph()
    const site = g.find((n) => n['@type'] === 'WebSite')
    const org = g.find((n) => n['@type'] === 'Organization')
    expect(site, 'WebSite 노드가 없으면 구글은 도메인을 쓴다').toBeTruthy()
    expect(site!.name).toBe('유어딜')
    expect(org!.name).toBe('유어딜')
    // 둘이 이어져 있어야 한 조직의 사이트로 읽힌다.
    expect((site!.publisher as { '@id': string })['@id']).toBe(org!['@id'])
  })

  it('🔴 `alternateName` 에 도메인을 품은 이름을 넣지 않는다', () => {
    // 구글 공식 가이드가 꼽는 실패 원인에 *"지나치게 일반적인 이름"* 과 *"화면의 브랜드와 안 맞는
    // 이름"* 이 있다. `"유어딜 urdeal.kr"` 같은 값은 사이트 이름 후보로 도메인 쪽을 가리킨다.
    const g = homeGraph()
    for (const n of g) {
      const alt = n.alternateName
      const list = Array.isArray(alt) ? alt : alt ? [alt] : []
      for (const a of list) {
        expect(String(a), `alternateName 에 도메인이 들어갔다: ${String(a)}`).not.toMatch(/urdeal\.kr|\.com|\.co\.kr/)
      }
    }
  })

  it('🔴 같은 `@id` 를 코드에서 또 만들지 않는다 — 두 벌은 반드시 갈린다', () => {
    // 제가 2026-10-11 에 정확히 이 중복을 만들었다. 서버가 붙이는 메타 경로 어디에도
    // `#organization`·`#website` 노드를 조립하는 코드가 없어야 한다.
    for (const f of [
      'src/shared/seo/consumer-surfaces.ts',
      'src/shared/seo/consumer-surface-table.ts', // 🗂️ 2026-11-01 표 분리
      'src/worker/utils/surface-ssr-meta.ts',
      'src/worker/utils/detail-ssr-meta.ts',
    ]) {
      const src = readCode(f)
      expect(src.length, `${f} 를 못 읽었다 — 이 단언이 통째로 헛돈다`).toBeGreaterThan(500)
      expect(src, `${f} 가 #organization 노드를 또 만든다`).not.toMatch(/'@id':\s*`?\$?\{?origin\}?\/#organization/)
      expect(src, `${f} 가 #website 노드를 또 만든다`).not.toMatch(/'@type':\s*'WebSite'/)
    }
    // 🔀 2026-10-11 재조준: 종전엔 `brand-jsonld.ts` 의 **부재**를 단언했다. 지키려던 불변식은
    //    *"같은 `@id` 가 한 문서에 두 벌 들어가지 않는다"* 이고 그건 그대로다 — 다만 그 모듈이
    //    꽂히는 곳이 **봇 셸**(`index.html` 과 상호배타)이라 중복이 구조적으로 불가능하다.
    //    ⇒ 부재 대신 **"사람 셸 쪽 경로에는 안 들어간다"** 를 단언한다(위 세 파일 검사가 그것).
    expect(existsSync('src/shared/seo/brand-jsonld.ts'),
      '브랜드 모듈이 사라졌다 — 크롤러가 브랜드 노드를 다시 못 받는다').toBe(true)
  })

  it('🔴 없는 SNS 계정을 지어내지 않는다', () => {
    // 404 나는 `sameAs` 는 구글이 확인하러 가서 신뢰 신호를 **깎는다**. 레포의
    // `youtube.com/@urdeal` 은 어드민 입력창의 플레이스홀더다(실제 계정 아님).
    const g = homeGraph()
    for (const n of g) {
      expect(n.sameAs, 'sameAs 를 넣으려면 실제 운영 계정이 있어야 한다').toBeUndefined()
    }
  })
})

describe('④ 이용권 상세 — 매장이 검색엔진에 전달된다 (대표 "특히 이용권 페이지들은 더욱")', () => {
  const payload = JSON.stringify({
    data: {
      id: 2915,
      name: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트',
      restaurant_name: '홍대돈까스',
      restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10',
      restaurant_phone: '063-251-6785',
      restaurant_lat: 35.8424453951244,
      restaurant_lng: 127.111022905076,
      price: 7500,
      image_url: 'https://cdn.example.com/a.jpg',
      category: 'meal_voucher',
      group_buy_status: 'active',
      avg_rating: 4.6,
      review_count: 12,
    },
  })
  const ld = () => {
    const m = buildDetailMeta(payload, ORIGIN, '/pass/2915')!
    return JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
  }

  it('🔴 매장이 `Product` 안이 아니라 **독립 엔티티**다 — Product.address 는 구글이 버린다', () => {
    const arr = ld()
    const product = arr.find((x: { '@type': string }) => x['@type'] === 'Product')
    expect(product, 'Product 가 사라졌다').toBeTruthy()
    expect(product.address, 'Product 에 address 가 남았다 — 표준 속성이 아니라 무시된다').toBeUndefined()
    expect(product.geo, 'Product 에 geo 가 남았다').toBeUndefined()

    const place = arr.find((x: { '@type': string }) => x['@type'] === 'FoodEstablishment')
    expect(place, '식사 이용권인데 매장 엔티티가 없다 — 로컬 검색 신호가 통째로 비어 있다').toBeTruthy()
    expect(place.name).toBe('홍대돈까스')
    expect(place.address.streetAddress).toContain('가리내10길')
    expect(place.telephone).toBe('063-251-6785')
    expect(place.geo.latitude).toBeCloseTo(35.8424, 3)
  })

  it('🔴 Offer 가 그 매장을 가리킨다 — 둘이 연결돼야 "어디서 쓰는 이용권" 이 된다', () => {
    const arr = ld()
    const product = arr.find((x: { '@type': string }) => x['@type'] === 'Product')
    const place = arr.find((x: { '@type': string }) => x['@type'] === 'FoodEstablishment')
    expect(product.offers.availableAtOrFrom['@id']).toBe(place['@id'])
  })

  it('카테고리마다 업종 타입이 갈린다 — 덜 구체적인 쪽으로 폴백', () => {
    const t = (category: string) => {
      const p = JSON.parse(payload)
      p.data.category = category
      const m = buildDetailMeta(JSON.stringify(p), ORIGIN, '/pass/2915')!
      const arr = JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
      return arr.find((x: { '@id'?: string }) => String(x['@id'] || '').endsWith('#place'))?.['@type']
    }
    expect(t('meal_voucher')).toBe('FoodEstablishment')
    expect(t('beauty_voucher')).toBe('HealthAndBeautyBusiness')
    expect(t('stay_voucher')).toBe('LodgingBusiness')
    expect(t('etc_voucher'), '모르는 업종은 상위 타입 — 틀린 업종보다 낫다').toBe('LocalBusiness')
  })

  it('🔴 리뷰가 0건이면 평점을 선언하지 않는다 — 구글 정책 위반이고 0점짜리로 읽힌다', () => {
    const arr = ld()
    const withReviews = arr.find((x: { '@type': string }) => x['@type'] === 'Product')
    expect(withReviews.aggregateRating.ratingValue).toBe(4.6)
    expect(withReviews.aggregateRating.reviewCount).toBe(12)

    const p = JSON.parse(payload)
    p.data.review_count = 0
    p.data.avg_rating = 0
    const m = buildDetailMeta(JSON.stringify(p), ORIGIN, '/pass/2915')!
    const none = JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
      .find((x: { '@type': string }) => x['@type'] === 'Product')
    expect(none.aggregateRating, '리뷰 0건에 평점을 선언했다').toBeUndefined()
  })

  it('🔴 매장 정보가 없으면 빈 엔티티를 만들지 않는다', () => {
    const p = JSON.parse(payload)
    delete p.data.restaurant_address
    delete p.data.restaurant_lat
    delete p.data.restaurant_lng
    const m = buildDetailMeta(JSON.stringify(p), ORIGIN, '/pass/2915')!
    const arr = JSON.parse(m.jsonLd.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&'))
    expect(arr.some((x: { '@id'?: string }) => String(x['@id'] || '').endsWith('#place'))).toBe(false)
    // 그래도 Product·BreadcrumbList 는 남아야 한다 — 매장이 없다고 상품까지 사라지면 안 된다.
    expect(arr.some((x: { '@type': string }) => x['@type'] === 'Product')).toBe(true)
    expect(arr.some((x: { '@type': string }) => x['@type'] === 'BreadcrumbList')).toBe(true)
  })
})

describe('③-2 크롤러 셸 — 브랜드 노드를 **봇이 받는 문서**에 둔다', () => {
  // 🔎 라이브 실측(2026-10-11, 같은 경로를 UA 만 바꿔 받아 봤다):
  //
  //    UA            서빙 셸                        `#organization`
  //    iPhone·PC     index.html(정적 @graph 포함)    있음
  //    Yeti·Googlebot·DaumOA   app.get('*') 최소 HTML        **0**
  //
  // 🧷 게다가 **사이트 전체가 없는 노드를 가리키고 있었다**: 크롤러가 받는 `/blog` 의 JSON-LD 는
  //    `publisher: {'@id': '.../#organization'}` · `isPartOf: {'@id': '.../#website'}` 로
  //    **정의되지 않은 `@id`** 를 참조한다. 봇 셸에 두 노드를 놓으면 그 참조가 이어진다.
  const workerSrc = readCode('src/worker/index.ts')

  /** 봇 셸 템플릿(`const html = ` 템플릿 리터럴)만 잘라낸다 — 거리 앵커(`[\s\S]{0,N}`)는 쓰지 않는다. */
  function botShell(): string {
    const i = workerSrc.indexOf('const html = `<!DOCTYPE html>')
    expect(i, '봇 셸 템플릿을 못 찾았다 — 이 시험의 앵커가 낡았다').toBeGreaterThan(-1)
    const end = workerSrc.indexOf('</html>`', i)
    expect(end).toBeGreaterThan(i)
    return workerSrc.slice(i, end)
  }

  it('봇 셸 `<head>` 에 브랜드 JSON-LD 가 꽂혀 있다', () => {
    const shell = botShell()
    const at = shell.indexOf('${brandJsonLdScript()}')
    expect(at, '봇 셸에 브랜드 JSON-LD 가 없다 — 크롤러는 사이트 이름 신호를 못 받는다').toBeGreaterThan(-1)
    // `<head>` 안이어야 한다(body 로 내려가면 구글은 읽지만 우리 의도와 갈린다).
    expect(at, '브랜드 JSON-LD 가 </head> 밖으로 나갔다').toBeLessThan(shell.indexOf('</head>'))
    expect(workerSrc, '모듈을 import 하지 않았다').toContain("from '../shared/seo/brand-jsonld'")
  })

  it('🔴 `index.html` 의 `@graph` 와 **값이 같다** — 두 벌이 갈리면 사람과 크롤러가 다른 브랜드를 본다', async () => {
    const { BRAND_JSONLD } = await import('@/shared/seo/brand-jsonld')
    const m = readCode('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(m, 'index.html 의 JSON-LD 블록이 사라졌다').toBeTruthy()
    // 원문 그대로 파싱한다(주석을 지우고 파싱하면 "JSON 안 주석" 결함이 안 보인다 — 위 ③ 주석 참조).
    expect(JSON.parse(JSON.stringify(BRAND_JSONLD))).toEqual(JSON.parse(m![1]))
  })

  it('🔴 내보내는 문자열이 **유효한 JSON** 이고 `</script>` 로 탈출하지 않는다', async () => {
    const { brandJsonLdScript, jsonLdScriptTag } = await import('@/shared/seo/brand-jsonld')
    const tag = brandJsonLdScript()
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true)
    const body = tag.slice('<script type="application/ld+json">'.length, -'</script>'.length)

    // 🩸 **지금 데이터엔 `&`·`<` 가 한 글자도 없다** — 그래서 완성본만 보면 escape 를 끼워 넣어도
    //    결과가 같아 "escape 금지" 를 판정할 수 없다(주입 러너가 실제로 그걸 잡았다).
    //    ⇒ 탈출 처리를 **탐침 값으로 직접 재서** 동작을 고정한다.
    const probe = jsonLdScriptTag({ amp: 'a&b', lt: '1<2', close: 'x</script>y' })
    expect(probe, 'HTML escape 가 섞였다 — JSON-LD 가 통째로 무효가 된다').toContain('a&b')
    expect(probe, '`<` 를 escape 하면 안 된다').toContain('1<2')
    expect(probe.slice(0, -'</script>'.length), '닫는 태그를 탈출시키지 않았다').not.toContain('</script')
    expect(body, '닫는 태그를 탈출시키지 않았다').not.toContain('</script')
    const parsed = JSON.parse(body) as { '@graph': Array<Record<string, unknown>> }
    const site = parsed['@graph'].find((n) => n['@type'] === 'WebSite')
    const org = parsed['@graph'].find((n) => n['@type'] === 'Organization')
    expect(site!.name, '크롤러가 받을 사이트 이름').toBe('유어딜')
    expect((site!.publisher as { '@id': string })['@id']).toBe(org!['@id'])
  })

  it('🔴 사람이 받는 셸에는 또 넣지 않는다 — 같은 `@id` 두 벌 금지', () => {
    // 봇 셸과 `index.html` 은 상호배타이므로 각 문서에 정확히 한 벌이다. `index.html` 쪽
    // 서빙 경로(HTMLRewriter 체인)나 메타 빌더가 이 모듈을 쓰면 그 문서에 두 벌이 된다.
    expect(readCode('index.html'), 'index.html 이 모듈을 또 끌어온다').not.toContain('brand-jsonld')
    for (const f of [
      'src/worker/utils/surface-ssr-meta.ts',
      'src/worker/utils/detail-ssr-meta.ts',
      'src/shared/seo/consumer-surfaces.ts',
    ]) {
      const src = readCode(f)
      expect(src.length, `${f} 를 못 읽었다 — 이 단언이 통째로 헛돈다`).toBeGreaterThan(500)
      expect(src, `${f} 가 브랜드 모듈을 또 쓴다 — 사람 셸에 두 벌이 된다`).not.toContain('brand-jsonld')
    }
    // 봇 셸 안에서도 정확히 한 번.
    expect(botShell().split('${brandJsonLdScript()}').length - 1, '봇 셸에 두 번 들어갔다').toBe(1)
  })

  it('🔴 브랜드 설명이 현행 명칭(유어샵)을 쓴다', async () => {
    // 2026-08-26 대표 확정으로 그 기능의 사용자-가시 이름은 "유어샵" 이다. 이 설명은 **검색 AI 가
    // 읽는 우리 자기소개**인데 `check-legacy-domain` 류 가드의 검사 경로(`src/pages`·locales) 밖이라
    // 2026-10-11 까지 옛 이름으로 남아 있었다.
    // 🔑 **옛 이름의 부재는 여기서 단언하지 않는다** — 그 불변식의 주인은 `urshop-naming.test.ts`(N1,
    //    src 전수)이고, 이 파일에 그 리터럴을 적으면 **그 가드가 이 파일을 잡는다**(실제로 잡혔다).
    //    두 가드가 같은 말을 하면 하나는 반드시 낡는다 — 긍정만 보고 부정은 주인에게 맡긴다.
    const { BRAND_JSONLD } = await import('@/shared/seo/brand-jsonld')
    const org = BRAND_JSONLD['@graph'].find((n) => n['@type'] === 'Organization') as { description: string }
    expect(org.description).toContain('유어샵')
  })
})
