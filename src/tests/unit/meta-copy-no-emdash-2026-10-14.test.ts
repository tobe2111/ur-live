/**
 * ✂️ 검색결과에 뜨는 줄에서 **줄표(em-dash)를 뺀다** — 2026-10-14
 *   (대표 *"또 개선점 찾아보자. SEO 와 GEO 부분에서"*)
 *
 * ## 실측 — 색인 365건의 스니펫에 대표가 지적한 그 문자가 있었다
 *
 * Googlebot UA 로 라이브 sitemap 32모양 72표본을 받아 `<title>`·`description` 을 셌다:
 *
 *     /pass/:id      310건   `… 짜조 — 23,400원, 유어딜에서 할인가로 바로 구매`
 *     /stays/:id      49건   `… 강릉의 게스트하우스 — 감성 숙소 — 조용한 …`  ← 줄표 둘
 *     /products/:id    1건   `프리미엄 무선아이폰 — 10,000원, …`
 *     /u/:handle       2건   `현정님의 추천 — 교환권·이용권 모음`
 *     /blog            1건   `유어딜 블로그 — 이용권·교환권·동네딜·유어샵 가이드`  ← **제목**
 *
 * CLAUDE.md "🎨 anti-slop" 은 *"em-dash `—` 0개. '적게 쓰기'가 아니라 0개다"* 라고 못박고
 * 2026-08-31 에 대표가 **직접** 그걸 "AI 티" 로 지적했는데, 그 규칙을 지키는 가드
 * (`check-anti-slop-copy.mjs`)는 `em-dash 0` 을 보고하고 있었다.
 *
 * ## 🔑 원인 — 가드가 가리키는 곳에 문구가 없었다 ("낡은 지도")
 *
 * 그 가드의 범위는 ① `.tsx` 마케팅 페이지 ② `src/shared/seo/*.ts`(2026-10-13 추가) 뿐이고,
 * **메타 description·title 을 실제로 만드는 곳은 `src/worker/utils/*` 다.** 즉 가드가 보는
 * 파일엔 검사할 문구가 없고, 문구가 있는 파일은 범위 밖이었다 — 2026-10-13 블로그 시드에서
 * 밟은 것과 **같은 클래스**다(그때는 `.tsx` ↔ `blog-seed.ts`, 이번은 `.tsx`+`shared/seo` ↔ 워커).
 *
 * 🩸 **그리고 `src/shared/stay-property-type.ts` 머리말이 거짓 주장을 하고 있었다** —
 *    *"`check-anti-slop-copy` 는 이 파일을 본다"* 고 적어 뒀는데 줄표를 주입해도 통과했다.
 *    같은 날 범위에 실제로 넣고 그 머리말도 고쳤다(⑤가 양방향으로 고정).
 *
 * ## 처방 — 줄표만 뺀다 (문구를 다시 쓰지 않는다)
 *
 * 주변 구두점이 이미 끊어 주는 자리는 **지우기만** 했고(`… 짜조 23,400원, 유어딜에서 …`),
 * 지우면 두 문장이 붙는 자리만 마침표를 넣었다(`{숙소명}. 유어딜에서 …`).
 * 제목·h1 은 집의 관례인 ` - `(하이픈 — anti-slop 이 허용)로 — 나머지 30개 제목이 그 모양이다.
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 *
 * - 바뀐 문구가 **읽기 좋은지**(사람이 본다 — 아래 ①이 전후 문장을 전부 찍는다).
 * - 구글이 그 스니펫을 실제로 쓰는지(외부 판정 · 수일~수주).
 * - `/stays` 꼬리의 줄표 둘은 **DB 값**이라 이 시험 밖이다 — 정비 레인
 *   (`heal-stay-descriptions`, 2026-10-14 #75)이 고치고 `STAY_PROPERTY_TYPE_DESCS` 가 그 문구다.
 *   ⑤가 그 파일을 가드 범위에 묶어 두므로 **새 줄표가 다시 들어오지는 못한다**.
 * - 잠금 파일(`worker/index.ts`) 7곳은 **동결만** 한다(④) — 문자열 한 줄도 대표 승인이 필요하다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { buildDetailMeta, buildStayDetailMeta, buildProductMeta } from '@/worker/utils/detail-ssr-meta'
import { resolveRegionSeo } from '@/worker/utils/surface-ssr-meta'
import { buildCuratorNoscript } from '@/worker/utils/crawler-noscript'
import { rowLine } from '@/worker/utils/crawler-noscript-rows'
import { buildVouchersFirstScreen } from '@/worker/utils/vouchers-first-screen'
import { STAY_PROPERTY_TYPE_DESCS } from '@/shared/stay-property-type'
import { readCode, readRaw } from '../helpers/source-text'

const EM = '—'
const GUARD = 'scripts/check-anti-slop-copy.mjs'
const BASELINE = 'scripts/anti-slop-baseline.json'

/** 라이브 응답 모양 그대로 — 평평하게 지어 쓰면 빌더가 null 을 준다(2026-10-12 교훈). */
const passSeed = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  data: {
    id: 2490, name: '곱빼기 쌀국수 2인 + 짜조', restaurant_name: '레몬그라스타이 낙성대점',
    price: 26000, original_price: 30000, category: 'meal_voucher',
    group_buy_status: 'active', address: '서울 관악구 낙성대역', ...over,
  },
})
const staySeed = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  data: {
    product: {
      id: 2743, name: '안프로하우스', restaurant_name: '안프로하우스',
      address: '강원 강릉시 교동', property_type: 'guesthouse',
      star_rating: 4, rating: 4.7, review_count: 9, ...over,
    },
    rooms: [{ name: '스탠다드', base_price_weekday: 109000 }],
  },
})
const productSeed = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  data: {
    id: 2917, name: '프리미엄 무선아이폰', price: 10000, category: 'lifestyle',
    deal_only: 0, stock: 200, stock_quantity: 0, ...over,
  },
})

/**
 * 가드를 돌려 **종료코드 + stdout·stderr 합본**을 돌려준다.
 * ⚠️ findings 는 `console.error`(stderr) 로 나간다 — stdout 만 보면 빈 문자열이다.
 */
function runGuard(): { ok: boolean; out: string } {
  try {
    const out = execFileSync('node', [GUARD], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, out }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string }
    return { ok: false, out: `${err.stdout || ''}\n${err.stderr || ''}` }
  }
}

/** 빌더 출력에서 줄표를 전수로 센다(제목·설명·JSON-LD 전부). */
function emOf(...parts: Array<string | null | undefined>): string[] {
  return parts.filter((p): p is string => !!p).filter((p) => p.includes(EM))
}

describe('① 진짜 빌더를 돌려 판정한다 (문자열 검사가 아니다)', () => {
  it('/pass 310건 — 할인·정가 두 분기 모두 줄표 0', () => {
    for (const over of [{}, { current_discount_pct: 13 }]) {
      const m = buildDetailMeta(passSeed(over), 'https://urdeal.kr', '/pass/2490')
      expect(m, '빌더가 null — 시드 모양을 다시 볼 것').toBeTruthy()
      // 🔬 전후를 눈으로 보려고 찍는다(바뀐 문구가 읽기 좋은지는 사람만 판정한다).
      console.log('  /pass  D:', m!.description)
      expect(emOf(m!.pageTitle, m!.title, m!.description, m!.jsonLd),
        '줄표가 남았다 — 두 분기 중 하나만 고치면 다른 쪽에서 되살아난다').toEqual([])
    }
  })

  it('/pass — 줄표만 뺐고 정보는 그대로다 (가게·상품·가격이 전부 남는다)', () => {
    const m = buildDetailMeta(passSeed(), 'https://urdeal.kr', '/pass/2490')!
    expect(m.description).toContain('레몬그라스타이 낙성대점')
    expect(m.description).toContain('곱빼기 쌀국수 2인 + 짜조')
    expect(m.description).toContain('26,000원')
  })

  it('/vouchers/:id — 설명 폴백(상품 설명이 없을 때)도 줄표 0', () => {
    const m = buildDetailMeta(passSeed({ description: '' }), 'https://urdeal.kr', '/vouchers/2192')!
    console.log('  /vouchers  D:', m.description)
    expect(emOf(m.pageTitle, m.title, m.description, m.jsonLd)).toEqual([])
    expect(m.description, '폴백이 비면 스니펫이 통째로 사라진다').toContain('기프티콘 교환권')
  })

  it('/stays/:id — 설명 폴백·제목·JSON-LD 줄표 0', () => {
    const m = buildStayDetailMeta(staySeed({ description: '', description_full: '' }),
      'https://urdeal.kr', '/stays/2743')
    expect(m, '빌더가 null — 숙소 시드는 `{data:{product,rooms}}` 다').toBeTruthy()
    console.log('  /stays  T:', m!.pageTitle, '\n  /stays  D:', m!.description)
    expect(emOf(m!.pageTitle, m!.title, m!.description, m!.jsonLd)).toEqual([])
  })

  it('/products/:id — 할인·정가 두 분기 + Product.description 폴백 줄표 0', () => {
    for (const over of [{}, { original_price: 20000 }, { description: '' }]) {
      const m = buildProductMeta(productSeed(over), 'https://urdeal.kr', '/products/2917')!
      expect(m, '빌더가 null').toBeTruthy()
      expect(emOf(m.pageTitle, m.title, m.description, m.jsonLd),
        `줄표가 남았다 (over=${JSON.stringify(over)})`).toEqual([])
    }
  })

  it('/region 허브 제목 — 줄표 0 (집의 관례인 하이픈)', () => {
    const r = resolveRegionSeo('/region', 'https://urdeal.kr')
    expect(r, '리졸버가 null — 경로 정규식을 다시 볼 것').toBeTruthy()
    console.log('  /region  T:', r!.pageTitle)
    expect(emOf(r!.pageTitle, r!.title, r!.description)).toEqual([])
    expect(r!.pageTitle, '구분자가 통째로 사라지면 두 구가 붙는다').toContain(' - ')
  })

  it('유어샵 크롤러 본문 행 — 줄표 0 이고 가게·가격이 그대로 남는다', () => {
    // ⚠️ 이 빌더는 **객체**를 받는다(문자열을 받는 건 `curatorNoscriptFromPayload` 다).
    //    `JSON.stringify` 를 넘기면 필드가 전부 undefined → `''` 로 조용히 빈다.
    const html = buildCuratorNoscript({
      curator: { name: '정지원', bio: '전국의 맛집을 소개합니다.' },
      // ⚠️ 핀은 **평평하다** — `product_name` 이다(`crawler-noscript.ts` 머리말이 경고한 함정).
      //    `name` 으로 지어 쓰면 전부 undefined 가 되어 `<noscript>` 가 **조용히 비고 에러가 안 난다**
      //    (이 시험의 첫 판이 정확히 그래서 빨간불이었다 — 머리말을 믿고 다시 쓰지 말 것).
      pins: [{ product_name: '닭도리탕', restaurant_name: '달빛한스푼', price: 31000 }],
    })
    console.log('  /u 행:', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    expect(html.includes(EM), '줄표가 남았다').toBe(false)
    expect(html).toContain('닭도리탕')
    expect(html).toContain('달빛한스푼')
    expect(html).toContain('31,000원')
  })

  it('목록 크롤러 행(rowLine) — 줄표 0 이고 가게↔상품 경계가 남는다', () => {
    const r = rowLine({ restaurant_name: 'GS25', name: '츄파춥스300', price: 300 } as never)
    expect(r, 'rowLine 이 null — 시드 필드명을 다시 볼 것').toBeTruthy()
    console.log('  목록 행:', r!.text)
    expect(r!.text.includes(EM)).toBe(false)
    // 🔴 반대 방향 — 구분자를 **통째로** 지우면 `GS25츄파춥스300` 처럼 붙는다(정보 손실).
    expect(r!.text).toMatch(/GS25[,\s]/)
    expect(r!.text).toContain('츄파춥스300')
  })

  it('/vouchers 첫 화면 h1 — 줄표 0', () => {
    // 유효 행이 0 이면 빌더가 `''` 를 준다 — 빈 시드로는 h1 을 판정할 수 없다.
    const seed = JSON.stringify({ success: true, data: [{ id: 2192, name: 'GS25 츄파춥스300', price: 300 }] })
    const html = buildVouchersFirstScreen(seed, '<div></div>', 'n1')
    const h1 = /<h1[^>]*>([^<]*)<\/h1>/.exec(html)
    expect(h1, 'h1 을 못 찾았다 — 첫 화면 마크업이 바뀌었으면 이 시험을 재조준할 것').toBeTruthy()
    console.log('  /vouchers h1:', h1![1])
    expect(h1![1].includes(EM)).toBe(false)
  })

  it('숙소 유형 문구 표 — 줄표 0 (색인 49건의 description 꼬리가 여기서 온다)', () => {
    for (const [k, v] of Object.entries(STAY_PROPERTY_TYPE_DESCS)) {
      expect(v.includes(EM), `${k} 문구에 줄표`).toBe(false)
    }
    expect(Object.keys(STAY_PROPERTY_TYPE_DESCS).length,
      '표가 비면 통과가 아니라 고장이다').toBeGreaterThanOrEqual(5)
  })
})

describe('② 가드 범위가 워커 문구 생성기를 **실제로** 본다', () => {
  const g = readCode(GUARD)

  it('접미사 규칙이 있다 (파일 목록이 아니라 — 새 생성기가 조용히 새지 않게)', () => {
    expect(g, 'src/worker/utils 의 문구 생성기가 범위에 없다')
      .toContain('src/worker/utils/[A-Za-z0-9-]*(ssr-meta|noscript|first-screen|ssr-body|list-jsonld)')
  })

  it('경로가 낡으면 **0건이 통과가 아니라 실패**다 (바닥)', () => {
    const m = /COPY_BUILDER_FLOOR\s*=\s*(\d+)/.exec(g)
    expect(m, '바닥 상수를 못 찾았다').toBeTruthy()
    // 🩸 처음엔 `\d+` 만 봤는데 **`= 0` 도 숫자다** — 주입이 바닥을 0 으로 내려도 통과했다.
    //    바닥의 일은 "몇 개여야 한다" 가 아니라 **디렉터리가 통째로 사라진 것을 잡는 것**이고,
    //    0 이면 그걸 못 한다. 실제 생성기는 10개 남짓이라 5 는 넉넉히 안전한 하한이다.
    expect(Number(m![1]), '바닥이 0/1 이면 경로가 낡아도 조용히 통과한다').toBeGreaterThanOrEqual(5)
    // 반대로 실제 개수보다 크면 가드가 **늘** 빨간불이라 결국 꺼진다.
    const real = fs.readdirSync('src/worker/utils')
      .filter((f) => /[A-Za-z0-9-]*(ssr-meta|noscript|first-screen|ssr-body|list-jsonld)\.ts$/.test(f)).length
    expect(real, '문구 생성기를 하나도 못 찾았다 — 경로가 낡았다').toBeGreaterThanOrEqual(5)
    expect(Number(m![1]), `바닥(${m![1]})이 실제 개수(${real})보다 크면 가드가 늘 빨간불이다`)
      .toBeLessThanOrEqual(real)
    expect(g, '바닥 미달이 경고로 끝나면 무검사로 조용히 돌아간다').toMatch(/copyBuilders\.length < COPY_BUILDER_FLOOR[\s\S]{0,400}process\.exit\(1\)/)
  })

  it('스캔 대상에 실제로 넣는다 — 규칙만 있고 안 넣으면 아무것도 안 본다', () => {
    expect(g).toMatch(/const files = \[[^\]]*copyBuilders/)
    expect(g).toMatch(/EXTRA_COPY/)
  })

  it('EXTRA_COPY 의 경로가 실재한다 (낡으면 조용히 무검사)', () => {
    const m = /const EXTRA_COPY = \[([\s\S]*?)\]/.exec(g)
    expect(m, 'EXTRA_COPY 를 못 찾았다').toBeTruthy()
    const paths = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    expect(paths.length, '목록이 비면 통과가 아니라 고장이다').toBeGreaterThanOrEqual(2)
    for (const p of paths) expect(fs.existsSync(p), `${p} 가 없다`).toBe(true)
    expect(paths).toContain('src/shared/stay-property-type.ts')
  })
})

describe('③ 가드를 실제로 돌려 판정한다', () => {
  it('지금 비잠금 줄표는 0 이다', () => {
    const r = runGuard()
    expect(r.out, '가드가 아무 말도 안 한다 — 등록 경로를 먼저 볼 것').toContain('anti-slop')
    expect(r.ok, `가드가 빨간불이다:\n${r.out}`).toBe(true)
    expect(r.out).toMatch(/em-dash 0\(≤0\)/)
  })

  it('주입하면 **빨간불**이다 (워커 생성기 범위가 살아 있다는 증거)', () => {
    const target = 'src/worker/utils/detail-ssr-meta.ts'
    const orig = readRaw(target)
    try {
      fs.writeFileSync(target, orig.replace(
        "`${name} 기프티콘 교환권을", "`${name} — 기프티콘 교환권을"))
      // 🩸 가드는 findings 를 **stderr** 로 찍는다(`console.error`). stdout 만 보면 늘 빈
      //    문자열이라 "무엇 때문에 빨간불인지" 를 판정하지 못한다(첫 판이 그래서 터졌다).
      expect(runGuard().out, '워커 생성기에 줄표를 넣었는데 가드가 통과했다 — 범위가 죽었다')
        .toContain(target)
    } finally { fs.writeFileSync(target, orig) }
  })
})

describe('④ 잠금 파일은 **따로** 센다 (총합 하나로 재면 0 고정이 무의미해진다)', () => {
  const g = readCode(GUARD)
  const base = JSON.parse(readRaw(BASELINE)) as Record<string, unknown>

  it('잠금 카운터가 분리돼 있다', () => {
    expect(g).toMatch(/const LOCKED_COPY = \/[^/]*src\\\/worker\\\/index\\\.ts\$\//)
    expect(g).toMatch(/hits\.lockedEmDash\.push/)
    // 🔴 잠금 → 비잠금 순서가 뒤집히면 잠금 파일이 0 고정 카운터로 샌다.
    const l = g.indexOf('LOCKED_COPY.test(posix)')
    const mk = g.indexOf('MARKETING.test(posix)')
    expect(l).toBeGreaterThan(-1)
    expect(mk).toBeGreaterThan(l)
  })

  it('비잠금은 0 고정이고 잠금은 동결이다', () => {
    expect(base.emDash, '비잠금 상한이 0 이 아니면 새 줄표가 그 사이에 숨는다').toBe(0)
    expect(typeof base.lockedEmDash).toBe('number')
    expect(base.lockedEmDash as number).toBeGreaterThan(0)
    expect(String(base._lockedEmDash || ''), '왜 동결인지 적어 두지 않으면 다음 세션이 그냥 올린다')
      .toContain('worker/index.ts')
  })

  it('잠금 파일은 가드 범위 안이다 (빼면 동결이 풀린다)', () => {
    expect(runGuard().out).toMatch(/잠금파일 \d+\(≤\d+\)/)
  })
})

describe('⑤ 숙소 문구 표가 가드 범위 안이다 — 거짓 주장을 고친 그 자리', () => {
  it('머리말이 더는 "가드가 본다" 고만 적어 두지 않는다 (정정 기록)', () => {
    const raw = readRaw('src/shared/stay-property-type.ts')
    expect(raw, '정정 기록이 사라지면 다음 세션이 같은 거짓을 다시 쓴다').toContain('2026-10-14 정정')
  })

  it('주입하면 빨간불 — 주장이 실제로 참이다', () => {
    const target = 'src/shared/stay-property-type.ts'
    const orig = readRaw(target)
    try {
      fs.writeFileSync(target, orig.replace(
        "hotel: '역과 시내에서", "hotel: '— 주입',\n  __x: '역과 시내에서"))
      expect(runGuard().out, '숙소 문구 표에 줄표를 넣었는데 가드가 통과했다 — 범위가 죽었다')
        .toContain(target)
    } finally { fs.writeFileSync(target, orig) }
  })
})

// 🔓 2026-10-18 대표 결재 `2026-10-14-locked-emdash` 안 1 — 잠금 파일의 라이브 셋을 고치고 폴백을 한 벌로.
import { ushopDescFallback } from '@/shared/ushop-share-card'
describe('⑤ 유어샵 설명 폴백 한 벌 (결재 2026-10-14-locked-emdash)', () => {
  const W = readCode('src/worker/index.ts')
  it('폴백 문구에 줄표가 없다', () => {
    expect(ushopDescFallback('현정')).toBe('현정님이 고른 교환권·이용권 모음')
    expect(ushopDescFallback('현정')).not.toMatch(/—/)
  })
  it('워커 두 자리(서빙 메타 · 봇 셸)가 같은 함수를 쓴다 — 문구를 손으로 적지 않는다', () => {
    expect(W.match(/ushopDescFallback\(/g)?.length).toBe(2)
    expect(W).not.toMatch(/님의 추천 — /)
  })
  it('라이브 제목 둘에 줄표가 없다', () => {
    expect(W).toMatch(/const adTitle = '유어애즈 UR Ads, /)
    expect(W).toMatch(/const bt = '유어딜 블로그, /)
  })
})
