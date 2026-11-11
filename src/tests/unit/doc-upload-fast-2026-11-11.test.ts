/**
 * ⚡ 문서 사진의 빠른 길 (2026-11-11 대표 신고 *"사진 올리는 속도 최적화 필요"* — 가게 등록 `/store/biz-cert`)
 *
 * 느렸던 이유: 2MB 미만은 원본을 그대로 올렸고, 2MB 이상은 압축 라이브러리를 그때 내려받았다.
 * 지키는 것:
 *   ① `compressForDocument` 가 빠른 길을 **먼저** 타고, 실패하면 종전 길로 물러난다(빠른 길이 등록을 막으면 안 된다)
 *   ② 가독성 하한 — 긴 변 2000px 이상 · 품질 0.75 이상(2026-09-15 "글자가 뭉개지면 심사 불가")
 *   ③ 빠른 길은 라이브러리를 부르지 않는다(내려받는 것 0 이 이 수리의 절반이다)
 *   ④ 화면이 진행률을 보여 준다
 * 못 보는 것: 실제 폰에서의 인코딩 시간·결과 크기(브라우저에서 재야 한다 — 인계에 실측), 사람이 읽기 좋은지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fitWithin, encodeDocumentFast, DOCUMENT_FAST_MAX_SIDE, DOCUMENT_FAST_QUALITY, DOCUMENT_FAST_SKIP_BYTES } from '../../lib/image-compress'

const SRC = readFileSync('src/lib/image-compress.ts', 'utf8')
const PAGE = readFileSync('src/pages/store-new/StoreBizCertPage.tsx', 'utf8')

describe('문서 사진 빠른 길', () => {
  it('① compressForDocument 는 빠른 길을 먼저 타고 실패하면 종전 길로 물러난다', () => {
    const at = SRC.indexOf('export async function compressForDocument')
    const body = SRC.slice(at, SRC.indexOf('\n}', at))
    const fast = body.indexOf('encodeDocumentFast(file).catch(() => null)')
    const old = body.indexOf('compressForUpload(file,')
    expect(fast).toBeGreaterThan(0)
    expect(old).toBeGreaterThan(fast)
  })
  it('② 가독성 하한 — 긴 변 2000px 이상 · 품질 0.75 이상 · 건너뛰는 크기는 1MB 아래', () => {
    expect(DOCUMENT_FAST_MAX_SIDE).toBeGreaterThanOrEqual(2000)
    expect(DOCUMENT_FAST_QUALITY).toBeGreaterThanOrEqual(0.75)
    expect(DOCUMENT_FAST_SKIP_BYTES).toBeLessThan(1024 * 1024) // 2MB 로 되돌아가면 원본을 그대로 올리던 때로 돌아간다
  })
  it('② 크기 계산 — 긴 변을 맞추고 비율을 지키며 키우지 않는다', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ w: 2000, h: 1500 })
    expect(fitWithin(3000, 4000, 2000)).toEqual({ w: 1500, h: 2000 })
    expect(fitWithin(1200, 900, 2000)).toEqual({ w: 1200, h: 900 })
  })
  it('③ 빠른 길은 압축 라이브러리를 부르지 않는다', () => {
    const at = SRC.indexOf('export async function encodeDocumentFast')
    const body = SRC.slice(at)
    expect(body).not.toContain('loadImageCompression')
    expect(body).toContain("'image/webp'")
    expect(body).toContain("'image/jpeg'") // WebP 를 못 만드는 브라우저의 물러날 자리
  })
  it('③ 작은 파일·이미지가 아닌 파일·브라우저 기능이 없는 환경', async () => {
    const small = new File([new Uint8Array(2048)], 'a.jpg', { type: 'image/jpeg' })
    expect(await encodeDocumentFast(small)).toBe(small)
    expect(await encodeDocumentFast(new File([new Uint8Array(9)], 'a.pdf', { type: 'application/pdf' }))).toBeNull()
  })
  it('④ 화면이 올리는 중 진행률을 보여 준다', () => {
    expect(PAGE).toContain('onUploadProgress')
    expect(PAGE).toMatch(/사진을 올리는 중이에요\$\{pct > 0/)
  })
})
