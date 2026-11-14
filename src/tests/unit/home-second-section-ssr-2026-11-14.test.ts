/**
 * 🏠 2026-11-14 대표 *"처음에 홈에서 밑 이용권들 불러오는게 늦어"* — 둘째 섹션('지금 인기 이용권')도 서버 첫 화면이 그린다.
 *   라이브 끼워 재기(폰 4G·CPU 4배 4+4회): 카드 글자 1.8~2.1s → 0.66~1.0s · 첫 사진 2.0~2.2s → 0.8~1.8s · CLS 0.
 *   고정하는 것: ① 그린다(배너 시드 있음·inline 없음) ② 안 그린다(inline 있음 / 배너 시드 없음 / 위치 정렬 / 둘째 섹션 없음)
 *   ③ 머리 클래스가 화면(`HomeSections`) 소스와 글자 그대로 ④ 사진은 lazy(화면 밖) ⑤ 띠 배너 **뒤** 순서 ⑥ 워커가 배너 시드를 넘긴다.
 *   못 보는 것: 픽셀(배포 뒤 라이브) · 섹션이 셋 이상일 때 셋째(종전처럼 앱이 그린다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildHomeFirstScreen, homeSecondSectionHtml, HOME_SEC_HEAD } from '@/worker/utils/home-first-screen'

const prod = (id: number) => ({ id, name: `딜${id}`, price: 9000, image_url: `https://media.ur-team.com/uploads/demo/${id}.jpg`, category: 'meal_voucher', restaurant_address: '서울 강남구 1' })
const SECTIONS = JSON.stringify({ success: true, data: [
  { id: 1, title: '첫 섹션', products: [prod(1), prod(2), prod(3), prod(4)] },
  { id: 2, title: '지금 인기 이용권', subtitle: '많이 팔린 순으로 모았어요', more_href: '/?sort=popular', products: [prod(5), prod(6), prod(7)] },
] })
const banners = (slots: string[]) => JSON.stringify({ success: true, data: slots.map((s, i) => ({ id: i + 1, title: `b${i}`, image_url: 'https://media.ur-team.com/b.jpg', banner_slot: s })) })
const L = '<div style="min-height:100dvh">L</div>'

describe('① 그린다 / ② 안 그린다', () => {
  it('배너 시드가 있고 inline 이 없으면 둘째 섹션을 그린다(제목·부제·더보기·카드 3장)', () => {
    const html = buildHomeFirstScreen(SECTIONS, L, '', null, banners(['strip']))
    expect(html).toContain('>지금 인기 이용권</h3>')
    expect(html).toContain('많이 팔린 순으로 모았어요')
    expect(html).toContain('>더보기</a>')
    for (const id of [5, 6, 7]) expect(html).toContain(`href="/pass/${id}"`)
  })
  it('inline 배너가 있으면 안 그린다(화면은 띠 배너와 이 섹션 사이에 그것을 그린다)', () => {
    expect(buildHomeFirstScreen(SECTIONS, L, '', null, banners(['strip', 'inline']))).not.toContain('지금 인기 이용권')
  })
  it('배너 시드가 없으면 안 그린다(inline 판정 불가 — 모르면 안 그린다) · 첫 섹션은 그대로', () => {
    const html = buildHomeFirstScreen(SECTIONS, L)
    expect(html).not.toContain('지금 인기 이용권')
    expect(html).toContain('href="/pass/1"')
  })
  it('위치 정렬 섹션 · 둘째 섹션 없음 · 깨진 배너 시드면 빈 문자열', () => {
    const s = { title: 't', near: true, products: [prod(1)] }
    expect(homeSecondSectionHtml(s as never, banners([]))).toBe('')
    expect(homeSecondSectionHtml(undefined, banners([]))).toBe('')
    expect(homeSecondSectionHtml({ title: 't', products: [prod(1)] } as never, '{x')).toBe('')
  })
})

describe('③④⑤⑥ 모양·순서·배선', () => {
  it('머리 클래스가 화면(HomeSections) 소스와 글자 그대로', () => {
    const src = readFileSync('src/components/home/HomeSections.tsx', 'utf8')
    for (const k of ['head', 'headText', 'sub', 'more'] as const) expect(src, k).toContain(HOME_SEC_HEAD[k])
    expect(src).toContain(`'${HOME_SEC_HEAD.title}'`)
  })
  it('사진은 eager 가 아니다(화면 밖) · 띠 배너 뒤에 온다', () => {
    const html = buildHomeFirstScreen(SECTIONS, L, '', null, banners(['strip']))
    const sec2 = html.slice(html.indexOf('지금 인기 이용권'))
    expect(sec2).not.toContain('loading="eager"')
    expect(html.indexOf('이벤트 배너')).toBeLessThan(html.indexOf('지금 인기 이용권'))
  })
  it('워커가 배너 시드를 다섯째 인자로 넘긴다', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toContain("c.req.header('cookie') ?? null, homeBannersPayload); if (homeFirst)")
  })
})
