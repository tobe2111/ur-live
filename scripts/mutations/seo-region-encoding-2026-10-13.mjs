/**
 * 🔗📦 2026-10-13 — 지역 경로 SSOT · 쇼핑 availability · sitemap 제출 계약이 **실제로** 지켜지는가.
 *
 * 가드: src/tests/unit/seo-region-encoding-availability-2026-10-13.test.ts
 *       scripts/check-anti-slop-copy.mjs (블로그 시드 제목 — 아래 셋)
 */
const SLUGS = 'src/shared/constants/region-slugs.ts'
const META = 'src/worker/utils/surface-ssr-meta.ts'
const JSONLD = 'src/worker/utils/surface-list-jsonld.ts'
const DIGEST = 'src/shared/seo/region-digest.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const DETAIL = 'src/worker/utils/detail-ssr-meta.ts'
const SURFACES = 'src/shared/seo/consumer-surfaces.ts'
const SEED = 'src/features/blog/api/blog-seed.ts'
const ANTISLOP = 'scripts/check-anti-slop-copy.mjs'
const TEST = 'src/tests/unit/seo-region-encoding-availability-2026-10-13.test.ts'

export default [
  {
    name: '🔗 regionPath 가 다시 날것 한글을 낸다',
    file: SLUGS,
    find: "  const sido = encodeURIComponent(ref.sido)\n  return ref.sigungu ? `/region/${sido}/${encodeURIComponent(ref.sigungu)}` : `/region/${sido}`",
    replace: "  return ref.sigungu ? `/region/${ref.sido}/${ref.sigungu}` : `/region/${ref.sido}`",
    test: TEST,
    why:
      '사이트맵 규격은 `<loc>` 의 URL-escape 를 요구하고, 더 나쁜 것은 **같은 페이지가 클라 `<SEO>` 로는 ' +
      '날것 · 워커 주입으로는 인코딩** canonical 을 내보내는 것이다(JS 를 렌더하는 크롤러와 안 하는 ' +
      '크롤러가 다른 정본을 본다). 에러가 하나도 안 나서 재 본 사람만 안다.',
  },
  {
    name: '🔗 워커 canonical 이 SSOT 를 안 쓰고 다시 손으로 조립한다',
    file: META,
    find: "  const canonicalPath = regionPath({ sido, ...(sigunguRaw ? { sigungu: sigunguRaw } : {}) })",
    replace: "  const canonicalPath = sigunguRaw ? `/region/${sido}/${sigunguRaw}` : `/region/${sido}`",
    test: TEST,
    why: '조립이 두 벌이 되는 그 순간 sitemap·빵부스러기와 갈린다 — 이 결함이 원래 있던 자리다.',
  },
  {
    name: '🔗 빵부스러기가 다시 손으로 조립한다',
    file: JSONLD,
    find: "    trail.push({ name: regionRef.sido, url: `${origin}${regionPath({ sido: regionRef.sido })}` })",
    replace: "    trail.push({ name: regionRef.sido, url: `${origin}/region/${regionRef.sido}` })",
    test: TEST,
    why: '빵부스러기가 canonical 아닌 URL 을 가리키면 구글에 서로 다른 신호를 보낸다.',
  },
  {
    name: '🔗 크롤러 내부 링크가 다시 손으로 조립한다',
    file: DIGEST,
    find: '    const href = regionPath(ref)',
    replace: '    const href = `/region/${ref.sido}${ref.sigungu ? `/${ref.sigungu}` : \'\'}`',
    test: TEST,
    why: '내부 링크가 canonical 과 다른 표기면 크롤러가 같은 페이지를 두 주소로 센다.',
  },
  {
    name: '🔗 sitemap `<loc>` 의 비ASCII 그물을 걷는다',
    file: SITEMAP,
    find: '<loc>${xmlEscape(asciiLoc(origin + u.loc))}</loc>',
    replace: '<loc>${xmlEscape(origin + u.loc)}</loc>',
    test: TEST,
    why:
      '조립을 한 곳으로 모은 것이 근본 처방이고 이 그물은 **새 경로가 또 날것으로 들어오는 것**을 ' +
      '막는다. 걷으면 다음에 누가 날것 경로를 밀어 넣어도 아무 신호가 없다.',
  },
  {
    name: '🔗 asciiLoc 을 encodeURI 로 바꾼다 (이미 인코딩된 것을 두 번 먹는다)',
    file: SITEMAP,
    find: '  return u.replace(/[^\\x00-\\x7F]/g, (ch) => encodeURIComponent(ch));',
    replace: '  return encodeURI(u);',
    test: TEST,
    why:
      '`encodeURI` 는 이미 인코딩된 `%EC` 의 `%` 를 `%25` 로 다시 먹어 **멀쩡한 URL 을 전부 깨뜨린다** ' +
      '(교환권 facet `?category=%ED%8E%B8%EC%9D%98%EC%A0%90` 가 그 경우다). 멱등이어야 한다.',
  },
  {
    name: '📦 쇼핑 availability 를 다시 항상 InStock 으로',
    file: DETAIL,
    // ⚠️ 앵커에 **앞줄을 포함**한다 — `replace` 가 `availability: 'https://…/InStock',` 하나뿐이면
    //   숙소 분기의 **같은 글자**와 구분이 안 돼 러너의 복원 검사가 오발한다(실제로 냈다).
    find: "          '@type': 'Offer', url: canonical, priceCurrency: 'KRW', price,\n          // 📦 2026-10-13",
    replace: "          '@type': 'Offer', url: canonical, priceCurrency: 'KRW', price,\n          availability: 'https://schema.org/InStock',\n          // 📦 2026-10-13",
    test: TEST,
    why:
      '품절 상품도 구조화 데이터로는 "재고 있음" 이 된다. 구글 상품 정책은 페이지와의 일치를 요구하고 ' +
      '어긋나면 리치결과가 거절될 수 있다 — 그리고 사용자는 품절을 클릭한다.',
  },
  {
    name: '📦 재고를 한쪽 컬럼만 본다 (멀쩡한 상품이 품절이 된다)',
    file: DETAIL,
    find: '    const inStock = Number(d.stock ?? 0) > 0 || Number(d.stock_quantity ?? 0) > 0',
    replace: '    const inStock = Number(d.stock_quantity ?? 0) > 0',
    test: TEST,
    why:
      '라이브 실측(id 2917) `stock: 200` ↔ `stock_quantity: 0` — 한쪽만 보면 **재고 200개 상품이 ' +
      'OutOfStock** 으로 나간다. 그건 오늘보다 나쁘다(2026-07-02 에 구매 버튼에서 같은 갭으로 값을 치렀다).',
  },
  {
    name: '🧾 법무 검토 전 초안 약관의 noindex 를 떼어낸다',
    file: SURFACES,
    // ⚠️ 앵커에 **그 표면의 `crumb`** 을 붙인다 — `noindex: true,` + 앞 주석만으로는 두 표면에
    //   똑같이 맞아 러너가 "여러 곳에 맞는다" 로 거부한다(또는 엉뚱한 쪽을 고친다).
    //   🩸 첫 판은 주석 접두만 바꿔서 **통과했다** — 주석을 바꾸는 주입은 행동을 안 바꾼다.
    find: "    noindex: true,\n    crumb: '소개 활동 약관',",
    replace: "    crumb: '소개 활동 약관',",
    test: TEST,
    why:
      '그 페이지가 스스로 *"초안이며, 실제 시행 전 법무 검토가 필요합니다"* 라고 적어 둔 문서다. ' +
      '검색결과에 "유어딜 약관" 으로 서면 신뢰 문제이고, 정본이 나와도 초안 URL 이 먼저 색인된 채 남는다.',
  },
  {
    name: '📰 블로그 제목에 em-dash 가 되돌아온다',
    file: SEED,
    find: "'유어샵, 누구나 갖는 나만의 이용권 진열대'",
    replace: "'유어샵 — 누구나 갖는 나만의 이용권 진열대'",
    test: TEST,
    why:
      '시드 제목은 `/blog/:slug` 의 `<title>` 이자 **검색결과에 그대로 뜨는 줄**이다. 실측에서 21편 중 ' +
      '14편이 `주제 — 설명` 한 틀이었고, 열넷이 같은 모양인 것 자체가 AI 티다.',
  },
  {
    name: '📰 anti-slop 가드가 블로그 시드를 다시 못 보게 된다 (경로 낡음)',
    file: ANTISLOP,
    find: "const BLOG_SEED = path.join(ROOT, 'src/features/blog/api/blog-seed.ts')",
    replace: "const BLOG_SEED = path.join(ROOT, 'src/features/blog/api/blog-seed-MOVED.ts')",
    test: TEST,
    why:
      '이 가드는 `.tsx` 만 훑는데 블로그 문구는 `.ts` 에 있다 — 원래 **구조적으로 못 보던** 자리다. ' +
      '경로가 낡으면 제목 검사가 조용히 사라진다(그래서 0개면 통과가 아니라 실패로 만들었다).',
  },
  {
    name: '📰 블로그 시드 본문 em-dash 래칫을 무력화한다',
    file: ANTISLOP,
    find: 'if (seed.bodyEm > (base.blogSeedBodyEmDash ?? 0)) {',
    replace: 'if (false) {',
    test: TEST,
    why:
      '본문 39건은 한 번에 고치면 문장 품질이 더 나빠질 위험이 커서 **동결만** 했다. 래칫이 사라지면 ' +
      '그 39건이 조용히 자란다(줄이는 건 자유, 늘리는 것만 막는 설계다). ⚠️ 이 결함은 **가드를 ' +
      '돌려서는 못 잡는다** — 검사를 끄면 그 가드는 초록이 된다. 그래서 시험이 소스로 고정한다.',
  },
]
