/**
 * 🖼️ 2026-10-17 — 인스타 초안에 카드 이미지(1080×1350)를 붙인다.
 * 그 전엔 이미지 칸이 비어 인스타 게시가 "이미지가 필요합니다" 로 막혔다(라이브 id 2·5).
 *
 * ⚠️ 못 보는 것: 카드가 **예쁜가**(그려서 봐야 한다 — 디자인 확인은 로컬 Playwright 렌더로 했다) ·
 *    Cloudflare 브라우저가 실제로 글꼴·그림을 받아 오는가(배포 후 라이브 판정) · 무료 한도(하루 10분) 소진.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import {
  buildCardHtml, cardSubline, cardHeadline, headlineSize, CARD_URL, CARD_CHIP, DEFAULT_CARD_ASSETS, escHtml, MASCOT_DRAW_H,
} from '@/features/social-media/api/social-image-card'
import { AUDIENCE_LANDING, SOCIAL_AUDIENCES } from '@/features/social-media/api/social-audience'
import { readCode } from '../helpers/source-text'

const store = { post: null as Record<string, unknown> | null, updated: null as Record<string, unknown> | null }
vi.mock('@/features/social-media/api/social-store', () => ({
  getPost: async () => store.post,
  updatePost: async (_db: unknown, _id: number, patch: Record<string, unknown>) => { store.updated = patch },
}))
const shot = { bytes: new Uint8Array(5000).fill(7), html: '' }
vi.mock('@cloudflare/playwright', () => ({
  launch: async () => ({
    newPage: async () => ({
      setContent: async (h: string) => { shot.html = h },
      evaluate: async () => true,
      screenshot: async () => shot.bytes,
    }),
    close: async () => undefined,
  }),
}))

describe('카드 HTML', () => {
  it('대상마다 착지 주소가 AUDIENCE_LANDING 과 같다', () => {
    for (const a of SOCIAL_AUDIENCES) {
      expect(`https://${CARD_URL[a]}`.replace(/\/$/, '')).toBe(`https://urdeal.kr${AUDIENCE_LANDING[a]}`.replace(/\/$/, ''))
    }
  })
  it('초안 글자를 탈출한다(LLM 출력이 마크업이 되지 않는다)', () => {
    const html = buildCardHtml({ audience: 'store', title: '<script>x</script>', body: 'a & b <b>' })
    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;script&gt;x')
    expect(escHtml(`"'`)).toBe('&quot;&#39;')
  })
  it('대상 꼬리표·주소·유달이가 카드에 실린다', () => {
    const html = buildCardHtml({ audience: 'creator', title: '가게가 먼저 제안', body: '본문.' })
    expect(html).toContain(CARD_CHIP.creator)
    expect(html).toContain(CARD_URL.creator)
    expect(html).toContain(DEFAULT_CARD_ASSETS.mascot.creator)
    expect(html).toContain('width:1080px;height:1350px')
  })
  it('보조 문구는 본문 첫 문장 — 주소·해시태그·대본 표지를 뺀다', () => {
    expect(cardSubline('https://urdeal.kr\n[대본]\n(0~3초) x\n단말기 새로 사실 필요 없어요. 둘째 문장.')).toBe('단말기 새로 사실 필요 없어요.')
    expect([...cardSubline('가'.repeat(200))].length).toBeLessThanOrEqual(57)
  })
  it('제목 길이에 따라 글자가 작아진다(긴 제목도 카드 안에)', () => {
    expect(headlineSize('짧은 제목')).toBeGreaterThan(headlineSize('평일 오후 빈 테이블, 이용권 하나로 채우는 법 그리고 더 긴 말'))
    expect(cardHeadline('제목 #해시 ')).toBe('제목')
  })
  it('카드가 새 숫자·금액을 지어내지 않는다(화면 조각에 숫자 0)', () => {
    for (const a of SOCIAL_AUDIENCES) {
      const html = buildCardHtml({ audience: a, title: '제목', body: '본문.' })
      const visible = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ')
      expect(visible).not.toMatch(/\d+\s*(%|원|딜)/)
    }
  })
})

/** webp 높이(VP8 · VP8L · VP8X) — 의존성 없이 머리만 읽는다. */
function webpHeight(file: string): number {
  const b = readFileSync(file)
  const kind = b.toString('ascii', 12, 16)
  if (kind === 'VP8X') return 1 + b.readUIntLE(27, 3)
  if (kind === 'VP8L') return 1 + (((b[22] | (b[23] << 8) | (b[24] << 16)) >> 6) & 0x3fff)
  return b.readUInt16LE(28) & 0x3fff
}

describe('품질 규율', () => {
  it('유달이를 원본보다 크게 그리지 않는다(키우면 털이 뭉개진다 — 1차 카드는 238px 를 360px 로 키웠다)', () => {
    for (const a of SOCIAL_AUDIENCES) {
      const h = webpHeight(`public/assets/mascot/${DEFAULT_CARD_ASSETS.mascot[a].split('/').pop()}`)
      expect(h, `${a} 원본 높이`).toBeGreaterThan(400)
      expect(MASCOT_DRAW_H, `${a}: 그리는 높이 ${MASCOT_DRAW_H} > 원본 ${h}`).toBeLessThanOrEqual(h)
    }
  })
  it('템플릿 장식을 쓰지 않는다(기울인 조각 · 강조 막대 · 굵기 800 제목)', () => {
    const html = buildCardHtml({ audience: 'store', title: '제목', body: '본문.' })
    expect(html).not.toMatch(/rotate\(/)
    expect(html).not.toMatch(/class="bar"/)
    expect(html).toMatch(/h1\{[^}]*font-weight:700/)
  })
  it('한글 제목은 단어 단위로 줄을 바꾼다(글자 중간에서 끊기지 않는다)', () => {
    const html = buildCardHtml({ audience: 'creator', title: '제목', body: '본문.' })
    expect(html).toMatch(/h1\{[^}]*word-break:keep-all/)
  })
})

describe('유달이 그림', () => {
  it('카드가 쓰는 그림은 공개 경로에 실재하고 장부에 있다', () => {
    const ledger = readFileSync('docs/design/urdeal-mascot-otter-2026-10.md', 'utf8')
    for (const a of SOCIAL_AUDIENCES) {
      const name = DEFAULT_CARD_ASSETS.mascot[a].split('/').pop()!
      expect(existsSync(`public/assets/mascot/${name}`)).toBe(true)
      expect(ledger).toContain(`\`${name}\``)
    }
  })
})

describe('렌더 → R2 → 초안', () => {
  beforeEach(() => { store.post = null; store.updated = null })
  const bucket = { puts: [] as string[], put: async function (k: string) { this.puts.push(k) } }
  const env = (extra: Record<string, unknown> = {}) => ({ DB: {}, BROWSER: {}, MEDIA_BUCKET: bucket, ...extra }) as never

  it('바인딩이 없으면 이유를 말하고 아무것도 쓰지 않는다', async () => {
    const { attachCardImage } = await import('@/features/social-media/api/social-image-render')
    store.post = { id: 1, status: 'draft', audience: 'store', title: 't', body: 'b' }
    const r = await attachCardImage({ DB: {}, MEDIA_BUCKET: bucket } as never, 1)
    expect(r).toEqual({ ok: false, error: expect.stringContaining('BROWSER') })
    expect(store.updated).toBeNull()
  })
  it('발행된 게시물은 건드리지 않는다', async () => {
    const { attachCardImage } = await import('@/features/social-media/api/social-image-render')
    store.post = { id: 1, status: 'published', audience: 'store', title: 't', body: 'b' }
    const r = await attachCardImage(env(), 1)
    expect(r.ok).toBe(false)
    expect(store.updated).toBeNull()
  })
  it('찍은 JPEG 를 social/ 키로 올리고 공개 주소를 media_url 에 붙인다', async () => {
    const { attachCardImage } = await import('@/features/social-media/api/social-image-render')
    store.post = { id: 7, status: 'draft', audience: 'creator', title: '가게가 먼저 제안', body: '본문.' }
    const r = await attachCardImage(env(), 7)
    expect(r.ok).toBe(true)
    const key = bucket.puts.at(-1)!
    expect(key).toMatch(/^social\/card-7-\d+\.jpg$/)
    expect(store.updated).toEqual({ media_url: `https://media.ur-team.com/${key}`, media_kind: 'image' })
    expect(shot.html).toContain('가게가 먼저 제안')
  })
  it('빈 렌더는 실패로 본다(빈 그림을 붙이지 않는다)', async () => {
    const { attachCardImage } = await import('@/features/social-media/api/social-image-render')
    store.post = { id: 8, status: 'draft', audience: 'store', title: 't', body: 'b' }
    const keep = shot.bytes; shot.bytes = new Uint8Array(10)
    const r = await attachCardImage(env(), 8)
    shot.bytes = keep
    expect(r.ok).toBe(false)
    expect(store.updated).toBeNull()
  })
})

describe('배선', () => {
  it('ur-ads 설정이 BROWSER·MEDIA_BUCKET 을 선언한다(대시보드만 있으면 다음 배포가 지운다)', () => {
    const toml = readFileSync('wrangler-ads.toml', 'utf8').replace(/^\s*#.*$/gm, '')
    expect(toml).toMatch(/\[browser\]\s*\nbinding = "BROWSER"/)
    expect(toml).toMatch(/\[\[r2_buckets\]\]\s*\nbinding = "MEDIA_BUCKET"\s*\nbucket_name = "ur-live-media"/)
  })
  it('wrangler 가 번들을 다시 묶지 않는다(다시 묶으면 node:fs 가 unenv 껍데기가 되어 렌더가 죽는다 — 라이브 첫 실행)', () => {
    const toml = readFileSync('wrangler-ads.toml', 'utf8').replace(/^\s*#.*$/gm, '')
    expect(toml).toMatch(/^no_bundle = true$/m)
    const date = /^compatibility_date = "(\d{4}-\d{2}-\d{2})"/m.exec(toml)?.[1] ?? ''
    expect(date >= '2025-09-01', `compatibility_date ${date} 는 진짜 node:fs 이전`).toBe(true)
    expect(toml).toMatch(/compatibility_flags = \[[^\]]*"nodejs_compat"/)
  })
  it('매일 크론이 인스타 초안에 카드 이미지를 붙인다', () => {
    const cron = readCode('src/worker/cron/social-draft.ts')
    expect(cron).toMatch(/platform === 'instagram'[\s\S]{0,200}attachCardImage\(env, r\.id\)/)
  })
  it('어드민 라우트·버튼이 있다', () => {
    expect(readCode('src/features/social-media/api/social-media.routes.ts')).toContain("'/posts/:id/card-image'")
    expect(readCode('src/pages/AdminSocialPage.tsx')).toMatch(/<SocialCardImage post=\{post\}/)
  })
  it('R2 고아 정리는 social/ 접두를 보지 않는다(카드가 지워지지 않는다)', () => {
    expect(readCode('src/worker/cron/r2-orphan-cleanup.ts')).toContain("prefix: 'uploads/'")
  })
})
