import { describe, it, expect } from 'vitest'
import { personalize, withOptOut, textToHtml, buildCampaignBody, welcomeEmail, CONSENTED_SEND_MAX } from '@/features/marketing/api/outreach-send'
import { OPT_OUT_LINE } from '@/features/marketing/api/influencer-outreach'

/**
 * 📨 2026-07-21 동의 리드 발송 헬퍼 잠금 — ⚖️ 수신거부 안내 코드 강제 + 개인화 치환.
 */
describe('withOptOut — 수신거부 안내 강제', () => {
  it('없으면 끝에 붙임', () => {
    expect(withOptOut('본문입니다')).toBe(`본문입니다\n\n${OPT_OUT_LINE}`)
  })
  it('이미 있으면 중복 안 붙임', () => {
    const body = `본문\n\n${OPT_OUT_LINE}`
    expect(withOptOut(body)).toBe(body)
  })
})

describe('personalize + buildCampaignBody', () => {
  it('{name}/{이름} 치환', () => {
    expect(personalize('안녕 {name}님, {이름}님 환영', '지원')).toBe('안녕 지원님, 지원님 환영')
  })
  it('캠페인 본문 = 치환 + 수신거부 강제', () => {
    const out = buildCampaignBody('안녕 {name}님', '미식가')
    expect(out.startsWith('안녕 미식가님')).toBe(true)
    expect(out.includes(OPT_OUT_LINE)).toBe(true)
  })
})

describe('textToHtml — XSS 이스케이프', () => {
  it('태그 이스케이프 + 줄바꿈 보존(white-space:pre-wrap)', () => {
    const h = textToHtml('<script>x</script>\n다음줄')
    expect(h).not.toContain('<script>')
    expect(h).toContain('&lt;script&gt;')
    expect(h).toContain('pre-wrap')
  })
})

describe('welcomeEmail — 인바운드 접수확인', () => {
  it('이름 포함 + 수신거부 안내 포함', () => {
    const w = welcomeEmail('방배미식가')
    expect(w.subject).toContain('방배미식가')
    expect(w.body).toContain(OPT_OUT_LINE)
  })
})

it('발송 회당 상한 50 (워커 subrequest 여유)', () => {
  expect(CONSENTED_SEND_MAX).toBe(50)
})
