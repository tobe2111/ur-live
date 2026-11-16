/**
 * 🖥️ 2026-11-16 대표 *"계속 개선"* — PC 홈 서버 첫 화면이 첫 섹션 아래 **유어쇼츠 줄 + 둘째 섹션**까지 그린다.
 *   라이브 끼워 재기(PC·CPU 4배 3+3회): 유어쇼츠·'지금 인기 이용권' 2.7~3.6s → 첫 섹션과 함께 0.37~1.0s · CLS 그대로(0.0001).
 *   화면 순서(`HomeSections rail`, shortsAfter=0): 첫 섹션 → 유어쇼츠 → inline 배너 → 둘째 섹션.
 *   못 보는 것: 픽셀(배포 뒤 라이브) · 셋째 섹션(종전처럼 앱이 아래에 붙인다 — 밀림 아님).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { pcFirstSectionHtml } from '@/worker/utils/pc-home-first-screen'

const prod = (id: number) => ({ id, name: `딜${id}`, price: 9000, image_url: `https://media.ur-team.com/uploads/demo/${id}.jpg`, category: 'meal_voucher', restaurant_address: '서울 강남구 1' })
const SECTIONS = JSON.stringify({ success: true, data: [
  { id: 1, title: '첫 섹션', products: [prod(1), prod(2), prod(3), prod(4), prod(5)] },
  { id: 2, title: '지금 인기 이용권', subtitle: '많이 팔린 순', more_href: '/?sort=popular', products: [prod(6), prod(7)] },
] })
const SHORTS = JSON.stringify({ success: true, data: [{ id: 1, video_id: 'a', title: 't', duration_sec: 31, store_name: '가게', price: 9000 }] })
const banners = (slots: string[]) => JSON.stringify({ success: true, data: slots.map((s, i) => ({ id: i + 1, title: `b${i}`, banner_slot: s })) })

describe('PC 첫 섹션 아래', () => {
  it('유어쇼츠 시드·배너 시드가 있고 inline 이 없으면: 첫 섹션 → 유어쇼츠 → 둘째 섹션 순서', () => {
    const html = pcFirstSectionHtml(SECTIONS, SHORTS, banners(['strip']))
    const a = html.indexOf('>첫 섹션<'), b = html.indexOf('>유어쇼츠<'), c = html.indexOf('>지금 인기 이용권<')
    expect(a).toBeGreaterThan(-1); expect(b).toBeGreaterThan(a); expect(c).toBeGreaterThan(b)
  })
  it('eager 는 첫 섹션 앞 4장뿐(둘째 섹션은 lazy)', () => {
    const html = pcFirstSectionHtml(SECTIONS, SHORTS, banners(['strip']))
    expect((html.match(/loading="eager"/g) || []).length).toBe(4)
  })
  it('inline 배너가 있으면 유어쇼츠까지만 · 유어쇼츠 시드/배너 시드가 없으면 첫 섹션만(종전)', () => {
    const withInline = pcFirstSectionHtml(SECTIONS, SHORTS, banners(['strip', 'inline']))
    expect(withInline).toContain('>유어쇼츠<'); expect(withInline).not.toContain('지금 인기 이용권')
    for (const h of [pcFirstSectionHtml(SECTIONS, null, banners([])), pcFirstSectionHtml(SECTIONS, SHORTS, null), pcFirstSectionHtml(SECTIONS)]) {
      expect(h).toContain('>첫 섹션<'); expect(h).not.toContain('유어쇼츠'); expect(h).not.toContain('지금 인기 이용권')
    }
  })
  it('화면 순서가 그대로다 — HomeSections: shortsAfter=0 이면 첫 섹션 뒤 유어쇼츠, 그 뒤 midBanner(PC = inline)', () => {
    const hs = readFileSync('src/components/home/HomeSections.tsx', 'utf8')
    expect(hs).toContain('{shortsAfter === 0 && sIdx === 0 && shortsRail}')
    expect(hs).toContain('{sIdx === 0 && midBanner}')
    expect(readFileSync('src/pages/pc-home/PcHomePage.tsx', 'utf8')).toContain('<HomeSections rail near={near} shortsRail={<UrShortsRail />} midBanner={<HomeBannerStrip variant="inline" />} />')
  })
})
