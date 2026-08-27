import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 🖼️ 딜 카드/상세 갤러리 불변식 — 2026-08-19 (대표 시안: 그루폰).
 *
 * 여기서 고정하는 것은 **배선과 안전장치**다. 픽셀이 아니라 "그 조건이 코드에 실제로 있는가".
 * 이 세 가지가 빠지면 각각 조용한 사고가 된다:
 *   ① 화살표가 `preventDefault`/`stopPropagation` 을 안 하면 — 사진을 넘기려던 클릭이 **상세로 튄다**
 *      (캐러셀이 `<Link>` 안에 있기 때문. 눌러 보기 전엔 아무도 모른다)
 *   ② 갤러리를 전부 미리 `<img>` 로 만들면 — 카드 50개 × 4장이라 **첫 화면 트래픽이 몇 배**가 된다
 *      (로딩 최적화 잠금이 지키려는 바로 그 값)
 *   ③ 서버가 안 자르면 — 같은 이유로 **응답 페이로드**가 몇 배가 된다(SSR 0-RTT 페이로드 포함)
 *
 * ## 못 막는 것
 * 실제 렌더/클릭 동작(JSDOM 상호작용 테스트가 아니다)과 라이브 응답 크기. 그건 배포 후 실측 몫.
 */

const root = process.cwd()
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
/** 주석을 걷어낸 소스 — "주석에만 남아도 통과"를 막는다. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('카드 hover 캐러셀 (DealCardMedia)', () => {
  const media = code('src/components/deal/DealCardMedia.tsx')

  it('🔴 화살표 클릭이 상세 페이지로 튀지 않는다 (Link 안이라 필수)', () => {
    const go = media.slice(media.indexOf('const go ='), media.indexOf('const multi ='))
    expect(go).toMatch(/e\.preventDefault\(\)/)
    expect(go).toMatch(/e\.stopPropagation\(\)/)
  })

  /**
   * 👆 손가락 스와이프 (2026-08-27 대표 지시 — "이용권 이미지 썸네일 좌우로 스와이프 되어져야 해").
   *
   * ①과 **같은 사고**의 터치판이다: 터치를 떼면 브라우저가 클릭을 합성하는데, 카드가 `<Link>` 안이라
   * 그 클릭이 그대로 상세로 간다 → **사진을 넘길 때마다 페이지가 이동**한다. 그래서 넘겼다는 사실을
   * 기억해 두고 capture 단계에서 클릭을 취소한다. 그 배선이 이 테스트가 지키는 값이다.
   *
   * ## 못 막는 것
   * 실제 제스처(JSDOM 터치 시뮬레이션이 아니다)와 임계값이 손에 맞는지. 그건 실기기 몫.
   */
  it('🔴 스와이프로 넘긴 뒤의 클릭이 상세로 튀지 않는다', () => {
    const cancel = media.slice(media.indexOf('const onClickCaptureMedia ='), media.indexOf('return ('))
    expect(cancel).toMatch(/if\s*\(!didSwipe\.current\)\s*return/)
    expect(cancel).toMatch(/e\.preventDefault\(\)/)
    expect(cancel).toMatch(/e\.stopPropagation\(\)/)
    // 취소는 capture 단계여야 한다 — bubble 로 달면 <Link> 가 먼저 받는다.
    expect(media).toMatch(/onClickCapture=\{onClickCaptureMedia\}/)
  })

  it('세로 스크롤을 스와이프로 오인하지 않는다 (사진 위에서 페이지가 안 내려가면 더 불편하다)', () => {
    // 가로 이동이 임계 이상 + 세로보다 우세할 때만 "넘겼다"로 친다.
    expect(media).toMatch(/SWIPE_MIN_PX\s*=\s*\d+/)
    expect(media).toMatch(/Math\.abs\(dx\) >= SWIPE_MIN_PX && Math\.abs\(dx\) > Math\.abs\(dy\)/)
  })

  it('🔴 안 본 장면은 네트워크를 태우지 않는다 (첫 화면 트래픽 보호)', () => {
    // `seen` 집합에 없는 인덱스는 <img> 자체를 만들지 않는다.
    expect(media).toMatch(/if\s*\(!seen\.has\(i\)\)\s*return null/)
    // 첫 화면 초기값은 **커버(0)뿐** — 스크롤만 해서는 갤러리를 받지 않는다.
    expect(media).toMatch(/useState<Set<number>>\(\(\)\s*=>\s*new Set\(\[0\]\)\)/)
  })

  /**
   * 🕐 2026-08-19 (대표 신고 — "화면이 너무 늦게 떠 다른 사진으로 보려고 할 때").
   *
   * 트래픽 보호가 만든 체감 지연이었다: 화살표를 **누른 순간부터** 받기 시작해 빈 회색 칸이 보였다.
   * ⚠️ 고치는 방향이 "전량 프리페치"로 새면 원래 막으려던 사고(첫 화면 트래픽 5배)로 되돌아간다.
   *   그래서 **딱 한 장**이라는 것 자체를 불변식으로 고정한다.
   */
  it('hover 하면 다음 1장을 미리 받는다 (넘겼는데 빈 칸 방지)', () => {
    expect(media).toMatch(/const prefetchNext = useCallback/)
    expect(media).toMatch(/onMouseEnter=\{prefetchNext\}/)
    // 한 장만: 다음 인덱스 하나를 계산해 add 한다(반복문·전체 add 금지).
    expect(media).toMatch(/const next = list\[\(at \+ 1\) % list\.length\]/)
    expect(media).not.toMatch(/setSeen\(new Set\(slides\.map/)
  })

  it('커버는 aboveFold 계약(eager·fetchPriority)을 그대로 지킨다', () => {
    expect(media).toMatch(/loading=\{isCover && eager \? 'eager' : 'lazy'\}/)
    expect(media).toMatch(/fetchPriority=\{isCover && eager \? 'high' : 'auto'\}/)
  })

  it('사진이 1장이면 화살표·도트를 아예 그리지 않는다', () => {
    // 💀 2026-08-19: 기준이 `slides`(원본 장수) → `alive`(살아 있는 장수) 로 바뀌었다.
    //   죽은 사진을 세면 "넘길 게 있다"고 화살표를 그려 놓고 눌러도 빈 칸이 나온다.
    expect(media).toMatch(/const multi = alive\.length > 1/)
    expect(media).toMatch(/\{multi && \(/)
  })

  it('갤러리 장수에 상한이 있다 (페이로드가 무한정 늘지 않게)', () => {
    expect(media).toMatch(/MAX_SLIDES\s*=\s*\d+/)
    expect(media).toMatch(/\.slice\(0, MAX_SLIDES\)/)
  })
})

describe('홈 카드는 한 벌이다 (섹션 ↔ 피드)', () => {
  it('섹션과 피드가 같은 미디어 컴포넌트를 쓴다', () => {
    expect(code('src/pages/main-home/GroupBuyFeedCard.tsx')).toMatch(/<DealCardMedia\b/)
    expect(code('src/components/home/HomeSections.tsx')).toMatch(/<GroupBuyFeedCard\b/)
  })
})

describe('서버가 카드 갤러리를 잘라서 보낸다', () => {
  it('자르기 규칙은 SSOT 헬퍼가 갖는다 (상한 + 커버 중복 제거)', () => {
    // 🔄 2026-08-19: 인라인이던 파싱을 `card-gallery`(SSOT)로 옮겼다 — 파일 크기 래칫 때문이기도 하지만,
    //   본질은 **라우트와 cron 이 같은 규칙을 써야 한다**는 것. 검사 대상도 함께 옮긴다.
    const helper = code('src/features/group-buy/api/card-gallery.ts')
    expect(helper).toMatch(/CARD_GALLERY_MAX\s*=\s*\d+/)
    expect(helper).toMatch(/\.slice\(0, CARD_GALLERY_MAX\)/)
    expect(helper).toMatch(/u !== coverUrl/)
  })

  it('🔴 라이브 쿼리와 materialized cron 이 **같은 함수**를 쓴다', () => {
    // 한쪽만 자르면 캐시 hit 여부에 따라 페이로드가 달라진다 — 에러가 없어 아무도 모른다.
    expect(code('src/features/group-buy/api/group-buy-public.routes.ts')).toMatch(/sliceCardGallery\(/)
    expect(code('src/worker/cron/group-buy-feed-cache.ts')).toMatch(/sliceCardGallery\(/)
  })

  it('갤러리를 실을 컬럼이 SELECT 에 있다 (섹션·피드 양쪽)', () => {
    expect(code('src/features/sections/api/section-rules.ts')).toMatch(/p\.images/)
    expect(code('src/features/group-buy/api/group-buy-public.routes.ts')).toMatch(/p\.restaurant_lat, p\.restaurant_lng, p\.images/)
    expect(code('src/worker/cron/group-buy-feed-cache.ts')).toMatch(/p\.images/)
  })
})

describe('상세 갤러리 (DetailGallery)', () => {
  const gal = code('src/pages/group-buy/DetailGallery.tsx')

  it('사진이 1장이면 그루폰 2단으로 펴지 않는다 (빈 칸을 만들지 않는다)', () => {
    expect(gal).toMatch(/const multi = images\.length > 1/)
    expect(gal).toMatch(/multi \? 'grid grid-cols-/)
  })

  it('모바일은 스와이프 갤러리를 유지한다', () => {
    expect(gal).toMatch(/scrollSnapType: 'x mandatory'/)
    expect(gal).toMatch(/lg:hidden/)
  })

  it('전체 사진 모달이 키보드로도 닫히고 넘어간다', () => {
    expect(gal).toMatch(/e\.key === 'Escape'/)
    expect(gal).toMatch(/e\.key === 'ArrowRight'/)
  })

  it('모달 z-index 는 표준 SSOT 를 쓴다 (하단 네비에 가리지 않게)', () => {
    expect(gal).toMatch(/zIndex: Z\.MODAL_BODY/)
    expect(gal).not.toMatch(/z-\[\d{4,}\]/)
  })
})

/**
 * 💀 죽은 사진 자동 대체 (2026-08-19 — 대표 확정 "B로 해줘").
 *
 * 라이브에 실제로 있던 사고: 커버가 403 인데 갤러리 4장은 멀쩡한 상품(보드람치킨 id 2822).
 * `cfImageOnError` 는 [리사이저 → 원본 → 숨김] 까지만 하므로 **카드가 빈 채로** 남았다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 브라우저에서 onError 가 뜨는지. 여기서는 **배선의 존재**만
 *    고정한다(어떤 URL이 죽었는지는 런타임에만 안다). 최종 판정은 라이브에서 그 카드를 보는 것.
 */
describe('죽은 사진은 다음 사진으로 대체된다', () => {
  const media = code('src/components/deal/DealCardMedia.tsx')
  const detail = code('src/pages/group-buy/DetailGallery.tsx')

  it('카드: 원본까지 실패한 장면을 죽은 것으로 표시한다', () => {
    // cfImageOnError 가 2단계(숨김)까지 갔을 때만 죽음으로 본다 — 1단계(원본 재시도) 중엔 아니다.
    expect(media).toMatch(/cfFallback\s*===\s*'2'/)
    expect(media).toMatch(/markDead\(/)
  })

  it('카드: 보이는 장면은 죽은 칸을 건너뛴다', () => {
    // idx 를 그대로 쓰면 죽은 칸에 머물러 빈 화면이 유지된다 — shown 으로 갈아탄다.
    expect(media).toMatch(/dead\.has\(idx\)/)
    expect(media).toMatch(/i === shown/)
  })

  it('카드: 전부 죽으면 폴백(카테고리 아이콘)을 그린다', () => {
    expect(media).toMatch(/alive\.length === 0/)
  })

  it('카드: 죽음 대체가 트래픽 보호를 깨지 않는다 (여전히 본 장면만 로드)', () => {
    // 이 한 줄이 사라지면 카드 50개 × 갤러리 전량 = 첫 화면 요청 폭증.
    expect(media).toMatch(/if \(!seen\.has\(i\)\) return null/)
    // 대체본은 **보이던 장면이 죽었을 때만** 받는다 — 안 보이는 뒷장이 죽었다고 미리 받으면
    // 사용자가 넘기지도 않은 사진을 네트워크에 태우는 셈이다.
    expect(media).toMatch(/markDead\(i, i === shown\)/)
    expect(media).toMatch(/if \(!isShown\) return/)
  })

  it('상세: CSS 배경은 오류를 못 잡으므로 같은 URL 의 감지용 img 를 얹는다', () => {
    // 같은 URL·같은 옵션이어야 브라우저가 요청을 재사용한다(추가 트래픽 0).
    // 🔄 2026-08-19: 감시 대상이 **대형 1장 → 대형 + PC 썸네일**로 늘면서(실측상 실패의 대부분이
    //   썸네일 칸이었다) 렌더가 배열 map 이 됐다. 지키는 것은 그대로 — "실제 렌더와 같은 URL/폭".
    expect(detail).toMatch(/cfImage\(src, \{ width: w, format: 'auto' \}\)/)
    expect(detail).toMatch(/\{ src: main, w: 1200 \}/)
    expect(detail).toMatch(/onError=\{\(\) => setDead\(/)
  })

  it('상세: 죽은 사진은 목록에서 빠진다', () => {
    expect(detail).toMatch(/rawImages\.filter\(\(u\) => !dead\.has\(u\)\)/)
  })
})
