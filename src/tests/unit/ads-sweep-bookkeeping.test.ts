/**
 * 🧾 **레인이 자기 기록을 쓸 예산을 남기는가** — 불변식 (2026-07-29 라이브 실측 후 신설).
 *
 *   무엇이 잘못돼 있었나: 카카오 전화 스윕의 루프가 `left <= 2` 에서 멈추는데, 루프 뒤에 따라오는
 *   D1 쓰기/읽기는 **5회**다(전화 저장 · 시도 도장 · 학습 상한 · 직전 통계 조회 · **자기 스탬프**).
 *   D1 도 서브리퀘스트라 예산을 넘으면 던지고, 전부 `.catch(() => null)` 이라 조용히 사라진다.
 *   하필 마지막이 자기 스탬프여서 — **레인이 돌았는데 "안 돈 것"처럼 보였다.**
 *
 *   실측: 이 레인은 매시간 디스패치되는데 `ads_kakao_sweep_stats.last_run` 이 13:01 에 멈춰 있었다
 *   (같은 게이트 블록의 `reclassify` 는 매시간 갱신 — 차이는 그쪽이 예산을 안 쓴다는 것뿐).
 *
 *   ⚠️ 이 검사가 못 막는 것: **플랫폼 한도를 실제로 친 회차**는 예약으로도 못 살린다(그 뒤 모든
 *   서브리퀘스트가 던진다). 그건 학습 상한이 낮추는 방식으로만 줄어든다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/company-collect.ts'), 'utf8')
/** `runKakaoPhoneSweep` 본문만 잘라 센다(파일 전체를 세면 다른 함수의 쓰기까지 섞인다). */
const sweepBody = (): string => {
  const i = SRC.indexOf('export async function runKakaoPhoneSweep(')
  expect(i, 'runKakaoPhoneSweep 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 함께 갱신할 것').toBeGreaterThan(0)
  const j = SRC.indexOf('\nexport ', i + 10)
  return SRC.slice(i, j > 0 ? j : undefined)
}

describe('카카오 전화 스윕 — 부기 예산', () => {
  it('🔒 루프 정지선이 상수를 쓴다(리터럴 2 로 되돌아가면 마지막 쓰기부터 잘린다)', () => {
    expect(sweepBody()).toMatch(/budget\.left <= SWEEP_BOOKKEEPING_RESERVE/)
    expect(sweepBody(), '리터럴로 되돌아갔다').not.toMatch(/budget\.left <= 2\b/)
  })

  it('🔒 예약분이 루프 뒤 실제 쓰기 횟수 이상이다 — 이게 이 시험의 전부다', () => {
    const m = /const SWEEP_BOOKKEEPING_RESERVE = (\d+)/.exec(SRC)
    expect(m, '상수를 못 찾았다').toBeTruthy()
    const reserve = Number(m![1])

    const body = sweepBody()
    const after = body.slice(body.indexOf('SWEEP_BOOKKEEPING_RESERVE') + 1)
    // 루프 이후 구간의 D1 접근(prepare 호출) 횟수 — 배치도 1회로 센다(D1.batch = 서브리퀘스트 1).
    const writes = (after.match(/DB\.(prepare|batch)\(/g) || []).length
    expect(writes, '루프 뒤 D1 접근을 못 셌다 — 형태가 바뀌었으면 이 검사도 함께').toBeGreaterThan(0)
    expect(reserve, `예약 ${reserve} < 실제 필요 ${writes} — 마지막 쓰기(자기 스탬프)부터 잘린다`)
      .toBeGreaterThanOrEqual(writes)
  })

  it('자기 스탬프가 여전히 마지막에 쓰인다(그래서 예약이 부족하면 그것부터 잃는다)', () => {
    const body = sweepBody()
    expect(body.lastIndexOf('ads_kakao_sweep_stats')).toBeGreaterThan(body.indexOf('SWEEP_BOOKKEEPING_RESERVE'))
  })
})
