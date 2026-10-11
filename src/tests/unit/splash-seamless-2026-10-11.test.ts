/**
 * 🌙 시작화면 안 1 (2026-10-11 대표 *"안1로 해줘"*)
 *
 * 홈 화면 웹앱의 시작화면은 브라우저가 **manifest 바탕색 + maskable 아이콘**으로 만든다.
 * 안 1 은 둘의 색을 같게 해서 아이콘 테두리를 지운다 — 둘 중 하나만 바뀌면 화면 한가운데
 * 네모(또는 동그라미) 경계가 다시 생긴다. 에러도 안 나고 설치된 폰에서만 보인다.
 * ⚠️ 못 보는 것: 기기 마스크 모양 · 이미 설치된 웹앱이 아이콘을 언제 다시 받는지(브라우저 몫).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

/** PNG 첫 화소(왼쪽 위). 첫 줄은 어떤 필터든 이웃이 0 이라 원본 값이 그대로 나온다. */
function firstPixel(path: string): string {
  const b = readFileSync(path)
  let o = 8, ihdr: Buffer | null = null
  const idat: Buffer[] = []
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8)
    const data = b.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') ihdr = data
    if (type === 'IDAT') idat.push(data)
    o += 12 + len
  }
  if (!ihdr) throw new Error('IHDR 없음')
  expect(ihdr[8], '8비트 PNG 만 판정한다').toBe(8)
  expect([2, 6]).toContain(ihdr[9]) // RGB · RGBA
  const raw = inflateSync(Buffer.concat(idat))
  return '#' + [raw[1], raw[2], raw[3]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))

describe('시작화면 안 1 — 바탕과 아이콘이 이어진다', () => {
  it('manifest 바탕색은 딥 네이비', () => {
    expect(manifest.background_color).toBe('#1B2340')
  })

  it('maskable 아이콘의 바탕이 manifest 바탕색과 같다', () => {
    const icons = (manifest.icons as Array<{ src: string; purpose?: string }>).filter(i => i.purpose === 'maskable')
    expect(icons.length, 'maskable 아이콘이 없으면 시작화면은 any 아이콘을 쓴다').toBeGreaterThan(0)
    for (const i of icons) expect(firstPixel(`public${i.src}`), i.src).toBe(manifest.background_color)
  })

  it('스토어 앱 시작화면도 같은 네이비', () => {
    expect(readFileSync('capacitor.config.ts', 'utf8')).toMatch(/SplashScreen:\s*\{[\s\S]*?backgroundColor:\s*'#1B2340'/)
    expect(firstPixel('android/app/src/main/res/drawable/splash.png')).toBe('#1B2340')
  })
})
