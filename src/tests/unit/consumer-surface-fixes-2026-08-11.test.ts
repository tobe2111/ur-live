/**
 * 🧪 2026-08-11 소비자 전면 AB 스윕에서 나온 결함 3건을 고정한다.
 *
 * 브라우저가 프록시를 못 뚫는 줄 알았는데 **TLS 1.3 이 원인**이었고(`--ssl-version-max=tls1.2` 로
 * 통과), 그제서야 라이브 클릭 테스트가 가능해져서 나온 것들이다. 셋 다 **에러가 안 나는 종류**라
 * 되돌아가도 빌드는 초록이고 아무도 모른다.
 *
 * | # | 증상 | 진짜 원인 |
 * |---|---|---|
 * | ① | `/meal-vouchers` 가 "상품이 없습니다" | `BrowsePage` 의 `exclude_deal_only=1` 이 **이용권 카테고리를 통째로 제외**한다 → 구조적 영구 0건 |
 * | ② | PC 회사소개 대문이 "LIVE COMMERCE" | `/introduce` 를 **폐기된 라이브커머스 액자**로 감싸고 있었다 |
 * | ③ | 404 의 `공동구매` 칩이 추천수익 페이지로 | 라벨·목적지·명칭 SSOT 가 전부 낡음 |
 *
 * ⚠️ **못 막는 것**: 실제 렌더 결과와 서버 301 의 실제 응답. 배포 후 curl/사람 눈이다.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { CONSUMER_ALIASES, resolveConsumerAlias } from '../../shared/seo/consumer-redirects'
import { CONSUMER_SURFACE_SEO } from '../../shared/seo/consumer-surfaces'
import { cfImage } from '../../utils/cf-image'

/**
 * 주석은 배선이 아니다 — 실행 코드만 남기고 판정한다(이 레포가 반복해 걸린 함정).
 *
 * ⚠️ **블록주석을 정규식으로 지우지 않는다.** `worker/index.ts` 에는 `'/api/*'` 같은 **문자열**이
 * 있어서 `/\/\*[\s\S]*?\*\//` 가 그걸 주석 시작으로 먹고 파일 뒤쪽을 통째로 삼킨다 —
 * 그러면 실재하는 배선을 "없다"고 판정한다(이 테스트를 쓰다가 실제로 당했다).
 * 줄 단위 `//`·`*` 제거만으로 충분하다.
 */
const code = (p: string) =>
  readFileSync(p, 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

const LOCALES = ['ko', 'en', 'ja', 'zh', 'es', 'fr'] as const
const tr = (l: string) => JSON.parse(readFileSync(`public/locales/${l}/translation.json`, 'utf8'))

describe('① /meal-vouchers — 이용권 URL 이 이용권을 보여준다', () => {
  it('🔴 왜 리다이렉트인지의 근거: BrowsePage 의 필터가 이용권을 구조적으로 배제한다', () => {
    // 이 앵커가 없으면 다음 세션이 "그냥 BrowsePage 로 되돌리면 되잖아" 하고 원복한다.
    const repo = code('src/features/products/repositories/ProductRepository.ts')
    expect(repo, 'excludeDealOnly 가 voucher 카테고리를 제외하지 않는다면 전제가 바뀐 것이다')
      .toMatch(/excludeDealOnly[\s\S]{0,600}category IS NULL OR category NOT IN/)
    expect(code('src/pages/BrowsePage.tsx')).toContain("exclude_deal_only: '1'")
  })

  it('🔴 BrowsePage 를 이용권 카테고리로 감싼 페이지가 되살아나지 않았다', () => {
    expect(existsSync('src/pages/MealVouchersPage.tsx'), 'MealVouchersPage 가 다시 생겼다').toBe(false)
    expect(code('src/App.tsx')).not.toContain('MealVouchersPage')
  })

  it('앱 안에서는 홈 카테고리 필터로 보낸다 (SPA 이동은 서버 301 을 안 탄다)', () => {
    expect(code('src/App.tsx'))
      .toMatch(/path="\/meal-vouchers"\s+element=\{<Navigate to="\/\?category=meal_voucher"/)
  })

  it('크롤러에게는 서버 301 — 별칭 표에 등재돼 있다', () => {
    expect(resolveConsumerAlias('/meal-vouchers')).toBe('/?category=meal_voucher')
    expect(CONSUMER_ALIASES['/meal-vouchers']).toBe('/?category=meal_voucher')
  })

  it('🔴 목적지에 쿼리가 있어도 원본 쿼리를 안전하게 잇는다 — `?a=1?b=2` 가 되면 안 된다', () => {
    // 워커는 `origin + alias + url.search` 로 이어붙였다. 목적지가 이미 `?` 를 가지면
    // 두 번째 `?` 는 **값의 일부로 먹혀** category 가 통째로 깨진다.
    const w = code('src/worker/index.ts')
    expect(w, '쿼리 병합 분기가 사라졌다').toMatch(/alias\.includes\('\?'\)/)
    expect(w).not.toMatch(/\$\{alias\}\$\{url\.search \|\| ''\}/)
  })

  it('리다이렉트가 된 경로를 색인 대상 표면으로 선언하지 않는다', () => {
    expect(Object.keys(CONSUMER_SURFACE_SEO)).not.toContain('/meal-vouchers')
  })
})

describe('② /introduce — 회사소개에 폐기된 라이브커머스가 없다', () => {
  it('🔴 라이브커머스 액자가 삭제됐다', () => {
    expect(existsSync('src/components/GripFrameLayout.tsx'), 'GripFrameLayout 이 되살아났다').toBe(false)
  })

  it('🔴 FrameWrapper 가 특정 경로를 액자로 감싸지 않는다', () => {
    const fw = code('src/components/FrameWrapper.tsx')
    expect(fw).not.toContain('GripFrameLayout')
    expect(fw, 'FRAME_PAGES 가 되살아나면 같은 사고가 다른 경로에서 난다').not.toContain('FRAME_PAGES')
  })

  it('없는 PDF 를 여는 CTA 가 없다 — `/company-brochure.pdf` 는 SPA 셸(text/html)을 돌려준다', () => {
    const hit = ['src/components/FrameWrapper.tsx', 'src/pages/IntroducePage.tsx']
      .filter((p) => existsSync(p) && code(p).includes('company-brochure'))
    expect(hit, `깨진 브로슈어 링크가 남아 있다: ${hit.join(', ')}`).toHaveLength(0)
  })
})

describe('④ 한글 파일명 사진이 cdn-cgi 에서 404 나지 않는다', () => {
  // 라이브 실측: 네이버 지도 사진 중 파일명이 한글인 것은 URL 이 이미 EUC-KR 퍼센트 인코딩돼 있고,
  // 그걸 cdn-cgi **경로**에 그대로 박으면 리사이저가 디코딩해 원본을 못 찾는다(404).
  // `onerror=redirect` 도 안 걸린다 — 404 를 리사이저 자신이 반환하기 때문.
  const ENCODED = 'https://ldb-phinf.pstatic.net/20260618_1/1781789159233fqISB_JPEG/%B8%DE%B4%BA%C6%C7_-001.jpg'
  const PLAIN = 'https://ldb-phinf.pstatic.net/20250306_72/1741229518125SFMUv_JPEG/20250305_160050.jpg'

  it('🔴 퍼센트는 한 번 더 이스케이프된다 (%→%25)', () => {
    const out = cfImage(ENCODED, { width: 900 })
    expect(out).toContain('/cdn-cgi/image/')
    expect(out, '원본 %가 그대로 경로에 박혔다 — 리사이저가 디코딩해 404 가 난다').toContain('%25B8%25DE')
    expect(out).not.toMatch(/JPEG\/%B8/)
  })

  it('🔴 `:` `/` 까지 인코딩하면 안 된다 — URL 이 통째로 깨진다', () => {
    // encodeURIComponent 로 갈아끼우는 "정리"를 막는다.
    expect(cfImage(ENCODED, { width: 900 })).toContain('https://ldb-phinf.pstatic.net/')
  })

  it('% 없는 URL 은 아무것도 바뀌지 않는다 (무해성)', () => {
    expect(cfImage(PLAIN, { width: 900 })).toContain(PLAIN)
  })

  it('🔴 쿼리스트링의 %는 건드리지 않는다 — 서명이 깨져 오히려 이미지가 죽는다', () => {
    // 라이브 표본에서 잡힌 **내 첫 수정의 회귀**. 카카오 썸네일은 쿼리에 서명을 단다:
    //   raw 200/117KB · 그대로 200/225KB · 전체 %25 200/**820B**(깨짐) · 경로만 %25 200/225KB
    const SIGNED = 'https://thumb.kakaocdn.net/dna/kamp/source/rvz/thumbs/1.jpg'
      + '?credential=TuMuFGKUIcirOSjFzOpncbomGFEIdZWK&signature=TKCd5UKSu0MciDacHVHMO5Obb10%3D&ts=1781849599'
    const out = cfImage(SIGNED, { width: 900 })
    expect(out, '서명의 %3D 가 %253D 로 바뀌면 원본 fetch 가 실패한다').toContain('%3D&ts=')
    expect(out).not.toContain('%253D')
  })

  it('경로와 쿼리에 둘 다 %가 있으면 경로만 바꾼다', () => {
    const BOTH = 'https://ldb-phinf.pstatic.net/a/%B8%DE_1.jpg?type=w386&sig=x%3D'
    const out = cfImage(BOTH, { width: 900 })
    expect(out).toContain('%25B8%25DE_1.jpg')   // 경로: 이스케이프됨
    expect(out).toContain('sig=x%3D')           // 쿼리: 원본 그대로
  })
})

describe('③ 404 — 길 잃은 사람을 실제로 있는 곳으로 보낸다', () => {
  const nf = code('src/pages/NotFoundPage.tsx')

  it('🔴 `공동구매` 칩이 추천수익(/referral)으로 가던 오배선이 없다', () => {
    expect(nf, '404 의 인기 페이지 칩이 /referral 로 간다 — 라벨과 목적지가 다르다')
      .not.toContain("to: '/referral'")
  })

  it('하단바 5탭과 같은 곳을 가리킨다', () => {
    for (const to of ["to: '/'", "to: '/vouchers'", "to: '/map'"]) expect(nf).toContain(to)
  })

  it.each(LOCALES)('🔴 [%s] 폐기 명칭 키가 되살아나지 않았다 (라이브·맛집딜·공동구매)', (l) => {
    const n = tr(l).notFound
    for (const k of ['linkLive', 'linkRestaurant', 'linkGroupBuy']) {
      expect(n, `${l}.notFound.${k} 가 되살아났다`).not.toHaveProperty(k)
    }
  })

  it.each(LOCALES)('[%s] 새 라벨 3종이 있다 — 키가 없으면 화면에 raw 키가 뜬다', (l) => {
    const n = tr(l).notFound
    for (const k of ['linkHome', 'linkVouchers', 'linkMap']) {
      expect(typeof n[k], `${l}.notFound.${k} 누락`).toBe('string')
    }
  })

  it('🔴 한국어 SEO 문구에 폐기 기능·명칭이 없다', () => {
    const s: string = tr('ko').notFound.seoDescription
    for (const dead of ['라이브 쇼핑', '맛집딜']) expect(s, `"${dead}" 가 남아 있다`).not.toContain(dead)
  })
})

describe('⑤ 딜 충전 실패 화면이 막다른 길이 아니다', () => {
  // 실측: 헤더·네비 없이 "결제 정보가 유효하지 않습니다 / 다시 시도" 두 줄뿐이었고,
  //   그 버튼이 보내는 `/points/charge` 는 TOPUP_DISABLED(2026-07-18 충전 종료) 안내 화면이다.
  //   즉 나갈 문이 없었다.
  const pg = code('src/pages/PointsChargeSuccessPage.tsx')

  it('🔴 어느 경우에도 메인으로 나가는 버튼이 있다', () => {
    expect(pg).toContain("navigate('/')")
    expect(pg).toContain('common.goHome')
  })

  it('🔴 충전이 종료된 동안에는 재시도를 권하지 않는다', () => {
    // 되돌리면 다시 "막다른 화면 → 막다른 화면" 이 된다.
    expect(pg).toContain('TOPUP_DISABLED')
    expect(pg).toMatch(/!TOPUP_DISABLED &&[\s\S]{0,200}navigate\('\/points\/charge'\)/)
  })

  it.each(LOCALES)('[%s] common.goHome 이 번역돼 있다 — defaultValue 로 때우면 6개 언어가 한국어가 된다', (l) => {
    expect(typeof tr(l).common?.goHome, `${l}.common.goHome 누락`).toBe('string')
  })
})

describe('⑥ 홈이 지도가 된 뒤의 연결 힌트 (index.html)', () => {
  // 라이브 실측(모바일 홈): LCP 8,372ms — LCP 요소가 **카카오맵 타일**이고, SDK 가
  //   dapi.kakao.com → t1.daumcdn.net → 타일(mts.daumcdn.net) 로 **4단 직렬**이다.
  //   2026-05-27 주석은 "dapi.kakao 는 메인 사용 X" 라며 preconnect 를 뗐는데,
  //   2026-07-29 에 홈이 지도(RestaurantMapPage)가 되면서 그 전제가 뒤집혔다.
  const html = readFileSync('index.html', 'utf8')

  it('🔴 LCP 경로의 카카오맵 호스트 3종에 preconnect 가 있다', () => {
    for (const h of ['https://dapi.kakao.com', 'https://t1.daumcdn.net', 'https://mts.daumcdn.net']) {
      expect(html, `${h} preconnect 누락 — 홈 LCP 경로다`).toMatch(
        new RegExp(`rel="preconnect"\\s+href="${h.replace(/[/.]/g, '\\$&')}"`),
      )
    }
  })

  it('기존 힌트를 지우지 않았다 (잠금표: 추가는 OK, 제거 금지)', () => {
    for (const h of ['https://cdn.jsdelivr.net', 'https://t1.kakaocdn.net', 'https://img1.kakaocdn.net']) {
      expect(html, `${h} preconnect 이 사라졌다`).toContain(`href="${h}"`)
    }
  })

  it('홈이 실제로 지도인지 — 이 전제가 다시 바뀌면 위 preconnect 도 재검토해야 한다', () => {
    // 전제를 코드에 묶어 둔다. 홈이 지도가 아니게 되면 이 테스트가 먼저 빨강이 된다.
    expect(code('src/App.tsx'), '홈 라우트가 HomeRoute 가 아니다').toMatch(/path="\/"[\s\S]{0,120}HomeRoute/)
    expect(code('src/pages/pc-home/HomeRoute.tsx')).toContain('RestaurantMapPage')
  })
})
