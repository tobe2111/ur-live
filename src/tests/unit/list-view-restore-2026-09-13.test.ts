/**
 * 🔙 목록 → 상세 → 뒤로 에서 목록이 처음부터 다시 로드되지 않는다 (2026-09-13 신설)
 *
 * 대표: *"교환권 페이지에서 교환권 상세페이지 들어갔다가 나오면 다시 새로고침됨.
 * 이전에 위치한 페이지 위치가 아님."*
 *
 * ## 무엇을 지키나
 * `App.tsx` 가 경로마다 페이지를 리마운트하므로 목록이 `useState` 에 들고 있던 것이 전부
 * 사라진다. 그래서 지키는 것은 "복원 코드가 있다"가 아니라 **"복원한 것을 마운트 직후의
 * 리셋 코드가 도로 지우지 않는다"** 이다. 실제로 그 리셋이 셋이나 있었다:
 *   ① 마운트 재fetch  ② `embedVisible` cap 리셋 effect  ③ ShoppingGrid 의 리셋 로드
 * 하나라도 안 막으면 목록이 도로 짧아지고, **그러면 스크롤 복원도 같이 깨진다**
 * (`ScrollToTop` 은 문서가 그만큼 길지 않으면 갈 수 있는 데까지만 간다).
 *
 * ## 실측 (430px · 로컬 앱 + 라이브 데이터, 브라우저 하네스)
 *   수정 전: 행 24 → 8 · 문서높이 3186 → 1454 · 맨 위 상품 바뀜 · 복귀 직후 전체화면 로더
 *   수정 후: 행 24 → 24 · 3186 → 3186 · 같은 상품이 맨 위 · 로더 0프레임
 *   되돌려-검증: `readListView` 조회 한 줄만 무력화 → 위 4개 전부 빨간불(귀속 확인).
 *
 * ## 이 테스트가 **못 막는 것**(정직하게)
 * - 실제 렌더 순서. 소스가 맞아도 훅 순서가 바뀌면 깨진다 — 최종 판정은 브라우저 실측이다.
 * - 스크롤 offset 자체. 이 테스트는 **높이를 되돌리는 배선**만 본다(복원은 ScrollToTop 담당,
 *   그쪽은 `scroll-restoration.test.ts`). 실측상 잔차 10px 은 상단 슬래브 접힘분이고
 *   화면 맨 위 상품은 같다.
 * - `/map`·`/browse` 등 다른 목록 화면. 같은 클래스지만 이번 범위 밖이다.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { saveListView, readListView, dropListView } from '../../lib/list-view-cache'
// 🩸 2026-09-13: 처음엔 자체 정규식으로 주석을 지웠다가 `check-comment-stripper` 에 걸렸다.
//   정당한 지적이다 — `/\*…\*/` 판은 문자열 안의 `/*` 하나에 소스 절반이 증발하고, 그러면
//   not.toContain 류 단언이 **무조건 통과**한다(이 레포가 실제로 밟은 지뢰). 공용 SSOT 를 쓴다.
import { stripComments as strip } from '../helpers/source-text'

const read = (p: string) => readFileSync(resolve(__dirname, '../../..', p), 'utf-8')

const PAGE = 'src/pages/VouchersPage.tsx'
const code = strip(read(PAGE))
// 쇼핑 섹션은 2026-09-13 에 자기 파일로 분리됐다(파일크기 래칫) — 같은 불변식을 그쪽에서 본다.
const shopCode = strip(read('src/pages/vouchers/ShoppingGrid.tsx'))

const BROWSE = strip(read('src/pages/BrowsePage.tsx'))
// 🗺️ 2026-09-14: 복원 배선은 파일크기 래칫 때문에 `browse/list-restore.ts` 로 **이동**했다.
//   이 줄을 안 옮기면 테스트가 옛 파일을 보고 조용히 빨간불이 된다(이번에 실제로 그랬다).
const BROWSE_RESTORE = strip(read('src/pages/browse/list-restore.ts'))
/** `/map` 과 유어샵은 **이미** 자기 복원 장치를 갖고 있다(2026-09-14 실측). 그 장치를 고정한다. */
const MAP_HOOK = strip(read('src/hooks/queries/useMapProducts.ts'))
const CURATOR = strip(read('src/pages/CuratorPage.tsx'))

describe('보관함(list-view-cache) 자체가 계약대로 동작한다', () => {
  it('저장한 것을 그대로 돌려준다', () => {
    dropListView('t:1')
    saveListView('t:1', { rows: [1, 2, 3] })
    expect(readListView<{ rows: number[] }>('t:1')?.rows).toEqual([1, 2, 3])
  })

  it('없는 키는 null — 새로고침(새 문서)은 빈 보관함에서 시작한다', () => {
    expect(readListView('t:없음')).toBeNull()
  })

  it('오래된 것은 버린다(TTL)', () => {
    saveListView('t:old', 'x')
    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 31 * 60_000)
    expect(readListView('t:old'), 'TTL 이 지났는데도 살아 있다').toBeNull()
    spy.mockRestore()
  })

  it('개수를 제한한다 — 오래된 것부터 버린다', () => {
    for (let i = 0; i < 20; i++) saveListView(`t:cap${i}`, i)
    expect(readListView('t:cap0'), '가장 오래된 항목이 안 버려졌다').toBeNull()
    expect(readListView('t:cap19')).toBe(19)
  })
})

describe('교환권 목록 — 뒤로 왔을 때 되살린다', () => {
  it('복원은 **POP 일 때만** — 하단바로 새로 들어오면(PUSH) 맨 위·첫 페이지', () => {
    expect(code, 'POP 조건 없이 복원하면 새로 들어온 사람에게 옛 목록을 보여 준다')
      .toMatch(/navType === 'POP' \? readListView<VouchersViewState>\(viewKey\) : null/)
  })

  it('키에 필터가 들어간다 — 다른 카테고리/브랜드/정렬의 목록이 섞이면 안 된다', () => {
    const m = code.match(/const viewKey = `vouchers:list:[^`]*`/)
    expect(m, 'viewKey 선언이 사라졌다').toBeTruthy()
    for (const part of ['category', 'brand', 'sort']) {
      expect(m![0], `viewKey 에 ${part} 가 빠졌다`).toContain(part)
    }
  })

  it('첫 렌더에 **동기** 복원한다 — effect 로 미루면 그 프레임의 짧은 문서에 스크롤이 잘린다', () => {
    expect(code).toMatch(/useState<VoucherProduct\[\]>\(\(\) => restored\?\.products \?\? ssrSeedRef\.current \?\? \[\]\)/)
    expect(code).toMatch(/useState\(\(\) => restored\?\.page \?\? 1\)/)
    expect(code, '복원했는데 로더가 뜨면 "새로고침됨" 증상 그대로다')
      .toMatch(/useState\(\(\) => restored == null && ssrSeedRef\.current == null\)/)
  })

  it("'더보기'로 편 개수(embedVisible)까지 되살린다 — 이게 곧 문서 높이다", () => {
    expect(code).toMatch(/useState\(\(\) => restored\?\.embedVisible \?\? EMBED_INITIAL\)/)
  })

  it('마운트 재fetch 가 복원본을 1페이지로 잘라내지 않는다', () => {
    expect(code, '복원본을 재fetch 하면 응답이 1페이지뿐이라 목록이 도로 20개로 잘린다')
      .toMatch(/if \(restored != null \|\| ssrSeedRef\.current != null\) return/)
  })

  it('cap 리셋 effect 가 복원 직후 첫 실행을 건너뛴다', () => {
    expect(code).toMatch(/embedResetSkipRef = useRef\(restored != null\)/)
    expect(code).toMatch(/if \(embedResetSkipRef\.current\) \{ embedResetSkipRef\.current = false; return \}/)
  })

  it('필터가 바뀌는 중(옛 상품이 떠 있는 동안)에는 보관하지 않는다', () => {
    expect(code, '스탬프 검사가 없으면 새 키에 옛 카테고리 목록이 들어간다')
      .toMatch(/productsKeyRef\.current !== viewKey\) return/)
  })

  it('보관 effect 는 embedVisible **선언 뒤**에 있다 (TDZ = 빈 화면)', () => {
    // 2026-09-13 실측: 위에 두었더니 의존성 배열이 렌더 중 평가되며 TDZ 로 페이지가 통째로 비었다.
    const decl = code.indexOf('const [embedVisible, setEmbedVisible] = useState')
    const save = code.indexOf('saveListView<VouchersViewState>')
    expect(decl, 'embedVisible 선언을 못 찾았다').toBeGreaterThan(-1)
    expect(save, '보관 호출을 못 찾았다').toBeGreaterThan(-1)
    expect(save, '보관 effect 가 embedVisible 선언보다 앞에 있다 — TDZ 로 빈 화면이 된다').toBeGreaterThan(decl)
  })
})

/**
 * ⚠️ 이 블록은 **소스 배선만** 고정한다(렌더 경로가 조건부라 브라우저 실측 대상이 아니다).
 *   배선이 눈에 안 보이는 만큼 조용히 빠지기 쉬워서, 사라지면 빨간불이 되게 박아 둔다.
 */
describe('교환권 아래로 이어지는 목록도 같이 되살린다', () => {
  it('POP 일 때만 복원한다', () => {
    expect(shopCode).toMatch(/navType === 'POP' \? readListView<ShopViewState>\('vouchers:shop'\) : null/)
  })

  it('복원 시 관찰 게이트를 열어 둔다 — 안 열면 더 못 불러온다', () => {
    expect(shopCode).toMatch(/useState\(\(\) => shopRestored != null\)/)
  })

  it('리셋 로드가 복원 직후 첫 실행을 건너뛴다', () => {
    expect(shopCode).toMatch(/shopSkipFirstLoadRef = useRef\(shopRestored != null\)/)
    expect(shopCode).toMatch(/if \(shopSkipFirstLoadRef\.current\) \{ shopSkipFirstLoadRef\.current = false; return \}/)
  })
})

/**
 * 🔙 2026-09-14 (대표 "모두 고쳐") — 나머지 목록 화면.
 *
 * ⚠️ **넷 중 둘은 이미 정상이었다.** `useState` 선언만 보고 "같은 버그"라고 단정했다가 실측에서
 *   뒤집혔다(브라우저, 430px, 라이브 데이터):
 *     /map   행 40→40 · 시트스크롤 1200→1200 · 맨 위 행 동일 — 캐시 TTL(2분)을 넘겨도 통과
 *     유어샵  카드 3→3 · 문서 1068→1068 · 스크롤 208→208 · 맨 위 상품 동일
 *   그래서 아래 두 번째 블록은 그 둘을 **고치는** 것이 아니라 **이미 있는 장치가 사라지지 않게** 잠근다.
 */
describe('/browse — 뒤로 왔을 때 되살린다', () => {
  it('복원은 POP 일 때만', () => {
    expect(BROWSE_RESTORE).toMatch(/navType === 'POP' \? readListView<BrowseViewState>\(keyRef\.current\) : null/)
    expect(BROWSE, '페이지가 그 훅을 실제로 부르는지').toMatch(/useBrowseRestore\(defaultCategory\)/)
  })

  it('복원 키와 보관 키가 같은 함수에서 나온다 (갈리면 조용히 안 살아난다)', () => {
    expect(BROWSE_RESTORE, 'browseViewKey SSOT 가 사라졌다').toMatch(/export const browseViewKey = \(cat: string, sort: string\) =>/)
    // 복원 키는 모듈 안에서, 보관 키는 페이지에서 — 둘 다 같은 SSOT 를 부른다.
    expect(BROWSE_RESTORE, '복원이 SSOT 를 안 쓰면 키가 갈린다').toMatch(/keyRef\.current = browseViewKey\(/)
    expect(BROWSE, '보관이 SSOT 를 안 쓰면 키가 갈린다').toMatch(/saveListView<BrowseViewState>\(browseViewKey\(/)
  })

  it('첫 렌더에 동기 복원한다 — 복원본이 SSR 시드보다 우선', () => {
    expect(BROWSE).toMatch(/useState<Product\[\]>\(restored\?\.products \?\? initialSeed \?\? \[\]\)/)
    expect(BROWSE_RESTORE, 'effect 로 미루면 그 프레임의 짧은 문서에 스크롤이 잘린다')
      .toMatch(/restoredRef\.current === undefined/)
    expect(BROWSE).toMatch(/useState\(restored == null && initialSeed == null\)/)
  })

  it('무한스크롤로 편 만큼(showCount·page·hasMore)까지 되살린다 — 이게 곧 문서 높이다', () => {
    expect(BROWSE).toMatch(/useState\(\(\) => restored\?\.showCount \?\? ITEMS_PER_PAGE\)/)
    expect(BROWSE).toMatch(/useState\(\(\) => restored\?\.page \?\? 1\)/)
    expect(BROWSE).toMatch(/useState\(\(\) => restored\?\.hasMore \?\? false\)/)
  })

  it('마운트 리셋(setProducts([]))이 복원본을 지우지 않는다', () => {
    expect(BROWSE).toMatch(/browseSkipFirstRef = useRef\(restored != null\)/)
    expect(BROWSE).toMatch(/if \(browseSkipFirstRef\.current\) \{ browseSkipFirstRef\.current = false; return \}/)
  })

  it('기본 가격대에서만 보관한다 (priceRange 는 URL 에 없어 마운트마다 all 로 돌아간다)', () => {
    expect(BROWSE).toMatch(/priceRange !== 'all'\) return/)
  })
})

describe('/map · 유어샵 — 이미 있는 복원 장치를 잠근다 (2026-09-14 실측 통과)', () => {
  it('/map: 모듈 캐시를 첫 렌더에 동기 소비한다', () => {
    expect(MAP_HOOK, 'seedOf 동기 소비가 사라지면 뒤로가기가 1페이지로 무너진다')
      .toMatch(/useState<Entry>\(\(\) => seedOf\(cacheKey\)/)
    expect(MAP_HOOK).toMatch(/useState<boolean>\(\(\) => !seedOf\(cacheKey\)\)/)
    expect(MAP_HOOK, '캐시에 쓰는 곳이 사라지면 seedOf 가 늘 null 이다').toMatch(/_cache\.set\(/)
  })

  it('/map: 시트 목록이 스크롤 복원 대상으로 등재돼 있다', () => {
    const page = strip(read('src/pages/RestaurantMapPage.tsx'))
    expect(page, 'data-scroll-restore 가 빠지면 ScrollToTop 이 시트를 못 되돌린다')
      .toMatch(/data-scroll-restore=["'{]/)
  })

  it('유어샵: 메모리 캐시를 첫 렌더에 동기 소비한다', () => {
    expect(CURATOR).toMatch(/useState<CuratorPageResponse \| null>\(\(\) => \{/)
    expect(CURATOR, 'getCuratorCache 소비가 사라지면 재진입마다 cold fetch 다')
      .toMatch(/return getCuratorCache\(handle\)/)
  })
})
