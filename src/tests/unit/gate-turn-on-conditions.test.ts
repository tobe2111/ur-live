/**
 * 🚦 **모든 게이트에 "무엇이 확인되면 켜는가"가 있어야 한다** 〔2026-08-02 대표 확정 ⑤〕
 *
 * ## 왜 테스트로 박는가
 * *"점등 조건 없는 게이트는 영원히 안 켜진다."* 아무도 **"지금이 그때인가"** 를 판단할 수 없기 때문이다.
 * 실측(2026-08-02): 이 명부의 게이트 **13개가 전부 미설정**인 채로 있었다 — 코드는 다 나가 있는데
 * 켜진 게 하나도 없었다. 조건을 문서에만 적으면 **다음 게이트를 추가할 때 또 빠진다.**
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 조건이 **틀린 것**(문장의 옳고 그름은 사람이 판단)
 *   - 조건이 충족됐는데 **대표가 안 켜는 것**
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const src = readCode('src/features/admin/api/admin-system-monitoring.routes.ts')
const block = src.slice(src.indexOf('const OPS_GATES'), src.indexOf('adminSystemMonitoringRoutes.get(\'/ops-status\''))
const gates = [...block.matchAll(/\{ key: '([^']+)'[\s\S]*?\}/g)].map((m) => m[0])

describe('🚦 게이트 점등 조건', () => {
  it('명부가 비어 있지 않다 — 파싱이 깨지면 이 테스트가 통째로 무의미해진다', () => {
    expect(gates.length).toBeGreaterThanOrEqual(13)
  })

  it('🔴 모든 게이트가 turn_on_when 을 갖는다', () => {
    const missing = gates.filter((g) => !g.includes('turn_on_when'))
    expect(missing, `점등 조건 누락:\n${missing.join('\n')}`).toEqual([])
  })

  it('🔴 조건이 빈 문자열이 아니다 — 형식만 채우면 없는 것과 같다', () => {
    const empty = [...block.matchAll(/turn_on_when: '([^']*)'/g)].filter((m) => m[1].trim().length < 10)
    expect(empty.map((m) => m[0])).toEqual([])
  })

  it('어드민 화면이 실제로 그 조건을 렌더한다', () => {
    const ui = readCode('src/pages/admin-system-monitoring/OpsStatusTab.tsx')
    expect(ui).toContain('turn_on_when')
  })
})
