/**
 * 🛑 영입 커미션 — **폐지의 잔재 정리** (2026-09-24)
 *
 * ## 먼저: 이건 "끄는 작업"이 아니다. 이미 꺼져 있었다.
 * 적립은 2026-08-31 에 호출부가 끊겼고(`order-commissions.ts` 의 `CommissionAxis` 에서
 * `store_intro` 제거 — `creditInfluencerStoreIntroCommission` 호출부는 **0개**),
 * 2026-09-16 에 화면·약관의 거짓 약속이 정리됐다(`store-intro-abolished-2026-09-16.test.ts`).
 *
 * ## 🩸 그런데 두 세션이 연달아 "살아 있다"고 오판했다
 * 2026-09-15 에 한 번(그 가드 머리말이 기록해 뒀다), **2026-09-24 에 내가 또** — 둘 다
 * `platform_settings.influencer_store_intro_pct = 2` 라는 **설정값만 보고** 단정했다.
 * 대표가 두 번 다 *"그런거 없어"* / *"아예 없기로 했는데"* 로 바로잡아야 했다.
 *
 * ⇒ 오판의 원인은 사람이 아니라 **남아 있던 잔재**다. 그래서 이 가드는 그 잔재를 고정한다:
 *   1. **코드 폴백**(`COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT`)이 2.0 이었다 —
 *      어드민 화면과 자동 생성 운영백서가 이 상수를 읽어 **"2.0"을 보여 주고 있었다.**
 *   2. **셀러 가이드 시드**가 *"매출의 2% 를 1년간 드립니다"* 를 그대로 약속하고 있었다.
 *      09-16 가드는 React 화면 셋(`EarnLadder`·약관·정산)만 고쳤고 **가이드 시드는 놓쳤다.**
 *      가이드는 재시드로만 바뀌므로, 시드를 안 고치면 라이브 가이드는 영영 옛 약속을 한다.
 *   3. **0-falsy 함정** — `getStoreIntroPct` 가 `pct > 0` 이라 0(= 끔)을 넣어도 폴백으로
 *      되돌아갔다. 지금은 호출부가 없어 무해하지만, 되살릴 때 끄는 길이 없으면 안 된다.
 *
 * ## 이 가드가 **못** 막는 것
 * - 라이브 `platform_settings` 의 값(레포 밖). 그 행은 09-16 결정대로 **일부러 남겨 둔다** —
 *   지우면 어드민 저장 payload 가 흔들리고, 값이 무엇이든 부를 코드가 없다.
 * - 적립 경로 자체의 부활 — 그건 `store-intro-abolished-2026-09-16.test.ts` 가 지킨다(축 타입).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { COMMISSION_DEFAULTS } from '@/shared/constants/policy'
import { stripComments } from '../helpers/source-text'

const SRC = 'src/worker/utils/influencer-store-intro-commission.ts'
const src = () => stripComments(readFileSync(SRC, 'utf-8'))

describe('영입 커미션 중단 — 요율 해석', () => {
  it('① 코드 기본값이 0 이다 (설정 행이 없어도 안 나간다)', () => {
    expect(COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT).toBe(0)
  })

  it('② 🔴 0 을 유효값으로 읽는다 — `> 0` 이면 끄는 스위치가 안 듣는다', () => {
    const s = src()
    expect(s).toMatch(/pct\s*>=\s*0\s*\?\s*pct\s*:\s*DEFAULT_STORE_INTRO_PCT/)
    // 되돌아가는 모양(`pct > 0 ? …`)이 다시 들어오면 빨간불.
    expect(s).not.toMatch(/pct\s*>\s*0\s*\?\s*pct\s*:\s*DEFAULT_STORE_INTRO_PCT/)
  })

  it('③ 요율이 0 이면 적립하지 않는다(금액 0 조기 반환이 살아 있다)', () => {
    const s = src()
    expect(s).toMatch(/if\s*\(\s*commission\s*<=\s*0\s*\)\s*return/)
    // 예산 아비터용 계산 경로도 같은 방향으로 0 을 돌려준다.
    expect(s).toMatch(/return\s+commission\s*>\s*0\s*\?\s*commission\s*:\s*0/)
  })

  it('④ 요율 해석이 음수는 거른다(적립이 징수가 되지 않게)', () => {
    // `>= 0` 이므로 음수는 조건을 못 넘어 기본값으로 떨어진다 — 그 기본값이 이제 0 이다.
    expect(COMMISSION_DEFAULTS.INFLUENCER_STORE_INTRO_PCT).toBeGreaterThanOrEqual(0)
    expect(src()).toMatch(/Number\.isFinite\(pct\)\s*&&\s*pct\s*>=\s*0/)
  })

  it('⑤ 사용자-가시 문서가 없어진 제도를 약속하지 않는다', () => {
    const guide = readFileSync('src/features/guides/api/guide-seed-seller.ts', 'utf-8')
    const sec = guide.slice(guide.indexOf("key: 'introduction-commission'"))
    // 🔴 **제목이 아니라 본문을 잰다.** 제목에 '중단' 이 들어 있어서, 본문에서 그 선언을 통째로
    //    지워도 `toContain('중단')` 은 통과했다(2026-09-24 주입 러너가 잡았다).
    const bodyStart = sec.indexOf('content:')
    const body = sec.slice(bodyStart, sec.indexOf('\n  },', bodyStart))
    // 🔴 **마크업을 지우고 문장으로 본다.** 원문이 `**매출의 2%**`(별표가 앞)인데 정규식을
    //    `매출의 **2%**` 로 써서 매치가 0 이었다 — 별표 위치가 바뀌면 또 헛돈다.
    const plain = body.replace(/\*/g, '').replace(/\s+/g, ' ')
    expect(plain).toMatch(/영입 커미션은 중단/)
    expect(plain).not.toMatch(/매출의 2% 를 1년간 드립니다/)
    expect(plain).not.toMatch(/규칙은 하나입니다/)
  })
})
