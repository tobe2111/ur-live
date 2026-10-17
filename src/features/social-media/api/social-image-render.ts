/**
 * 🖼️ 2026-10-17 소셜 카드 이미지 — 카드 HTML(`social-image-card.ts`)을 **실제 브라우저로 찍어** R2 에 올리고
 * 초안의 `media_url` 에 붙인다. 인스타는 이미지가 없으면 게시가 막히므로 인스타 초안의 필수 단계다.
 *
 * 렌더 엔진 = Cloudflare Browser Rendering(ur-ads 의 `BROWSER` 바인딩, `@cloudflare/playwright`). 무료 플랜은 하루 10분 ·
 * 동시 3개이고 넘으면 **과금이 아니라 실패**한다(공식 문서). 카드 한 장은 수 초라 하루 몇 장은 여유다.
 *
 * ⚠️ 실패해도 초안은 그대로 남는다(fail-soft) — 이미지만 비고, 어드민에서 [카드 이미지 만들기]로 다시 시도한다.
 *    바인딩이 없으면 이유를 돌려준다(조용한 성공으로 위장하지 않는다).
 */
import type { Env } from '../../../worker/types/env'
import { buildCardHtml, CARD_W, CARD_H } from './social-image-card'
import { isSocialAudience } from './social-audience'
import { getPost, updatePost } from './social-store'

type E = Record<string, unknown>

/** R2 공개 주소(업로드 응답과 같은 규칙 — PUBLIC_R2_URL, 없으면 미디어 도메인). */
export function mediaPublicBase(env: Env): string {
  const v = (env as unknown as E).PUBLIC_R2_URL
  return (typeof v === 'string' && /^https:\/\//.test(v) ? v : 'https://media.ur-team.com').replace(/\/+$/, '')
}

export function cardObjectKey(postId: number, now = Date.now()): string {
  return `social/card-${postId}-${now}.jpg`
}

/**
 * HTML → JPEG 바이트. 바인딩이 없으면 null.
 * 🧰 `@cloudflare/playwright` 를 쓴다 — `@cloudflare/puppeteer` 는 `@puppeteer/browsers → extract-zip`
 *    (high, 패치 없음)을 끌고 와 audit 게이트에 걸렸다. playwright 쪽은 의존성이 0 이다.
 */
export async function renderCardJpeg(env: Env, html: string): Promise<Uint8Array | null> {
  const binding = (env as unknown as E).BROWSER
  if (!binding) return null
  const { launch } = await import('@cloudflare/playwright')
  const browser = await launch(binding as Parameters<typeof launch>[0])
  try {
    const page = await browser.newPage({ viewport: { width: CARD_W, height: CARD_H }, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 20000 })
    // 글꼴이 다 올 때까지 — 안 기다리면 시스템 글꼴로 찍힌다(가장 흔한 품질 사고).
    await page.evaluate(() => document.fonts.ready.then(() => true))
    const buf = await page.screenshot({ type: 'jpeg', quality: 90 })
    return new Uint8Array(buf)
  } finally {
    await browser.close().catch(() => undefined)
  }
}

export type CardImageResult = { ok: true; url: string } | { ok: false; error: string }

/** 초안 하나에 카드 이미지를 만들어 붙인다. 발행된 게시물은 건드리지 않는다. */
export async function attachCardImage(env: Env, postId: number): Promise<CardImageResult> {
  const post = await getPost(env.DB, postId)
  if (!post) return { ok: false, error: '초안을 찾을 수 없습니다' }
  if (post.status === 'published') return { ok: false, error: '이미 발행된 게시물입니다' }
  const bucket = (env as unknown as E).MEDIA_BUCKET as R2Bucket | undefined
  if (!(env as unknown as E).BROWSER) return { ok: false, error: '이미지 렌더 바인딩(BROWSER)이 없습니다' }
  if (!bucket) return { ok: false, error: '미디어 저장소 바인딩(MEDIA_BUCKET)이 없습니다' }

  const audience = isSocialAudience(post.audience) ? post.audience : 'consumer'
  const html = buildCardHtml({ audience, title: post.title || '', body: post.body })
  let bytes: Uint8Array | null
  try {
    bytes = await renderCardJpeg(env, html)
  } catch (err) {
    return { ok: false, error: `렌더 실패: ${String((err as Error)?.message || err).slice(0, 160)}` }
  }
  if (!bytes || bytes.byteLength < 1000) return { ok: false, error: '렌더 결과가 비어 있습니다' }

  const key = cardObjectKey(postId)
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' },
  })
  const url = `${mediaPublicBase(env)}/${key}`
  await updatePost(env.DB, postId, { media_url: url, media_kind: 'image' })
  return { ok: true, url }
}
