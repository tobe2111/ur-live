/**
 * 🔑 **자격 저장 화면이 사람에게 말을 하는가** (2026-08-25 신설 — 실제 왕복 4회 후)
 *
 * ## 무엇이 있었나
 *
 * 대표가 Cloudflare API 토큰을 어드민에 넣으려는데 계속 안 들어갔다. 원인을 찾는 데 왕복이
 * 네 번 걸렸고, **셋 다 화면이 말을 안 해 준 것**이었다:
 *
 * | 증상 | 실제 원인 |
 * |---|---|
 * | 저장했는데 D1 값이 8월 2일 그대로 | 페이지의 **유일한 저장 버튼이 맨 위 헤더**에 있고 입력칸은 맨 아래 |
 * | `저장 실패` 만 뜸 | 서버가 400 + **어느 키가 왜 틀렸는지**를 주는데 화면이 통째로 버림 |
 * | 좁은 권한으로 만들어짐 | 화면 안내가 *"D1 = Read 하나면 됩니다"* — 그대로 하면 **주간 백업이 안 된다** |
 *
 * 마지막 것은 실제 피해가 있었다 — 주간 백업이 3주 연속 실패했고 그 토큰이 원인이었다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * 렌더 결과가 아니라 **소스에 그 배선이 있는가**까지만 본다(이 페이지는 어드민 전용이라
 * 렌더 테스트 하네스가 없다). 버튼이 실제로 눌리는지는 사람이 화면에서 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync('src/pages/AdminPlatformSettingsPage.tsx', 'utf8')
/**
 * 2026-08-25 — 자격 카드는 파일 크기 래칫 때문에 **별도 파일로 분리**됐다.
 *   판정 대상이 두 파일로 갈리므로 둘 다 읽는다(한쪽만 읽으면 시험이 조용히 헛돈다).
 */
const card = readFileSync('src/pages/admin-platform-settings/CloudflareCredsSection.tsx', 'utf8')

describe('🔑 어드민 자격 저장 — 화면이 이유를 말한다', () => {
  it('파일을 읽었다 (0바이트면 통과가 아니라 실패)', () => {
    expect(src.length).toBeGreaterThan(1000)
  })

  it('🔴 저장 실패 시 **서버가 준 사유**를 그대로 보여 준다', () => {
    // 서버는 400 + { error: "<키> — 저장이 취소되었습니다" } 를 준다. 버리면 원인 불명이 된다.
    expect(src, '서버 error 를 읽지 않는다').toMatch(/response\?\.data\?\.error/)
    expect(src, '읽어 놓고 화면에 안 쓴다').toMatch(/저장 실패 — \$\{detail\}/)
  })

  it('🔴 세션 만료와 네트워크 실패를 구분해서 말한다', () => {
    expect(src).toMatch(/401 \|\| status === 403/)
    expect(src).toContain('세션이 끊겼습니다')
    expect(src).toContain('네트워크')
  })

  it('🔴 자격 카드에 자체 저장 버튼이 있다 (헤더까지 스크롤하지 않게)', () => {
    expect(card.length, '자격 카드 파일을 못 읽었다 — 이 시험이 헛돈다').toBeGreaterThan(500)
    expect(card, '자격 카드를 못 찾았다 — 이 시험이 헛돈다').toContain('Cloudflare API 토큰')
    expect(card, '카드 안에 저장 버튼이 없다').toMatch(/onClick=\{onSave\}/)
    // 부모가 실제로 넘겨야 동작한다(prop 만 받고 안 넘기면 조용히 undefined).
    expect(src).toMatch(/<CloudflareCredsSection[^>]*onSave=\{save\}/)
  })

  it('🔴 권한 안내가 낡지 않았다 — D1 Read 만 시키면 주간 백업이 죽는다', () => {
    const hint = /key: 'cf_api_token'[\s\S]{0,600}?hint: '([^']*)'/.exec(card)?.[1] ?? ''
    expect(hint.length, '토큰 안내문을 못 찾았다').toBeGreaterThan(30)
    expect(hint, '아직 "D1 = Read 하나면 됩니다" 다 — 그 토큰으로는 export 가 안 된다')
      .not.toMatch(/D1\s*=\s*Read\s*하나/)
    expect(hint, 'export 에 필요한 Edit 을 안 알려 준다').toContain('Edit')
    expect(hint, '무기한 설정을 안 알려 준다').toContain('만료일')
  })
})
