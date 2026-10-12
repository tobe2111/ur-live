/**
 * 🧭 **AI 검색(GEO) — 컨셉 표면이 크롤러에게 문장을 준다** (2026-10-12)
 *
 * 대표 *"그록, 클로드 등 AI 모든 AI 서비스에서 검색 시 나오게 해줘"* ·
 * *"AI 서비스 유저가 여행 계획을 짠다던지 동네 맛집을 찾는다던지 할 때 유어딜과 유어딜
 * 이용권들이 나오게끔"* · *"합리적인 여행, 할인권 등의 … 컨셉에 맞는 내용들을 바탕으로"*.
 *
 * ## 무엇이 틀려 있었나 (라이브 실측 2026-10-12, Googlebot UA 로 받아 **파싱해서** 셌다)
 *
 *     경로            크롤러 본문        구조화 데이터
 *     /faq                33자         FAQPage **0건**  ← 답변 14개가 코드에 있는데도
 *     /about              30자         WebPage 만
 *     /region/서울        26자         빵부스러기만, 항목 0건
 *
 * 세 줄이 같은 병이다 — `<title>`·`description`·canonical 은 **전부 멀쩡**했고 **문장만** 없었다.
 * `/faq` 는 더 고약했다: `FAQPage` JSON-LD 를 `FAQPage.tsx` 가 **이미 만들고 있었는데**
 * react-helmet 경유라 JS 를 안 돌리는 크롤러에게 **한 글자도 배달되지 않았다.**
 * 에러도 배포 실패도 없다 — 재 본 사람만 안다.
 *
 * 🔑 **언어모델은 인용할 문장이 있어야 인용한다.** 상품 상세는 `Product`+`Offer`+
 * `FoodEstablishment` 로 *"이런 게 있다"* 를 전달하지만, *"유어딜이 무엇인가"*·
 * *"동네 맛집 할인권은 어디서 찾나"*·*"여행 숙소 이용권이 있나"* 를 답할 문장은 어디에도 없었다.
 *
 * ## 이 시험이 고정하는 것 (짝으로 묶인 불변식)
 *
 *   ① robots — `Google-Extended` 는 차단 **안 한다**(제미나이 인용) / 학습 봇은 **계속 차단**
 *   ② 문구는 **한 벌** — 화면(`FAQPage.tsx`)과 서버 JSON-LD·noscript 가 같은 배열에서 온다
 *   ③ `FAQPage` 는 `/faq` **에만** (그 페이지에 없는 Q&A 를 선언하면 역효과)
 *   ④ `<noscript>` 는 **사람 화면에 영향 0** — 로더를 지우지 않고 앞에 붙는다
 *   ⑤ 지역 항목은 **그 지역만** · 시드 경로는 홈과 **같은 캐시 키**(예열 적중 = 추가 비용 0)
 *
 * ## ⚠️ 이 시험이 못 보는 것
 *
 *   · 그 봇들이 실제로 크롤하는지 · ChatGPT·제미나이·그록 답변에 **인용되는지**
 *     (둘 다 외부 판정이고 수일~수주 걸린다 — 서치콘솔은 대표만 본다)
 *   · Cloudflare 엣지의 AI 봇 차단 설정(대시보드라 레포가 못 본다)
 *   · HTMLRewriter 런타임 배선(워커 전용 API 라 유닛 밖 — 배포 후 curl 이 유일한 판정)
 *   · **실제 입점 매장 수.** 2026-10-12 실측 **2곳**이고, 그러면 "동네 맛집" 질의에 우리를
 *     쓸 이유 자체가 없다. 이 시험은 *실물이 늘어나는 순간 바로 인용되게* 준비된 상태까지만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CONCEPT_FAQ, CONCEPT_ABOUT_LINES } from '@/shared/seo/concept-content'
import { MAIN_SEED_PATH, REGION_PATH_RE } from '@/shared/seo/region-seed'
import { buildSurfaceListJsonLd } from '@/worker/utils/surface-list-jsonld'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'
import { stripComments } from '@/tests/helpers/source-text'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8')
const ROBOTS = 'public/robots.txt'
const WORKER = 'src/worker/index.ts'
const FAQ_PAGE = 'src/pages/FAQPage.tsx'
const PREWARM = 'src/worker/cron/cache-prewarm.ts'
/** 카테고리 라벨도 로케일에 있어야 한다 — 서비스 카테고리가 컨셉 넷의 소속이다. */
const f_cat = 'catService'

/** 주석을 뺀 실행되는 줄만. 제거를 기록하는 주석이 제거를 검사하는 단언을 통과시키는 것을 막는다. */
const code = (p: string) => stripComments(read(p))

const META = {
  title: '자주 묻는 질문 - 이용권 사용·환불 - 유어딜',
  description: '유어딜 이용 안내',
  canonical: 'https://urdeal.kr/faq',
}

describe('① robots — 제미나이는 열고, 학습은 계속 막는다', () => {
  /** robots 의 차단 그룹(주석 제외)에 그 토큰이 있는가. */
  const blocked = (ua: string) =>
    new RegExp(`^User-agent: ${ua}$`, 'm').test(read(ROBOTS).split('\n').filter(l => !l.trimStart().startsWith('#')).join('\n'))

  it('`Google-Extended` 를 차단하지 않는다 — 그 토큰이 제미나이의 그라운딩(=인용)까지 묶는다', () => {
    expect(blocked('Google-Extended'), 'robots 가 Google-Extended 를 다시 막았다 — 제미나이가 우리를 근거로 쓸 수 없게 된다').toBe(false)
  })

  it('학습 크롤러는 계속 차단된다 (제미나이 해제가 전면 개방으로 번지지 않았는지)', () => {
    for (const ua of ['GPTBot', 'ClaudeBot', 'CCBot', 'Bytespider', 'Meta-ExternalAgent']) {
      expect(blocked(ua), `robots 에 ${ua} 차단이 사라졌다`).toBe(true)
    }
  })

  it('`Applebot-Extended` 는 차단 유지 — 애플은 그 토큰이 *학습 전용*이고 색인은 `Applebot` 이 따로 한다', () => {
    // 🩸 구글과 애플을 같은 것으로 묶어 본 것이 2026-10-11 오기의 출처다. 둘은 다르다.
    expect(blocked('Applebot-Extended')).toBe(true)
    expect(blocked('Applebot'), 'Applebot(검색 색인)을 막으면 Siri·스포트라이트 노출이 사라진다').toBe(false)
  })

  it('비공개 경로 Disallow 는 그대로다 (해제가 그쪽으로 새지 않았는지)', () => {
    const r = read(ROBOTS)
    for (const p of ['/admin', '/seller/login', '/supplier']) {
      expect(r, `robots 에서 ${p} 차단이 사라졌다`).toContain(`Disallow: ${p}`)
    }
  })
})

describe('② 문구는 한 벌 — 화면과 서버가 같은 배열에서 온다', () => {
  it('`FAQPage.tsx` 가 SSOT 를 쓴다 (손으로 베낀 배열 부활 금지)', () => {
    const c = code(FAQ_PAGE)
    expect(c, 'FAQPage 가 CONCEPT_FAQ 를 안 쓴다 — 화면과 구조화 데이터가 갈린다').toContain('CONCEPT_FAQ.map(')
    // 베낀 배열이 돌아오면 그 모양(`question: t('faq.q1'`)이 다시 나타난다.
    expect(c, '베낀 Q&A 배열이 되살아났다').not.toMatch(/question:\s*t\('faq\.q1'/)
  })

  it('SSOT 가 비어 있지 않다 (0건이면 통과가 아니라 고장이다)', () => {
    expect(CONCEPT_FAQ.length).toBeGreaterThanOrEqual(10)
    expect(CONCEPT_ABOUT_LINES.length).toBeGreaterThanOrEqual(3)
    for (const f of CONCEPT_FAQ) {
      expect(f.question.length, `빈 질문: ${f.key}`).toBeGreaterThan(4)
      expect(f.answer.length, `빈 답변: ${f.key}`).toBeGreaterThan(10)
      expect(f.key, 'i18n 키 모양이 깨졌다 — 번역이 덮어쓸 수 없게 된다').toMatch(/^faq\.q\d+$/)
    }
  })

  it('6개 언어 로케일에 그 키가 다 있다 — 한 언어만 비면 그 언어 사용자는 한국어를 본다', () => {
    // 기존 q1~q10 이 여섯 로케일에 다 있었다. 컨셉 넷을 추가하면서 그 패턴을 깨면,
    // 코드는 `defaultValue` 로 조용히 한국어를 내보내므로 **에러 없이** 그 언어만 섞인다.
    for (const lang of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const t = JSON.parse(read(`public/locales/${lang}/translation.json`)) as { faq: Record<string, string> }
      for (const f of CONCEPT_FAQ) {
        const aKey = f.key.replace('.q', '.a').replace('faq.', '')
        expect(t.faq[f.key.replace('faq.', '')], `${lang} 로케일에 ${f.key} 가 없다`).toBeTruthy()
        expect(t.faq[aKey], `${lang} 로케일에 ${aKey} 가 없다`).toBeTruthy()
      }
      expect(t.faq[f_cat], `${lang} 로케일에 카테고리 키가 없다`).toBeTruthy()
    }
  })

  it('컨셉 질의(여행·동네 맛집·할인권)가 실제로 들어 있다 — 대표가 말한 질문의 모양', () => {
    const qs = CONCEPT_FAQ.map(f => f.question).join(' ')
    for (const kw of ['동네 맛집', '여행', '이용권과 교환권']) {
      expect(qs, `컨셉 질의에서 "${kw}" 가 빠졌다`).toContain(kw)
    }
  })

  it('수치를 적지 않았다 — 요율·기간은 어드민 조정 대상이라 적으면 반드시 낡는다', () => {
    const all = CONCEPT_FAQ.map(f => f.answer).join(' ') + CONCEPT_ABOUT_LINES.join(' ')
    // 컨셉 넷 + 소개에 한해 검사한다(기존 1~8 은 "7일 이내"·"3-7 영업일" 같은 운영 안내를 원래 갖고 있었다).
    const conceptOnly = CONCEPT_FAQ.filter(f => Number(f.key.replace('faq.q', '')) >= 11).map(f => f.answer).join(' ')
      + CONCEPT_ABOUT_LINES.join(' ')
    expect(conceptOnly, '컨셉 문구에 퍼센트 수치가 들어갔다').not.toMatch(/\d+\s*%/)
    expect(all.length).toBeGreaterThan(200)
  })
})

describe('③ FAQPage 구조화 데이터는 `/faq` 에만', () => {
  const parse = (s: string) => JSON.parse(s.replace(/\\u003c/g, '<')) as { '@graph': Array<Record<string, unknown>> }

  it('`/faq` 가 FAQPage 를 내고, Q&A 수가 SSOT 와 같다', () => {
    const out = buildSurfaceListJsonLd('/faq', '', 'https://urdeal.kr', META, null)
    expect(out, '/faq 가 JSON-LD 를 안 낸다').not.toBe('')
    const g = parse(out)['@graph']
    const faq = g.find(n => n['@type'] === 'FAQPage') as { mainEntity?: unknown[] } | undefined
    expect(faq, 'FAQPage 노드가 없다').toBeTruthy()
    expect(faq?.mainEntity).toHaveLength(CONCEPT_FAQ.length)
    const first = (faq?.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>)[0]
    expect(first.name).toBe(CONCEPT_FAQ[0].question)
    expect(first.acceptedAnswer.text).toBe(CONCEPT_FAQ[0].answer)
  })

  it('다른 표면엔 FAQPage 가 없다 — 그 페이지에 없는 Q&A 를 선언하지 않는다', () => {
    for (const p of ['/', '/about', '/browse', '/vouchers']) {
      const out = buildSurfaceListJsonLd(p, '', 'https://urdeal.kr', { ...META, canonical: `https://urdeal.kr${p}` }, null)
      if (!out) continue
      expect(parse(out)['@graph'].some(n => n['@type'] === 'FAQPage'), `${p} 가 FAQPage 를 낸다`).toBe(false)
    }
  })

  it('noindex 표면엔 아무것도 안 낸다 (종전 규율 불변)', () => {
    expect(buildSurfaceListJsonLd('/faq', '', 'https://urdeal.kr', { ...META, noindex: true }, null)).toBe('')
  })
})

describe('④ noscript — 크롤러는 읽고, 사람 화면은 그대로다', () => {
  it('`/faq` 가 Q&A 를 전부 글로 낸다', () => {
    const ns = buildStaticSurfaceNoscript('/faq')
    expect(ns.startsWith('<noscript>')).toBe(true)
    expect(ns).toContain(CONCEPT_FAQ[0].question)
    expect(ns).toContain(CONCEPT_FAQ[CONCEPT_FAQ.length - 1].answer)
    // 라이브 33자 → 이 요약으로 얼마나 늘어나는지. 하한을 둬서 "빈 문자열인데 통과" 를 막는다.
    expect(ns.replace(/<[^>]+>/g, '').length).toBeGreaterThan(800)
  })

  it('`/about` 이 소개 문장을 낸다', () => {
    const ns = buildStaticSurfaceNoscript('/about')
    for (const l of CONCEPT_ABOUT_LINES) expect(ns).toContain(l)
  })

  it('대상 밖 경로엔 아무것도 안 낸다 (전 표면에 같은 글이 붙는 것 차단)', () => {
    for (const p of ['/', '/vouchers', '/pass/2919', '/u/jiwon1228', '/admin', '/region']) {
      expect(buildStaticSurfaceNoscript(p, null), `${p} 에 noscript 가 붙는다`).toBe('')
    }
  })

  it('끝 슬래시도 같은 키로 본다', () => {
    expect(buildStaticSurfaceNoscript('/faq/')).not.toBe('')
  })

  it('워커가 로더를 지우지 않고 앞에 붙인다 — 사람 화면은 byte-동일이어야 한다', () => {
    const c = code(WORKER)
    expect(c, 'noscript 가 로더를 대체하고 있다 — 로딩 화면이 사라진다').toContain('staticNs + urdealLoaderHtml')
    expect(c).toContain('buildStaticSurfaceNoscript(url.pathname, ssrPayload)')
  })
})

describe('⑤ 지역 — 그 지역 항목만, 시드는 홈과 같은 캐시 키', () => {
  const seed = JSON.stringify({
    success: true,
    data: [
      { id: 1, name: '닭도리탕 2인', restaurant_name: '달빛한스푼', restaurant_address: '서울 서초구 방배중앙로 165', price: 31000, original_price: 35000, category: 'meal_voucher' },
      { id: 2, name: '한우 모둠', restaurant_name: '기천한우직판장', restaurant_address: '경기 파주시 조리읍 통일로 318', price: 96400, original_price: 125000, category: 'meal_voucher' },
      { id: 3, name: '아메리카노', restaurant_name: '브랜드', restaurant_address: '서울 강남구 테헤란로 1', price: 4100, deal_only: 1, category: 'etc_voucher' },
    ],
  })

  it('`/region/서울` 은 서울 항목만 — 다른 시/도가 섞이지 않는다', () => {
    const ns = buildStaticSurfaceNoscript('/region/서울', seed)
    expect(ns).toContain('달빛한스푼')
    expect(ns, '다른 지역 가게가 섞였다').not.toContain('기천한우직판장')
    expect(ns, '교환권(매장 없음)이 섞였다').not.toContain('아메리카노')
    expect(ns).toContain('서울 이용권')
  })

  it('시군구까지 좁힌다', () => {
    expect(buildStaticSurfaceNoscript('/region/서울/서초구', seed)).toContain('달빛한스푼')
    expect(buildStaticSurfaceNoscript('/region/서울/강남구', seed)).not.toContain('달빛한스푼')
  })

  it('퍼센트 인코딩 경로도 같게 판정한다 (워커가 받는 pathname 모양)', () => {
    expect(buildStaticSurfaceNoscript(`/region/${encodeURIComponent('서울')}`, seed)).toContain('달빛한스푼')
  })

  it('모르는 지역·깨진 인코딩은 0건 — 지어낸 세그먼트(도어웨이)에 내용을 주지 않는다', () => {
    expect(buildStaticSurfaceNoscript('/region/없는지역', seed)).toBe('')
    expect(buildStaticSurfaceNoscript('/region/%E0%A4%A', seed)).toBe('')
  })

  it('HTML 을 탈출한다 — 상수가 아니라 **시드 값**으로 재야 판정이 된다', () => {
    const evil = JSON.stringify({
      data: [{ id: 9, name: 'x</script><b>y', restaurant_name: 'a&b', restaurant_address: '서울 서초구 1', price: 1000 }],
    })
    const ns = buildStaticSurfaceNoscript('/region/서울', evil)
    expect(ns, '시드 값이 그대로 마크업에 들어갔다').not.toContain('</script>')
    expect(ns).toContain('&amp;')
  })

  it('ItemList 도 그 지역만 낸다', () => {
    const out = buildSurfaceListJsonLd('/region/서울', '', 'https://urdeal.kr',
      { title: '서울 이용권', description: '서울', canonical: 'https://urdeal.kr/region/서울' }, seed)
    const g = JSON.parse(out)['@graph'] as Array<Record<string, unknown>>
    const page = g.find(n => n['@type'] === 'CollectionPage') as { mainEntity?: { itemListElement?: Array<{ name?: string }> } } | undefined
    const names = (page?.mainEntity?.itemListElement ?? []).map(x => JSON.stringify(x))
    expect(names.join(' '), '서울 항목이 없다').toContain('달빛한스푼')
    expect(names.join(' '), '다른 지역이 섞였다').not.toContain('기천한우직판장')
  })

  it('시드 경로가 홈과 같은 상수이고, 그 값이 예열 목록에 실재한다 (추가 비용 0 의 근거)', () => {
    const w = code(WORKER)
    // 두 분기가 같은 상수를 쓴다 — 리터럴로 베끼면 캐시 키가 갈려 지역 페이지만 콜드 D1 이 된다.
    expect((w.match(/slot: 'MAIN', path: MAIN_SEED_PATH/g) ?? []).length, '홈·지역이 같은 시드 상수를 쓰지 않는다').toBe(2)
    expect(w, '지역 분기가 사라졌다').toContain('REGION_PATH_RE.test(url.pathname)')
    // 예열이 헛돌지 않는가 — HOT_PATHS 에 그 문자열이 실제로 있어야 엣지 캐시를 맞는다.
    expect(code(PREWARM), `예열 목록에 ${MAIN_SEED_PATH} 가 없다 — 지역·홈 시드가 콜드 D1 이 된다`).toContain(MAIN_SEED_PATH)
  })

  it('지역 경로 판정이 목록(`/region`)과 더 깊은 경로를 삼키지 않는다', () => {
    expect(REGION_PATH_RE.test('/region')).toBe(false)
    expect(REGION_PATH_RE.test('/region/서울')).toBe(true)
    expect(REGION_PATH_RE.test('/region/서울/중구')).toBe(true)
    expect(REGION_PATH_RE.test('/region/서울/중구/더')).toBe(false)
  })
})

describe('읽기 하한 — 검사 대상이 조용히 비면 실패다', () => {
  it('소스를 실제로 읽었다', () => {
    expect(read(WORKER).length).toBeGreaterThan(50_000)
    expect(read(ROBOTS).split('\n').length).toBeGreaterThan(40)
    expect(read(FAQ_PAGE).length).toBeGreaterThan(2_000)
  })
})
