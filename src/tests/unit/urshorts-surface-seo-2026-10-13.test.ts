/**
 * 🎬 2026-10-13 — **유어쇼츠 두 표면의 서버 메타**(`/urshorts` 전체보기 · `/videos` 뷰어).
 *
 * 📊 **실측(라이브 · Googlebot UA)** — 둘 다 `CONSUMER_SURFACE_SEO` 에 없어 서버 rewrite 를 안 탔다:
 *
 *       표면         robots         title/description            본문    h1   Breadcrumb
 *       /urshorts   index, follow  **홈과 완전히 동일**           32자     0      0
 *       /videos     index, follow  **홈과 완전히 동일**           32자     0      0
 *       (대조) /vouchers  index    전용                         268자     -      있음
 *
 * 🔴 **`/videos` 는 그 페이지가 이미 `noindex` 를 선언하고 있었다** — 클라 `<SEO ... noindex />`.
 *    그런데 서버가 `index, follow` 를 줘서 **JS 안 돌리는 크롤러(Yeti·AI 봇)에는 무효**였다.
 *    2026-07-29 에 `/search`·`/gb-market` 에서 고친 것과 **같은 결함**이고 이 둘만 빠져 있었다
 *    (`/videos` 는 2026-09-07 신설 — 그 뒤에 표에 등록되지 않았다).
 *
 * 🔴 **`VideoObject` 는 선언하지 않는다.** 영상이 전부 **남의 유튜브 채널**이다(라이브 실측:
 *    부산일보TV·해피푸게더·슬아투니·부산이야·파인예플·재슐랭가이드). 우리 페이지의 영상이라
 *    선언하면 거짓 주장이고, 이 레포가 브랜드 `sameAs` 를 비워 둔 것·리뷰 0 에 `aggregateRating` 을
 *    안 내는 것과 **같은 규율**이다. 우리 것은 큐레이션이다.
 *
 * 🔴 **`/urshorts` 는 `surface-copy` 에 넣지 않는다**(본문 없음). 그 표는 표면당 **110자 바닥**을
 *    요구하는데 이 페이지의 내용은 남의 썸네일 그리드라 우리 산문이 적다 — 바닥을 채우려고 문장을
 *    지어내는 것은 *"이름만 적어 글자수를 늘리지 않는다"* 규율을 어긴다. 같은 이유로 **sitemap 미제출**.
 *
 * ⚠️ **이 가드가 못 보는 것**: 구글·네이버가 실제로 중복 제목을 합치거나 색인에서 빼는지
 *    (외부 판정 · 수일~수주 · 서치콘솔은 대표만 본다) · HTMLRewriter 런타임 배선(워커 전용 API).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { CONSUMER_SURFACE_SEO, resolveConsumerSurfaceSeo } from '@/shared/seo/consumer-surfaces'
import { SURFACE_COPY } from '@/shared/seo/surface-copy'
import { buildStaticSurfaceNoscript } from '@/worker/utils/crawler-noscript'

const ORIGIN = 'https://urdeal.kr'
const HOME = CONSUMER_SURFACE_SEO['/']

describe('① 두 표면이 서버 메타를 갖는다', () => {
  it.each(['/urshorts', '/videos'])('%s — 표에 있고 홈 메타가 아니다', (path) => {
    const e = CONSUMER_SURFACE_SEO[path as '/urshorts']
    expect(e, `${path} 가 표에 없다 — 서버 rewrite 를 안 탄다`).toBeTruthy()
    expect(e.title).not.toBe(HOME.title)
    expect(e.description).not.toBe(HOME.description)
    expect(e.title.length).toBeGreaterThan(3)
    expect(e.description.length).toBeGreaterThan(10)
  })

  it('canonical 이 자기 자신이고 쿼리를 끌고 가지 않는다', () => {
    for (const path of ['/urshorts', '/videos']) {
      const r = resolveConsumerSurfaceSeo(path, '?si=busan&utm_source=x', ORIGIN)
      expect(r!.canonical).toBe(`${ORIGIN}${path}`)
    }
  })
})

describe('② /videos 는 noindex — 서버와 클라가 같은 말을 한다', () => {
  it('표가 noindex 다', () => {
    expect(CONSUMER_SURFACE_SEO['/videos'].noindex).toBe(true)
    expect(resolveConsumerSurfaceSeo('/videos', '', ORIGIN)!.noindex).toBe(true)
  })

  it('/urshorts 는 색인 대상이다 — 둘을 같이 묶지 않는다', () => {
    expect(CONSUMER_SURFACE_SEO['/urshorts'].noindex).toBeFalsy()
  })

  it('noindex 표면은 crumb 를 비워 둔다 (색인 말라면서 빵부스러기를 달지 않는다)', () => {
    expect(CONSUMER_SURFACE_SEO['/videos'].crumb).toBeFalsy()
    expect(CONSUMER_SURFACE_SEO['/urshorts'].crumb).toBeTruthy()
  })

  it('페이지가 표를 읽는다 — 문구를 두 벌로 적지 않는다', () => {
    for (const [file, key] of [
      ['src/pages/VideosPage.tsx', '/videos'],
      ['src/pages/UrShortsBrowsePage.tsx', '/urshorts'],
    ] as const) {
      const code = readCode(file)
      expect(code, `${file} 가 표를 안 읽는다`).toContain(`CONSUMER_SURFACE_SEO['${key}']`)
      // 🔴 하드코딩한 title/description 문자열이 남아 있으면 두 벌이다.
      expect(code).not.toContain(`title="유어쇼츠`)
      expect(code).not.toContain('description="영상으로')
    }
    // 뷰어는 `noindex` 를 계속 넘긴다(표에만 있고 전달을 빼면 클라 쪽이 색인 가능해진다).
    expect(readCode('src/pages/VideosPage.tsx')).toMatch(/noindex/)
  })
})

describe('③ 지어내지 않는다', () => {
  it('VideoObject 를 어디서도 선언하지 않는다 — 남의 유튜브 영상이다', () => {
    for (const f of [
      'src/shared/seo/consumer-surfaces.ts',
      'src/shared/seo/consumer-surface-table.ts', // 🗂️ 2026-11-01 표 분리 — 안 넣으면 그 자리에 생겨도 못 본다
      'src/worker/utils/crawler-noscript.ts',
      // 🔁 2026-10-13 추가: `/urshorts` 본문 빌더가 모듈로 빠졌다(`crawler-noscript` 가 600줄 래칫을
      //   넘겼다). 목록에 안 넣으면 그 자리에 `VideoObject` 가 생겨도 이 검사가 못 본다.
      'src/worker/utils/urshorts-noscript.ts',
      'src/worker/utils/surface-list-jsonld.ts',
      'src/pages/UrShortsBrowsePage.tsx',
      'src/pages/VideosPage.tsx',
    ]) {
      expect(readCode(f), `${f} 에 VideoObject 가 생겼다`).not.toContain('VideoObject')
    }
  })

  it('/urshorts 를 **정적 마케팅 문구로** 채우지 않는다 — 시드가 없으면 아무것도 안 낸다', () => {
    // 🔁 2026-10-13 재조준. 종전 제목은 *"크롤러 본문을 만들지 않는다"* 였고 그때는 맞았다 —
    //   그 시점에 쓸 수 있는 수단이 `SURFACE_COPY`(정적 문구)뿐이었고, 110자 바닥을 **문장으로**
    //   채우는 것은 패딩이기 때문이다.
    //   🔑 전제가 바뀌었다: `/api/urshorts` 는 `cache-prewarm` HOT_PATHS 에 **이미 있는 키**라
    //   그 시드로 **그 페이지의 실제 내용**(영상 제목 · 출처 채널 · 매장 · 지역)을 글로 낼 수 있다
    //   (실측 6자 → 465자, 새 캐시 키 0). 그건 패딩이 아니라 그 화면에 떠 있는 것 그대로다.
    //   ⇒ 지키려던 것 **둘은 그대로** 잠근다: ① 정적 문구(`SURFACE_COPY`)로 채우지 않는다
    //      ② 시드가 없으면 **아무것도 내지 않는다**(지어내지 않는다).
    expect(Object.keys(SURFACE_COPY)).not.toContain('/urshorts')
    expect(buildStaticSurfaceNoscript('/urshorts', null)).toBe('')
    expect(buildStaticSurfaceNoscript('/urshorts', JSON.stringify({ success: true, data: [] }))).toBe('')
    expect(buildStaticSurfaceNoscript('/videos', null)).toBe('')
  })

  it('짝 주장 — 제출했으면 본문이 있어야 한다 (양방향)', () => {
    // 🔁 2026-10-13 재조준: 불변식은 *"제출 ⟺ 본문"* 이고 그건 한 글자도 안 바뀌었다.
    //   달라진 것은 `/urshorts` 가 그 조건을 **충족하게 됐다**는 사실이다(6자 → 465자).
    //   그래서 "제출 안 함" 을 고정하는 대신 **짝 자체**를 고정한다 — 어느 방향으로 깨져도 빨간불.
    const sm = readCode('src/worker/routes/sitemap.routes.ts')
    const submitted = sm.includes("loc: '/urshorts'")
    const hasBody = buildStaticSurfaceNoscript(
      '/urshorts',
      JSON.stringify({ success: true, data: [{ title: '제목', channel: '채널', region_si: '부산' }] }),
    ).length > 0
    expect(submitted, 'sitemap 이 /urshorts 를 제출하는데 크롤러 본문 빌더가 없다 (soft-404)').toBe(hasBody)
    // `/videos` 는 **뷰어**다(표에서 noindex) — 제출 금지 방향은 그대로 잠근다.
    expect(sm).not.toContain("'/videos'")
  })
})

describe('④ 화면과 크롤러가 같은 말을 한다', () => {
  it('/urshorts 설명 한 줄이 화면에 실재한다 (메타 문구와 같은 글자)', () => {
    // 🩸 종전 이 페이지엔 설명 문장이 **하나도 없었다**(제목 + 편수 + 칩 라벨뿐). 메타에만 설명을
    //    두면 검색 스니펫과 도착 화면이 다른 말을 한다 — 그래서 같은 문장을 화면에 한 줄 넣었다.
    const page = readCode('src/pages/UrShortsBrowsePage.tsx')
    expect(page).toContain(CONSUMER_SURFACE_SEO['/urshorts'].description)
  })
})
