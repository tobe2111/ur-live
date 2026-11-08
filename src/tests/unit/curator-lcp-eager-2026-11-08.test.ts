/**
 * ⚡ 2026-11-08 대표 *"계속 최적화"* — 유어샵 첫 화면 사진을 **지금 보이는 사진**으로 받는다.
 *
 * 라이브 실측(느린 4G 흉내): `/u/jiwon1228` 첫 줄 사진(7KB)이 `loading="lazy"` 라 배치 계산 뒤로 밀리고
 * 우선순위도 낮아, CSS 뒤 출발한 스크립트 25개와 회선을 다투다 **1.4초** 뒤에 떴다(LCP 2.2s).
 * 처방 셋: ① 서버 첫 화면 줄은 lazy 없이 · 첫 줄 `fetchpriority="high"` ② 응답 헤더 `Link: rel=preload`(첫 줄 사진)
 * ③ 마운트한 `PinRow` 도 첫 네 줄은 lazy 없이(같은 주소를 lazy 로 다시 그려 우선순위를 낮추지 않게).
 *
 * ⚠️ 못 보는 것: 실제 LCP 가 줄었는지(라이브에서 잰다) · 정렬을 바꾼 뒤 화면 위 네 줄(즉시 받기는 주인 순서 기준).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildCuratorFirstScreen, curatorLcpImage } from '@/worker/utils/curator-ssr-body'
import { cfImage } from '@/utils/cf-image'

const pin = (id: number, img: string, order: number) => ({
  id, product_id: 1000 + id, product_name: `상품${id}`, restaurant_name: '가게', price: 9000, original_price: 10000,
  discount_rate: 10, image_url: img, thumbnail: null, pin_order: order, deal_only: 0,
})
const payload = (over: Record<string, unknown> = {}) => JSON.stringify({
  success: true,
  curator: { handle: 'shop', name: '가게주인', id: 1 },
  pins: [1, 2, 3, 4, 5].map((i) => pin(i, `https://media.ur-team.com/uploads/demo/${i}.jpg`, i)),
  ...over,
})

describe('① 서버 첫 화면 줄 — lazy 없이, 첫 줄만 high', () => {
  const html = buildCuratorFirstScreen(payload(), '<div style="min-height:100dvh"></div>')
  const imgs = html.match(/<img[^>]*>/g) || []
  const rowImgs = imgs.filter((t) => t.includes('/uploads/demo/'))

  it('진열 사진을 그렸다(이 시험이 무언가를 본다)', () => {
    expect(rowImgs.length).toBeGreaterThanOrEqual(4)
  })
  it('어느 줄도 loading="lazy" 가 아니다', () => {
    for (const t of rowImgs) expect(t).not.toMatch(/loading="lazy"/)
  })
  it('fetchpriority="high" 는 정확히 한 장 — 첫 줄', () => {
    const high = rowImgs.filter((t) => t.includes('fetchpriority="high"'))
    expect(high.length).toBe(1)
    expect(high[0]).toBe(rowImgs[0])
  })
})

describe('② 응답 헤더 preload 주소 = 첫 줄 img 주소', () => {
  it('같은 주소다(갈리면 같은 사진을 두 번 받는다)', () => {
    const p = payload()
    const href = curatorLcpImage(p)
    expect(href).toBe(cfImage('https://media.ur-team.com/uploads/demo/1.jpg', { width: 240, format: 'auto' }))
    const first = (buildCuratorFirstScreen(p, '').match(/<img[^>]*\/uploads\/demo\/[^>]*>/) || [''])[0]
    expect(first.replace(/&amp;/g, '&')).toContain(`src="${href}"`)
  })
  it('첫 화면을 그리지 않는 경우엔 비운다(사업자 유어샵 · 실패 · 빈 값)', () => {
    expect(curatorLcpImage(payload({ linked_seller: { id: 3 } }))).toBe('')
    expect(curatorLcpImage(payload({ success: false }))).toBe('')
    expect(curatorLcpImage('')).toBe('')
    expect(curatorLcpImage('{깨진')).toBe('')
  })
  it('워커가 첫 화면을 그릴 때만 헤더를 싣는다', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../worker/index.ts'), 'utf8')
    expect(src).toMatch(/if \(curatorFirst\) appendLcpLink\(c\.res\.headers, curatorLcpImage\(ssrPayload\)\)/)
  })
})

describe('③ 마운트 뒤 PinRow — 첫 네 줄은 즉시', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../pages/curator-page/PinRow.tsx'), 'utf8')
  it('order 로 lazy 를 가르고, 그 경계가 서버 줄 수(4)와 같다', () => {
    expect(src).toMatch(/loading=\{order <= CURATOR_EAGER_ROWS \? undefined : 'lazy'\}/)
    expect(src).toMatch(/const CURATOR_EAGER_ROWS = 4\b/)
    const ssr = fs.readFileSync(path.join(__dirname, '../../worker/utils/curator-ssr-body.ts'), 'utf8')
    expect(ssr).toMatch(/export const CURATOR_FS_ROWS = 4\b/)
  })
  it('첫 줄만 fetchPriority high', () => {
    expect(src).toMatch(/fetchPriority=\{order === 1 \? 'high' : undefined\}/)
  })
})
