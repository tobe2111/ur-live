/**
 * 📧 서버 HTML 의 이메일을 Cloudflare 가리기에서 뺀다 (2026-11-11 대표 *"이메일도 고쳐줘"*)
 *
 * 존 설정 `email_obfuscation: on` 이 `/faq` 서버 첫 화면의 이메일을 `[email protected]` 로 바꾸고,
 * 그 풀이 스크립트는 우리 CSP 가 막아 앱이 켜지기 전 화면 · 크롤러에서 영영 가려져 있었다.
 * 지키는 것: ① 헬퍼가 이메일이 든 조각만 감싼다 ② `/faq` 서버 첫 화면의 이메일 칸이 감싸여 나간다.
 * 못 보는 것: Cloudflare 가 실제로 그 표시를 존중하는지(배포 뒤 `/faq` 에 `__cf_email__` 가 0 인지 실측) · 앞으로 다른 서버 화면에 새 이메일이 생기는 경우.
 */
import { describe, it, expect } from 'vitest'
import { emailOff, EMAIL_OFF_OPEN, EMAIL_OFF_CLOSE } from '../../worker/utils/email-off'
import { buildFaqFirstScreen } from '../../worker/utils/faq-first-screen'
import { FAQ_COPY } from '@/shared/faq-page'

describe('이메일 가리기 제외', () => {
  it('① 이메일이 든 조각만 감싼다', () => {
    expect(emailOff('a@b.com')).toBe(`${EMAIL_OFF_OPEN}a@b.com${EMAIL_OFF_CLOSE}`)
    expect(emailOff('평일 10:00 – 18:00')).toBe('평일 10:00 – 18:00')
    expect(EMAIL_OFF_OPEN).toBe('<!--email_off-->') // Cloudflare 가 정한 표기 그대로
    expect(EMAIL_OFF_CLOSE).toBe('<!--/email_off-->')
  })
  it('② /faq 서버 첫 화면의 이메일 칸이 감싸여 나간다', () => {
    const html = buildFaqFirstScreen('<div></div>')
    const v = FAQ_COPY.supportEmailValue
    expect(v).toContain('@')
    expect(html).toContain(`${EMAIL_OFF_OPEN}${v}${EMAIL_OFF_CLOSE}`)
    // 감싸지 않은 채로 한 번 더 나오지 않는다(가려지는 사본이 남으면 소용없다)
    expect(html.split(v).length - 1).toBe(1)
  })
})

/**
 * ☁️ CloudFront 시험 표시 (같은 날 · 결재 `2026-11-10-cloudfront-trial-edge` 대표 *"1번으로 하고"*)
 * AWS 를 거쳐 온 요청은 콜로 앞에 A 를 붙여 실사용 측정이 시험 주소를 따로 모으게 한다.
 */
import { edgeColoLabel, appendEdgeHeaders } from '../../worker/utils/css-first-boot'
import { readFileSync } from 'node:fs'

describe('CloudFront 경유 표시', () => {
  it('Via 에 CloudFront 가 있으면 A + 콜로, 없으면 콜로 그대로', () => {
    expect(edgeColoLabel('ICN', '1.1 abc.cloudfront.net (CloudFront)')).toBe('AICN')
    expect(edgeColoLabel('LAX', null)).toBe('LAX')
    expect(edgeColoLabel('LAX', '1.1 varnish')).toBe('LAX')
    expect(edgeColoLabel(undefined, '1.1 x.cloudfront.net (CloudFront)')).toBe('')
  })
  it('헤더에 실린다 · 측정 저장소가 4글자를 받는다', () => {
    const h = new Headers()
    appendEdgeHeaders(h, [], 'NRT', '1.1 x.cloudfront.net (CloudFront)')
    expect(h.get('Server-Timing')).toBe('colo;desc="ANRT"')
    expect(/^colo:([A-Z]{3,4})$/.test('colo:ANRT')).toBe(true)
    expect(readFileSync('src/worker/routes/analytics.routes.ts', 'utf8')).toContain('const coloM = /^colo:([A-Z]{3,4})$/.exec(body.page')
  })
  it('워커가 요청의 Via 를 넘긴다', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toContain("cf?.colo, c.req.header('via'));")
  })
})
