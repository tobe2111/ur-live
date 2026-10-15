/**
 * 🏷️ 2026-10-14 — 상세 `<title>` 이 **한 곳**에서 정해지는지.
 *
 * 근거·실측(숙소 49건이 Googlebot 쪽에서 지역을 잃던 것 · 교환권 ~135건 `교환권 교환권`)은
 * `src/shared/seo/detail-title.ts` 머리말.
 *
 * ⚠️ **이 시험이 못 보는 것**
 *   - 브라우저에서 react-helmet 이 실제로 어느 값을 남기는지(jsdom 밖 · 라이브 UA 실측이 판정)
 *   - 구글이 그 제목을 검색결과에 쓰는지(제목 재작성은 구글이 한다)
 *   - 이용권(`/pass/:id`) 제목의 **문구 규칙**(단어·중복·꼬리 가게명) — 2026-10-15 대표 승인으로
 *     SSOT 에 들어왔고, 그 생성기는 `pass-title-voucher-2026-10-15.test.ts` 가 본다.
 *     여기서 보는 것은 **세 종류가 한 파일에 모였는가**와 SSOT 전체에 `공동구매` 0건인가뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { stayDetailTitle, voucherDetailTitle } from '@/shared/seo/detail-title'
import { stayRegionLabel } from '@/shared/stay-address'
import { withSiteName, CONSUMER_SITE_NAME } from '@/shared/seo/consumer-surfaces'
import { readCode } from '../helpers/source-text'

describe('🏷️ 상세 제목 SSOT', () => {
  // ──────────────────── ① 숙소 — 지역이 들어간다
  it('①-1 라이브 세 건의 제목이 서버가 내던 값과 같다', () => {
    expect(stayDetailTitle('그랑블루글램핑&펜션', { sido: '강원', sigungu: '속초시' }))
      .toBe('그랑블루글램핑&펜션 (강원 속초시) - 유어딜')
    expect(stayDetailTitle('소설재 첨성대점', { sido: '경북', sigungu: '경주시' }))
      .toBe('소설재 첨성대점 (경북 경주시) - 유어딜')
    expect(stayDetailTitle('헤이춘천', { sido: '강원', sigungu: '춘천시' }))
      .toBe('헤이춘천 (강원 춘천시) - 유어딜')
  })

  it('①-2 지역이 없으면 괄호를 만들지 않는다 (빈 괄호가 없는 것보다 나쁘다)', () => {
    expect(stayDetailTitle('무지개펜션', {})).toBe('무지개펜션 - 유어딜')
    expect(stayDetailTitle('무지개펜션', { sido: '  ', sigungu: null, address: '' })).toBe('무지개펜션 - 유어딜')
  })

  it('①-3 🔒 지역은 **컬럼 우선** — 주소가 있어도 라이브 제목이 안 바뀐다', () => {
    // 이 방향이 중요하다: 주소에서 뽑으면 `강원` → `강원특별자치도` 가 되어 49건의 제목이 길어지고
    // `/region/강원` 슬러그 표기와도 어긋난다. 서버가 종전에 쓴 공식을 그대로 공유한다.
    const reg = { sido: '강원', sigungu: '속초시', address: '강원특별자치도 속초시 번영로' }
    expect(stayDetailTitle('x', reg)).toBe('x (강원 속초시) - 유어딜')
    expect(stayDetailTitle('x', reg)).not.toContain('강원특별자치도')
  })

  it('①-4 컬럼이 둘 다 비었을 때만 주소에서 뽑는다 (순수 추가 — 기존 출력 불변)', () => {
    const only = { sido: null, sigungu: '', address: '강원특별자치도 속초시 번영로 1' }
    expect(stayDetailTitle('x', only)).toBe(`x (${stayRegionLabel(null, null, only.address)}) - 유어딜`)
    expect(stayDetailTitle('x', only)).toBe('x (강원특별자치도 속초시) - 유어딜')
  })

  // ──────────────────── ② 교환권 — 같은 말을 두 번 하지 않는다
  it('②-1 라이브에서 중복이던 네 건이 한 번만 말한다', () => {
    expect(voucherDetailTitle('교보문고 기프트카드 교환권 10만원권')).toBe('교보문고 기프트카드 교환권 10만원권 - 유어딜')
    expect(voucherDetailTitle('[쿠팡] 쿠팡캐시 교환권 10만원')).toBe('[쿠팡] 쿠팡캐시 교환권 10만원 - 유어딜')
    expect(voucherDetailTitle('스타벅스 e카드 5만원 교환권')).toBe('스타벅스 e카드 5만원 교환권 - 유어딜')
    expect(voucherDetailTitle('롯데모바일교환권 5만원권')).toBe('롯데모바일교환권 5만원권 - 유어딜')
    for (const n of ['교보문고 기프트카드 교환권 10만원권', '스타벅스 e카드 5만원 교환권', '롯데모바일교환권 5만원권']) {
      expect((voucherDetailTitle(n).match(/교환권/g) ?? []).length, n).toBe(1)
    }
  })

  it('②-2 이름에 없으면 붙인다 (대다수 — 실측 100건 중 94건)', () => {
    expect(voucherDetailTitle('치즈롤 존스 페이버릿(L)+더블 초코칩 브라우니'))
      .toBe('치즈롤 존스 페이버릿(L)+더블 초코칩 브라우니 교환권 - 유어딜')
    expect(voucherDetailTitle('연타발 30만원권')).toBe('연타발 30만원권 교환권 - 유어딜')
  })

  it('②-3 가운데에 들어도 중복으로 본다 (store-name-dedupe 와 규칙이 다른 이유)', () => {
    // `store-name-dedupe` 는 일부러 `startsWith` 다(꼬리는 사람이 쓴 것일 수 있다).
    // 여기 실측 6건은 `…교환권 10만원권`·`롯데모바일교환권 …` 처럼 **가운데**에 들었다.
    expect(voucherDetailTitle('A 교환권 B')).toBe('A 교환권 B - 유어딜')
  })

  // ──────────────────── ③ 클라가 서버와 같은 값을 낸다
  it('③-1 withSiteName 이 사이트 이름을 덧붙이지 않는다 (접미사 두 번 방지)', () => {
    // 클라 `<SEO title>` 은 `withSiteName` 을 지난다 — 이미 들어 있으면 그대로 돌려줘야 한다.
    const t = stayDetailTitle('헤이춘천', { sido: '강원', sigungu: '춘천시' })
    expect(withSiteName(t)).toBe(t)
    const v = voucherDetailTitle('연타발 30만원권')
    expect(withSiteName(v)).toBe(v)
    expect(t).toContain(CONSUMER_SITE_NAME)
  })

  // ──────────────────── ④ 배선 — 네 자리가 같은 함수를 쓴다
  it('④-1 서버 두 자리가 SSOT 를 쓴다 (리터럴을 손으로 적지 않는다)', () => {
    const m = readCode('src/worker/utils/detail-ssr-meta.ts')
    expect(m).toContain('voucherDetailTitle(name)')
    expect(m).toContain('stayDetailTitle(stayName,')
    expect(m).toContain("from '../../shared/seo/detail-title'")
    // 종전 리터럴이 되살아나지 않는다.
    expect(m).not.toContain('${name} 교환권 - 유어딜')
    expect(m).not.toContain("${region ? ` (${region})` : ''} - 유어딜")
  })

  it('④-2 클라 두 자리가 같은 SSOT 를 쓴다', () => {
    const stay = readCode('src/pages/StayDetailPage.tsx')
    expect(stay).toContain('stayDetailTitle(stay.restaurant_name || stay.name,')
    expect(stay).not.toContain('${stay.restaurant_name || stay.name} - 유어딜')
    const v = readCode('src/pages/VoucherDetailPage.tsx')
    expect(v).toContain('voucherDetailTitle(product.name)')
    expect(v).not.toContain('${product.name} 교환권 - 유어딜')
  })

  it('④-3 숙소 설명의 지역 공식은 제목과 같다 (한 문서에 두 공식 금지)', () => {
    // 설명은 종전 공식을 **그대로 둔다** — 제목 SSOT 도 컬럼 우선이므로 둘이 같은 값이다.
    const m = readCode('src/worker/utils/detail-ssr-meta.ts')
    expect(m).toContain("const region = [p.region_sido, p.region_sigungu].filter(Boolean).join(' ').trim()")
    // 🔴 주소 우선으로 바뀌면 설명만 `강원특별자치도` 가 되어 제목과 갈린다.
    expect(m).not.toContain('const region = stayRegionLabel(')
  })

  // ──────────────────── ⑤ 세 종류가 한 파일에 모였다
  it('⑤-1 이용권 제목도 SSOT 에 들어왔다 — 공동구매 라는 말은 안 쓴다', () => {
    // 🔁 2026-10-15 재조준: 이 자리는 종전 `${name} 공동구매 - ${store}` **리터럴을 동결**했다
    //    (결재 #35 대기 · "승인 없이 310건이 바뀌지 않게"). 대표 승인이 왔으므로 지키는 방향이
    //    **뒤집힌다** — 리터럴로 돌아가는 것을 막는다. 제목 생성기 자체(단어·중복·꼬리)는
    //    `pass-title-voucher-2026-10-15.test.ts` 가 보므로 여기선 **가족 수준**만 본다.
    const ssot = readCode('src/shared/seo/detail-title.ts')
    for (const fn of ['stayDetailTitle', 'voucherDetailTitle', 'passDetailTitle']) {
      expect(ssot).toContain(`export function ${fn}`)
    }
    // 🔴 이 파일만 보는 것: SSOT **전체**에 `공동구매` 0건(실행되는 줄). 생성기 한 줄이 아니라
    //    파일 단위라, 다음 세션이 그 말을 쓰는 **새 함수**를 더해도 잡힌다.
    expect(ssot).not.toContain('공동구매')
  })

  it('⑤-2 SSOT 가 사이트 이름을 지어내지 않는다 (상수에서 받는다)', () => {
    const src = readCode('src/shared/seo/detail-title.ts')
    expect(src).toContain('CONSUMER_SITE_NAME')
    // 기본 인자 밖에서 리터럴 '유어딜' 을 박지 않는다.
    expect((src.match(/'유어딜'/g) ?? []).length).toBe(0)
  })
})
