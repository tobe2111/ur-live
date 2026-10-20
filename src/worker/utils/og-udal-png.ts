/**
 * 🦦 공유 카드용 유달이(서 있는 포즈) — 168×246 PNG(256색) (2026-10-09).
 *
 * 왜 data URI 인가: 카드(SVG)는 카카오 스크래퍼가 굽는데 **바깥 그림을 가져오지 않는다**
 *   (`og-inline-image.ts` 머리말의 실측). 사진은 리사이저를 거쳐 JPEG 로 인라인하지만,
 *   유달이는 **투명 배경**이 있어야 사진 위에 올라간다 — JPEG 경로를 못 탄다.
 *
 * 📦 2026-10-11 워커 다이어트: 이 그림을 base64 로 **코드에 박아 두고 있었는데**(18KB, 압축이 안 된다)
 *   워커 번들이 Cloudflare 무료 압축 한도(1MB) 게이트를 넘어 **배포가 전부 막혔다.** 그림은 정적 파일
 *   (`public/static/og/udal-share-168.png`)로 옮기고, 카드를 그릴 때 ASSETS 에서 한 번 읽어 data URI 로
 *   만든다(isolate 당 1회 메모). 카드 모양은 byte-동일 — 판 번호를 올리지 않는다.
 *   읽기에 실패하면 null → 유달이 없는 카드(사진·로고는 그대로). 카드를 못 그리는 것보다 낫다.
 * 원본: `src/assets/mascot/udal-pose-stand.webp`. 그림을 바꾸면 정적 파일을 다시 만들고
 *   `shared/pass-share-card.ts` 의 카드 판 번호(`PASS_OG_VERSION`)를 올릴 것.
 */
export const UDAL_OG_PNG_W = 168
export const UDAL_OG_PNG_H = 246
export const UDAL_OG_PNG_PATH = '/static/og/udal-share-168.png'

type AssetFetcher = { fetch?: (r: Request) => Promise<Response> } | undefined

let memo: string | null = null

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** 카드에 박을 유달이 data URI. 못 읽으면 null(카드는 유달이 없이 그린다). */
export async function loadUdalOgPng(assets: AssetFetcher, origin: string): Promise<string | null> {
  if (memo) return memo
  try {
    const res = await assets?.fetch?.(new Request(new URL(UDAL_OG_PNG_PATH, origin).toString()))
    if (!res || !res.ok) return null
    const buf = await res.arrayBuffer()
    const sig = new Uint8Array(buf, 0, 4)
    if (buf.byteLength < 100 || sig[0] !== 0x89 || sig[1] !== 0x50) return null // PNG 가 아니면(SPA 폴백 HTML 등) 쓰지 않는다
    memo = 'data:image/png;base64,' + toBase64(buf)
    return memo
  } catch {
    return null
  }
}
