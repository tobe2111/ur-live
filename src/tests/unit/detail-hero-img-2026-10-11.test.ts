/**
 * 🔎 상세 히어로는 **진짜 `<img>`** 다 — 2026-10-11 (대표 `AskUserQuestion` 승인 "허가 — 진행").
 *
 * ## 왜 (라이브 실측)
 * 대표가 구글 패널 스크린샷을 보냈다 — 헤이춘천 숙박권 **사진은 뜨는데 제목이 유어딜 일반 제목**.
 * 재 보니 페이지 메타는 전부 멀쩡했다(`<title>`·og·JSON-LD `name`/`image`/`brand` 모두 정확).
 * 진짜 원인은 **그 사진이 상세 페이지에 `<img>` 로 존재하지 않았다**는 것이다:
 *
 * | | 사진이 `<img>` 로 있나 | 그 페이지 `<title>` |
 * |---|---|---|
 * | 홈·목록 | ✅ (`DealCardMedia`) | 유어딜 일반 제목 |
 * | 상세 `/pass/:id` | ❌ **CSS `background-image`** | **이용권 명칭** ← 이게 떠야 한다 |
 *
 * 구글 이미지는 CSS 배경을 색인 대상으로 보지 않는다. 그래서 그 사진이 붙을 수 있는 유일한 자리가
 * *제목이 일반적인* 목록 페이지였다.
 *
 * ## 이 시험이 지키는 것
 * ① 서버 첫 화면과 ② React 슬라이드가 **둘 다** 진짜 `<img alt>` 로 그리고,
 * ③ 그 URL 이 배경 윗겹과 **같아서 추가 요청이 안 생기고**,
 * ④ 슬라이드가 `relative` 라 절대배치 `<img>` 가 칸 밖으로 안 나간다.
 *
 * ## 못 보는 것
 * - 구글이 실제로 색인했는지 — 서치콘솔에서 사람이 본다.
 * - 마운트 때 안 밀리는지 — jsdom 엔 레이아웃이 없다. 프레임 촬영이 판정한다
 *   (`node scripts/visual-preview.mjs`, 그리고 배포 후 라이브).
 * - PC(lg+) 히어로는 **아직 배경 그대로**다(서버가 PC 를 안 그리고, 그쪽은 프로브와 URL 을 공유해
 *   트래픽 0 을 유지하는 구조라 한쪽만 바꾸면 요청이 두 배가 된다). 범위 밖임을 여기 적어 둔다.
 */
import { describe, it, expect } from 'vitest'
import { buildDetailFirstScreen } from '@/worker/utils/detail-ssr-body'
import { readCode, stripComments } from '../helpers/source-text'

const GALLERY = 'src/pages/group-buy/DetailGallery.tsx'
const LOADER = '<div style="min-height:100dvh">로더</div>'

const NAME = '주말 1박 숙박권 (스탠다드 룸)'
const seed = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ data: { name: NAME, restaurant_name: '헤이춘천', category: 'stay_voucher',
    image_url: 'https://media.ur-team.com/uploads/demo/2026-09/a.jpg', ...over } })

describe('① 서버 첫 화면 — 진짜 <img> 로 그린다', () => {
  const html = buildDetailFirstScreen(seed(), LOADER)

  it('히어로를 그린다(빈 문자열이면 아래 단언이 전부 무의미해진다)', () => {
    expect(html.length).toBeGreaterThan(200)
    expect(html).toContain('aspect-ratio:3/2')
  })

  it('`<img>` 가 있고 alt 가 이용권 명칭이다 — 구글이 사진과 이름을 묶는 유일한 신호', () => {
    const m = /<img\b[^>]*>/.exec(html)
    expect(m, '히어로에 <img> 가 없다 — 구글 이미지는 CSS 배경을 안 본다').toBeTruthy()
    expect(m![0]).toContain(`alt="${NAME}"`)
  })

  it('`object-fit:cover` 로 칸을 채운다 (배경 `cover` 와 같은 그림)', () => {
    expect(/<img\b[^>]*object-fit:cover/.test(html)).toBe(true)
  })

  it('🔑 `<img>` 의 src 가 배경 윗겹과 **같은 URL** — 다르면 같은 사진을 두 번 받는다', () => {
    const imgSrc = /<img\b[^>]*\bsrc="([^"]+)"/.exec(html)?.[1]
    const bgUrl = /background-image:url\(&quot;([^&]+)&quot;\)/.exec(html)?.[1]
    expect(imgSrc, '<img src> 를 못 읽었다').toBeTruthy()
    expect(bgUrl, '배경 URL 을 못 읽었다').toBeTruthy()
    expect(imgSrc).toBe(bgUrl)
  })

  it('슬라이드가 `relative` — 아니면 절대배치 <img> 가 칸을 벗어난다', () => {
    expect(html).toContain('style="position:relative;flex:0 0 100%')
  })

  it('히어로는 즉시 받는다(eager + 높은 우선순위) — 워커 preload 와 같은 대우', () => {
    const img = /<img\b[^>]*>/.exec(html)![0]
    expect(img).toContain('loading="eager"')
    expect(img).toContain('fetchpriority="high"')
  })

  it('따옴표가 든 이름도 속성을 깨지 않는다', () => {
    const h = buildDetailFirstScreen(seed({ name: '1박 "스탠다드" 룸' }), LOADER)
    expect(h).not.toContain('alt="1박 "스탠다드"')
    expect(h).toContain('&quot;')
  })

  it('사진이 없으면 아무것도 안 그린다(폴백은 React 가 그린다)', () => {
    expect(buildDetailFirstScreen(seed({ image_url: '', images: [], image_urls: [] }), LOADER)).toBe('')
  })
})

describe('② React 슬라이드 — 서버와 같은 구조', () => {
  const code = stripComments(readCode(GALLERY))

  it('모바일 슬라이드가 `<img>` 를 그린다', () => {
    expect(/<img\s+[\s\S]{0,400}?src=\{hi\}/.test(code),
      '슬라이드가 hi 를 <img src> 로 안 쓴다 — 배경만 남으면 서버와 어긋나고 색인도 안 된다').toBe(true)
  })

  it('alt 는 호출부가 준 이름을 그대로 쓴다 (빈 alt 면 색인에 아무 말도 안 하는 것)', () => {
    // ⚠️ 이 파일의 **숨은 PC 프로브**는 `alt=""` 가 맞다(aria-hidden 장식) — 그래서 "빈 alt 가
    //    하나도 없다" 로는 못 쓴다. 보이는 슬라이드가 이름을 싣는지만 본다.
    expect(/<img[\s\S]{0,400}?alt=\{alt\}/.test(code)).toBe(true)
  })

  it('`objectFit: \'cover\'` 로 칸을 채운다', () => {
    expect(code).toMatch(/objectFit:\s*'cover'/)
  })

  it('슬라이드 래퍼가 `relative`', () => {
    expect(code).toMatch(/position:\s*'relative',\s*flex:\s*'0 0 100%'/)
  })

  it('밑깔개 두 겹 배경은 남는다 — 클릭 즉시 그려지는 체감(추가 요청 0)', () => {
    expect(code).toMatch(/backgroundImage:\s*hi\s*\?\s*layered\(hi,\s*src\)/)
  })

  it('죽은 사진은 보이는 <img> 자신이 잡는다 (배경엔 오류 이벤트가 없었다)', () => {
    // 🩸 처음엔 `<img … onError` 로 썼는데 **숨은 PC 프로브**의 onError 에 걸려 늘 통과했다
    //    (주입이 잡았다). 보이는 슬라이드는 `src={hi}` 로만 구별되므로 거기서부터 앵커한다.
    const slide = code.slice(code.indexOf('src={hi}'))
    expect(slide.indexOf('src={hi}')).toBe(0)
    expect(/^[\s\S]{0,600}?onError=\{\(\)\s*=>\s*setDead/.test(slide)).toBe(true)
  })

  it('모바일 숨은 프로브는 사라졌다 — 같은 URL 을 두 번 적을 이유가 없다', () => {
    expect(code).toMatch(/if\s*\(!isDesktop\)\s*return list/)
  })
})
