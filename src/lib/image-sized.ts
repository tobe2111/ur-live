/**
 * 🖼️ 2026-11-01 사진을 **브라우저에서 한 번** 세 크기로 줄여 R2 에 넣는다 — Cloudflare 변환을 아예 안 쓴다.
 *   주소 규칙·폭은 `shared/sized-image.ts` 가 SSOT 다.
 *
 * 흐름: 원본 → createImageBitmap → 폭 1280·640·320 로 줄여(반씩 줄이며 품질 유지) webp(안 되면 jpg) →
 *   `/api/upload/image-sized` 에 **한 크기씩** 보낸다(전역 본문 천장 1MB — 셋을 한 요청에 담으면 넘는다).
 *   첫 응답이 묶음 이름을 주고, 나머지 둘이 같은 자리에 들어간다. 셋 다 성공해야 주소를 돌려준다 —
 *   하나라도 실패하면 `null` 이고 호출부는 종전 업로드로 돌아간다(작은 크기가 빠진 주소가 저장되지 않게).
 *
 * ⚠️ GIF(움직임)·SVG 는 다루지 않는다(`null` → 종전 경로).
 */
import { SIZED_WIDTHS, type SizedExt } from '@/shared/sized-image'

type Bitmap = { width: number; height: number; close?: () => void }

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c
}

async function canvasToBlob(c: HTMLCanvasElement | OffscreenCanvas, type: string, q: number): Promise<Blob | null> {
  if ('convertToBlob' in c) return c.convertToBlob({ type, quality: q }).catch(() => null)
  return new Promise((res) => (c as HTMLCanvasElement).toBlob((b) => res(b), type, q))
}

/** 반씩 줄여 목표 폭까지 — 한 번에 4000→320 으로 줄이면 계단이 진다. */
function drawScaled(src: CanvasImageSource, sw: number, sh: number, tw: number): HTMLCanvasElement | OffscreenCanvas {
  let cur: CanvasImageSource = src; let cw = sw; let ch = sh
  while (cw / 2 >= tw) {
    const nw = Math.round(cw / 2); const nh = Math.round(ch / 2)
    const step = makeCanvas(nw, nh)
    const ctx = step.getContext('2d') as CanvasRenderingContext2D | null
    if (!ctx) break
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, nw, nh)
    cur = step as CanvasImageSource; cw = nw; ch = nh
  }
  const th = Math.max(1, Math.round((sh * tw) / sw))
  const out = makeCanvas(tw, th)
  const ctx = out.getContext('2d') as CanvasRenderingContext2D | null
  if (ctx) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(cur, 0, 0, tw, th) }
  return out
}

export interface SizedVariants { ext: SizedExt; files: Map<number, Blob> }

/** 세 크기를 만든다. 원본이 목표보다 작으면 원본 폭으로(키우지 않는다). 실패하면 null. */
export async function makeSizedVariants(file: Blob): Promise<SizedVariants | null> {
  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return null
  if (typeof createImageBitmap !== 'function') return null
  let bmp: Bitmap & CanvasImageSource
  try { bmp = (await createImageBitmap(file)) as Bitmap & CanvasImageSource } catch { return null }
  try {
    // 웹P 를 못 만드는 브라우저(받은 blob 이 png)는 셋 다 jpg 로 — 확장자는 한 벌이어야 한다.
    return (await makeAs(bmp, 'image/webp', 'webp', 0.82)) ?? (await makeAs(bmp, 'image/jpeg', 'jpg', 0.85))
  } finally { bmp.close?.() }
}

async function makeAs(bmp: Bitmap & CanvasImageSource, type: string, ext: SizedExt, q: number): Promise<SizedVariants | null> {
  const files = new Map<number, Blob>()
  for (const w of [...SIZED_WIDTHS].reverse()) {
    const b = await canvasToBlob(drawScaled(bmp, bmp.width, bmp.height, Math.min(w, bmp.width)), type, q)
    if (!b || b.type !== type || b.size < 100) return null
    files.set(w, b)
  }
  return { ext, files }
}

/** 업로드 함수(호출부가 인증 방식을 정한다 — fetch Bearer / axios 인스턴스). */
export type SizedPost = (fd: FormData) => Promise<{ success?: boolean; data?: { url?: string; batch?: string } } | null>

/** 세 크기를 올리고 저장 주소(가장 큰 크기)를 돌려준다. 하나라도 실패하면 null(호출부는 종전 업로드로). */
export async function uploadSizedImage(
  file: Blob, post: SizedPost, make: (f: Blob) => Promise<SizedVariants | null> = makeSizedVariants,
): Promise<string | null> {
  const v = await make(file).catch(() => null)
  if (!v) return null
  let batch = ''
  let url = ''
  for (const w of [...SIZED_WIDTHS].reverse()) {
    const blob = v.files.get(w)
    if (!blob) return null
    const fd = new FormData()
    fd.append('file', new File([blob], `w${w}.${v.ext}`, { type: blob.type }))
    fd.append('width', String(w))
    if (batch) fd.append('batch', batch)
    const r = await post(fd).catch(() => null)
    if (!r?.success || !r.data?.batch) return null
    if (!batch) { batch = r.data.batch; url = r.data.url || '' }
    else if (r.data.batch !== batch) return null
  }
  return url || null
}
