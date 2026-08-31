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

  it('2차 해동 — 길이로 거르다 놓친 것들을 잡는다', () => {
    // 🩸 1차에서 길이 비교로 걸렀다가 틀렸다. 폐기어 치환은 **같은 글자 수**이고
    //    (유통사→판매사 · 식사권→이용권), 옛 도메인은 **더 길다**(live.ur-team.com vs urdeal.kr).
    //    그래서 "길이가 같다/더 길다"는 드리프트가 없다는 뜻이 아니다.
    expect(routes).toContain('UNFREEZE_ONCE_2')
    expect(routes).toContain('guide_unfreeze_2026_08_31_b')
    // ⚠️ `indexOf(']')` 를 그냥 쓰면 **타입 표기 `Array<[GuideType, string]>` 의 대괄호**에서
    //    잘려 빈 조각을 검사하게 된다. 그러면 `.not.toContain` 류는 늘 통과한다(헛도는 가드).
    const start = routes.indexOf('UNFREEZE_ONCE_2: Array')
    const open = routes.indexOf('= [', start)
    const arr = routes.slice(open, routes.indexOf('\n    ]', open))
    for (const key of ['account-kakao', 'deploy', 'onboarding', 'tax']) {
      expect(arr, `${key} 가 빠지면 그 절이 폐기어/옛 명령을 계속 가르친다`).toContain(`'${key}'`)
    }
    expect(routes, '왜 길이 비교가 틀렸는지 남겨야 다음 세션이 같은 오판을 반복하지 않는다')
      .toContain('드리프트는 길이가 아니라 내용으로 판정해야 한다')
  })

  it('2차 해동도 키 범위를 지킨다 (전체 해동 금지)', () => {
    const hits = routes.match(/manually_edited = 0 WHERE guide_type = \? AND section_key = \?/g) || []
    expect(hits.length, '1차·2차 두 곳 모두 guide_type + section_key 로 좁혀야 한다').toBe(2)
  })
})
