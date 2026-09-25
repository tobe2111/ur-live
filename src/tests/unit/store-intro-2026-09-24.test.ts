/**
 * 🏪 **이용권 상세 — 상품 설명이 제자리에 있고, 가게 소개가 실제로 그려진다** (2026-09-24 대표 문서 ①).
 *
 * ## 무엇이 문제였나
 * 대표: *"두툼한 삼겹살 500g 과 김치찌개… 이건 왜 터무니없이 저 자리에 있는거지??"*
 * 그 문장은 상품 설명(`description`)인데 `gb-sec-info` 안에서 `<UsageGuide>` **바로 뒤**에
 * 제목도 구분선도 없이 붙어 있었다 — 위 '유의사항' 불릿의 꼬리처럼 읽힌다.
 * 원인은 디자인이 아니라 **이사 자국**이다(2026-09-15 `faed018ff` 가 UsageGuide 를 이 앵커로
 * 끌어올리면서 설명 문단이 뒤로 밀렸다 — `git log -S` 로 두 변경이 같은 커밋임을 확인).
 *
 * ## 그리고 소개란이 없었다
 * 대표: *"소개란이 따로 있었으면 좋겠다 / 글·사진 조합이었으면 좋겠음."*
 * 실측: 라이브 `/api/group-buy/products/2645` 응답에 `long_description`·`seller_bio`·`seller_avatar`
 * 가 **이미 있는데** 상세 페이지의 사용 횟수가 `long_description` 0회 · `seller_bio` 0회였다.
 * 만들 게 아니라 **그리면 되는 것**이었다.
 *
 * ## 이 시험이 **못 하는 것**
 * jsdom 은 레이아웃이 없어 "그 문단이 유의사항 꼬리처럼 보이는가"를 못 잰다.
 * 여기서 지키는 것은 **어느 블록에 속하는가**(구조)와 **필드가 실제로 소비되는가**뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, readRaw, stripComments } from '../helpers/source-text'

const PAGE = 'src/pages/GroupBuyDetailPage.tsx'
const INTRO = 'src/pages/group-buy/StoreIntro.tsx'
const CARD = 'src/pages/group-buy/SellerCard.tsx'

describe('상품 설명이 이용 안내 꼬리에 붙어 있지 않다', () => {
  it('`gb-sec-info` 블록(이용 안내)에 description 문단이 없다', () => {
    const code = readCode(PAGE)
    const i = code.indexOf("id=\"gb-sec-info\"")
    expect(i, 'gb-sec-info 앵커를 못 찾았다').toBeGreaterThan(0)
    // 그 블록은 짧다(UsageGuide 한 줄). 뒤 400자 안에 description 렌더가 있으면 되돌아온 것이다.
    const block = code.slice(i, i + 400)
    expect(block).toContain('<UsageGuide')
    expect(block, '설명 문단이 이용 안내 뒤로 되돌아왔다').not.toMatch(/\{detail\.description\s*&&/)
  })

  it('설명은 StoreIntro 로 넘어간다 — 사라진 게 아니다', () => {
    // 지우기만 하면 손님이 상품 구성을 아예 못 본다. 이동인지 삭제인지를 가른다.
    expect(readCode(PAGE)).toMatch(/<StoreIntro[\s\S]{0,400}description=\{detail\.description\}/)
  })
})

describe('가게 소개가 실제로 그려진다', () => {
  const intro = readCode(INTRO)

  it('서버가 이미 보내던 필드를 소비한다', () => {
    for (const f of ['longDescription', 'sellerBio', 'sellerAvatar']) expect(intro).toContain(f)
    const page = readCode(PAGE)
    expect(page).toContain('long_description')
    expect(page).toContain('seller_bio')
  })

  it('값이 없으면 스스로 사라진다 — 빈 제목만 남기지 않는다', () => {
    expect(intro).toMatch(/if \(!body && !bio && !spec\) return null/)
  })

  it('설명이 상품명과 같은 말이면 두 번 쓰지 않는다 (이사 전 가드 승계)', () => {
    expect(intro).toMatch(/raw !== \(productName \|\| ''\)\.trim\(\)/)
  })

  it('상단 탭과 앵커 id 가 맞물린다', () => {
    // 탭이 스크롤할 앵커가 없으면 눌러도 아무 일도 안 일어난다(에러도 안 난다).
    expect(readCode(PAGE)).toContain("{ id: 'gb-sec-store', label: '가게 소개' }")
    expect(intro).toContain('id="gb-sec-store"')
  })

  it('사진을 두 번 그리지 않는다 — detail_images 는 상단 갤러리 담당', () => {
    expect(stripComments(readRaw(INTRO)), 'StoreIntro 가 갤러리 사진을 다시 그린다(중복)').not.toContain('detail_images')
  })
})

describe('셀러 카드는 옮기기만 했다', () => {
  const card = readCode(CARD)
  it('마크업 계약이 그대로다', () => {
    for (const t of ['검증 셀러', 'publicSellerHandle', 'width: 44, height: 44', 'width: 36, height: 36']) {
      expect(card, `${t} 가 추출 과정에서 사라졌다`).toContain(t)
    }
  })
  it('페이지는 그 부품을 쓰고, 옛 인라인 블록은 남지 않았다', () => {
    const page = readCode(PAGE)
    expect(page).toMatch(/<SellerCard\b/)
    expect(page, '인라인 셀러 카드가 되살아났다(두 벌이 갈린다)').not.toContain('검증 셀러')
  })
})
