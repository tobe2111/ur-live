/**
 * 🪣 2026-10-31 사진 변환 칸 묶기 — Cloudflare Images 무료 한도(월 5,000 *고유* 변환) 보호.
 * 대표 "2번(무료 유지 + 줄이는 횟수 낮추기). 이용권 많아지면 무조건 유료 전환".
 * 한도는 사진 × 옵션 조합으로 센다 — 폭 값이 코드에 40가지 넘게 있어 한 사진이 여러 번 셌다.
 * ⚠️ 못 보는 것: 이번 달 실제 사용량(대시보드에만 있다) · 칸에 올린 만큼 늘어난 바이트.
 */
import { describe, it, expect } from 'vitest'
import { cfImage, cfSrcSet, snapResizeOptions, CF_WIDTH_BUCKETS } from '@/utils/cf-image'

const M = '/api/media/uploads/demo/a.jpg'
const widthOf = (u: string) => Number(/width=(\d+)/.exec(u)?.[1])

describe('폭은 정해진 칸으로만 나간다', () => {
  it('흔히 쓰는 폭이 전부 칸 안이다', () => {
    for (const w of [64, 96, 112, 120, 128, 160, 200, 240, 300, 320, 384, 400, 480, 640, 760, 800, 900, 1200, 1600]) {
      expect(CF_WIDTH_BUCKETS as readonly number[]).toContain(widthOf(cfImage(M, { width: w })))
    }
  })
  it('작게 받지 않는다 — 위 칸으로 올린다', () => {
    expect(widthOf(cfImage(M, { width: 401 }))).toBe(640)
    expect(widthOf(cfImage(M, { width: 400 }))).toBe(400)
  })
  it('종류가 크게 준다 — 40가지 폭이 8칸으로', () => {
    const seen = new Set([64, 96, 112, 120, 128, 160, 200, 240, 300, 320, 384, 400, 480, 640, 760, 800, 900].map((w) => widthOf(cfImage(M, { width: w }))))
    expect(seen.size).toBeLessThanOrEqual(5)
  })
  it('크롭 비율을 지킨다(높이도 같은 비율로)', () => {
    expect(snapResizeOptions({ width: 900, height: 600 })).toMatchObject({ width: 960, height: 640 })
    expect(snapResizeOptions({ width: 384, height: 288 })).toMatchObject({ width: 400, height: 300 })
  })
  it('화질도 세 칸', () => {
    expect(snapResizeOptions({ quality: 80 }).quality).toBe(75)
    expect(snapResizeOptions({ quality: 90 }).quality).toBe(85)
  })
})

describe('srcset 은 기본 2x 까지', () => {
  it('3x 후보를 기본으로 내지 않는다', () => expect(cfSrcSet(M, 200)).not.toMatch(/ 3x/))
})
