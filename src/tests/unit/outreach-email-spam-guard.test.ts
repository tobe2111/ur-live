/**
 * 📮 제안 이메일 스팸 방어 7겹 — 2026-08-22 대표 "계속 보내면 스팸 되지 않을까? 코딩으로 해결"
 *   의 코드 답. 이 테스트는 그 7겹이 **철거되면 빨간불**이 뜨게 각 겹을 소스에 앵커한다.
 *
 * ⚠️ 못 막는 것: 실제 발송·수신함 도착(Resend 대시보드/실메일 판정), SPF/DKIM/DMARC(DNS — 코드 밖).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const pipe = readFileSync('src/features/marketing/api/outreach-email.ts', 'utf8')
const invites = readFileSync('src/features/marketing/api/influencer-offer-invites.routes.ts', 'utf8')
const sched = readFileSync('src/worker/scheduled.ts', 'utf8')
const email = readFileSync('src/services/email.ts', 'utf8')

describe('스팸 방어 7겹', () => {
  it('①② 드립+일일캡 — cron 등재 · tick 소량 · platform_settings 캡(기본 30)', () => {
    expect(sched).toMatch(/safeCron\('outreach-email-drain'/)
    expect(pipe).toMatch(/PER_TICK = 10/)
    expect(pipe).toMatch(/outreach_daily_email_cap/)
    expect(pipe).toMatch(/DEFAULT_DAILY_CAP = 30/)
    // 캡 소진 시 발송 중단 — remaining 0 이면 return
    expect(pipe).toMatch(/if \(remaining <= 0\) return/)
  })

  it('③ 서프레션 3중 — opted_out · ad_email_suppress · email_suppressions 전부 적재 전 확인', () => {
    expect(pipe).toMatch(/opted_out\) === 1/)
    expect(pipe).toMatch(/FROM ad_email_suppress WHERE email = \?/)
    expect(pipe).toMatch(/FROM email_suppressions WHERE email = \?/)
    // sendEmail 최종 필터도 유지 — db 핸들(adsLeadsDb 라우터)을 넘긴다
    expect(pipe).toMatch(/env\.RESEND_FROM.*, db,/s)
  })

  it('④ 쿨다운 30일 — 같은 주소 재발송 차단', () => {
    expect(pipe).toMatch(/COOLDOWN_DAYS = 30/)
    expect(pipe).toMatch(/sent_at > datetime\('now', '-\$\{COOLDOWN_DAYS\} days'\)/)
  })

  it('⑤ 원클릭 수신거부 — RFC 8058 헤더 쌍 + 엔드포인트가 3중 서프레션을 등록', () => {
    expect(pipe).toContain("'List-Unsubscribe':")
    expect(pipe).toContain("'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'")
    // 엔드포인트: GET(사람) + POST(메일 클라이언트) 둘 다
    expect(invites).toMatch(/app\.get\('\/unsubscribe\/:token'/)
    expect(invites).toMatch(/app\.post\('\/unsubscribe\/:token'/)
    // 눌리면 리드 opted_out + 양쪽 억제 테이블 등록
    expect(invites).toMatch(/SET opted_out = 1/)
    expect(invites).toMatch(/INSERT OR IGNORE INTO ad_email_suppress/)
    expect(invites).toMatch(/INSERT OR IGNORE INTO email_suppressions/)
    // 발송기가 실제로 그 헤더를 Resend 에 전달할 수 있어야 한다 (email.ts headers 지원)
    expect(email).toMatch(/params\.headers \? \{ headers: params\.headers \}/)
  })

  it('⑥ 법 준수 — 제목 (광고) 표기 + 본문 발신자/수신거부 안내', () => {
    expect(pipe).toMatch(/`\(광고\) \[유어딜\]/)
    expect(pipe).toContain('수신거부')
    expect(pipe).toContain('발신: 유어딜')
  })

  it('⑦ 개인화 — 리드 이름/매장/이용권이 본문 치환에 들어간다', () => {
    expect(pipe).toMatch(/esc\(p\.leadName\)/)
    expect(pipe).toMatch(/esc\(p\.sellerName\)/)
  })

  it('이중발송 구조적 0 — CAS 선점(pending→sent)이 sendEmail 보다 앞', () => {
    const casIdx = pipe.indexOf("SET status = 'sent', sent_at = datetime('now') WHERE id = ? AND status = 'pending'")
    const sendIdx = pipe.indexOf('await sendEmail(')
    expect(casIdx).toBeGreaterThan(0)
    expect(sendIdx).toBeGreaterThan(0)
    expect(casIdx, '발송이 선점보다 앞 — cron 중복 tick 이 같은 메일을 두 번 보낸다').toBeLessThan(sendIdx)
    expect(pipe).toMatch(/if \(!claim\?\.meta\?\.changes\) continue/)
  })

  it('자동발송 게이트 기본 OFF — 셀러 접수가 어드민 검토 없이 나가려면 설정을 켜야 한다', () => {
    const seller = readFileSync('src/features/seller/api/seller-influencers.routes.ts', 'utf8')
    expect(seller).toMatch(/outreach_auto_send/)
    expect(seller).toMatch(/auto\?\.value === 'true'/)
  })
})
