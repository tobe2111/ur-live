/**
 * 🏛 유어애즈 — **정체를 모르는 리드를 발송 대상으로 두지 않는다** (2026-08-08 대표 신고).
 *
 * ## 신고와 실제가 달랐다
 *
 * 대표: *"B2B에서 나라장터 담당자도 섞여있음. `jeejeehea@naver.com` 은 전라남도중소기업일자리경제진흥원임."*
 *
 * 라이브 실측(id 401793)은 이랬다:
 * ```
 * company_name : "[광주"     ← 회사명이 아니라 **파편**
 * source       : webkr       ← 나라장터가 아니라 웹 검색
 * lead_type    : partner     ← 그런데 발송 대상
 * ```
 * "[광주] …" 같은 공고 제목을 파싱하다 대괄호 앞부분만 남은 것이다. 그래서 어떤 기관 어휘 규칙
 * (`ORG_WORD_STRICT` 등)도 못 잡았다 — 잡을 이름 자체가 없다.
 *
 * ## 진짜 구멍
 *
 * `suspectCompanyName` 은 있었지만 **confidence 만 낮추고 `lead_type` 은 `partner` 로 뒀다.**
 * 게다가 `lead_type === 'unknown' ? 'partner' : …` 승격이 두 곳(저장·재분류)에 있어,
 * 분류기가 "모르겠다"고 해도 발송 대상이 됐다.
 *
 * **제안을 보낼 수 없는 리드는 발송 풀에 있으면 안 된다** — 그 수가 곧 이 DB 의 유일한 성공 지표다.
 *
 * ⚠️ **못 막는 것**: 이름이 멀쩡한데 실제로는 공공기관인 경우. 그건 기관 어휘 규칙(ORG_WORD*)의
 * 몫이고 이미 작동한다(실측: 제주개발공사·소상공인시장진흥공단 → v5 재분류에서 `org` 로 잡힘).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { suspectCompanyName, CLASSIFY_RULES_VERSION } from '../../features/marketing/api/company-classify'

const code = (p: string) =>
  readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')

describe('이름 파편 판정', () => {
  it('🔴 여는 괄호만 있고 닫는 괄호가 없으면 파편이다', () => {
    // 라이브 실측 2건 — 이 둘이 발송 풀에 있었다.
    expect(suspectCompanyName('[광주')).toBe(true)          // id 401793
    expect(suspectCompanyName('(주케이디알앤케이')).toBe(true)  // id 305893
  })

  it('닫는 괄호만 있어도 파편이다 (반대 방향 잘림)', () => {
    expect(suspectCompanyName('광주]')).toBe(true)
  })

  it('🟢 괄호가 짝을 이루는 정상 상호는 통과한다 — 과차단이면 실고객이 죽는다', () => {
    expect(suspectCompanyName('(주)케이디알앤케이')).toBe(false)
    expect(suspectCompanyName('스타벅스(강남점)')).toBe(false)
    expect(suspectCompanyName('간판공장직영 거성광고공사')).toBe(false)  // '공사'가 상호에 든 실제 광고업체
    expect(suspectCompanyName('영양농협가공사업소')).toBe(false)        // '가공사업소' — 우연히 '공사'
  })
})

describe('정체 불명 리드는 발송 대상(partner)이 되지 않는다', () => {
  it('🔴 저장 경로: suspect 이면 unknown→partner 승격을 막는다', () => {
    const save = code('src/features/marketing/api/company-save.ts')
    expect(save, '무조건 승격이 되살아났다')
      .not.toMatch(/_type:\s*c\.lead_type === 'unknown' \? 'partner' : c\.lead_type/)
    expect(save).toContain("c.lead_type === 'unknown' && !suspect ? 'partner'")
  })

  it('🔴 저장 경로: partner 로 분류돼도 이름이 파편이면 unknown 으로 내린다', () => {
    const save = code('src/features/marketing/api/company-save.ts')
    expect(save).toMatch(/suspect && c\.lead_type === 'partner' \? 'unknown'/)
  })

  it('🔴 재분류 경로도 같은 규칙을 쓴다 — 한쪽만 고치면 다음 회차에 되돌아온다', () => {
    const disc = code('src/features/marketing/api/company-discovery.ts')
    expect(disc).toContain("c.lead_type === 'unknown' && !suspect ? 'partner'")
  })
})

describe('소급 적용', () => {
  it('🔴 규칙을 바꿨으면 CLASSIFY_RULES_VERSION 이 올라가 있다', () => {
    // 이 상수는 재검사 쿼리에 **시간 폴백이 없어** 안 올리면 옛 판정이 영구히 굳는다
    // (2026-07-27 에 "인천교통공사…특강" 류가 정확히 그렇게 영구 제외됐다).
    expect(CLASSIFY_RULES_VERSION).toBeGreaterThanOrEqual(6)
  })
})
