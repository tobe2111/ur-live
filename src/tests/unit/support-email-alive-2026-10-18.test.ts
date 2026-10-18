/**
 * 📮 2026-10-18 — 사이트가 고객에게 알려주는 문의 주소가 실제로 메일을 받는가.
 * support@ur-team.com · contact@ur-team.com 은 ur-team.com 메일 서버(aspmx.daum.net)에 없는 계정이라
 * 고객 문의가 전부 `550 5.1.1 No such user` 로 반송됐다. 우리 쪽엔 에러가 안 남아 아무도 몰랐다.
 * ⚠️ 이 시험이 못 보는 것: 새 주소가 실제로 받는지(메일 서버는 레포 밖) — 바꾸기 전에 직접 메일을 보내 볼 것.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { SUPPORT_EMAIL } from '@/shared/support-contact'

const DEAD = ['support@ur-team.com', 'contact@ur-team.com']

describe('고객 문의 주소', () => {
  it('반송되는 주소가 소스·번역에 다시 들어오지 않는다', () => {
    for (const addr of DEAD) {
      let hits = ''
      try {
        hits = execSync(`grep -rln --include=*.ts --include=*.tsx --include=*.json -F "${addr}" src public`, { encoding: 'utf8' })
      } catch { hits = '' } // grep: 0건이면 exit 1
      const files = hits.split('\n').filter(f => f && !f.includes('support-email-alive') && !f.includes('support-contact'))
      expect(files, `${addr} 는 없는 주소다 — SUPPORT_EMAIL 을 쓸 것`).toEqual([])
    }
  })
  it('SSOT 값은 메일 주소이고 죽은 주소가 아니다', () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(DEAD).not.toContain(SUPPORT_EMAIL)
  })
  it('6개 언어 문의 주소가 SSOT 와 같다', async () => {
    const fs = await import('node:fs')
    for (const l of ['ko', 'en', 'ja', 'zh', 'es', 'fr']) {
      const j = fs.readFileSync(`public/locales/${l}/translation.json`, 'utf8')
      expect(j).toContain(`"supportEmailValue": "${SUPPORT_EMAIL}"`)
    }
  })
})
