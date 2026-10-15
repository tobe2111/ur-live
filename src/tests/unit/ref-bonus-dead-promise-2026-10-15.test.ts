/**
 * 🗑️ 2026-10-15 — "0.5% 레퍼럴" 이라는 안 주는 보상을 약속하던 자리 전부 (대표 결재 "0.5% 레퍼럴은 아예 없어")
 *
 * ## 무엇이 틀렸나 (전부 라이브 실측)
 *
 * `/pass/:id` 의 `?ref=` 진입 배너가 **참여 시 양쪽 0.5% 보너스 딜** 이라고 말했고,
 * 공구 이용약관 제5조는 같은 보상을 **"즉시 적립"** + **"회사가 보장"** 으로 적어 뒀고,
 * 인플 카탈로그 공유 문구는 `친구 추천 시 양쪽 보너스` 를 **카톡방으로 내보냈다**.
 *
 * 그런데 라이브는 그 반대였다:
 *   `user_referral_bonus_pct` = '0' (2026-08-23 대표 "심플 모델")
 *   `influencer_commission_pct` = '0' (2026-08-22)
 *   `invite_reward_enabled` = 행 부재(꺼짐)
 *   `point_transactions WHERE type='referral_bonus'` → **0행. 한 번도 지급된 적이 없다.**
 *
 * 비율이 0 이라 분기와 무관하게 0 이다 — `calcSplit` · `group-buy.routes` 는 물론
 * 인플 차단 분기(`calcSplitInfluencerBlocked`, *"회사가 보장"* 하는 그 경로)도 같은 값이다.
 *
 * ## 왜 "문구만 고치기" 가 아니라 삭제인가
 *
 * 선례가 둘 있고 둘 다 삭제 쪽이다 — 2026-10-06 지갑 공유 모달(**같은 문구**)이
 * *"문구만 고치면 보상 없는 공유 권유만 남는다"* 로 삭제됐고, 2026-08-26 `/influencer` 랜딩도
 * 같은 주장을 포함해 전면 재작성됐다. 그리고 이번엔 **지급 이력이 0행**이라 설정을 읽어
 * 조건부로 보여 주는 방식(2026-10-06 어필리에이트 선례)의 전제조차 없다.
 *
 * ## 🔒 이 시험이 **양방향**인 이유
 *
 * 거짓 약속을 지우다가 **살아 있는 것**을 지우면 더 조용하고 더 나쁘다. 셋을 반대 방향으로 고정한다:
 *   1. `storeAffiliateRef` — `?ref=` 를 저장하는 effect. 지우면 소개 귀속이 통째로 깨진다(에러 0).
 *   2. `getPurchaseRef` — 결제 때 `ref` 를 서버로 보낸다. 살아 있는 레일(매장이 건 딜 소개비)이 이걸 쓴다.
 *   3. 약관의 **본인 추천 차단** — 실제로 구현돼 있다(`affiliate-credit.ts` self_referral ·
 *      `gb-purchase-guards.ts` isSelfReferral). 대상이 "보너스" 가 아니라 "소개비" 라 그 말만 고쳤다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 *
 * - **서버 레일 자체**(`referral-bonus.ts` · `group-buy.routes` 호출)는 **안 지웠다.** 비율이 0 이라
 *   아무 일도 안 하지만 머니 경로라 코드 삭제는 별건(등급 C)이다. 그 모듈이 되살아나는 것은 이 시험 범위 밖.
 * - 설정값이 다시 0.5 로 올라가는 것(어드민 — 그건 대표 판단이고, 그때는 배너를 **새로** 써야 한다).
 * - 화면이 보기 좋은지(배너가 빠지면서 사진·제목이 약 70px 올라온다 — 그림으로만 보인다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '@/tests/helpers/source-text'

const DETAIL = 'src/pages/GroupBuyDetailPage.tsx'
const GB_TERMS = 'src/pages/GroupBuyTermsPage.tsx'
const INF_TERMS = 'src/pages/InfluencerTermsPage.tsx'
const DISCOVER = 'src/pages/InfluencerDiscoverPage.tsx'

/** 판정은 **항상** 주석 제거본으로 — 제거를 기록하는 주석이 그 문구를 인용하기 때문이다.
 *  (이 레포가 robots·d1-migrate·공유카드에서 세 번 밟은 함정.) */
const code = (f: string) => stripComments(readFileSync(f, 'utf-8'))
const raw = (f: string) => readFileSync(f, 'utf-8')
const count = (s: string, p: string) => s.split(p).length - 1

describe('① 안 주는 0.5% 보너스를 약속하는 자리가 없다', () => {
  it('`/pass` 상세에 0.5% 보너스 문구 0건', () => {
    expect(count(code(DETAIL), '0.5%')).toBe(0)
  })

  it('`/pass` 상세에 배너 플래그가 되살아나지 않았다', () => {
    const c = code(DETAIL)
    // `isInfluencerLanding` 은 이 배너 **한 곳에서만** 쓰였다(제거 전 전수 확인).
    expect(count(c, 'isInfluencerLanding')).toBe(0)
    expect(count(c, 'refUserId')).toBe(0)
  })

  it('공구 이용약관에 "0.5% 보너스"·"회사가 보장" 0건', () => {
    const c = code(GB_TERMS)
    expect(count(c, '0.5%')).toBe(0)
    expect(count(c, '회사가 보장')).toBe(0)
    // 제6조 — 지급된 적 없는 referral 보너스 딜의 유효기간을 말하지 않는다.
    expect(c).not.toContain('referral / 보너스 딜')
  })

  it('약관 전체에 `referral` 이라는 없는 제도 이름이 0건', () => {
    // 🩸 제5조만 고치고 렌더해서 보니 **제1조**가 여전히 적용 범위를
    //    *"결제·voucher 사용·환불·referral 보너스를 규정합니다"* 라고 말하고 있었다.
    //    조문 하나를 고치면 그 조문을 가리키는 머리·제재 조항이 낡는다 — 문서 전체로 센다.
    expect(count(code(GB_TERMS), 'referral')).toBe(0)
  })

  it('인플 카탈로그 공유 문구가 보너스를 약속하지 않는다 (카톡방으로 나가는 글이다)', () => {
    const c = code(DISCOVER)
    expect(count(c, '양쪽 보너스')).toBe(0)
    expect(count(c, '친구 추천 시')).toBe(0)
  })
})

describe('② 두 약관이 같은 사실을 말한다', () => {
  // 수리 전에는 공구 약관이 "즉시 적립" 이라 하고 인플 약관이 "현재 운영하지 않습니다" 라고 했다.
  // 약관은 분쟁 때 꺼내 읽는 문서라 서로 반대로 말하면 그 자체가 결함이다.
  it('공구 약관 제5조가 구매자 보너스를 운영하지 않는다고 말한다', () => {
    expect(code(GB_TERMS)).toContain('추천 보너스는 운영하지 않습니다')
  })

  it('인플 약관 제3조도 같은 사실을 말한다 (한쪽만 고치면 다시 갈린다)', () => {
    expect(code(INF_TERMS)).toContain('현재 운영하지 않습니다')
  })
})

describe('③ 반대 방향 — 살아 있는 것을 지우지 않았다', () => {
  it('`?ref=` 저장 effect 가 남아 있다 (지우면 소개 귀속이 깨진다)', () => {
    // 배너와 **무관한** 별도 effect 다. 배너 플래그는 이 값을 읽지 않았다.
    expect(code(DETAIL)).toContain("storeAffiliateRef(searchParams.get('aff') || searchParams.get('ref'))")
  })

  it('결제 때 ref 를 서버로 보낸다 (살아 있는 레일 = 매장이 건 딜 소개비)', () => {
    const c = code(DETAIL)
    expect(c).toContain('getPurchaseRef')
    expect(c).toMatch(/quantity,\s*payment_method:\s*'deal',\s*ref,/)
  })

  it('약관의 본인 추천 차단 조항이 남아 있다 (실제로 구현된 규칙이다)', () => {
    const c = code(GB_TERMS)
    expect(c).toContain('본인 추천')
    expect(c).toContain('계정 정지')
    // 대상이 "보너스" 가 아니라 "소개비" 로 정정됐는지 — 보너스는 존재하지 않으므로 회수할 것도 없다.
    expect(c).toContain('소개비 미지급')
  })

  it('그 차단이 코드에 실재한다 (약관만 적어 두고 안 막는 것이 아니다)', () => {
    expect(code('src/worker/utils/affiliate-credit.ts')).toContain('self_referral')
    expect(code('src/features/group-buy/api/gb-purchase-guards.ts')).toMatch(/isSelfReferral/)
  })

  it('매장이 건 딜 소개비는 약관이 계속 설명한다', () => {
    expect(code(GB_TERMS)).toContain('소개비')
  })
})

describe('④ 잠금표(로딩) 계약 — 배너를 지우면서 같이 지우지 않았다', () => {
  // 📏 2026-10-15 제거 **전** 주석제거본 실측값. 바뀐 것은 배너 세 지문뿐이다
  //    (`Sparkles` 3→2 · `isInfluencerLanding` 2→0 · `refUserId` 2→0).
  it.each([
    ['__SSR_INITIAL_DETAIL__', 1],
    ['pickSeedDetail', 2],
    ['lazy(', 3],
    ['passShareCardUrl', 3],
    ['rootMargin', 1],
    ['handleJoin', 3],
    ['storeAffiliateRef', 2],
    ['getPurchaseRef', 3],
  ])('%s 지문 %i건 불변', (pat, n) => {
    expect(count(code(DETAIL), pat as string)).toBe(n as number)
  })
})

describe('⑤ 이 시험이 헛돌지 않는다', () => {
  it('검사 대상 네 파일이 모두 실재하고 비어 있지 않다', () => {
    // 경로가 낡아 조용히 0자를 검사하는 것을 막는다 — 그러면 위 `toBe(0)` 들이 전부 공짜로 통과한다.
    for (const f of [DETAIL, GB_TERMS, INF_TERMS, DISCOVER]) {
      expect(code(f).length).toBeGreaterThan(2000)
    }
  })

  it('제거 기록 주석이 남아 있다 (왜 지웠는지 없으면 다음 세션이 되살린다)', () => {
    // 주석을 보는 유일한 단언이므로 원문을 읽는다.
    expect(raw(DETAIL)).toContain('0.5% 레퍼럴은 아예 없어')
    expect(raw(GB_TERMS)).toContain('0.5% 레퍼럴은 아예 없어')
    expect(raw(DISCOVER)).toContain('0.5% 레퍼럴은 아예 없어')
  })
})
