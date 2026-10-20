/**
 * ⚖️ **제휴 제안 문안의 법정 표기 불변식** — 2026-07-29.
 *
 *   배경(실측): 문안이 **두 벌**이었고 갈라져 있었다.
 *     · 엑셀 내보내기 → `outreach-template`(SSOT): `(광고)` 표기 · 수신거부 · 전송자 정보 전부 포함
 *     · 어드민 발송 화면 → `reach.ts` 폴백: **`(광고)` 없음 · 전송자 정보 없음**
 *   하필 **대표가 실제로 쓰는 경로가 화면**이라, 의무 표기가 빠진 쪽이 실사용 경로였다.
 *   레포는 이미 내보내기 쪽에 원칙을 적어 뒀다 — *"법적 문구는 발송 경로와 같은 SSOT 를 쓴다.
 *   따로 쓰면 법이 바뀔 때 한쪽만 고쳐진다."* 그 예언대로 갈라졌다.
 *
 *   ⚠️ 이 테스트가 **못 막는 것**: 이건 *표기*만 본다. 사전동의(정보통신망법 제50조)를 대체하지 않으며,
 *   발송 여부·범위는 대표 판단이다. 수집 이메일은 사전동의가 아니다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('제휴 제안 문안 — 의무 표기', () => {
  it('서버 SSOT 는 (광고)·수신거부·전송자 정보를 같은 헬퍼로 만든다', () => {
    const src = read('src/features/marketing/api/outreach-template.ts')
    expect(src).toMatch(/withAdLabel/)
    expect(src).toMatch(/withOptOut/)
    expect(src).toMatch(/withSenderInfo/)
  })

  it('엑셀 내보내기는 문안을 **자체 정의하지 않고** SSOT 를 import 한다', () => {
    const src = read('src/features/marketing/api/influencer-pool-export.ts')
    expect(src).toMatch(/from '\.\/outreach-template'/)
    // 자체 정의가 되살아나면(=두 벌) 갈라짐이 재발한다.
    expect(src).not.toMatch(/const mailBody\s*=/)
  })

  it('발송 화면 폴백 제목에도 (광고) 표기가 있다 — 서버 문안이 못 왔을 때의 안전망', () => {
    const src = read('src/pages/admin/influencer-pool/reach.ts')
    const m = /export function fallbackSubject[\s\S]{0,400}?\n\}/.exec(src)
    expect(m, 'fallbackSubject 를 못 찾았다 — 리팩토링됐다면 이 테스트도 갱신할 것').toBeTruthy()
    // ⚠️ **주석을 지우고 본다.** 첫 판을 일부러 깨뜨려 봤더니 통과했다 — 함수 안 설명 주석에도 '(광고)' 가
    //   있어서, 정작 반환 문자열에서 빠져도 초록이었다. 가드가 자기 주석에 속는 전형적인 헛돎이다.
    const code = m![0].replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).toMatch(/\(광고\)/)
  })

  it('발송 화면은 서버 SSOT 문안을 폴백보다 **우선**한다', () => {
    const src = read('src/pages/admin/influencer-pool/reach.ts')
    // 우선순위: AI 초안 > 서버 문안(mail_subject/mail_body) > 화면 폴백
    expect(src).toMatch(/lead\.mail_subject\s*\|\|\s*fallbackSubject/)
    expect(src).toMatch(/lead\.mail_body\s*\|\|\s*fallbackBody/)
  })

  it('발송 큐 API 가 문안을 동봉한다 — 안 실어 주면 화면이 조용히 폴백으로 돌아간다', () => {
    const src = read('src/features/marketing/api/admin-ads-influencers.routes.ts')
    // ⚠️ 첫 판은 `mail_subject: outreachSubject(` **호출 형태**를 봤다가, 바로 다음 커밋에서
    //   그 매핑을 SSOT 모듈로 옮기자 빨강이 났다(파일크기 래칫 때문). 지키려던 건 "큐 응답에 문안이
    //   실린다"는 *사실*이지 그것을 어느 파일에서 조립하느냐가 아니다 → 구현 위치가 아니라
    //   **SSOT 를 거쳐 응답에 실리는가**로 판정한다. 문안을 여기서 다시 손으로 쓰면 그건 아래에서 막는다.
    expect(src).toMatch(/from '\.\/outreach-template'/)
    expect(src).toMatch(/withOutreachTemplate\(/)
    // 라우트가 자체 문안을 재정의하면(=세 벌째) 다시 갈라진다.
    expect(src).not.toMatch(/유어딜 제휴 제안 드립니다/)
  })
})
