/**
 * 🔖 검색 로봇이 받는 문서에도 파비콘 태그가 있다 (2026-10-31 대표 *"네이버 유어딜의 저 아이콘은 왜 없지?"*).
 *
 * 네이버 검색결과의 사이트 아이콘 자리가 **회색 지구본**이었다. 사람이 받는 `index.html` 엔 아이콘 태그가
 * 열 개 있는데, Yeti·Googlebot 은 워커가 손으로 쓴 **봇 셸**을 받고 거기엔 `<link rel="icon">` 이 0개였다
 * (라이브 실측). 네이버는 문서의 아이콘 태그로 사이트 아이콘을 고른다.
 * ⚠️ 못 보는 것: 네이버가 실제로 아이콘을 언제 바꾸는지(재수집 후 · 외부 판정).
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { readRaw } from '../helpers/source-text'

const shell = (() => {
  const src = readRaw('src/worker/index.ts')
  const at = src.indexOf('<meta name="naver-site-verification"')
  const end = src.indexOf('</head>', at)
  return at > 0 && end > at ? src.slice(at, end) : ''
})()

describe('봇 셸 파비콘', () => {
  it('봇 셸 <head> 를 찾는다 (0이면 통과가 아니라 실패)', () => {
    expect(shell.length).toBeGreaterThan(50)
  })
  it('rel="icon" 이 있고 가리키는 파일이 public/ 에 실재한다', () => {
    const hrefs = [...shell.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map(m => m[1])
    expect(hrefs).toContain('/favicon.ico')
    for (const h of hrefs) expect(existsSync(`public${h}`), h).toBe(true)
  })
})
