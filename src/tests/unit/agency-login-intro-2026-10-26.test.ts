/**
 * 🏢 에이전시 로그인 소개 판 (2026-10-26 대표 *"페이지를 좀 꾸며야 하지 않을까?"*)
 *
 * 지키는 것:
 *  ① 로그인 화면이 소개 판을 싣는다.
 *  ② 소개 판이 **없는 돈 흐름**을 약속하지 않는다 — 에이전시 몫은 사장님이 정하고 매장이 직접 보낸다
 *     (`agency-share.ts`). "유어딜이 보내 드린다/송금" 류 문장은 지금 거짓이다.
 * ⚠️ 못 보는 것: 생김새 · 다른 표현으로 같은 거짓을 쓰는 경우.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

describe('에이전시 로그인 소개 판', () => {
  it('① 로그인 화면이 소개 판을 싣는다', () => {
    expect(readCode('src/pages/agency-console/AgencyLoginPage.tsx')).toMatch(/aside=\{<AgencyIntro \/>\}/)
  })
  it('② 유어딜이 에이전시 몫을 보낸다고 말하지 않는다', () => {
    const intro = readCode('src/pages/agency-console/AgencyIntro.tsx')
    expect(intro).not.toMatch(/송금|보내 드려|유어딜이 (직접 )?보내|정산해 드려/)
    expect(intro.length).toBeGreaterThan(800)
  })
})
