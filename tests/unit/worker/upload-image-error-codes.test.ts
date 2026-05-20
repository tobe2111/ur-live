/**
 * Unit Tests — upload-image 에러 분류 → HTTP status 매핑.
 *
 * 2026-05-20: 사용자 신고 "500 만 반환" 사고 후 영구 분류 도입.
 *   400  INVALID_MULTIPART_BODY  — formdata / multipart / boundary
 *   413  PAYLOAD_TOO_LARGE       — arraybuffer / memory / too large / size
 *   503  IMGBB_UPSTREAM_ERROR    — imgbb
 *   504  UPLOAD_TIMEOUT          — timeout / abort
 *   500  UPLOAD_UNKNOWN_ERROR    — 그 외
 */

import { describe, it, expect } from 'vitest'

// 핸들러 내부 분류 로직을 재현 (실제 라우트는 Worker 환경 필요 → unit 으로 추출 검증).
function classifyUploadError(msg: string): {
  statusCode: 400 | 413 | 500 | 503 | 504
  errorCode: string
} {
  const lc = msg.toLowerCase()
  if (lc.includes('imgbb')) return { statusCode: 503, errorCode: 'IMGBB_UPSTREAM_ERROR' }
  if (lc.includes('formdata') || lc.includes('multipart') || lc.includes('boundary')) {
    return { statusCode: 400, errorCode: 'INVALID_MULTIPART_BODY' }
  }
  if (lc.includes('timeout') || lc.includes('timed out') || lc.includes('abort')) {
    return { statusCode: 504, errorCode: 'UPLOAD_TIMEOUT' }
  }
  if (lc.includes('arraybuffer') || lc.includes('memory') || lc.includes('too large') || lc.includes('size')) {
    return { statusCode: 413, errorCode: 'PAYLOAD_TOO_LARGE' }
  }
  return { statusCode: 500, errorCode: 'UPLOAD_UNKNOWN_ERROR' }
}

describe('upload-image error classification', () => {
  it('multipart parse 실패 → 400 / INVALID_MULTIPART_BODY', () => {
    expect(classifyUploadError('FormData parse failed')).toEqual({ statusCode: 400, errorCode: 'INVALID_MULTIPART_BODY' })
    expect(classifyUploadError('Invalid multipart body')).toEqual({ statusCode: 400, errorCode: 'INVALID_MULTIPART_BODY' })
    expect(classifyUploadError('boundary not found')).toEqual({ statusCode: 400, errorCode: 'INVALID_MULTIPART_BODY' })
  })

  it('imgbb 에러 → 503 / IMGBB_UPSTREAM_ERROR', () => {
    expect(classifyUploadError('imgbb HTTP 503: Service Unavailable')).toEqual({ statusCode: 503, errorCode: 'IMGBB_UPSTREAM_ERROR' })
    expect(classifyUploadError('imgbb non-JSON response')).toEqual({ statusCode: 503, errorCode: 'IMGBB_UPSTREAM_ERROR' })
  })

  it('timeout/abort → 504 / UPLOAD_TIMEOUT', () => {
    expect(classifyUploadError('The operation timed out after 30s')).toEqual({ statusCode: 504, errorCode: 'UPLOAD_TIMEOUT' })
    expect(classifyUploadError('AbortError: signal aborted')).toEqual({ statusCode: 504, errorCode: 'UPLOAD_TIMEOUT' })
  })

  it('메모리/크기 에러 → 413 / PAYLOAD_TOO_LARGE', () => {
    expect(classifyUploadError('arraybuffer allocation failed')).toEqual({ statusCode: 413, errorCode: 'PAYLOAD_TOO_LARGE' })
    expect(classifyUploadError('Out of memory')).toEqual({ statusCode: 413, errorCode: 'PAYLOAD_TOO_LARGE' })
    expect(classifyUploadError('Request body too large')).toEqual({ statusCode: 413, errorCode: 'PAYLOAD_TOO_LARGE' })
  })

  it('분류 불가 → 500 / UPLOAD_UNKNOWN_ERROR', () => {
    expect(classifyUploadError('Random unexpected error')).toEqual({ statusCode: 500, errorCode: 'UPLOAD_UNKNOWN_ERROR' })
    expect(classifyUploadError('TypeError: undefined is not a function')).toEqual({ statusCode: 500, errorCode: 'UPLOAD_UNKNOWN_ERROR' })
  })

  it('우선순위: imgbb 가 timeout 보다 먼저 매치', () => {
    // 'imgbb timeout' — imgbb 매치 (503)
    expect(classifyUploadError('imgbb request timed out')).toEqual({ statusCode: 503, errorCode: 'IMGBB_UPSTREAM_ERROR' })
  })

  it('case-insensitive — 대문자 입력도 매치', () => {
    expect(classifyUploadError('FORMDATA PARSE FAILED').statusCode).toBe(400)
    expect(classifyUploadError('IMGBB ERROR').statusCode).toBe(503)
  })
})
