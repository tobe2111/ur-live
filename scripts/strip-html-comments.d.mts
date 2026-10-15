/** 타입 선언 — 구현·근거는 strip-html-comments.mjs. */
export function inlineBlocks(html: string): string[]
export const COUNTED_TAGS: readonly string[]
/** 주석을 떼고 무손실인지 확인한다. 어긋나면 던진다(빌드가 멈춘다). */
export function stripHtmlComments(html: string): string
export function stripHtmlCommentsPlugin(): {
  name: string
  transformIndexHtml: { order: 'post'; handler: (html: string) => string }
}
