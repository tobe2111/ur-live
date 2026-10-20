/**
 * 🔍 어드민 OCR 패널이 "왜 못 읽었나" 를 보여 준다 — `OcrComparePanel.tsx` (2026-09-21).
 *
 * S-OCR 실측에서 셋 다 읽힘 0% 인데 화면은 빈 칸만 보여 줬다. 서버는 09-20 부터 `ocr.message/raw` 를 동봉하는데
 * 패널이 안 그리면 어드민은 "사진을 다시 받아야 하나 / 다시 누르면 되나" 를 알 수 없다.
 * 이 시험이 못 막는 것: 문구가 어색한 것 · 실제 렌더 여부(소스 검사).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const code = readCode('src/pages/admin/business-verification/OcrComparePanel.tsx')

describe('OcrComparePanel — 모델 이유·원문', () => {
  it('못 읽었을 때 모델 message 를 그린다', () => {
    expect(code).toMatch(/res\.ocr && !res\.ocr\.ok && <p[^>]*>· 모델 — \{res\.ocr\.message\}/)
  })
  it('원문은 접힌 details 안에만 (기본 화면을 어지럽히지 않는다)', () => {
    expect(code).toContain('<summary className="cursor-pointer">모델 원문 보기</summary>')
    expect(code).toMatch(/<details[^>]*>[\s\S]*\{res\.ocr\.raw\}/)
  })
})
