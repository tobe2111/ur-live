/**
 * 🔴 **신규 몰 경로에 예치금이 없다** 〔세션 ③-c, 철거 선행조건〕
 *
 * 운영자 몰은 **소비자 카드결제 레일**(`orders` + Toss)이다. 도매몰의 **예치금(선불충전)** 과
 * 완전히 다른 돈 흐름이고, 그 차이가 이 서비스의 **법적 위치**를 가른다.
 *
 * ## 왜 테스트로 고정하는가
 * 예치금은 **전자금융거래법 해당 여부가 미해결**(체크리스트 X4a — 법무 1순위)이다.
 * 신규 몰 경로가 예치금을 한 줄이라도 참조하기 시작하면:
 * - 미해결 법적 리스크가 **새 서비스로 번진다**
 * - 예치금 **동결·철거**(X2 대기 중)가 신규 몰을 깨뜨리게 된다 — 지금은 안 깨진다
 *
 * 그리고 이건 **어기기 쉽다**. 도매 코드가 옆에 있고, "잔액에서 차감" 은 자연스러운 재사용처럼 보인다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 런타임 호출(문자열이 아니라 동적 접근으로 부르는 경우)
 *   - 몰 화면이 **도매 API 를 호출**하는 것(그건 `check-dashboard-api-crossrole` 몫)
 *   - 목록에 없는 **새 몰 파일**이 생기는 것 → 아래 SURFACE 에 함께 추가할 것
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync, statSync } from 'fs'
import { resolve } from 'path'
import { readCode } from '../helpers/source-text'

/** 운영자 몰 표면 — 파일·디렉터리 모두 허용. **새 몰 파일을 만들면 여기 추가한다.** */
const SURFACE = [
  'src/shared/mall',
  'src/features/mall',
  'src/worker/utils/mall-consumer.ts',
  'src/worker/utils/mall-ssr-meta.ts',
  'src/pages/MallHomePage.tsx',
  'src/pages/SellerQuickGbPage.tsx',
]

/** 예치금 레일의 신호. 값이 아니라 **개념**을 막는다. */
const DEPOSIT_SIGNALS = [
  /\bdeposit\b/i,
  /예치금/,
  /선불충전/,
  /wholesale_deposit/,
  /charge_request/i,
]

function walk(rel: string): string[] {
  const abs = resolve(process.cwd(), rel)
  if (!existsSync(abs)) return []
  if (statSync(abs).isFile()) return [rel]
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${rel}/${e.name}`) : (/\.tsx?$/.test(e.name) ? [`${rel}/${e.name}`] : []),
  )
}

describe('🔴 운영자 몰 경로는 예치금을 모른다', () => {
  const files = SURFACE.flatMap(walk)

  it('스캔이 헛돌지 않는다 — 대상 0건은 통과가 아니라 실패', () => {
    // 가드 레지스트리 교훈: "측정 대상 0건이면 통과가 아니라 실패".
    // 파일이 리네임·이동되면 여기서 먼저 걸려 SURFACE 를 갱신하게 만든다.
    expect(files.length, 'SURFACE 경로가 낡았다 — 몰 파일이 이동·리네임됐는지 확인').toBeGreaterThanOrEqual(6)
  })

  it('예치금 신호가 한 건도 없다', () => {
    const hits: string[] = []
    for (const f of files) {
      const code = readCode(f)   // 주석 제외 — 설명에 "예치금 안 씀"이라고 적는 건 위반이 아니다
      for (const re of DEPOSIT_SIGNALS) {
        if (re.test(code)) { hits.push(`${f} ← ${re}`); break }
      }
    }
    expect(hits, '신규 몰 경로에 예치금 참조 — 미해결 법적 리스크(X4a)가 번진다').toEqual([])
  })

  it('철거해도 안 깨진다는 뜻이다 — 이 테스트가 그 근거다', () => {
    // 예치금 동결/철거(X2 대기)가 신규 몰을 깨뜨리지 않음을 **코드로** 보장한다.
    // 값 검증이 아니라 **선언**이므로, 위 두 케이스가 초록인 것이 곧 이 문장의 증거다.
    expect(files.every((f) => !/deposit/i.test(readCode(f)))).toBe(true)
  })
})
