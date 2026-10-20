/**
 * 🔖 **확인했으면 확인했다고 남긴다** (2026-08-03 라이브 실측).
 *
 * ## 무엇이 문제였나
 * 재분류는 본문으로 카테고리를 다시 뽑아 **값이 다를 때만** 썼다:
 * ```ts
 *   if (byContent && byContent !== r.category) UPDATE ... category_source = 'content'
 * ```
 * 그래서 **본문 분류가 기존 값과 일치하는 행**은 아무것도 안 써서 `category_source` 가 NULL 로 남았다.
 * 어드민 통계는 근거 NULL 을 **키워드 폴백으로** 센다 ⇒ 분류 품질이 실제보다 나빠 보였다:
 *
 * ```
 *   category_source   content 22,665 · (NULL) 19,595 · keyword 1,545 · topic 190
 *   그 19,595 중 소개글 보유 19,297  ← 본문으로 판정 가능한데 근거가 안 남은 행
 *   어드민 표시        cat_keyword 20,132 (= NULL + keyword 를 합쳐 센 값)
 * ```
 * 재분류 회차가 `scanned 6,000 · changed 38` 이었던 것도 이것으로 설명된다 — 고칠 게 없었던 게 맞고,
 * **확인했다는 사실만 안 남기고 있었다.**
 *
 * ⚠️ **이 수정은 분류 품질을 올리지 않는다. 보이게 할 뿐이다.**
 *   값은 하나도 안 바뀐다(같을 때만 근거를 찍는다). 진짜 폴백이 몇인지는 한 바퀴 뒤에 처음 알게 된다.
 *
 * ⚠️ 이 테스트가 못 보는 것: `classifyCategory` 가 실제로 옳게 분류하는지(그건 분류기 자체의 문제다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'src/features/marketing/api/influencer-performance.ts'), 'utf8')
/** 재분류 루프 본문만 잘라 본다 — 파일 다른 곳의 유사 문자열에 걸리지 않게. */
const LOOP = /export async function runReclassifyPool[\s\S]*?\n\}/.exec(SRC)?.[0] || ''

describe('재분류 — 값이 같아도 근거는 남긴다', () => {
  it('재분류 함수를 찾았다 — 못 찾으면 아래 검사가 전부 무의미하다', () => {
    expect(LOOP, 'runReclassifyPool 을 못 찾음(리네임됐다면 이 테스트도 갱신할 것)').not.toBe('')
  })

  it('🔒 근거가 content 가 아니면 값이 같아도 도장을 찍는다', () => {
    expect(LOOP).toMatch(/byContent && r\.category_source !== 'content'/)
    expect(LOOP).toMatch(/SET category_source = 'content' WHERE id = \?/)
  })

  it('🔒 그러려면 category_source 를 읽어와야 한다 — 안 읽으면 매번 다시 찍는다', () => {
    expect(LOOP).toMatch(/SELECT id, name, description, category, category_source FROM ad_influencer_leads/)
  })

  it('🔒 값 변경(changed)과 근거 도장(stamped)을 따로 센다 — 섞으면 규칙 효과를 못 본다', () => {
    expect(LOOP).toMatch(/changed \+= ups\.length - pageStamped/)
    expect(LOOP).toMatch(/stamped \+= pageStamped/)
    expect(LOOP).toMatch(/return \{ scanned, changed, stamped, done \}/)
  })

  /**
   * 도장 분기가 **값 변경 분기보다 뒤**에 있어야 한다. 앞에 오면 값이 달라야 하는 행까지
   * 근거만 찍고 지나가 **분류가 영영 안 고쳐진다** — 조용히 나빠지는 형태다.
   */
  it('🔒 값 변경 분기가 먼저다 — 순서가 뒤집히면 분류가 영영 안 고쳐진다', () => {
    const iChange = LOOP.indexOf("byContent !== r.category")
    const iStamp = LOOP.indexOf("r.category_source !== 'content'")
    expect(iChange).toBeGreaterThanOrEqual(0)
    expect(iStamp).toBeGreaterThan(iChange)
  })

  it('🔒 카테고리 정리(shouldClearCategory) 경로는 그대로다 — 도장이 그걸 가로채면 안 된다', () => {
    expect(LOOP).toMatch(/!byContent && shouldClearCategory\(/)
    // 정리 분기는 `byContent` 가 없을 때만 — 도장 분기(byContent 있음)와 상호배타라 서로 못 가로챈다.
    const iClear = LOOP.indexOf('shouldClearCategory(')
    expect(iClear).toBeGreaterThan(LOOP.indexOf("r.category_source !== 'content'"))
  })
})
