/**
 * ☎️ 카카오 전화 스윕 — **줄 세우는 순서**가 곧 처리량이다 (2026-08-04 라이브 실측 수리).
 *
 * ## 무엇이 고장이었나
 * ```
 *   적격 148,297  |  tier1 96 · tier2 933 · tier3 2,637 · tier4 129,049 · tier5 15,582
 *   storeinfo 17,979건 전부 주소 보유  →  카카오 조회를 받은 것 **0건**
 *   실적 하루 360조회 → tier4(12.9만)를 통과하는 데만 358일
 * ```
 * `ORDER BY tier ASC, id ASC` 뿐이라 뒷줄이 영원히 안 왔다. 게다가 30일 쿨다운이 만료된 **앞줄이
 * 계속 재적격**돼, 커서가 없는 이 설계에서는 앞줄만 반복 조회된다(쿨다운 30일 < 한 바퀴 411일).
 *
 * ⚠️ 이 시험이 **못** 보는 것: 실제 처리량(하루 360)이 오르는가. 그건 순서가 아니라 틱 CPU 문제다
 *   (`docs/handoff/2026-08-04-tick-cpu-ceiling.md`). 여기서 고치는 건 **누가 먼저 오는가**뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/company-collect.ts'), 'utf8')
/** 스윕 쿼리 본문만 — 주석에 같은 문자열이 있어도 걸리지 않게 `ORDER BY` 절을 직접 집는다. */
const ORDER = (() => {
  //   ⚠️ 앵커를 `FROM ad_company_leads` 로 잡는다 — 그 아래 WHERE 조건까지 함께 검사해야
  //     "순서만 바꿨다(대상 집합 불변)"를 시험할 수 있다.
  const i = SRC.indexOf('WHERE merged_into IS NULL AND (phone IS NULL')
  expect(i, '스윕 쿼리를 못 찾았다 — 코드가 옮겨갔나(낡은 지도)').toBeGreaterThan(0)
  const j = SRC.indexOf('LIMIT ?', i)
  return SRC.slice(i, j)
})()

describe('스윕 정렬 — 기아가 구조적으로 불가능해야 한다', () => {
  it('① **한 번도 안 본 행**이 최우선이다 — 없으면 앞줄만 30일마다 반복된다', () => {
    expect(ORDER, '미조회 우선 키가 사라졌다 — 뒷줄 15,518건이 다시 영원히 굶는다')
      .toContain('(kakao_checked_at IS NOT NULL) ASC')
  })

  it('② **연락처가 아예 없는 행**이 그다음이다 — 이미 이메일 있는 리드에 희소한 조회를 쓰지 않는다', () => {
    expect(ORDER, "이메일 보유 후순위 키가 사라졌다 — tier4 의 17,921건이 다시 앞줄을 먹는다")
      .toContain("(email IS NOT NULL AND email <> '') ASC")
  })

  it('③ tier(접촉 가치)는 **그대로 남아 있다** — 이 수리는 축을 늘린 것이지 우선순위를 뒤집은 게 아니다', () => {
    expect(ORDER).toContain('(tier IS NULL) ASC, tier ASC, id ASC')
  })

  it('🔒 순서가 지켜진다 — 미조회 → 연락처없음 → tier 순', () => {
    const a = ORDER.indexOf('(kakao_checked_at IS NOT NULL) ASC')
    const b = ORDER.indexOf("(email IS NOT NULL AND email <> '') ASC")
    const c = ORDER.indexOf('tier ASC')
    expect(a).toBeGreaterThan(-1)
    expect(b, '연락처 키가 미조회 키보다 앞이면 기아 수리가 무효다').toBeGreaterThan(a)
    expect(c, 'tier 가 앞으로 오면 옛 동작으로 되돌아간다').toBeGreaterThan(b)
  })

  it('🔒 WHERE 조건은 불변 — 대상 집합을 넓히거나 좁히지 않았다(순서만 바꿨다)', () => {
    expect(ORDER).toContain("(phone IS NULL OR phone = '')")
    expect(ORDER).toContain("address IS NOT NULL AND address != ''")
  })
})
