import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * 🔴 도매 번들 cron no-op 게이트 — 정산 이중성숙 차단 (2026-07-29 대표 승인)
 *
 * 배경: 소비자(ur-live)와 도매(ur-wholesale)는 **같은 entry `src/worker/index.ts` 를 두 번 빌드**한다
 *   (`build-worker.js`, `WHOLESALE_BUNDLE` 은 라우트 포함 여부만 가름). 그래서 도매 번들도
 *   `handleCronScheduled` 를 그대로 싣고 있었고, 도매 Pages 에 cron trigger 가 걸리는 순간
 *   `matureSupplierSettlements`·예치금/출금 reconcile 이 **이중 실행 → 이중 지급**이었다.
 *   기존 방어는 "대시보드에서 설정 안 함" 뿐 — 레포가 지킬 수 없었다.
 *
 * ⚠️ 이 변경의 최대 위험은 도매가 아니라 **소비자 cron 이 조용히 죽는 것**이다. 그래서 극성이 핵심:
 *   `__INCLUDE_WHOLESALE__ === true` (도매 번들임이 확실할 때) **만** no-op 이고,
 *   define 미치환/undefined/문자열 등 애매한 값은 전부 **실제 핸들러로 폴백**한다(최악 = 현행 동작).
 *   아래 검사는 그 극성이 뒤집히거나 느슨해지면 빨강.
 *
 * 빌드 산출물 실측(2026-07-29, 이 커밋):
 *   - 소비자 번들: no-op 마커 0개 + **변경 전후 바이트 동일**(sha 94f18d01baa28588) → 회귀 0
 *   - 도매 번들:   no-op 마커 1개 + default export 가 `scheduled:<no-op>` 로 바인딩
 *   (빌드는 CI 가 별도로 돈다 — 여기선 소스 극성만 고정해 빠르게 잡는다)
 */
describe('도매 번들 cron no-op 게이트 — 이중성숙 차단', () => {
  const index = readFileSync(resolve(process.cwd(), 'src/worker/index.ts'), 'utf8')

  // default export 의 scheduled 바인딩 한 줄만 뽑는다.
  const line = (index.match(/^\s*scheduled:.*$/m) || [])[0] ?? ''

  it('scheduled 바인딩이 존재하고 단 하나다', () => {
    expect(line).not.toBe('')
    expect((index.match(/^\s*scheduled:/gm) || []).length).toBe(1)
  })

  it('게이트 극성 — `=== true` 일 때만 no-op (느슨한 truthiness 금지)', () => {
    // `__INCLUDE_WHOLESALE__ ? noop : real` 같은 느슨한 형태는 define 미치환 시 위험 → 금지.
    expect(line).toContain('__INCLUDE_WHOLESALE__ === true')
  })

  it('참 분기 = no-op / 거짓 분기 = 실제 핸들러 (뒤집히면 소비자 cron 사망)', () => {
    const m = line.match(/\?\s*([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)/)
    expect(m).not.toBeNull()
    const [, whenWholesale, whenConsumer] = m as RegExpMatchArray
    expect(whenWholesale).toBe('wholesaleCronNoop')   // 도매 → 아무것도 안 함
    expect(whenConsumer).toBe('handleCronScheduled')  // 소비자 → 실제 cron
  })

  // no-op 본체는 cron 진입점을 소유한 scheduled.ts 에 있다(index.ts 는 래칫상 성장 불가).
  const scheduled = readFileSync(resolve(process.cwd(), 'src/worker/scheduled.ts'), 'utf8')
  const noopBody = (scheduled.match(/async function wholesaleCronNoop[\s\S]{0,300}?\n\}/) || [])[0] ?? ''

  it('no-op 은 정산/예치금 로직을 부르지 않는다 (실행 주체만 가름, 로직 무접촉)', () => {
    expect(noopBody).not.toBe('')
    for (const f of ['matureSupplierSettlements', 'reconcile', 'payout']) {
      expect(noopBody.includes(f)).toBe(false)
    }
  })

  it('no-op 은 무음이 아니다 — 잘못된 cron 설정이 로그로 드러난다', () => {
    expect(scheduled).toContain('wholesale-cron-gate')
    expect(/async function wholesaleCronNoop[\s\S]{0,200}console\.error/.test(scheduled)).toBe(true)
  })
})
