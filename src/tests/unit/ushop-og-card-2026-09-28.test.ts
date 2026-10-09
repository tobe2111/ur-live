/**
 * 🛍️ 유어샵 카톡 공유 카드 — 2026-09-28 대표 신고 *"카카오로 링크 공유했는데 이 형태 너무한데?"*
 *
 * 라이브 카드가 **새까맸다**. 원인은 둘이 겹친 것이고, 둘 다 에러를 안 낸다:
 *   ① SVG 안에서 사진을 외부 `<image href="https://…">` 로 불러왔다 → 카톡 스크래퍼는 SVG 를
 *      굽기만 하고 하위 리소스를 안 가져온다 → 사진 0장. (실측: SVG 엔 `<image>` 4개가 멀쩡히 있었다)
 *   ② 바탕 `#11141C` 과 빈 칸 `#1D1F29` 이 거의 같은 검정이라 안 그려진 자리가 티도 안 났다.
 *
 * ⚠️ **이 시험이 못 하는 것**: 카카오가 실제로 어떻게 굽는지는 못 잰다(그쪽 렌더러를 우리가 못 부른다).
 *   여기서는 "카드 안에 네트워크를 타는 참조가 남아 있지 않은가"까지만 기계로 고정하고,
 *   실제 그림은 브라우저로 **네트워크를 끊고** 렌더해 눈으로 확인했다(PR 본문의 스크린샷).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  generateCuratorSVG, tileWidth, TILE_X, TILE_ROW_W, TILE_GAP, TILE_H,
  type CuratorForOG,
} from '@/worker/utils/og-curator-card'
import { toAbsolute, resizedUrl, bytesToBase64, inlineImage, OG_INLINE_MAX_BYTES } from '@/worker/utils/og-inline-image'
import { stripComments } from '../helpers/source-text'

const CURATOR: CuratorForOG = {
  id: 3, handle: 'jiwon1228', name: '정지원',
  bio: '전국의 맛집을 소개합니다.', profile_image: '/api/media/p.jpg',
}
const DATA = (n: number) => Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,AAA${i}`)

const hrefs = (svg: string) => [...svg.matchAll(/href="([^"]*)"/g)].map(m => m[1])
/** 타일 사각형들의 [x, width] — 문자열이 아니라 **출력에서 파싱**해 잰다. */
const tileRects = (svg: string) =>
  [...svg.matchAll(/<rect x="(\d+)" y="296" width="(\d+)" height="(\d+)" rx="18"\/>/g)]
    .map(m => ({ x: Number(m[1]), w: Number(m[2]), h: Number(m[3]) }))

describe('유어샵 OG 카드 — 사진이 카드 안에 박혀 있는가', () => {
  it('①(핵심) 네트워크를 타는 사진 참조가 하나도 없다', () => {
    const svg = generateCuratorSVG(CURATOR, DATA(1)[0], DATA(4))
    const list = hrefs(svg)
    expect(list.length, 'href 가 0개면 이 검사는 아무것도 안 지킨다').toBeGreaterThan(0)
    for (const h of list) expect(h.startsWith('data:'), `외부 참조가 남았다: ${h.slice(0, 40)}`).toBe(true)
  })

  it('② 사진이 0장이면 빈 칸을 보여주지 않는다 (까만 카드의 절반이 이것이었다)', () => {
    const svg = generateCuratorSVG(CURATOR, null, [])
    expect(tileRects(svg)).toHaveLength(0)
    expect(hrefs(svg)).toHaveLength(0)
    // 신원 블록은 그대로 있어야 한다 — 사진이 없다고 빈 카드가 되면 안 된다.
    expect(svg).toContain('정지원')
    expect(svg).toContain('@jiwon1228')
  })

  it('③ 타일은 몇 장이든 줄을 꽉 채운다 (3장일 때 오른쪽이 휑하던 것)', () => {
    for (const n of [1, 2, 3, 4]) {
      const rects = tileRects(generateCuratorSVG(CURATOR, null, DATA(n)))
      expect(rects, `${n}장`).toHaveLength(n)
      expect(rects[0].x).toBe(TILE_X)
      const last = rects[n - 1]
      // 반올림 오차 2px 까지만 허용 — 그 이상이면 줄이 안 맞는다.
      expect(Math.abs(last.x + last.w - (TILE_X + TILE_ROW_W)), `${n}장 오른쪽 끝`).toBeLessThanOrEqual(2)
      for (const r of rects) expect(r.h).toBe(TILE_H)
    }
  })

  it('④ 긴 이름·긴 소개가 카드 밖으로 안 넘친다', () => {
    const long = '아주아주긴이름을가진사장님입니다정말로'
    const svg = generateCuratorSVG({ ...CURATOR, name: long, bio: '가'.repeat(200) }, null, DATA(3))
    const name = svg.match(/font-size="52"[^>]*>([^<]*)</)?.[1] ?? ''
    expect(name.length, '이름은 15자 이내로 잘려야 한다(52px 한글 15자 = 오른쪽 안전선)').toBeLessThanOrEqual(15)
    expect(name.endsWith('…')).toBe(true)
    const bio = svg.match(/font-size="27"[^>]*>([^<]*)</)?.[1] ?? ''
    expect(bio.length).toBeLessThanOrEqual(34)
  })

  it('⑤ 이름·소개의 <, & 가 SVG 를 깨뜨리지 않는다', () => {
    const svg = generateCuratorSVG({ ...CURATOR, name: '<b>&"x"', bio: '<script>' }, null, [])
    expect(svg).not.toContain('<b>')
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;b&gt;')
  })

  it('⑥ 흰 카드 위에 브랜드 블루 밴드 — 까만 카드로 되돌아가지 않는다', () => {
    const svg = generateCuratorSVG(CURATOR, null, [])
    expect(svg).toContain('fill="#FFFFFF"')   // 카드 면
    expect(svg).toContain('fill="#1C69EF"')   // 브랜드 밴드
    expect(svg).not.toContain('#11141C')      // 종전 까만 바탕
  })
})

describe('사진 인라인 helper', () => {
  it('상대 경로에 오리진을 붙이고, 외부 절대 URL 은 그대로 둔다', () => {
    expect(toAbsolute('/api/media/a.jpg', 'https://x.kr')).toBe('https://x.kr/api/media/a.jpg')
    expect(toAbsolute('https://m.ur-team.com/a.webp', 'https://x.kr')).toBe('https://m.ur-team.com/a.webp')
    expect(toAbsolute('', 'https://x.kr')).toBe('')
    expect(toAbsolute(null, 'https://x.kr')).toBe('')
  })

  it('원본 URL 의 % 를 한 번 더 감싼다 (2026-08-11 과 같은 404 함정)', () => {
    const u = resizedUrl('https://n.net/%B8%DE.jpg', 'https://x.kr', 300, 236)
    expect(u).toContain('%25B8%25DE')
    expect(u).toContain('format=jpeg')       // AVIF/WebP 면 굽는 쪽이 못 읽을 수 있다
    expect(u).toContain('width=300,height=236')
  })

  it('큰 배열도 스택을 안 터뜨리고 base64 로 바꾼다', () => {
    const big = new Uint8Array(70_000).fill(65)
    expect(bytesToBase64(big)).toBe(Buffer.from(big).toString('base64'))
  })

  it('받아 오면 data URI, 실패·과대는 null (카드는 사진 없이도 그려진다)', async () => {
    const ok = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    expect(await inlineImage('/a.jpg', 'https://x.kr', 10, 10, ok as never))
      .toBe(`data:image/jpeg;base64,${Buffer.from([1, 2, 3]).toString('base64')}`)

    const notFound = async () => new Response('nope', { status: 404 })
    expect(await inlineImage('/a.jpg', 'https://x.kr', 10, 10, notFound as never)).toBeNull()

    const huge = async () => new Response(new Uint8Array(OG_INLINE_MAX_BYTES + 1), { status: 200 })
    expect(await inlineImage('/a.jpg', 'https://x.kr', 10, 10, huge as never)).toBeNull()

    const boom = async () => { throw new Error('network') }
    expect(await inlineImage('/a.jpg', 'https://x.kr', 10, 10, boom as never)).toBeNull()

    expect(await inlineImage(null, 'https://x.kr', 10, 10, ok as never)).toBeNull()
  })
})

describe('배선 — 모듈만 맞고 라우트가 안 부르면 라이브는 그대로다', () => {
  const route = stripComments(fs.readFileSync('src/worker/routes/og-image.routes.ts', 'utf8'))
  const worker = stripComments(fs.readFileSync('src/worker/index.ts', 'utf8'))

  it('라우트가 프로필과 타일을 모두 인라인해서 넘긴다', () => {
    expect(route).toMatch(/inlineImage\(\s*curator\.profile_image/)
    expect(route).toMatch(/thumbs\.map\(t => inlineImage\(t, origin, tw, TILE_H\b/)
    expect(route).toMatch(/generateCuratorSVG\(curator, profileUri,/)
  })

  it('받는 크기를 카드와 같은 식으로 정한다 (정사각으로 받아 늘리지 않게)', () => {
    expect(route).toMatch(/tileWidth\(thumbs\.length\)/)
    // 고정 숫자로 되돌아가면 3장일 때 비율이 어긋난다.
    expect(route).not.toMatch(/inlineImage\(t, origin, 300, 300\)/)
    expect(tileWidth(3)).toBeCloseTo((TILE_ROW_W - TILE_GAP * 2) / 3, 5)
    expect(tileWidth(0)).toBe(0)
  })

  it('og:image 주소에 판 번호가 있다 — 없으면 카톡이 옛 까만 카드를 계속 물고 있다', () => {
    expect(worker).toMatch(/\/api\/og\/curator\/\$\{encodeURIComponent\(cur\.handle \|\| ''\)\}\?v=\d+/)
  })
})

describe('🖼️ 2026-10-10 Images 바인딩 — 서버 안에서 사진을 줄여 박는다', () => {
  const huge = () => new Response(new Uint8Array(OG_INLINE_MAX_BYTES * 4), { status: 200 })
  const shrinker = (out: Uint8Array) => {
    const calls: Array<Record<string, unknown>> = []
    return {
      calls,
      input() {
        return {
          transform(o: Record<string, unknown>) {
            calls.push(o)
            return { output: async () => ({ response: () => new Response(out as unknown as BodyInit) }) }
          },
        }
      },
    }
  }

  it('바인딩이 있으면 큰 원본(라이브 656KB)도 줄여서 data URI 로', async () => {
    const img = shrinker(new Uint8Array([9, 9]))
    const urls: string[] = []
    const f = async (u: string) => { urls.push(u); return huge() }
    expect(await inlineImage('https://p.net/a.jpg', 'https://x.kr', 780, 520, f as never, img))
      .toBe(`data:image/jpeg;base64,${Buffer.from([9, 9]).toString('base64')}`)
    expect(urls[0], '바인딩 경로는 원본을 직접 받는다(cdn-cgi 아님)').toBe('https://p.net/a.jpg')
    expect(img.calls[0]).toMatchObject({ width: 780, height: 520, fit: 'cover' })
  })

  it('바인딩이 실패하면 종전 cdn-cgi 경로로 떨어진다', async () => {
    const broken = { input() { throw new Error('no binding') } }
    const urls: string[] = []
    const f = async (u: string) => { urls.push(u); return new Response(new Uint8Array([1]), { status: 200 }) }
    expect(await inlineImage('https://p.net/a.jpg', 'https://x.kr', 10, 10, f as never, broken as never))
      .toBe(`data:image/jpeg;base64,${Buffer.from([1]).toString('base64')}`)
    expect(urls.some((u) => u.includes('/cdn-cgi/image/'))).toBe(true)
  })

  it('라우트가 두 카드(사진 세 자리) 모두 바인딩을 넘긴다', () => {
    const src = fs.readFileSync('src/worker/routes/og-image.routes.ts', 'utf8')
    expect((src.match(/fetch, c\.env\.IMAGES\)/g) || []).length).toBe(3)
  })
})
