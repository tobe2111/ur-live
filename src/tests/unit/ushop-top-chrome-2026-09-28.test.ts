/**
 * 🎫 2026-09-28 (대표 확정 **상단 1안**) 유어샵 모바일 상단 — 버튼 몇 개를 위해 줄을 쓰지 않는다.
 *
 * ■ 왜 생겼나 (라이브 실측 · iPhone 13 844px · `urdeal.kr/u/jiwon1228` 핀 3개)
 *   대표: *"이용권 상품 문제가 아니라 윗 부분들 위치들이 별로야. 조금 더 컴팩트하게 있어야 할 것 같아.
 *   SNS 로고도 말이야. 카테고리 배치들도 그렇고, 추천순 그 버튼도."*
 *
 *   | 층 | y | 높이 |
 *   |---|---|---|
 *   | 이름·소개·공유/관리 | 64 | 75 |
 *   | **SNS 아이콘**      | 139 | **36** ← 아이콘 두 개가 자기 줄을 통째로 |
 *   | 카테고리 칩        | 187 | 48 |
 *   | **정렬 드롭다운**   | 247 | **32** ← 버튼 하나가 자기 줄을 통째로 |
 *   | 첫 상품            | 287 | |
 *
 *   상품 전에 **287px = 첫 화면의 34%**. 그중 102px(SNS 36 + 정렬 32 + 앞뒤 여백 34)이
 *   **줄 두 개의 존재 자체**에 쓰였다. 1안은 그 두 줄을 없앤다 → 첫 상품 y 287 → **185**.
 *
 * ■ 이 시험이 지키는 것
 *   ① SNS 가 전용 줄을 갖지 않는다(이름 줄의 버튼 그룹 안).
 *   ② **공유·관리 버튼은 그대로 있다** — 대표가 직접 확인을 요청한 항목이다
 *      (*"편집? 관리 버튼 들어가야 해"*). 줄을 줄이려다 버튼을 없애면 안 된다.
 *   ③ 칩이 자기 줄을 소유하지 않는다(호출부의 한 줄을 정렬과 나눠 쓴다).
 *   ④ 그런데도 **빈 진열대 판정은 칩 부품이 혼자** 한다 — 호출부에 개수 게이트를 두면 언젠가 갈린다.
 *
 * ■ 이 시험이 **못** 보는 것
 *   - 실제 픽셀(줄이 정말 한 줄인지, 넘치는지)은 브라우저만 안다. 라이브 실측으로 판정할 것:
 *     주인 화면 최악(이름 10자 + SNS 2 + 공유 + 관리)에서 오른쪽 끝 374/390px 이었다.
 *   - PC(lg+) 좌측 프로필 열의 폭(308px)에서 같은 줄이 어떻게 접히는지도 브라우저 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const MANAGE = 'src/pages/ushop-manage/ShopInfoCards.tsx'
const CHIPS = 'src/pages/curator-page/PinCategoryChips.tsx'
const PAGE = 'src/pages/CuratorPage.tsx'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const header = read(HEADER)
const chips = read(CHIPS)
const page = read(PAGE)
const manage = read(MANAGE)

describe('① SNS 가 전용 줄을 쓰지 않는다', () => {
  it('측정이 비어 있지 않다', () => {
    // 0자면 통과가 아니라 고장이다(경로가 낡으면 아래 not.toMatch 가 전부 무의미해진다).
    expect(header.length).toBeGreaterThan(2000)
    expect(header).toContain('snsUrl(')
  })

  it('SNS 링크가 버튼 그룹 안에 들어간다', () => {
    expect(header, 'snsLinks 를 만든다').toMatch(/const snsLinks = hasSns \?/)
    // 이름 줄의 오른쪽 그룹(ml-3 …)이 SNS 를 먼저 그린다.
    const group = header.slice(header.indexOf('className="ml-3 flex items-center'))
    expect(group.slice(0, 200), '버튼 그룹이 snsLinks 를 그린다').toContain('{snsLinks}')
  })

  it('SNS 전용 줄(px-4 pb-3)이 없다', () => {
    // 되살아나면 36px + 여백이 통째로 돌아온다.
    expect(header).not.toMatch(/-ml-2 px-4 pb-3/)
  })

  it('크기는 36px 그대로다 — 줄을 없앤 것이 높이를 줄인 것이다', () => {
    // 🩸 처음엔 버튼(31px)과 균형을 맞추려 32px 로 줄였다가 **되돌렸다.** 라이브 실측에서
    //   36 → 32 로 줄여도 **헤더 높이 92px 가 그대로**였다(왼쪽 이름·소개 칸이 더 높아 그쪽이
    //   높이를 정한다). 얻는 것은 이름 칸 12px(112 → 124)뿐이고, 대신 2026-09-16 이 박아 둔
    //   탭 영역 하한(≥34px)을 깎아야 했다 — 그 거래는 남는 게 없다.
    //   ⇒ 이 작업이 줄인 것은 **줄 하나(48px)** 이고 아이콘 크기가 아니다.
    expect(header, '36px(w-9) 유지').toMatch(/w-9 h-9 rounded-full/)
    expect(header, '34px 이하로 깎지 않았다').not.toMatch(/w-\[3[0-4]px\]/)
  })
})

describe('② 공유·관리 버튼은 그대로 있다 (대표 확인 항목)', () => {
  it('공유 버튼이 있다', () => {
    expect(header).toMatch(/onClick=\{onCopyLink\}/)
    expect(header).toContain("curator.share")
  })

  it('관리 버튼이 주인에게 뜬다', () => {
    // 🩸 2026-10-09 재조준: 그 줄이 **삼항**이 됐다 — 방문자에게도 같은 자리를 `invisible` 로
    //   비워 두기 때문이다(`CuratorHeader` 의 🪑: 서버가 첫 화면을 그리려면 이름 칸 폭이 누가
    //   보든 같아야 한다). 지키려던 것은 *"관리는 주인에게만 **진짜 링크**로 뜬다"* 이므로
    //   `?`·`&&` 둘 다 허용하고, 그 뒤가 `/u/me/manage` 링크인지를 본다.
    expect(header, '관리는 canEdit 일 때').toMatch(/canEdit (\?|&&) \([\s\S]{0,200}\/u\/me\/manage/)
    expect(header).toContain("curator.manage")
  })
})

describe('③ 칩과 정렬이 줄 하나를 나눠 쓴다', () => {
  it('칩 부품이 자기 줄의 바깥 여백을 갖지 않는다', () => {
    // `max-w-3xl mx-auto px-4` 가 부품 안에 있으면 그건 자기 줄을 소유한다는 뜻이다.
    expect(chips, '칩은 줄을 소유하지 않는다').not.toMatch(/max-w-3xl mx-auto px-4/)
    // 🩸 2026-09-30 재조준: 종전엔 `gap-2` 까지 박아 놨는데, 그건 **알약 사이 여백**이라
    //   밑줄 탭(한 톤 확정)으로 바뀌며 사라졌다. 지키려던 것은 여백 수치가 아니라
    //   **"자기 줄을 소유하지 않고 나눠 쓴다"** 다 — `flex-1 min-w-0` + 가로 스크롤이 그것이다.
    expect(chips, '줄을 나눠 쓰는 형태').toMatch(/flex-1 min-w-0 flex[^"]*overflow-x-auto/)
  })

  it('호출부의 한 줄에 칩과 정렬이 함께 있다', () => {
    const rowStart = page.indexOf('empty:hidden')
    expect(rowStart, '병합 줄이 있다').toBeGreaterThan(0)
    const row = page.slice(rowStart, rowStart + 900)
    expect(row).toContain('<PinCategoryChips')
    expect(row).toContain('<SortMenu')
  })

  it('정렬만 든 줄이 남아 있지 않다', () => {
    // 칩 없이 SortMenu 만 있는 컨테이너가 또 생기면 32px 줄이 되돌아온다.
    const sortCount = (page.match(/<SortMenu/g) || []).length
    expect(sortCount, 'SortMenu 는 한 번만 그린다').toBe(1)
  })
})

describe('④ 빈 진열대 판정은 칩 부품이 혼자 한다', () => {
  it('부품이 스스로 null 을 낸다', () => {
    expect(chips).toMatch(/if \(pins\.length === 0\) return null/)
  })

  it('호출부에 개수 게이트를 두지 않는다', () => {
    // 게이트가 두 곳이면 언젠가 갈린다(2026-09-28 주석이 경고하는 바로 그것).
    expect(page).not.toMatch(/pins\.length[^\n]*&&\s*<PinCategoryChips/)
    expect(page, '죽은 최소개수 상수가 되살아나지 않았다').not.toContain('CHIPS_MIN_PINS')
  })

  it('둘 다 없으면 빈 줄의 여백까지 접는다', () => {
    // 칩 null + (정렬은 항상 있음) 이라 실제로는 거의 안 걸리지만,
    // 이 클래스가 사라지면 미래에 정렬이 조건부가 되는 순간 빈 줄이 남는다.
    expect(page).toMatch(/flex items-center gap-2 empty:hidden/)
  })
})

describe('⑤ PC(lg+) — 같은 말을 두 번 하지 않는다', () => {
  // 🖥️ 2026-09-28 (대표 *"PC로는 어떻게 보이는거지??"* → *"둘 다 고치고 머지해줘"*).
  //   1440px 실측에서 나온 **PC 전용** 결함 둘. 둘 다 모바일 전용으로 만든 것이 PC 에도
  //   그대로 렌더돼 생겼다 — 유어샵 PC 는 좌측 300px 프로필 칸(a3/P1)이라 폭이 다르다.
  it('브랜드 바를 PC 에서 그리지 않는다 (전역 네비와 중복)', () => {
    // 화면 맨 위 DesktopTopNav 가 이미 `urdeal.` + 검색·찜·장바구니를 그린다.
    expect(header).toMatch(/className="lg:hidden flex items-center px-4 pt-3"/)
  })

  it('브랜드 바를 없애지는 않았다 — 모바일에는 그대로 있다', () => {
    // 이게 없으면 폰에서 유어샵이 유어딜 밖 페이지처럼 보인다(a3 확정안의 ①).
    // 🩸 2026-09-30 재조준: 종전 앵커는 `t('nav.myVouchers'`(GNB 세 개 중 하나)였는데 대표가
    //   *"검색, 찜, 내 이용권은 없어도 되고"* 로 그 셋을 뺐다. 브랜드 바의 정체는 GNB 가 아니라
    //   **홈으로 가는 로고** 하나다 — 앵커를 그것으로 옮긴다.
    expect(header).toMatch(/<Link to="\/" aria-label=/)
    expect(header, '로고는 워드마크 SSOT 로 그린다').toContain('<UrDealLogo')
  })

  /**
   * 🩸 2026-09-30 신설 (대표 *"유어딜 로고 좌측 상단에 있는거 왜 제대로 적용이 안됐지?
   *   검색, 찜, 내 이용권은 없어도 되고"*).
   *
   *   ⓐ **로고가 로고가 아니었다.** `urdeal` 을 텍스트로 적어 놔서 라이브 실측이
   *      `font: Pretendard`(Poppins 아님) · 브랜드 원 마침표 `false` 였다. 폰트는 이미 로드돼
   *      있었으니(`poppinsLoaded: true`) **이 자리만 SSOT 를 안 쓴 배선 누락**이다.
   *      워드마크를 손으로 다시 적으면 자간·굵기·점이 조용히 갈린다 — 에러는 안 난다.
   *   ⓑ **GNB 세 개는 손님을 밖으로 내보낸다.** 남의 가게에서 가장 눈에 띄는 자리에 유어딜로
   *      나가는 링크 셋이 있었고, 같은 목적지는 하단 탭이 이미 담고 있다.
   */
  it('🔴 로고는 워드마크 SSOT 이고, GNB 세 개는 돌아오지 않았다', () => {
    expect(header, '텍스트로 다시 적지 않는다').not.toMatch(/>\s*urdeal\s*</)
    for (const k of ['nav.search', 'nav.wishlist', 'nav.myVouchers']) {
      expect(header, `${k} 링크가 브랜드 바로 돌아왔다`).not.toContain(k)
    }
  })

  /**
   * 🩸 2026-09-29 (대표 *"배고프다 뭐먹지?는 아예 빼기"*) — 이 자리에 있던 두 시험은
   *   **마퀴가 PC 에서 안 흐르는가 / PC 에서 문구가 안 사라지는가** 였다. 대표가 기능을 통째로
   *   없앴으니 그 전제가 사라졌다. 커버리지를 지우는 대신 **불변식을 뒤집어** 재조준한다 —
   *   지켜야 할 것이 "PC 에서 잘 흐르는가" 에서 "다시 살아나지 않는가" 로 바뀌었을 뿐이다.
   *
   *   왜 뺐나(라이브 실측): 맨 위 30px 풀블리드 띠였고 그 색이 **순수 검정 `#000000`** 이었다.
   *   우리 다크 바탕은 `#11141C` 라 팔레트 밖 값이고, 같은 문구가 세 번 반복해 흐르는 모양이라
   *   첫인상을 그 띠가 전부 먹었다.
   */
  it('🔴 흐르는 문구(마퀴)가 헤더에 없다 — 조용히 되살아나지 않게', () => {
    expect(header, 'HeaderMarquee 부품 미참조').not.toContain('HeaderMarquee')
    expect(header, '마퀴 애니메이션 미사용').not.toContain('animate-marquee')
    expect(header, '헤더가 headline 을 그리지 않는다').not.toMatch(/\{\s*curator\.headline/)
  })

  it('🔴 표시 자리가 없으면 편집 칸도 없다 — 아무도 못 보는 값을 입력시키지 않는다', () => {
    // 이 레포가 반복해 당한 "조용한 부재": 표시를 지우고 편집만 남기면 주인이 계속 쓰는데
    // 어디에도 안 뜬다. 에러도 안 나서 아무도 모른다.
    expect(manage.length, '측정이 비어 있지 않다').toBeGreaterThan(1000)
    expect(manage, "'흐르는 문구' 편집 행 0개").not.toContain('흐르는 문구')
    expect(manage, 'headline 편집 상태 0개').not.toContain('headlineVal')
  })
})
