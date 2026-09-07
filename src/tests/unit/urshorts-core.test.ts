import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseYouTubeUrl, parseYouTubeVideoId, parseIsoDurationSec, youTubeEmbedUrl, youTubeThumbUrl,
  URSHORTS_CARD_W, URSHORTS_CARD_H, URSHORTS_RAIL_LIMIT, URSHORTS_VIEWER_PATH,
  URSHORTS_MAX_DURATION_SEC,
} from '@/shared/urshorts'

/**
 * 🎬 유어쇼츠 (2026-09-07 대표 확정)
 *
 * 이 파일이 지키는 것 넷. 넷 다 **깨져도 에러가 안 나는** 종류라 테스트가 유일한 방어선이다.
 *  ① 쇼츠만 들어온다 — 가로 영상이 9:16 카드에 들어가면 검은 띠가 생길 뿐 에러는 없다.
 *  ② 이용권이 안 붙은 영상은 홈에 못 나간다 — LEFT JOIN 으로 바뀌면 조용히 새어 나온다.
 *  ③ 홈 첫 화면이 비용을 안 문다 — 마운트 fetch 로 되돌아가도 화면은 똑같아 보인다.
 *  ④ 재생기는 하나만 — 열 개가 살아 있어도 느려질 뿐 에러는 없다.
 *
 * ## 이 테스트가 못 보는 것
 * 실제 유튜브 응답(이 환경은 유튜브 도메인이 막혀 있다) · 브라우저에서의 실제 렌더 ·
 * 어드민이 실제로 쇼츠를 구분해 넣는지(사람 몫).
 */

const code = (p: string) =>
  readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 쇼츠만 받는다', () => {
  it('/shorts/ 주소는 그 자체로 쇼츠임을 증명한다 (비용 0)', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/shorts/aBcDeFgHiJk'))
      .toEqual({ id: 'aBcDeFgHiJk', form: 'shorts' })
  })

  it('watch?v= 는 쇼츠라고 단정하지 않는다 — 길이를 따로 봐야 한다', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=aBcDeFgHiJk')?.form).toBe('watch')
    expect(parseYouTubeUrl('https://youtu.be/aBcDeFgHiJk')?.form).toBe('watch')
  })

  it('유튜브가 아닌 주소·모양이 틀린 id 는 거부한다 (추측해서 저장하지 않는다)', () => {
    expect(parseYouTubeUrl('https://vimeo.com/12345')).toBeNull()
    expect(parseYouTubeUrl('https://www.youtube.com/shorts/tooshort')).toBeNull()
    expect(parseYouTubeUrl('')).toBeNull()
    expect(parseYouTubeUrl(null)).toBeNull()
  })

  it('id 만 필요한 호출부를 위한 얇은 래퍼가 같은 값을 준다', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/shorts/aBcDeFgHiJk')).toBe('aBcDeFgHiJk')
  })

  it('재생시간을 초로 읽는다 — 못 읽으면 null(모르면 통과시키지 않는다)', () => {
    expect(parseIsoDurationSec('PT58S')).toBe(58)
    expect(parseIsoDurationSec('PT2M30S')).toBe(150)
    expect(parseIsoDurationSec('PT1H2M3S')).toBe(3723)
    expect(parseIsoDurationSec('garbage')).toBeNull()
    expect(parseIsoDurationSec(null)).toBeNull()
  })

  it('쇼츠 상한은 3분 — 유튜브가 2024-10 에 60초에서 늘렸다', () => {
    expect(URSHORTS_MAX_DURATION_SEC).toBe(180)
  })

  const R = code('src/features/urshorts/api/urshorts.routes.ts')

  it('서버가 주소 모양과 길이 둘 다로 거른다', () => {
    expect(R).toMatch(/form === 'shorts'/)
    // 🩸 이름만 찾으면 **import 줄**에 걸려 늘 통과한다. 실제 비교식을 앵커로.
    expect(R).toMatch(/sec > URSHORTS_MAX_DURATION_SEC/)
  })

  it('확인이 안 되면 통과시키지 않는다 (키 부재·호출 실패 모두 거부)', () => {
    // `verifyIsShort` 안에서 키가 없으면 ok:false 로 끝나야 한다.
    const fn = R.slice(R.indexOf('async function verifyIsShort'), R.indexOf('adminUrshortsRoutes.post'))
    expect(fn).toMatch(/if \(!key\)[\s\S]{0,120}ok: false/)
    expect(fn).toMatch(/catch \{[\s\S]{0,120}ok: false/)
  })

  it('길이 확인은 videos.list 다 — search(100 units)를 쓰면 안 된다', () => {
    expect(R).toContain('youtube/v3/videos?part=contentDetails')
    expect(R).not.toContain('youtube/v3/search')
  })
})

describe('② 이용권이 안 붙은 영상은 홈에 못 나간다', () => {
  const R = code('src/features/urshorts/api/urshorts.routes.ts')

  it('공개 쿼리가 products 와 INNER JOIN 이다', () => {
    const sql = R.slice(R.indexOf('const PUBLIC_SQL'), R.indexOf('urshortsRoutes.get'))
    expect(sql).toMatch(/JOIN products p ON p\.id = s\.product_id/)
    expect(sql).not.toMatch(/LEFT JOIN products/)
  })

  it('내려간 상품의 영상도 같이 사라진다', () => {
    const sql = R.slice(R.indexOf('const PUBLIC_SQL'), R.indexOf('urshortsRoutes.get'))
    expect(sql).toMatch(/p\.is_active = 1/)
    expect(sql).toMatch(/s\.is_active = 1/)
  })

  it('어드민 목록만 LEFT JOIN 이다 — 미연결 영상을 보여 줘야 고칠 수 있다', () => {
    const adm = R.slice(R.indexOf("adminUrshortsRoutes.get('/'"), R.indexOf("adminUrshortsRoutes.post"))
    expect(adm).toMatch(/LEFT JOIN products/)
  })
})

describe('③ 홈 첫 화면이 비용을 안 문다', () => {
  const RAIL = code('src/components/home/UrShortsRail.tsx')

  it('데이터를 다가올 때만 부른다 — 마운트 fetch 는 홈 전체에 요청을 하나 더 얹는다', () => {
    // fetch 가 `near` 게이트 뒤에 있어야 한다.
    const eff = RAIL.slice(RAIL.indexOf('if (!near) return'), RAIL.indexOf('const sync'))
    expect(eff).toContain("fetch('/api/urshorts')")
  })

  it('썸네일도 같은 신호를 쓴다', () => {
    expect(RAIL).toMatch(/load=\{near\}/)
    expect(RAIL).toMatch(/IntersectionObserver/)
  })

  it('영상이 없으면 섹션을 안 그린다 (빈 줄을 남기지 않는다)', () => {
    expect(RAIL).toMatch(/items\.length === 0/)
  })

  it('할인 빨강을 새로 발명하지 않는다 — 시스템 --sale 값(다크 표면)을 쓴다', () => {
    // 🩸 처음에 #FF8A93 이라는 넷째 빨강을 만들었다. 같은 날 아침에 할인율을 --sale 하나로
    //    통일해 놓고서다. 사진 위 스크림은 테마와 무관하게 늘 어두워 라이트 값(#DC2626)이 안 읽히므로
    //    **다크 표면용 --sale 값**을 그대로 쓴다.
    expect(RAIL).toContain('#FF5C69')
    expect(RAIL).not.toContain('#FF8A93')
    const css = readFileSync('src/index.css', 'utf8')
    expect(css, '다크 --sale 값이 바뀌면 이 카드도 함께 바꿀 것').toMatch(/--sale:\s*#FF5C69/)
  })

  it('레일에서는 iframe 을 만들지 않는다 — 재생기는 뷰어에서만 산다', () => {
    expect(RAIL).not.toContain('<iframe')
  })

  it('뷰어는 lazy 라우트다 — 홈 번들이 유튜브 재생 코드를 받으면 안 된다', () => {
    const APP = code('src/App.tsx')
    expect(APP).toMatch(/const VideosPage = lazy\(\(\) => import\('\.\/pages\/VideosPage'\)\)/)
    expect(APP).toMatch(/path="\/videos"/)
  })
})

describe('④ 재생기는 항상 하나만', () => {
  const V = code('src/pages/VideosPage.tsx')

  it('iframe 이 정확히 하나이고 key 가 video_id 다 (넘기면 이전 것이 파기된다)', () => {
    expect((V.match(/<iframe/g) ?? []).length).toBe(1)
    // 🩸 `/key=\{cur\.video_id\}/` 로 쓰면 주입본 `data-key={cur.video_id}` 도 매치된다
    //    (부분문자열이라). 앞의 공백을 요구해 속성 이름 자체를 앵커로 삼는다.
    expect(V).toMatch(/\skey=\{cur\.video_id\}/)
  })

  it('목록은 열 때 한 번만 받는다 — 넘길 때마다 부르면 D1 읽기가 스와이프 수만큼 는다', () => {
    expect((V.match(/fetch\('\/api\/urshorts/g) ?? []).length).toBe(1)
  })

  it('구매 바가 영상 위에 항상 있다 (끝나기를 기다리면 늦다)', () => {
    expect(V).toMatch(/absolute inset-x-2\.5 bottom-2\.5/)
    expect(V).toMatch(/to=\{`\/group-buy\/\$\{cur\.product_id\}`\}/)
  })

  it('embed 는 nocookie · playsinline · rel=0 이다', () => {
    const u = youTubeEmbedUrl('aBcDeFgHiJk', { autoplay: true })
    expect(u).toContain('youtube-nocookie.com/embed/aBcDeFgHiJk')
    expect(u).toContain('playsinline=1')
    expect(u).toContain('rel=0')
    expect(u).toContain('autoplay=1')
    expect(youTubeEmbedUrl('aBcDeFgHiJk')).not.toContain('autoplay=1')
  })
})

describe('대표가 확정한 값', () => {
  it('카드 125×222 고정 · 레일 12편 · 뷰어는 /videos', () => {
    expect(URSHORTS_CARD_W).toBe(125)
    expect(URSHORTS_CARD_H).toBe(222)
    expect(URSHORTS_RAIL_LIMIT).toBe(12)
    expect(URSHORTS_VIEWER_PATH).toBe('/videos')
  })

  it('레일 높이가 딜 카드(299px)보다 낮다 — 영상이 딜을 밀어내면 안 된다', () => {
    expect(URSHORTS_CARD_H).toBeLessThan(299)
  })

  it('자리는 인기 이용권(첫 섹션) 다음이고 배너보다 앞이다', () => {
    const H = code('src/components/home/HomeSections.tsx')
    const rail = H.indexOf('{sIdx === 0 && shortsRail}')
    const banner = H.indexOf('{sIdx === 0 && midBanner}')
    expect(rail).toBeGreaterThan(-1)
    expect(banner).toBeGreaterThan(rail)
  })

  it('썸네일은 유튜브 것을 쓴다 (cf-image 허용 목록에 이미 있다)', () => {
    expect(youTubeThumbUrl('aBcDeFgHiJk')).toBe('https://img.youtube.com/vi/aBcDeFgHiJk/hqdefault.jpg')
  })
})

describe('어드민 화면', () => {
  const A = code('src/pages/AdminUrShortsPage.tsx')

  it('라우트와 메뉴에 둘 다 등록돼 있다 (한쪽만 있으면 못 들어가거나 안 보인다)', () => {
    expect(code('src/routes/admin.routes.tsx')).toMatch(/path="\/admin\/urshorts"/)
    expect(code('src/components/admin/admin-nav-config.ts')).toMatch(/'\/admin\/urshorts'/)
  })

  it('붙여 넣는 즉시 쇼츠인지 알려 준다 (서버까지 갔다 거부당하는 왕복을 줄인다)', () => {
    expect(A).toContain('parseYouTubeUrl(url)')
    expect(A).toMatch(/form === 'shorts'/)
  })

  it('이용권을 안 고른 영상이 눈에 띈다 — 그게 이 화면의 할 일이다', () => {
    expect(A).toContain('이용권을 고르세요')
    expect(A).toMatch(/rows\.filter\(\(r\) => !r\.product_id\)/)
  })

  it('서버 거부 사유를 그대로 보여 준다 (일반 문구로 덮지 않는다)', () => {
    expect(A).toMatch(/response\?\.data\?\.error/)
  })
})

describe('셀러 입력칸 — 소유권이 전부다', () => {
  const R = code('src/features/urshorts/api/urshorts.routes.ts')
  const seller = R.slice(R.indexOf('sellerUrshortsRoutes.get'))

  it('추가할 때 그 상품이 정말 그 셀러 것인지 서버가 확인한다 (IDOR 차단)', () => {
    // 화면이 보낸 product_id 를 믿으면 남의 상품에 영상을 걸 수 있다.
    expect(seller).toMatch(/FROM products WHERE id = \? AND seller_id = \?/)
    expect(seller).toMatch(/내 이용권이 아닙니다/)
  })

  it('삭제도 자기 상품에 붙은 것만 지운다', () => {
    const del = seller.slice(seller.indexOf("sellerUrshortsRoutes.delete"))
    expect(del).toMatch(/product_id IN \(SELECT id FROM products WHERE seller_id = \?\)/)
  })

  it('목록도 자기 상품 것만 (남의 쇼츠가 보이면 안 된다)', () => {
    const list = seller.slice(0, seller.indexOf("sellerUrshortsRoutes.post"))
    expect(list).toMatch(/WHERE p\.seller_id = \?/)
  })

  it('셀러 경로도 쇼츠만 받는다 (어드민과 같은 검사를 쓴다)', () => {
    expect(seller).toContain('verifyIsShort(c.env, parsed.id, parsed.form)')
  })

  it('세 경로 전부 requireSeller 뒤에 있다', () => {
    expect((seller.match(/requireSeller\(\)/g) ?? []).length).toBe(3)
  })

  it('화면은 저장 전 상품에서는 안 뜬다 (붙일 곳이 없다)', () => {
    const F = code('src/pages/seller-product-edit/ProductShortsField.tsx')
    expect(F).toMatch(/if \(!productId\) return null/)
  })
})

/**
 * 🤝 2026-09-07 대표 판단 — *"남의 영상을 우리 구매 버튼 옆에 두는게 좋을까?"*
 *
 * 답: **허락 없이는 두지 않는다.** 이유 셋.
 *  ① 유어애즈가 바로 그 식당 채널 4,825명에게 제휴 제안을 보낼 참인데, 자기 영상이 이미 우리
 *     판매에 쓰이는 걸 보면 그 제안이 열리기도 전에 죽는다 — 만들려는 관계를 태우는 셈이다.
 *  ② 영상 옆에 "지금 구매"가 붙으면 그 창작자가 이 딜을 보증한 것으로 읽히는데 그는 그런 적이 없다.
 *  ③ 얻는 건 레일이 좀 더 차는 것이고, 잃는 건 창작자 한 명의 공개 항의다. 비대칭이 심하다.
 *
 * ⇒ 홈에 나가는 영상은 (a) 우리 것 (b) 매장 것 (c) 창작자가 명시로 허락한 것, 셋 중 하나.
 *   이 규칙을 **문서가 아니라 구조로** 만든다 — 나중에 자동수집이 붙어도 못 샌다.
 */
describe('허락받은 영상만 홈에 나간다', () => {
  const R = code('src/features/urshorts/api/urshorts.routes.ts')

  it('공개 쿼리가 consent = 1 을 요구한다 (이게 규칙의 전부다)', () => {
    const sql = R.slice(R.indexOf('const PUBLIC_SQL'), R.indexOf('urshortsRoutes.get'))
    expect(sql).toMatch(/AND s\.consent = 1/)
  })

  it('기본값은 0 이다 — 모르면 안 내보낸다', () => {
    expect(R).toMatch(/consent INTEGER NOT NULL DEFAULT 0/)
    // 기존 테이블에도 붙는다(이미 있으면 무해).
    expect(R).toMatch(/ALTER TABLE home_shorts ADD COLUMN consent/)
  })

  it('셀러는 확인란을 체크해야 등록된다 (안 하면 400)', () => {
    const seller = R.slice(R.indexOf('sellerUrshortsRoutes.post'))
    expect(seller).toMatch(/if \(!body\?\.consent\)/)
    expect(seller).toMatch(/허락받았는지 확인해 주세요/)
  })

  it('어드민은 확인란 값을 그대로 저장하고 나중에 토글할 수 있다', () => {
    expect(R).toMatch(/body\?\.consent \? 1 : 0/)
    expect(R).toMatch(/if \('consent' in b\)/)
  })

  it('두 화면 모두 확인란을 보여 준다 (서버만 막으면 사람은 이유를 모른다)', () => {
    for (const p of ['src/pages/AdminUrShortsPage.tsx',
                     'src/pages/seller-product-edit/ProductShortsField.tsx']) {
      const F = code(p)
      expect(F, p).toMatch(/type="checkbox"/)
      expect(F, p).toMatch(/허락받았습니다/)
    }
  })

  it('repair-schema 테이블 정의에도 있다 (라우트만 있으면 새 DB 에서 갈린다)', () => {
    expect(code('src/worker/routes/repair-schema.routes.ts'))
      .toMatch(/consent INTEGER NOT NULL DEFAULT 0/)
  })
})
