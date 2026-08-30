import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { resolveSectionMoreHref, isDeadEndHref } from '@/components/home/section-more-href'

/**
 * 🔗 홈 섹션 '더보기' 링크 — **실제 입력으로** 검증한다.
 *
 * ## 왜 문자열 검사가 아니라 동작 검사인가
 * 이 한 줄에서 같은 신고가 **세 번** 났다:
 *   · 2026-08-17 별칭(`/group-buy`)이라 홈이 리마운트되며 옛 프레임 플래시
 *   · 2026-08-19 쿼리 유실 — "쿼리를 다시 붙이자"고 고쳤는데 `safeInternalPath` **결과에서** 찾아
 *     붙일 게 없었다. **그 수정은 한 번도 동작한 적이 없다**(소스에는 고친 것처럼 보였다).
 *   · 2026-08-27 그 위에 "죽은 링크는 숨긴다"를 얹자, 납작해진 `/` 가 걸려 **버튼이 사라졌다**
 *     (대표 신고 "지금 인기 이용권의 더보기 클릭도 안되고")
 *
 * 세 번 다 "소스에 그 코드가 있는가"로는 통과했을 것이다. 그래서 **입력 → 출력**을 고정한다.
 *
 * ## 못 막는 것
 * 어드민이 DB 에 무엇을 넣었는지(그건 라이브 `/api/sections` 값)와, 목적지 화면이 그 쿼리를
 * 실제로 반영하는지(`useHomeQuerySync` 배선 — 그건 아래 두 번째 describe 가 본다).
 */
describe('섹션 더보기 링크 해석', () => {
  it('🔴 쿼리를 잃지 않는다 — safeInternalPath 가 통째로 버리는 것이 이 버그의 정체였다', () => {
    // 라이브 실제 값(2026-08-27 `/api/sections`): "지금 인기 이용권"
    expect(resolveSectionMoreHref('/?sort=popular')).toBe('/?sort=popular')
    expect(resolveSectionMoreHref('/?category=meal_voucher')).toBe('/?category=meal_voucher')
  })

  it('🔴 쿼리가 살아 있으면 죽은 링크가 아니다 (버튼이 사라지면 안 된다)', () => {
    expect(isDeadEndHref(resolveSectionMoreHref('/?sort=popular'))).toBe(false)
    // 맨 `/` 는 홈에서 홈 — 눌러도 정말 아무 일이 없으므로 숨긴다.
    expect(isDeadEndHref(resolveSectionMoreHref('/'))).toBe(true)
    expect(isDeadEndHref(resolveSectionMoreHref(null))).toBe(true)
    expect(isDeadEndHref(resolveSectionMoreHref(''))).toBe(true)
  })

  it('별칭은 정본으로 바꾼다 (안 하면 홈이 리마운트되며 옛 프레임이 번쩍)', () => {
    // `/group-buy` 는 App.tsx 에서 `<Navigate to="/">` 인 별칭이다.
    expect(resolveSectionMoreHref('/group-buy')).toBe('/')
    // 별칭 + 쿼리도 함께 살아야 한다(둘을 동시에 못 해서 08-19 에 틀렸다).
    expect(resolveSectionMoreHref('/group-buy?sort=popular')).toBe('/?sort=popular')
  })

  it('정상 내부 경로는 그대로 통과한다', () => {
    expect(resolveSectionMoreHref('/stays')).toBe('/stays')   // 라이브 실제 값: "주말에 떠나는 숙소"
    expect(resolveSectionMoreHref('/vouchers')).toBe('/vouchers')
  })

  it('🔴 외부 URL·인증 경로는 여전히 막는다 (쿼리를 살리려다 구멍을 내면 안 된다)', () => {
    expect(resolveSectionMoreHref('https://evil.example/x')).toBe('')
    expect(resolveSectionMoreHref('//evil.example/x')).toBe('')
    expect(resolveSectionMoreHref('/login?next=/admin')).toBe('')   // 자기참조 로그인 루프
    expect(resolveSectionMoreHref('/auth/callback')).toBe('')
    expect(resolveSectionMoreHref('javascript:alert(1)')).toBe('')
  })

  it('쿼리에 이상한 문자가 있으면 쿼리만 버리고 경로는 살린다', () => {
    expect(resolveSectionMoreHref('/vouchers?a=<script>')).toBe('/vouchers')
    expect(resolveSectionMoreHref('/vouchers?a="x"')).toBe('/vouchers')
  })
})

/**
 * 📱 목적지가 그 쿼리를 **실제로 반영**해야 링크가 의미를 갖는다.
 *
 * 2026-08-27 대표 신고의 나머지 절반: 홈으로 가는 쿼리 링크를 **PC 홈만** 읽고 있었다.
 * 폰에서는 같은 링크를 받고도 아무 일이 없었다 — 훅이 한쪽에만 배선돼 있었기 때문.
 */
describe('두 홈이 같은 쿼리 훅을 쓴다', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
  const code = (p: string) =>
    read(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

  it('🔴 PC·모바일 홈 둘 다 useHomeQuerySync 를 부른다', () => {
    for (const p of ['src/pages/pc-home/PcHomePage.tsx', 'src/pages/mobile-home/MobileHomePage.tsx']) {
      expect(code(p), p).toMatch(/useHomeQuerySync\(\{/)
    }
  })
})
