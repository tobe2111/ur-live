/**
 * 📱 **없는 앱의 스토어 배지를 두지 않는다** — 2026-09-28 (대표 확정 *"아직 앱은 하나도 없어"*).
 *
 * ## 무엇이 있었나 (실측)
 * 세 화면이 각자 다른 방식으로 "앱이 있다"고 말하고 있었다:
 *
 * | 화면 | 링크 | 실제 동작 |
 * |---|---|---|
 * | `IntroducePage` 배지 4곳 | `apps.apple.com/…/id6745051422` · `play.google.com/…?id=com.urdeal.app` | **스토어 '앱을 찾을 수 없음'** |
 * | `PcHomeAppBand` | `href="#"` + "지금 바로 다운로드하기" | **눌러도 아무 일 없음** |
 * | `AppDownloadModal` | `urdeal.kr`(모바일 웹) | 동작은 함 — **말만 거짓** |
 *
 * 셋 다 **에러가 안 난다.** 그래서 아무도 신고하지 않았고, 2026-09-24 에 지어낸 실적 수치를
 * 지우면서도 바로 옆의 이 배지들은 살아남았다(그 세션이 `/about` 과 `/introduce` 를 헷갈린 것도 겹쳤다).
 *
 * ## 이 시험이 막는 것
 * 스토어 도메인 링크 · 스토어 배지 라벨 · "앱 다운로드" 류 문구가 소비자 표면에 **다시 생기는 것**.
 *
 * ## 이 시험이 **못 하는 것**
 * - "그 앱이 실제로 존재하는가"는 판정 못 한다. 네트워크를 안 본다 — **문자열 모양만** 본다.
 *   앱이 진짜 나오면 이 시험을 지우는 게 맞고, 그때 **스토어 URL 이 200 인지 먼저 확인**할 것
 *   (이번에 빠져 있던 단계가 정확히 그거다).
 * - 이미지·SVG 로 그린 배지는 못 잡는다(텍스트가 없으면 안 보인다).
 * - 여기 없는 파일은 안 본다 — 즉 `SURFACES` 목록이 곧 이 가드의 사정거리다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { stripComments } from '../helpers/source-text'

const SRC = resolve(__dirname, '../..')

/** 비로그인 방문자가 보는 소비자 표면 + 앱 배지가 실제로 있었던 자리. */
const SURFACES = [
  'pages/IntroducePage.tsx',
  'pages/AboutServicePage.tsx',
  'pages/AboutPage.tsx',
  'pages/pc-home/PcHomeAppBand.tsx',
  'components/main/AppDownloadModal.tsx',
  'components/main/DesktopTopNav.tsx',
]

const BANNED: Array<[RegExp, string]> = [
  [/apps\.apple\.com|itunes\.apple\.com/i, '애플 앱스토어 링크'],
  [/play\.google\.com/i, '구글 플레이 링크'],
  [/App\s*Store/i, '“App Store” 배지·문구'],
  [/Google\s*Play/i, '“Google Play” 배지·문구'],
  [/앱\s*다운로드|다운로드하기/, '“앱 다운로드” 문구'],
]

describe('없는 앱의 스토어 배지가 소비자 표면에 없다 (2026-09-28)', () => {
  const present = SURFACES.filter(f => existsSync(resolve(SRC, f)))

  it('검사 대상이 있다 — 0건이면 통과가 아니라 고장이다', () => {
    // 파일명이 바뀌면 이 시험이 조용히 아무것도 안 보게 된다(이 레포가 반복해 당한 클래스).
    expect(
      present.length,
      `표면 파일을 못 찾았다: ${SURFACES.filter(f => !present.includes(f)).join(', ')}`,
    ).toBe(SURFACES.length)
  })

  it.each(SURFACES.filter(f => existsSync(resolve(SRC, f))))('%s — 스토어 배지 0', (f) => {
    // 주석 속 설명("App Store 배지를 삭제했다")은 위반이 아니다 — 렌더되지 않는다.
    const code = stripComments(readFileSync(resolve(SRC, f), 'utf-8'))
    const hits = BANNED.filter(([re]) => re.test(code)).map(([, why]) => why)
    expect(hits, `${f} 에 남아 있다: ${hits.join(' · ')}`).toEqual([])
  })

  it('PC 홈 배너의 QR 은 lazy 여야 한다 — 정적 import 면 홈 첫 페인트가 codes 청크를 끌고 온다', () => {
    // 2026-07-13 에 `ConsumerFrameRails` 에서 정확히 이걸 고쳤다. 배지를 QR 로 바꾸며 되살리지 않는다.
    const band = readFileSync(resolve(SRC, 'pages/pc-home/PcHomeAppBand.tsx'), 'utf-8')
    expect(band).toMatch(/lazy\(\(\)\s*=>\s*import\('qrcode\.react'\)/)
    expect(stripComments(band)).not.toMatch(/^import\s+\{[^}]*QRCodeSVG[^}]*\}\s+from\s+'qrcode\.react'/m)
  })
})
