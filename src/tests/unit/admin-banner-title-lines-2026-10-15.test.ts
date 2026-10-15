/**
 * 어드민 배너 제목에서 줄 띄어쓰기를 직접 정한다 (2026-10-15 대표 *"어드민에서 배너의 글 작성할 때 줄 띄어쓰기도 설정할 수 있게"*).
 * 종전엔 한 줄 <input> 이라 Enter 를 칠 수 없었다 — 줄바꿈은 API 로만 넣을 수 있었다.
 */
import { describe, it, expect } from 'vitest'
import { clampTitleLines } from '@/shared/banner-title'
import { readCode } from '../helpers/source-text'

const PAGE = readCode('src/pages/AdminBannersPage.tsx')

describe('clampTitleLines — 배너는 두 줄까지', () => {
  it('한 줄·두 줄은 그대로', () => {
    expect(clampTitleLines('제주 맛집')).toBe('제주 맛집')
    expect(clampTitleLines('제주 맛집,\n여행 경비는 가볍게')).toBe('제주 맛집,\n여행 경비는 가볍게')
  })
  it('세 번째 줄부터는 두 번째 줄에 공백으로 이어 붙인다 (글자는 안 버린다)', () => {
    expect(clampTitleLines('가\n나\n다')).toBe('가\n나 다')
  })
  it('윈도우 줄바꿈(CRLF)도 한 번의 줄바꿈으로 센다', () => {
    expect(clampTitleLines('가\r\n나')).toBe('가\n나')
  })
})

describe('어드민 배너 폼', () => {
  it('제목 칸이 Enter 를 받는 textarea 다', () => {
    expect(PAGE).toMatch(/<textarea[^>]*value=\{formData\.title\}/)
    expect(PAGE).not.toMatch(/<input type="text" value=\{formData\.title\}/)
  })
  it('입력값이 두 줄 제한을 지난다', () => {
    expect(PAGE).toMatch(/title: clampTitleLines\(e\.target\.value\)/)
  })
  it('목록에서도 줄바꿈이 보인다', () => {
    expect(PAGE).toMatch(/<h3 className=\{`text-sm font-semibold whitespace-pre-line/)
  })
})
