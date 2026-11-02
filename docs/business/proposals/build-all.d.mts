/** 타입 선언 — 구현·근거는 build-all.mjs. */
export const DECKS: string[]
export const CLAIMS: Array<{ id: string; decks: string[]; says: string; holds: (f: any) => boolean; setting: string }>
export function claimWarnings(facts: any): Array<{ id: string; decks: string[]; message: string }>
export function expectedSlides(pageSource: string): Record<string, number>
export function pdfPageCount(buf: Buffer): number
