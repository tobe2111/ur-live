/**
 * 🖥️ 이용권 상세 PC(lg+) 서버 첫 화면 (2026-11-09 대표 승인 — 2026-09-16 "PC 는 안 그린다" 를 대체).
 *
 * 라이브 실측(1440px·4G·CPU 4배): PC 상세 첫 글자 0.76s(빵부스러기) · **LCP 2.47s**(큰 사진이 앱 뒤). 지키는 것:
 *   ① `DETAIL_PC_FS` 의 클래스가 React 원본(`GroupBuyDetailPage`·`DetailGallery`·`DetailTitleHeader`) 소스의 className 과 한 글자도 안 다르다
 *      (둘은 잠금표 파일이라 import 로 묶지 않고 소스에서 뽑아 대조)
 *   ② PC 본문 = [빵부스러기] + 2열 그리드[좌: 갤러리(PC 블록 · 배경 URL = detailCropUrl 데스크톱 폭·장수별 비율) + 제목 헤더 · 우: 빈 aside] — 반쪽 금지
 *   ③ 제목 헤더는 진짜 `DetailTitleHeader` 를 렌더해 구조·문구 대조(핀 SVG ↔ 15px 빈 칸은 둘 다 ICON)
 *   ④ 호출부는 UA 로 가른다(폰 본문엔 PC 블록이, PC 본문엔 폰 슬라이드·`<img>` 가 없다 — 숨은 <img> 도 받아져 사진이 두 벌)
 *   ⑤ `firstScreenApplies` PC 가지에 상세가 있다(첫 화면 CSS 를 PC 에도 인라인)
 * ⚠️ 못 보는 것: 실제 마운트 때 픽셀 이동(배포 뒤 PC 뷰포트로 CLS 실측).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildDetailFirstScreen } from '@/worker/utils/detail-ssr-body'
import { DETAIL_PC_FS, DETAIL_PC_THUMBS, DETAIL_PC_COPY } from '@/shared/detail-pc-first-screen'
import { detailCropUrl, DETAIL_HERO_DESKTOP_WIDTH, DETAIL_PC_HERO_RATIO_MULTI, DETAIL_PC_HERO_RATIO_SINGLE, DETAIL_THUMB_WIDTH, DETAIL_PC_THUMB_RATIO } from '@/shared/detail-hero-image'
import DetailTitleHeader from '@/pages/group-buy/DetailTitleHeader'
import { PC_HOME_FS } from '@/shared/pc-home-first-screen'

const src = (f: string) => stripComments(readFileSync(f, 'utf8'))
const page = src('src/pages/GroupBuyDetailPage.tsx')
const gallery = src('src/pages/group-buy/DetailGallery.tsx')
const header = src('src/pages/group-buy/DetailTitleHeader.tsx')

const IMG = (n: number) => Array.from({ length: n }, (_, i) => `https://media.ur-team.com/uploads/p${i}.jpg`)
const seed = (over: Record<string, unknown> = {}, n = 4) => JSON.stringify({ data: {
  name: '곱빼기 쌀국수 2인', image_url: IMG(n)[0], images: JSON.stringify(IMG(n).slice(1)), category: 'meal_voucher',
  restaurant_name: '포36거리', restaurant_address: '서울 마포구 양화로 12', restaurant_phone: '02-123-4567', avg_rating: 4.6, review_count: 12, price: 12900, ...over,
} })
const LOADER = '<div style="min-height:100dvh">LOADER</div>'
const pc = (over?: Record<string, unknown>, n?: number) => buildDetailFirstScreen(seed(over, n), LOADER, '', false)

describe('① 클래스는 React 원본 그대로', () => {
  it.each([
    ['grid', page], ['leftCol', page], ['heroBox', page], ['aside', page],
    ['pcWrap', gallery], ['pcGridMulti', gallery], ['pcMain', gallery], ['pcThumbCol', gallery], ['pcThumb', gallery], ['pcRest', gallery], ['pcRestN', gallery],
    ['header', header], ['store', header], ['onnuri', header], ['h1', header], ['meta', header], ['metaGroup', header], ['ratingB', header], ['ratingCount', header], ['sep', header], ['pin', header], ['phone', header],
  ] as const)('%s', (key, source) => {
    const v = DETAIL_PC_FS[key]
    expect(source.includes(`"${v}"`) || source.includes(`'${v}'`), `${key}: "${v}" 가 원본에 없다`).toBe(true)
  })
  it('PC 썸네일 칸 수 · 문구가 원본과 같다', () => {
    expect(gallery).toContain(`const PC_THUMBS = ${DETAIL_PC_THUMBS}`)
    expect(gallery).toContain("defaultValue: '전체 사진 {{count}}장'")
    expect(header).toContain(`defaultValue: '${DETAIL_PC_COPY.registeredStore}'`)
    expect(header).toContain(`defaultValue: '${DETAIL_PC_COPY.onnuri}'`)
  })
})

describe('② PC 본문 구조', () => {
  it('그리드 통째(좌 열 + 빈 aside) · 빵부스러기 · 로더는 사진 아래', () => {
    const h = pc()
    const d = document.createElement('div'); d.innerHTML = h
    const root = d.querySelector('#ur-first-screen')!
    expect(root.getAttribute('class')).toContain('gbd')
    const grid = root.querySelector(`div[class="${DETAIL_PC_FS.grid}"]`)!
    expect(grid, '2열 그리드 래퍼가 없다').toBeTruthy()
    expect(grid.children.length).toBe(2)
    expect(grid.children[0].getAttribute('class')).toBe(DETAIL_PC_FS.leftCol)
    expect(grid.children[1].tagName).toBe('ASIDE')
    expect(grid.children[1].getAttribute('class')).toBe(DETAIL_PC_FS.aside)
    expect(root.querySelector('nav'), '빵부스러기').toBeTruthy()
    // 🧢 상단 네비 높이 예약이 **맨 앞**(React 가 #root 맨 위에 sticky 네비를 세운다 — 없으면 본문이 113px 내려간다)
    const first = root.firstElementChild!
    expect(first.getAttribute('class')).toBe(PC_HOME_FS.topnav)
    expect(Array.from(first.children).map((e) => e.getAttribute('class'))).toEqual([PC_HOME_FS.topnavRow1, PC_HOME_FS.topnavRow2])
    expect(buildDetailFirstScreen(seed(), LOADER), '폰 본문엔 PC 네비 예약이 없다').not.toContain(PC_HOME_FS.topnavRow1)
    expect(h).toContain('min-height:34dvh')
    expect(h.indexOf('</div>' + LOADER.replace('100dvh', '34dvh'))).toBeGreaterThan(0)
  })
  it('갤러리: 여러 장이면 4:3 + 썸네일 2칸 + "+N 전체 사진", 배경 URL 은 detailCropUrl(데스크톱 폭·장수별 비율)', () => {
    const imgs = IMG(4)
    const h = pc(undefined, 4)
    expect(h).toContain(`class="${DETAIL_PC_FS.pcGridMulti}"`)
    expect(h).toContain('aspect-ratio:4 / 3;')
    expect(h).toContain(detailCropUrl(imgs[0], DETAIL_HERO_DESKTOP_WIDTH, DETAIL_PC_HERO_RATIO_MULTI).replace(/&/g, '&amp;'))
    expect(h).toContain(detailCropUrl(imgs[1], DETAIL_THUMB_WIDTH, DETAIL_PC_THUMB_RATIO).replace(/&/g, '&amp;'))
    expect(h).toContain(`<span class="${DETAIL_PC_FS.pcRestN}">+1</span>${DETAIL_PC_COPY.allPhotos(4)}`)
    const one = pc(undefined, 1)
    expect(one).toContain('aspect-ratio:16 / 9;')
    expect(one).not.toContain(DETAIL_PC_FS.pcGridMulti)
    expect(one).toContain(detailCropUrl(imgs[0], DETAIL_HERO_DESKTOP_WIDTH, DETAIL_PC_HERO_RATIO_SINGLE).replace(/&/g, '&amp;'))
  })
  it('?ref= 가 붙으면 제목 헤더를 접는다(폰과 같은 규칙)', () => {
    expect(buildDetailFirstScreen(seed(), LOADER, '?ref=abc', false)).not.toContain(`<header class="${DETAIL_PC_FS.header}">`)
    expect(pc()).toContain(`<header class="${DETAIL_PC_FS.header}">`)
  })
})

/** 요소 트리 → [태그.클래스] 줄. svg(핀) ↔ `block shrink-0 …` 빈 칸은 둘 다 ICON. */
function shape(el: Element, out: string[] = [], depth = 0): string[] {
  const cls = (el.getAttribute('class') || '').trim()
  const icon = el.tagName.toLowerCase() === 'svg' || cls.startsWith('block shrink-0')
  out.push(`${'  '.repeat(depth)}${icon ? 'ICON' : `${el.tagName.toLowerCase()}.${cls}`}`)
  if (!icon) for (const c of Array.from(el.children)) shape(c, out, depth + 1)
  return out
}

describe('③ 제목 헤더 = 진짜 DetailTitleHeader', () => {
  it('구조·클래스·문구가 같다(별점·주소·전화·온누리 전부)', () => {
    const { container } = render(<DetailTitleHeader name="곱빼기 쌀국수 2인" storeName="포36거리" address="서울 마포구 양화로 12" phone="02-123-4567" rating={4.6} reviewCount={12} onnuri />)
    const d = document.createElement('div'); d.innerHTML = pc({ onnuri_merchant: true })
    const s = d.querySelector('header')!; const r = container.querySelector('header')!
    expect(shape(s)).toEqual(shape(r))
    expect(s.textContent).toBe(r.textContent)
  })
  it('별점 0 · 주소 없음이면 둘 다 그 조각을 안 그린다', () => {
    const { container } = render(<DetailTitleHeader name="x" storeName="포36거리" rating={0} />)
    const d = document.createElement('div'); d.innerHTML = pc({ avg_rating: 0, review_count: 0, restaurant_address: null, restaurant_phone: null })
    expect(shape(d.querySelector('header')!)).toEqual(shape(container.querySelector('header')!))
  })
})

describe('④ UA 로 가른다 · ⑤ PC CSS 자격', () => {
  it('폰 본문엔 PC 블록 없음 · PC 본문엔 폰 슬라이드·<img> 없음', () => {
    const m = buildDetailFirstScreen(seed(), LOADER)
    expect(m).toContain('class="relative lg:hidden"'); expect(m).toContain('<img ')
    expect(m).not.toContain(DETAIL_PC_FS.pcWrap)
    const p = pc()
    expect(p).not.toContain('class="relative lg:hidden"'); expect(p).not.toContain('<img ')
    expect(p).toContain(`class="${DETAIL_PC_FS.pcWrap}"`)
  })
  it('워커가 UA 를 넘기고, firstScreenApplies PC 가지에 상세가 있다', () => {
    expect(src('src/worker/index.ts')).toContain("buildDetailFirstScreen(ssrPayload, urdealLoaderHtml, url.search, isMobileUserAgent(c.req.header('user-agent')))")
    expect(src('src/worker/utils/css-first-boot.ts')).toMatch(/if \(!shouldRenderMobileFirstScreen\(ua\)\) return [^\n]*\/\^\\\/\(\?:pass\|group-buy\)\\\/\\d\+\\\/\?\$\/\.test\(pathname\)/)
  })
})
