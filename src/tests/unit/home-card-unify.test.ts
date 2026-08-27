/**
 * 🎨 홈 카드가 한 벌이다 + 더보기가 살아 있다 + 사진을 손으로 넘긴다 (2026-08-27 대표 지시)
 *
 * 대표: *"지금 인기 이용권의 더보기 클릭도 안되고, 첫번째 형태의 이용권 ui로 통일돼야 해."*
 *       *"이용권 이미지 썸네일 좌우로 스와이프 되어져야 해."*  *"글자 색도 검정으로 변경."*
 *
 * ## ① 카드 룩이 두 벌이었다
 * 편성 섹션은 **흰 카드**(사진 아래 검은 글자), 동네 딜 피드는 모바일에서 **대표색 그라데이션 카드**
 * (사진 위에 글자가 얹히고 카드 배경이 상품 색으로 물듦). 같은 화면 위아래에 다른 카드가 놓였다.
 * 이 둘을 가른 건 `pc` 플래그였고, `HomeSections` 는 흰 룩을 얻으려고 `pc` 를 하드코딩으로 넘겼다
 * — 그 부작용이 이미지 폭 2~3배 과다였다(`home-card-image-width` 참조). ⇒ 룩을 하나로 고정.
 *
 * ## ② 더보기가 폰에서 안 눌렸다
 * 섹션 '더보기'는 `/?sort=popular` 같은 **쿼리 전용 이동**인데, 그걸 화면에 반영하는 코드가
 * **PC 홈에만** 있었다. 모바일은 같은 링크를 받고도 쿼리를 안 읽어 정말 아무 일도 안 일어났다.
 * ⇒ `useHomeQuerySync` 로 묶고 두 홈이 모두 부른다.
 *
 * ## ③ 폰에서 사진을 넘길 방법이 화살표뿐이었다
 * 카드는 `<Link>` 안이라 스와이프를 그냥 두면 손을 떼는 순간 상세로 이동한다 — 넘겼다는 사실을
 * 기억해 이어지는 클릭을 취소해야 한다. 그리고 세로 스크롤은 절대 막지 않는다.
 *
 * 이 테스트가 **못 막는 것**: 실제 제스처 동작과 픽셀. 배선만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
/**
 * 주석 제거 — 줄 단위로만. `/*…*\/` 정규식으로 지우면 앞쪽 블록주석 시작이 뒤쪽 `*\/` 와
 * 짝지어져 멀쩡한 코드까지 삼킨다(2026-08-24 에 실제로 당했다).
 */
const code = (s: string) =>
  s.split('\n').filter((l) => {
    const t = l.trim()
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  }).join('\n')

const CARD = 'src/pages/main-home/GroupBuyFeedCard.tsx'
const MEDIA = 'src/components/deal/DealCardMedia.tsx'
const HOOK = 'src/pages/main-home/useHomeQuerySync.ts'
const PC = 'src/pages/pc-home/PcHomePage.tsx'
const MOBILE = 'src/pages/mobile-home/MobileHomePage.tsx'
const SECTIONS = 'src/components/home/HomeSections.tsx'

describe('① 카드 룩이 한 벌이다', () => {
  it('카드가 `pc` 로 룩을 가르지 않는다', () => {
    const s = code(read(CARD))
    expect(s, '카드 배경을 대표색으로 칠하는 분기가 살아 있다').not.toMatch(/backgroundColor:\s*grad\.base/)
    expect(s, '사진 하단 대표색 번짐이 살아 있다').not.toMatch(/grad\.imageFade/)
    expect(s, '글자색을 대표색으로 덮는 인라인 style 이 남아 있다').not.toMatch(
      /style=\{t(Sub|Text|Accent)\}/,
    )
    expect(s, '`pc` prop 이 아직 카드에 있다 — 룩이 다시 갈릴 통로다').not.toMatch(/\bpc\?:\s*boolean/)
  })

  it('글자색이 검정(잉크) 고정이다', () => {
    const s = code(read(CARD))
    expect(s, '제목 글자색이 고정 잉크가 아니다').toMatch(/cText = 'text-gray-900 dark:text-white'/)
    expect(s, '보조 글자색이 고정이 아니다').toMatch(/cSub = 'text-gray-500 dark:text-gray-400'/)
  })

  it('두 호출부 모두 `pc` 를 넘기지 않는다', () => {
    for (const f of [SECTIONS, 'src/pages/main-home/GroupBuyFeed.tsx']) {
      expect(code(read(f)), `${f}: 카드에 pc 를 넘긴다`).not.toMatch(/<GroupBuyFeedCard[^>]*\spc[\s=/>]/)
    }
  })
})

describe('② 더보기가 두 홈에서 똑같이 동작한다', () => {
  it('쿼리 동기화가 공유 훅으로 있다', () => {
    const s = code(read(HOOK))
    expect(s, '훅이 sort 쿼리를 안 읽는다').toMatch(/q\.get\('sort'\)/)
    expect(s, '훅이 category 쿼리를 안 읽는다').toMatch(/q\.get\('category'\)/)
    expect(s, '첫 마운트 스킵이 없다 — 홈 진입마다 화면이 점프한다').toMatch(/firstSync/)
  })

  it('PC 와 모바일 **둘 다** 훅을 부른다 (한쪽만이면 그쪽만 죽는다)', () => {
    for (const f of [PC, MOBILE]) {
      expect(code(read(f)), `${f}: useHomeQuerySync 를 안 부른다`).toMatch(/useHomeQuerySync\(\{/)
    }
  })

  it('아무 데도 못 가는 더보기는 그리지 않는다', () => {
    // 🩸 처음엔 `moreIsDeadEnd` **선언**만 찾았다 — 조건절에서 빼도 상수가 남아 초록이었다.
    //    (이 레포가 반복해 겪은 "헛도는 가드". 렌더 조건 자체를 본다.)
    const s = code(read(SECTIONS))
    expect(s, '죽은 더보기 판정이 없다').toMatch(/const moreIsDeadEnd =/)
    expect(s, '판정해 놓고 렌더 조건에서 안 쓴다 — 죽은 버튼이 그대로 보인다').toMatch(
      /\{more && !moreIsDeadEnd &&/,
    )
  })
})

describe('③ 사진을 손으로 넘길 수 있다', () => {
  it('터치 스와이프가 배선돼 있다', () => {
    const s = code(read(MEDIA))
    expect(s, 'onTouchMove 가 없다 — 화살표로만 넘길 수 있다').toMatch(/onTouchMove=\{/)
    expect(s, 'onTouchEnd 가 없다').toMatch(/onTouchEnd=\{/)
  })

  it('스와이프 뒤 클릭이 상세로 새지 않는다 (<Link> 안이다)', () => {
    expect(code(read(MEDIA)), 'onClickCapture 로 스와이프 직후 클릭을 취소하지 않는다').toMatch(
      /onClickCapture=\{/,
    )
  })

  it('세로 스크롤을 막지 않는다 — 가로 우세일 때만 스와이프로 친다', () => {
    const s = code(read(MEDIA))
    expect(s, '가로/세로 우세 비교가 없다').toMatch(/Math\.abs\(dx\) > Math\.abs\(dy\)/)
    expect(s, 'touchmove 에서 preventDefault 하면 페이지가 안 내려간다').not.toMatch(
      /onTouchMoveMedia[\s\S]{0,400}preventDefault/,
    )
  })

  it('화살표와 스와이프가 같은 이동 로직을 쓴다', () => {
    const s = code(read(MEDIA))
    expect(s, 'step() 공유가 없다 — 둘이 갈리면 한쪽만 고쳐진다').toMatch(/const step = useCallback/)
    expect(s, 'go() 가 step 을 안 쓴다').toMatch(/step\(delta\)/)
  })
})
