/**
 * 🔓 가이드 한정 해동 — "시드에서 고쳤다 ≠ 라이브가 고쳐졌다" (2026-08-31 라이브 실측)
 *
 * 배경: `manually_edited` 컬럼이 생기던 날, 보수적 백필이 **그때 존재하던 모든 섹션**을
 * 수동편집으로 간주해 얼렸다. 아무도 편집하지 않았는데도 그 섹션들은 시드 갱신이 영영 안 닿는다.
 * 그 결과 **영구 중단된 라이브커머스의 OBS 설정법**이 셀러 가이드에 그대로 살아 있었다 —
 * 2026-08-31 배포 후 라이브를 직접 읽어 보고서야 발견했다(초록불은 아무것도 말해 주지 않았다).
 *
 * ⛔ 이 테스트가 **못 막는 것**: 제목이 같고 본문만 낡은 섹션. 실측은 제목 비교로 찾았으므로
 *   본문만 드리프트한 pre-백필 섹션은 여전히 조용히 낡아 있을 수 있다(별도 과제).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const routes = read('src/features/guides/api/guide.routes.ts')

describe('가이드 한정 해동', () => {
  it('해동은 키를 명시한 것만 — 전체 해동이 아니다', () => {
    // 전체 해동은 관리자가 진짜로 쓴 문구까지 시드로 되돌린다.
    expect(routes).toContain('UNFREEZE_ONCE')
    expect(routes, '해동 UPDATE 는 guide_type + section_key 로 좁혀야 한다')
      .toMatch(/manually_edited = 0 WHERE guide_type = \? AND section_key = \?/)
    expect(routes, '조건 없는 전체 해동이 있으면 안 된다')
      .not.toMatch(/SET manually_edited = 0\s*`\s*\)/)
  })

  it('1회만 돈다 (마커) — 이후 관리자 편집이 이긴다', () => {
    expect(routes).toContain('guide_unfreeze_2026_08_31')
    expect(routes, '마커가 있으면 건너뛰는 가드가 있어야 한다')
      .toMatch(/if \(!unfrozen\)/)
  })

  it('실측으로 갈린 섹션들을 실제로 지목한다', () => {
    for (const key of ['live-broadcast', 'live-mastery', 'daily', 'settlement', 'promo', 'moderation']) {
      expect(routes, `${key} 가 해동 목록에 없으면 라이브가 안 고쳐진다`).toContain(`'${key}'`)
    }
  })

  it('라이브가 시드보다 길었던 섹션은 건드리지 않는다 (남의 작업)', () => {
    // admin 'deploy'(710/690) · wholesale 'overview'(1116/1102) — 누군가 내용을 더한 흔적이다.
    const start = routes.indexOf('UNFREEZE_ONCE: Array')
    const arr = routes.slice(start, routes.indexOf(']', start))
    expect(arr, 'deploy 는 라이브가 더 길다 — 되돌리면 남이 더한 내용이 사라진다').not.toContain("'deploy'")
    // 근거는 배열 **위** 주석에 있다(배열 안이 아니다) — 파일 전체에서 찾는다.
    expect(routes, '실측 근거를 주석에 남겨야 다음 세션이 추측으로 넓히지 않는다')
      .toContain('라이브가 시드보다 긴 것은 뺐다')
  })
})
