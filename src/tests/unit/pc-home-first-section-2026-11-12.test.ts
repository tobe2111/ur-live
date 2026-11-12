/**
 * 🖥️ PC 홈 서버 첫 화면 — 첫 어드민 섹션 한 줄 (2026-11-12 대표 *"아직 느리네"* · PC 홈 캡처: 배너 아래가 회색 자리표시)
 *
 * 지키는 것:
 *   ① 서버 마크업의 클래스가 화면(`HomeSections` rail · `SectionRail`)과 글자 그대로 같다 — 갈리면 마운트 때 튄다
 *   ② 카드 사진은 4열 폭(LG 400) — 화면 `homeCardImgWidth(isLg)` 와 같은 주소여야 두 번 안 받는다
 *   ③ 위치 정렬 섹션(near)이 첫째거나 시드가 없거나 깨지면 그리지 않는다(종전대로 로더)
 *   ④ 워커가 섹션 시드를 넘긴다
 * 못 보는 것: 실제 밀림·첫 그림 시각(배포 뒤 `measure-live-vitals --pc /`), 카드 글자 줄 수가 화면과 같은지(그려 봐야 안다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PC_SECTION_CLS } from '@/shared/pc-home-first-screen'
import { pcFirstSectionHtml, buildPcHomeFirstScreen } from '../../worker/utils/pc-home-first-screen'
import { HOME_CARD_IMG_WIDTH_LG } from '@/shared/home-card-image'

const SECTIONS = readFileSync('src/components/home/HomeSections.tsx', 'utf8')
const RAIL = readFileSync('src/components/home/SectionRail.tsx', 'utf8')
const WORKER = readFileSync('src/worker/index.ts', 'utf8')
const prod = (id: number) => ({ id, name: `상품${id}`, restaurant_name: '가게', price: 10000, original_price: 15000, image_url: `https://media.ur-team.com/uploads/p${id}.jpg`, category: 'meal_voucher' })
const seed = (over: Record<string, unknown> = {}) => JSON.stringify({ success: true, data: [{ id: 1, title: '지금 인기 이용권', subtitle: '많이 산 순', more_href: '/vouchers', products: [prod(1), prod(2), prod(3), prod(4), prod(5)], ...over }] })
const banners = JSON.stringify({ success: true, data: [{ id: 1, title: '배너', image_url: 'https://media.ur-team.com/uploads/b.jpg', banner_slot: 'strip' }] })

describe('PC 홈 첫 섹션', () => {
  it('① 서버 클래스가 화면 소스에 글자 그대로 있다', () => {
    for (const k of ['head', 'headText', 'title', 'sub', 'more'] as const) expect(SECTIONS, k).toContain(PC_SECTION_CLS[k])
    expect(SECTIONS).toContain('className={`ur-home-panel')
    expect(RAIL).toContain(`className="${PC_SECTION_CLS.railWrap}"`)
    expect(RAIL).toContain(PC_SECTION_CLS.rail)
  })
  it('② 제목 · 부제 · 더보기 · 카드(4열 폭 사진)를 그린다', () => {
    const html = pcFirstSectionHtml(seed())
    expect(html).toContain('<h3 class="' + PC_SECTION_CLS.title + '">지금 인기 이용권</h3>')
    expect(html).toContain('많이 산 순')
    expect(html).toContain('>더보기</a>')
    expect(html.match(/<a href="\/pass\//g)?.length).toBe(5)
    expect(html).toContain(`width=${HOME_CARD_IMG_WIDTH_LG}`)
  })
  it('③ near 첫째 · 시드 없음 · 깨진 시드 · 빈 섹션이면 빈 문자열', () => {
    expect(pcFirstSectionHtml(seed({ near: true }))).toBe('')
    expect(pcFirstSectionHtml(null)).toBe('')
    expect(pcFirstSectionHtml('{')).toBe('')
    expect(pcFirstSectionHtml(seed({ products: [] }))).toBe('')
  })
  it('③ 배너 다음 · 로더 앞에 들어간다', () => {
    const html = buildPcHomeFirstScreen(banners, '<div id="LDR" style="min-height:100dvh"></div>', seed())
    const a = html.indexOf('기획전 배너'); const b = html.indexOf('지금 인기 이용권'); const c = html.indexOf('id="LDR"')
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b)
  })
  it('④ 워커가 섹션 시드를 넘긴다', () => {
    expect(WORKER).toContain('buildPcHomeFirstScreen(homeBannersPayload, urdealLoaderHtml, ssrExtraPayload)')
  })
})
