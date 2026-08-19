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

  it('🔴 안 본 장면은 네트워크를 태우지 않는다 (첫 화면 트래픽 보호)', () => {
    // `seen` 집합에 없는 인덱스는 <img> 자체를 만들지 않는다.
    expect(media).toMatch(/if\s*\(!seen\.has\(i\)\)\s*return null/)
    // 초기값은 커버(0)뿐 — hover 만으로 더 받지 않는다.
    expect(media).toMatch(/useState<Set<number>>\(\(\)\s*=>\s*new Set\(\[0\]\)\)/)
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
  })

  it('상세: CSS 배경은 오류를 못 잡으므로 같은 URL 의 감지용 img 를 얹는다', () => {
    // 같은 URL·같은 옵션이어야 브라우저가 요청을 재사용한다(추가 트래픽 0).
    expect(detail).toMatch(/cfImage\(main, \{ width: 1200, format: 'auto' \}\)/)
    expect(detail).toMatch(/onError=\{\(\) => setDead\(/)
  })

  it('상세: 죽은 사진은 목록에서 빠진다', () => {
    expect(detail).toMatch(/rawImages\.filter\(\(u\) => !dead\.has\(u\)\)/)
  })
})
