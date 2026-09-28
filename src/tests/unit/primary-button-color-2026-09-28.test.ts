import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * 🔵 2026-09-28 — 소비자 **주 행동 버튼**의 색.
 *
 * ## 무엇이 문제였나 (실측)
 *
 * 2026-09-02 에 대표가 코레일톡 체계를 확정하며 주 버튼을 **잉크 #16181C → 브랜드 블루 #1C69EF**
 * 로 정했고(`docs/design/ticket-completion-reference-2026-09.md`), `.ur-btn-primary` 클래스까지
 * 만들면서 *"페이지는 뜻만 고른다"* 고 못 박았다. 그런데 2026-09-28 에 재 보니 소비자 화면
 * **224곳**이 여전히 `bg-gray-900 … text-white` 를 손으로 적고 있었다.
 *
 * 그래서 **똑같은 역할의 버튼이 화면마다 색이 달랐다** — "다시 시도"가 마이에선 파랑,
 * 숙소 목록에선 검정. 홈의 "교환권 보러가기"는 검정, 마이의 "이용권 사용처리"는 파랑.
 * 빌드는 초록이고 화면도 안 깨져서 **아무도 신고하지 않는다.** 대표가 두 번 지적한
 * *"디자인, ui 모두 별로야 · 대기업수준이 필요해"* 의 실체 중 하나가 이것이다.
 *
 * ## 이 시험이 못 보는 것
 *
 *   · **파랑이 맞는 자리인지**는 안 본다. 파괴적 행동(삭제·탈퇴)까지 파랑으로 칠하면 통과한다.
 *   · 변수로 조립한 클래스 · 인라인 `style` 로 같은 사고를 내는 것.
 *   · 실제 렌더 색은 안 잰다(이 환경은 브라우저 CONNECT 가 막혀 있다) — CI 의 contrast
 *     워크플로가 실제 렌더로 다시 잰다.
 */

const GUARD = 'scripts/check-primary-button-color.mjs'
const BASELINE = 'scripts/primary-button-baseline.json'

function runGuard(): number {
  try {
    execFileSync('node', [GUARD, '-s'], { stdio: 'pipe' })
    return 0
  } catch (e) {
    return (e as { status?: number }).status ?? 1
  }
}

describe('주 버튼은 브랜드 블루다 (검정 손색 차단)', () => {
  it('현재 코드는 통과한다 — 잠기지 않은 소비자 표면에 검정 주버튼 0건', () => {
    expect(runGuard()).toBe(0)
  })

  it('잠금표 잔여분은 **동결**돼 있다 — 늘 수 없다', () => {
    const b = JSON.parse(readFileSync(BASELINE, 'utf8'))
    const total = Object.values(b.files as Record<string, number>).reduce((a, n) => a + n, 0)
    // 0 이 되면 baseline 파일째 지우고 이 단언을 없앤다(그때 가드가 0 을 강제한다).
    expect(total).toBeGreaterThan(0)
    // ⚠️ 동결은 **래칫**이지 면제가 아니다. 값을 크게 잡으면 그 파일 안에서는 검정이 얼마든지
    //    늘어난다 — 실측 20건이라 상한을 25 로 둔다(늘리려면 왜 늘었는지부터 적을 것).
    expect(total).toBeLessThanOrEqual(25)
    for (const [f, n] of Object.entries(b.files as Record<string, number>)) {
      expect(n, `${f} 동결값이 과하다`).toBeLessThanOrEqual(10)
    }
    // 잠긴 파일에만 남아 있어야 한다 — 잠기지 않은 파일이 동결 목록에 끼면 그냥 봐주는 것이다.
    const LOCKED = [
      'BrowsePage', 'GroupBuyDetailPage', 'MyOrdersPage', 'MyVouchersPage',
      'PaymentSuccessPage', 'ProductDetailPage', 'VoucherDetailPage', 'VouchersPage',
    ]
    for (const f of Object.keys(b.files)) {
      expect(LOCKED.some((n) => f.includes(n))).toBe(true)
    }
  })

  it('가드가 실패할 수 있다 — 검정 주버튼을 심으면 빨간불', () => {
    // 합성 위반을 임시 파일이 아니라 **가드 자신의 판정 함수**로 확인할 수는 없으므로
    // (가드는 파일시스템을 훑는다), 여기서는 가드 소스가 판정에 필요한 세 조각을
    // 실제로 갖고 있는지 본다. 진짜 주입은 `scripts/mutations/primary-button-color.mjs` 가 한다.
    const src = readFileSync(GUARD, 'utf8')
    expect(src).toMatch(/BLACK_FILL\s*=\s*\//)
    expect(src).toMatch(/WHITE_TEXT\s*=\s*\//)
    expect(src).toMatch(/PRESSABLE\s*=\s*\//)
    // "측정 0 = 통과 아님" — 경로가 낡아 훑을 게 없어진 것을 초록으로 넘기지 않는다.
    expect(src).toMatch(/files\.length\s*<\s*200/)
  })

  it('브랜드 블루 쪽이 이제 다수다 — 이행이 실제로 됐는가', () => {
    // 이행 전: 검정 224 vs 블루 409. 이행 후 검정은 잠금표 20건만 남는다.
    const out = execFileSync('bash', ['-c',
      `grep -rn "bg-brand text-white\\|ur-btn-primary" src/pages src/components --include=*.tsx | wc -l`,
    ], { encoding: 'utf8' })
    expect(Number(out.trim())).toBeGreaterThan(400)
  })
})
