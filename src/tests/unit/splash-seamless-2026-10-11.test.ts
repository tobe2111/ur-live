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
    expect(firstPixel('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png')).toBe('#1B2340')
  })
})

/**
 * 🍎 아이폰 홈 화면 웹앱은 manifest 를 안 본다 — `apple-touch-startup-image` 가
 * **기기 픽셀과 정확히 같은 크기**일 때만 쓰고, 1px 만 달라도 흰 화면을 띄운다(에러 0).
 * 그래서 선언 · 파일 · 실제 크기 · 서빙(_routes exclude) 넷을 한꺼번에 대조한다.
 */
describe('아이폰 웹앱 시작화면 — 선언·파일·크기·서빙', () => {
  const INDEX = readFileSync('index.html', 'utf8')
  const ROUTES = JSON.parse(readFileSync('public/_routes.json', 'utf8')) as { exclude: string[] }
  const links = [...INDEX.matchAll(/<link rel="apple-touch-startup-image" media="([^"]+)" href="([^"]+)"/g)]
    .map(m => ({ media: m[1], href: m[2] }))

  it('기기별 이미지를 선언한다 (0개면 통과가 아니라 실패)', () => {
    expect(links.length).toBeGreaterThanOrEqual(10)
  })

  it.each(links.map(l => [l.href, l.media]))('%s — 크기가 media 의 CSS 크기 × DPR 과 같고 바탕이 네이비', (href, media) => {
    const w = Number(/device-width: (\d+)px/.exec(media)?.[1])
    const h = Number(/device-height: (\d+)px/.exec(media)?.[1])
    const d = Number(/device-pixel-ratio: (\d+)/.exec(media)?.[1])
    const b = readFileSync(`public${href}`)
    expect([b.readUInt32BE(16), b.readUInt32BE(20)], `${href} 의 픽셀 크기`).toEqual([w * d, h * d])
    expect(firstPixel(`public${href}`)).toBe(manifest.background_color)
    expect(ROUTES.exclude, `${href} 가 exclude 에 없으면 워커가 SPA 셸을 돌려준다`).toContain(href)
  })
})

/**
 * 🔎 파비콘(구글 검색 결과·브라우저 탭) — 2026-10-11 대표 *"남색 바탕에 유달이로도 해주고"*.
 * 구글은 index.html 의 rel=icon 중 하나를 골라 원형으로 잘라 보여 준다. 일부만 바뀌면 어느 크기를
 * 고르느냐에 따라 옛 파란 `ur` 이 다시 뜬다(에러 0) — 그래서 선언된 PNG 전부의 바탕을 대조한다.
 * ⚠️ 못 보는 것: favicon.ico 안쪽 그림 · 구글이 언제 다시 가져가는지(며칠~몇 주).
 */
describe('파비콘 — 남색 + urdeal. 로고(2026-10-17)', () => {
  const INDEX = readFileSync('index.html', 'utf8')
  const pngs = [...INDEX.matchAll(/<link rel="icon" type="image\/png"[^>]*href="([^"]+)"/g)].map(m => m[1])

  it('PNG 파비콘을 선언한다 (0개면 통과가 아니라 실패)', () => {
    expect(pngs.length).toBeGreaterThanOrEqual(5)
  })

  it.each(pngs.map(p => [p]))('%s — 바탕이 앱 아이콘과 같은 남색', (href) => {
    expect(firstPixel(`public${href}`)).toBe(manifest.background_color)
  })

  it('favicon.svg 도 생성 스크립트 산출물(옛 블루+ur 아님)', () => {
    expect(readFileSync('public/favicon.svg', 'utf8')).toContain('make-favicon.py')
  })
})
