/**
 * 🪪 SNS 연동 목록 = **정보 블록** (2026-11-01 대표 *"이런 식으로 정보들도 나오고 새로고침도 있고 해야하지 않을까"*)
 *
 * 종전엔 한 줄이었다: `인스타그램 / @urdeal_food · 팔로워 12,300명` + [다시 확인][해제].
 * 저장된 값은 처음부터 다 있었는데(`username`·`follower_count`·`verified_at`) **화면이 안 보여 줬다** —
 * 특히 `verified_at`(언제 확인한 숫자인가)은 **어디에도 없었다**. 사장님이 요구하는 팔로워 조건을
 * 이 숫자로 판정하는데, 그게 방금 값인지 한 달 전 값인지 알 길이 없는 것은 그 자체로 결함이다.
 *
 * ## 이 시험이 지키는 것
 * ① 신선도(`verified_at`)와 **다시 확인 손잡이**가 함께 있다 — 둘은 짝이다(오래됐다고만 알려 주고
 *    고칠 방법을 안 주면 소용없고, 반대로 버튼만 있으면 언제 눌러야 하는지 모른다).
 * ② 못 읽은 팔로워(`null`)를 **0 으로 위장하지 않는다** — 모르는 것과 0 은 다르다.
 * ③ 블록마다 카드를 씌우지 않는다 — 이 목록은 이미 카드 **안**이다(카드 안에 카드).
 * ④ 상대 시간 포매터는 `utils/date` SSOT 를 지난다(DB 값은 `Z` 없는 UTC 라 `new Date` 면 9시간 어긋난다).
 *
 * ## 이 시험이 **못** 하는 것
 * 보기 좋은가 · 390px 에서 두 줄로 접히는가(레이아웃은 jsdom 밖이다 — `visual-preview` 로 봐야 한다).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { relativeFromNow } from '@/utils/date'

const SRC = readCode('src/components/seeding/SnsLinkList.tsx')
const DATE = readCode('src/utils/date.ts')

describe('① 신선도와 다시 확인은 짝이다', () => {
  it('마지막 확인 시각을 보여 준다', () => {
    expect(SRC, 'verified_at 소비').toMatch(/relativeFromNow\(l\.verified_at\)/)
    expect(SRC, '"확인" 이라고 말한다').toMatch(/확인/)
  })

  it('같은 자리에 다시 확인 손잡이가 있다', () => {
    // 버튼이 `connect(p)` 를 부른다 — 갱신 경로는 바뀔 수 있어도 손잡이 자체는 남아야 한다.
    const refresh = SRC.match(/<RefreshCw[\s\S]{0,200}?relativeFromNow\(l\.verified_at\)/)
    expect(refresh, '새로고침 아이콘과 시각이 한 버튼 안').not.toBeNull()
  })

  it('상대 시간은 utils/date SSOT 를 지난다', () => {
    expect(SRC, '손으로 Date 비교 금지').not.toMatch(/new Date\(/)
    expect(DATE, 'SSOT 가 parseUTCDate 로 읽는다').toMatch(/export function relativeFromNow[\s\S]{0,400}parseUTCDate/)
  })

  it('포매터를 실제로 돌려 본다', () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString().replace('T', ' ').slice(0, 19)
    expect(relativeFromNow(ago(10_000))).toBe('방금')
    expect(relativeFromNow(ago(5 * 60_000))).toBe('5분 전')
    expect(relativeFromNow(ago(3 * 3600_000))).toBe('3시간 전')
    expect(relativeFromNow(ago(4 * 86400_000))).toBe('4일 전')
    // 🔮 미래 시각(기기 시계 차이)에 "-3분 전" 을 보여 주지 않는다.
    expect(relativeFromNow(new Date(Date.now() + 600_000).toISOString().replace('T', ' ').slice(0, 19))).toBe('방금')
    expect(relativeFromNow(null)).toBe('')
  })
})

describe('② 모르는 값을 0 으로 위장하지 않는다', () => {
  it('follower_count 가 null 이면 숫자 대신 —', () => {
    expect(SRC).toMatch(/l\.follower_count === null \? '—' : formatNumber\(l\.follower_count\)/)
    // 🔁 2026-11-01(2차) 재조준 — 불변식("못 읽었다고 **말한다**")은 그대로이고, 그 문장이
    //    `shared/sns-account.ts` 로 옮겨갔을 뿐이다(이유까지 말하게 하면서 SSOT 로 모았다).
    //    문구를 화면이 다시 손으로 적으면 두 벌이 되므로, 여기서는 **그 함수를 부르는지**를 본다.
    expect(SRC, '읽지 못했다고 말한다').toMatch(/snsUnknownFollowerText\(p, l\.account_type\)/)
  })
})

describe('③ 카드 안에 카드를 만들지 않는다', () => {
  it('블록에 판(shadow-lift)·테두리를 깔지 않는다', () => {
    expect(SRC, '판 금지').not.toMatch(/shadow-lift/)
    expect(SRC, '테두리 카드 금지').not.toMatch(/border border-/)
    expect(SRC, '블록 사이는 hairline 하나').toMatch(/divide-y divide-rule/)
  })
})

describe('④ 로고는 공용 부품 한 벌', () => {
  it('path 를 다시 베끼지 않는다', () => {
    expect(SRC, '공용 맵').toMatch(/SNS_LOGO\[p\]/)
    expect(SRC, '인라인 svg 금지').not.toMatch(/<svg\b/)
  })
})
