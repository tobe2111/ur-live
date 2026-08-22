import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { YT_COLLECT_ENRICH_MAX } from '@/features/marketing/api/influencer-round-width'
import { NAVER_COLLECT_ENRICH_MAX } from '@/features/marketing/api/influencer-keyword-rotation'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const COLLECT = read('src/features/marketing/api/influencer-auto-collect.ts')
const DISCOVERY = read('src/features/marketing/api/influencer-discovery.ts')
const WIDTH = read('src/features/marketing/api/influencer-round-width.ts')

/**
 * 📺 **유튜브 수집 시점 보강 예산** (2026-08-22 대표 *"가장 이상적으로"*).
 *
 * ## 이 파일이 지키는 불변식 — 왜 이게 돈이 되는가
 * 회차 예산 56은 **매번 100% 소진**된다. 그래서 유튜브 보강에 쓰는 1요청은 네이버에서 **6.59명**을
 * 포기하는 것이다(실측 12회차: YT 382요청→77명 · 네이버 227요청→1,497명).
 * 그런데 유튜브 이메일은 **보강 레인이 어차피 채운다**(미측정 13.3% → 측정됨 38.4%, 커버 96%).
 * ⇒ 수집 시점에는 **레인이 못 하는 것(영상 제목 = 업종 판정 재료)** 만 남긴다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것: 실제 절감분이 네이버로 흘러가는지는 라이브 `spend_by` 로만 보인다.
 *    여기서는 "상수가 낮아졌고 · 호출부가 그 상수를 쓰고 · 대상이 좁혀졌다"까지만 고정한다.
 */
describe('유튜브 보강 예산 — 레인이 못 하는 것만 수집 시점에 한다', () => {
  it('📉 상한이 종전(8)보다 낮다 — 그래야 예산이 네이버로 간다', () => {
    expect(YT_COLLECT_ENRICH_MAX).toBeLessThan(8)
    expect(YT_COLLECT_ENRICH_MAX).toBe(4)
  })

  /**
   * 0 으로 만들면 두 가지를 잃는다: ① 경로가 죽었는지 살았는지 알 수 없다(네이버가 1 을 남긴 이유)
   * ② **업종 판정 재료는 대체재가 없다** — 보강 레인은 영상 제목을 안 본다.
   */
  it('🫀 0 은 아니다 — 분류 신호는 대체재가 없고, 경로 생존도 안 보인다', () => {
    expect(YT_COLLECT_ENRICH_MAX).toBeGreaterThan(0)
    expect(NAVER_COLLECT_ENRICH_MAX).toBeGreaterThan(0) // 같은 원칙(회귀 방지)
  })

  it('🔌 호출부가 상수를 쓴다 — 리터럴로 되돌아가면 이 판단이 코드에서 사라진다', () => {
    expect(COLLECT, '유튜브 발굴이 상수를 안 쓰면 조정 지점이 두 곳이 된다')
      .toMatch(/enrichMax:\s*YT_COLLECT_ENRICH_MAX/)
    expect(COLLECT, '네이버 쪽도 같은 방식이어야 한다(회귀 방지)')
      .toMatch(/enrichMax:\s*NAVER_COLLECT_ENRICH_MAX/)
  })

  /**
   * 🎯 **대상 좁히기가 절감의 절반이다.** 상한만 내리면 여전히 "이메일만 없는 채널"에 쓴다 —
   *   그건 보강 레인이 더 싸게, 더 잘 한다(실측 커버 96% · 수율 3배).
   */
  it('🎯 후보는 분류 실패분만 — 이메일만 없는 채널은 보강 레인에 맡긴다', () => {
    const m = /\.filter\(l => l\._uploads && ([^)]*classifyCategory[^\n]*)\)/.exec(DISCOVERY)
    expect(m, '유튜브 보강 후보 필터를 못 찾았다(코드가 이동했으면 앵커를 고칠 것)').toBeTruthy()
    expect(m![0], '`!l.email ||` 이 살아 있으면 대상이 안 좁혀진다').not.toMatch(/!l\.email\s*\|\|/)
    expect(m![0], '분류 판정은 남아 있어야 한다 — 그게 이 보강의 유일한 고유 기여다').toContain('classifyCategory')
  })

  it('📚 근거가 코드에 남아 있다 — 다음 세션이 숫자 없이 되돌리지 않게', () => {
    // 되돌리려면 반박할 실측이 필요하다. 그 실측이 상수 옆에 있어야 한다.
    expect(WIDTH).toMatch(/6\.59/)   // 네이버 요청당 신규
    expect(WIDTH).toMatch(/38\.4/)   // 레인이 만든 유튜브 이메일 수율
    expect(WIDTH).toMatch(/82\.1/)   // 보강이 만든 분류율(고유 기여)
  })
})
