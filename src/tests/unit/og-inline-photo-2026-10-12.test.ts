/**
 * 🖼️ OG 카드에 사진이 **실제로 박히는가** (2026-10-12 대표 신고 *"유어샵 링크 공유했는데 이렇게 보이면
 * 너무 투박하잖아"*).
 *
 * 🔎 **디자인이 투박했던 게 아니다 — 사진이 한 장도 안 들어가고 있었다.** 라이브 실측:
 *   `https://urdeal.kr/api/og/curator/jiwon1228` → **1,694바이트 · `<image>` 0개**(핀 4장은 멀쩡).
 *   그래서 카드가 `hasTiles === false` 폴백(letter 아바타 + 이름 + 한 줄)으로 나갔고,
 *   그 내용은 카톡이 아래에 적는 제목·설명과 **똑같아서** 그림이 정보를 하나도 안 보탰다.
 *   이용권 카드는 같은 원인으로 **302 폴백**(생 사진)을 탔다 — 우리 카드가 아예 안 나간다.
 *
 * 📏 같은 사진을 **바깥에서** 같은 식으로 받으면 6~11KB 다(`cf-resized: internal=ok`, 상한 160KB).
 *   ⇒ 크기 문제가 아니라 **줄여 주는 경로를 못 타고 있었다.**
 *
 * ⚠️ **이 시험이 못 보는 것**: `cf.image` 가 라이브 워커에서 실제로 리사이즈를 거는지. 그건 워커
 *   런타임 전용이라 유닛 밖이고 **배포 후 E4**(카드 바이트 수 · `<image>` 개수)로만 판정된다.
 *   여기서 고정하는 것은 *우리가 올바른 수단을 올바른 순서로 시도하는가* 까지다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'
import { toAbsolute, toFetchable, inlineImage, OG_INLINE_MAX_BYTES } from '../../worker/utils/og-inline-image'

const SRC = join(process.cwd(), 'src/worker/utils/og-inline-image.ts')
const CODE = stripComments(readFileSync(SRC, 'utf8'))

const ORIGIN = 'https://urdeal.kr'

/** 그림 한 장을 흉내 내는 응답. `bytes` 만큼의 본문 + content-type 을 준다. */
function imgRes(bytes: number, ct = 'image/jpeg'): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': ct } })
}

describe('① 워커가 자기 자신을 다시 부르지 않는다 — /api/media 는 R2 공개 도메인으로', () => {
  it('업로드 사진은 media.ur-team.com 으로 간다', () => {
    expect(toFetchable('/api/media/uploads/demo/a.jpg', ORIGIN))
      .toBe('https://media.ur-team.com/uploads/demo/a.jpg')
    // 절대 주소로 저장된 레거시도 같은 자리로 모인다.
    expect(toFetchable(`${ORIGIN}/api/media/uploads/x/b.png`, ORIGIN))
      .toBe('https://media.ur-team.com/uploads/x/b.png')
  })

  it('그 밖의 주소는 손대지 않는다 (외부 CDN·R2 직접 주소)', () => {
    for (const u of ['https://media.ur-team.com/uploads/x/c.jpg', 'https://i.ytimg.com/vi/x/hq.jpg']) {
      expect(toFetchable(u, ORIGIN)).toBe(u)
    }
    expect(toFetchable('', ORIGIN)).toBe('')
    expect(toFetchable(null, ORIGIN)).toBe('')
  })

  it('표시용 toAbsolute 는 바뀌지 않았다 — 302 폴백은 사용자가 여는 주소다', () => {
    expect(toAbsolute('/api/media/uploads/demo/a.jpg', ORIGIN)).toBe(`${ORIGIN}/api/media/uploads/demo/a.jpg`)
  })
})

describe('② Workers 네이티브 리사이즈(cf.image)를 실제로 건다', () => {
  it('cf.image 로 요청하고, 받은 그림을 data URI 로 박는다', async () => {
    const calls: Array<{ url: string; cf: unknown }> = []
    const fakeFetch = (async (u: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(u), cf: (init as { cf?: unknown } | undefined)?.cf })
      return imgRes(8_000)
    }) as unknown as typeof fetch

    const uri = await inlineImage('/api/media/uploads/demo/a.jpg', ORIGIN, 236, 236, fakeFetch)
    expect(uri, '사진을 못 박았다').toMatch(/^data:image\/jpeg;base64,/)
    expect(calls.length, '요청이 하나도 안 나갔다 — 이 검사가 헛돈다').toBeGreaterThan(0)

    const first = calls[0]
    expect(first.url, '워커가 자기 자신을 다시 불렀다').toBe('https://media.ur-team.com/uploads/demo/a.jpg')
    const img = (first.cf as { image?: Record<string, unknown> } | undefined)?.image
    expect(img, 'cf.image 없이 보냈다 — 워커 안에서는 /cdn-cgi/image 가 안 먹는다').toBeTruthy()
    expect(img).toMatchObject({ width: 236, height: 236, fit: 'cover', format: 'jpeg' })
  })

  it('cf.image 가 무시돼 원본이 와도(상한 초과) 종전처럼 null — 회귀가 아니다', async () => {
    const fakeFetch = (async () => imgRes(OG_INLINE_MAX_BYTES + 1)) as unknown as typeof fetch
    expect(await inlineImage('/api/media/x/big.jpg', ORIGIN, 236, 236, fakeFetch)).toBeNull()
  })

  it('cf.image 가 터지면 종전 cdn-cgi 경로로 떨어진다', async () => {
    const seen: string[] = []
    let n = 0
    const fakeFetch = (async (u: string | URL | Request) => {
      seen.push(String(u))
      if (n++ === 0) throw new Error('cf.image unsupported')
      return imgRes(5_000)
    }) as unknown as typeof fetch

    const uri = await inlineImage('/api/media/x/a.jpg', ORIGIN, 100, 100, fakeFetch)
    expect(uri, '폴백 경로가 끊겼다').toMatch(/^data:image\/jpeg;base64,/)
    expect(seen.length).toBe(2)
    expect(seen[1], '두 번째 시도가 cdn-cgi 가 아니다').toContain('/cdn-cgi/image/')
  })
})

describe('③ 그림이 아닌 응답을 그림이라고 박지 않는다', () => {
  it('SPA HTML 이 와도 null — 깨진 그림을 카드에 넣는 것이 빈 칸보다 나쁘다', async () => {
    const html = () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    const fakeFetch = (async () => html()) as unknown as typeof fetch
    expect(await inlineImage('/api/media/x/a.jpg', ORIGIN, 100, 100, fakeFetch)).toBeNull()
  })

  it('content-type 이 **없는** 그림은 받아들인다 — 막으면 오늘 나오던 사진이 사라진다', async () => {
    // 🔒 의도적으로 느슨하다. 일부 오리진·프록시가 그림에 타입을 안 붙인다(기존 가드의 픽스처가
    //   정확히 그 모양이고, 그 사실이 첫 판의 `image/*` 전용 규칙을 뒤집었다).
    const bare = () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    const fakeFetch = (async () => bare()) as unknown as typeof fetch
    expect(await inlineImage('/api/media/x/a.jpg', ORIGIN, 100, 100, fakeFetch)).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('두 경로 모두 content-type 을 본다 (한쪽만 보면 다른 쪽으로 샌다)', () => {
    expect((CODE.match(/looksLikeImage\(res\)/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('④ 시도 순서 — 바인딩 → cf.image → cdn-cgi', () => {
  it('cf.image 가 cdn-cgi URL 조립보다 먼저 온다', () => {
    const iCf = CODE.indexOf('cf: { image:')
    const iUrl = CODE.indexOf('resizedUrl(abs, origin, width, height)')
    expect(iCf, 'cf.image 시도가 사라졌다').toBeGreaterThan(-1)
    expect(iUrl, 'cdn-cgi 폴백이 사라졌다 — 안전판을 지우지 말 것').toBeGreaterThan(-1)
    expect(iCf, '순서가 뒤집혔다 — 안 먹는 경로를 먼저 태우게 된다').toBeLessThan(iUrl)
  })

  it('Images 바인딩 경로도 R2 주소를 받는다 (자기-자신 호출 금지)', () => {
    expect(CODE).toMatch(/fetchImpl\(src,\s*\{\s*headers:\s*\{\s*Accept:\s*'image\/\*'/)
  })
})
