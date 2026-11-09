/**
 * 🔐 2026-11-09 — `/api/image/resize` 가 내보내도 되는 것은 **래스터 이미지뿐**이다.
 *
 * 원본 폴백이 상류 `Content-Type` 을 그대로 복사했는데, 허용 호스트에는 누구나 파일을 올리는
 * 곳(Firebase Storage 등)이 있어 비-이미지 문서가 우리 출처에서 열릴 수 있었다.
 * SVG 는 스크립트를 담을 수 있어 래스터가 아니다.
 */
const RASTER = /^image\/(?:jpeg|jpg|png|webp|gif|avif|bmp|x-icon|vnd\.microsoft\.icon)\b/i

export function isRasterImageType(type: string | null | undefined): boolean {
  return RASTER.test(type || '')
}

/** 프록시 응답 공통 헤더 — 브라우저가 형식을 추측하지 않고, 문서로 열려도 아무것도 실행하지 않게. */
export function hardenImageHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
}
