/**
 * 🖼️ 공유 카드 1200×630 + 봇 셸 치수 선언 — 주입 매니페스트 (2026-10-12)
 *
 * 가드: src/tests/unit/og-share-card-size-2026-10-12.test.ts
 *
 * 절반이 **반대 방향**이다. 이 처방은 "그림을 1200×630 으로 만든다" 와 "JSON-LD 상품 사진은
 * 원본을 둔다" 두 축이 쌍인데, 한쪽으로 몰아 통일하려는 유혹이 양쪽에 다 있다 —
 *   · 카드 쪽으로 몰면 구글 상품 사진이 깎이고
 *   · 원본 쪽으로 몰면 소셜 카드가 small card 로 떨어진다.
 * 둘 다 **빌드도 화면도 안 깨진다.**
 */
const SSOT = 'src/shared/og-share-image.ts'
const DETAIL = 'src/worker/utils/detail-ssr-meta.ts'
const MALL = 'src/worker/utils/mall-ssr-meta.ts'
const BLOG = 'src/features/blog/api/blog-ssr-meta.ts'
const WORKER = 'src/worker/index.ts'
const USHOP = 'src/shared/ushop-share-card.ts'
const TEST = 'src/tests/unit/og-share-card-size-2026-10-12.test.ts'

export default [
  {
    name: '🖼️ 상품 카드가 `cover` 로 — 정사각 기프티콘이 세로 44% 잘린다',
    why: '실측: giftishow 500×500 을 cover 로 구우면 1200×630 은 되지만 위아래가 날아간다. '
       + 'pad 는 54,819B 에 잘림 0 인데 cover 는 112,028B 에 44% 손실이다.',
    file: SSOT,
    find: "  const tail = opts.fit === 'cover'",
    replace: "  const tail = opts.fit === 'cover' || true",
    test: TEST,
  },
  {
    name: '🖼️ 상품 카드가 `contain` 으로 — 1200×630 을 아예 안 만든다',
    why: '실측: contain 은 패딩을 안 해서 630×630 이 온다. 그러면 og:image:width/height 선언이 거짓이 되고 '
       + '선언을 믿는 렌더러가 레이아웃을 잘못 잡는다.',
    file: SSOT,
    find: "    : `fit=pad,background=${encodeURIComponent(opts.background || OG_CARD_BG)}`",
    replace: "    : `fit=contain`",
    test: TEST,
  },
  {
    name: '🖼️ pad 배경을 뺀다 — 투명 PNG 뒤가 검정이 된다',
    why: 'jpeg 는 투명을 못 담는다. 유어샵이 유달이에서 같은 함정을 실측으로 적어 뒀다.',
    file: SSOT,
    find: "background=${encodeURIComponent(opts.background || OG_CARD_BG)}",
    replace: "fit=pad",
    test: TEST,
  },
  {
    name: '🖼️ 원본의 `%` 재인코딩을 지운다 — 한글 파일명 사진이 404',
    why: '2026-08-11 에 이 함정으로 네이버 사진 134개가 안 떴다. 리사이저가 경로를 디코딩해 다른 주소를 가져간다.',
    file: SSOT,
    find: "${abs.replace(/%/g, '%25')}",
    replace: "${abs}",
    test: TEST,
  },
  {
    name: '🖼️ `/api/media/` R2 치환을 상대 모양만 보게 되돌린다 — 1.9배 느린 워커 경유',
    why: '호출부(`absImage`)가 먼저 origin 을 붙이므로 상대 모양만 보면 **전부 놓친다**(실측: 숙소 데모 전부). '
       + '같은 바이트에 1.57s ↔ 3.02s 이고, 스크래퍼는 느리면 기다려 주지 않는다.',
    file: SSOT,
    find: "  const m = /^(?:https?:\\/\\/[^/]+)?\\/api\\/media\\/(.+)$/.exec(t)",
    replace: "  const m = /^\\/api\\/media\\/(.+)$/.exec(t)",
    test: TEST,
  },
  {
    name: '🖼️ 감쌀 수 없을 때 빈 문자열을 그대로 내보낸다 — 사진 없는 카드',
    why: '그림이 없는 카드보다 비율이 안 맞는 카드가 낫다(종전 동작). 폴백을 지우면 상대경로 사진이 통째로 사라진다.',
    file: SSOT,
    find: "  return ogCardUrl(photo, origin, { fit: 'pad' }) || String(photo || '')",
    replace: "  return ogCardUrl(photo, origin, { fit: 'pad' })",
    test: TEST,
  },
  // ─── 반대 방향: 카드 쪽으로 몰아 JSON-LD 상품 사진을 깎는다 ───
  {
    name: '↩️ JSON-LD `Product.image` 를 카드 주소로 — 구글 상품 사진이 1200×630 으로 깎인다',
    why: '"일관성" 을 이유로 한 축으로 몰고 싶어진다. 그러면 구글 이미지에 저해상 크롭이 올라가고 '
       + '소셜 카드만 멀쩡해 보인다 — 에러 0.',
    file: DETAIL,
    // 🩸 **두 번 틀렸다.** ① `...(p.image_url ? { image: [photo] }` 는 숙소 빌더에 두 번 나와
    //    앵커가 모호했다 ② 그래서 **앞 줄에 `image:` 를 더했더니** 뒤따르는 스프레드가 그 키를
    //    덮어써 **행동이 안 바뀌고 가드가 통과**했다(객체 리터럴에서 나중 스프레드가 이긴다).
    //    ⇒ 스프레드 **자체**를 바꾼다. 쇼핑 빌더의 description 줄과 묶어 유일 앵커로.
    // 🔁 2026-10-14 재조준 — 앵커의 설명 폴백에서 줄표가 쉼표로 바뀌었다(#79). 지키려던 것
    //    (JSON-LD `Product.image` 는 **원본**이고 소셜 카드와 두 축이다)은 한 글자도 안 바뀌었다.
    find: "      description: (String(d.description || '') || `${name}, 유어딜`).replace(/\\s+/g, ' ').trim().slice(0, 300),\n      ...(d.image_url ? { image: [photo] } : {}),",
    replace: "      description: (String(d.description || '') || `${name}, 유어딜`).replace(/\\s+/g, ' ').trim().slice(0, 300),\n      ...(d.image_url ? { image: [productShareImage(photo, origin)] } : {}),",
    test: TEST,
  },
  {
    name: '↩️ 숙소 og:image 를 원본으로 되돌린다 — 1397×748 · 530KB',
    why: '라이브 실측값이다. 비율 1.867 이라 large card 에서 잘리고 530KB 는 스크래퍼가 포기할 수 있다.',
    file: DETAIL,
    find: "    const ogImage = productShareImage(photo, origin) // 🖼️ 소셜 카드 — 실측 원본 1397×748·518KB 였다",
    replace: "    const ogImage = photo",
    test: TEST,
  },
  {
    name: '↩️ 교환권 og:image 를 남의 CDN 원본으로 되돌린다 — 500×500 · 258KB',
    why: 'bizimg.giftishow.com 은 핫링크·데이터센터 IP 차단 이력이 있다(2026-06-17 차단 → 07-13 해제). '
       + '차단되는 날 카드 사진이 통째로 빈다.',
    file: DETAIL,
    find: "      return { pageTitle: title, title, description, canonical, ogImage: productShareImage(photo, origin), ogType: 'product', noindex: true, jsonLd: '' }",
    replace: "      return { pageTitle: title, title, description, canonical, ogImage: photo, ogType: 'product', noindex: true, jsonLd: '' }",
    test: TEST,
  },
  {
    // 🔁 2026-10-13 재조준: 대표 확정이 '사진 가득(cover, 안 1-가)' 으로 바뀌었다 — pad(여백, 안 1-나)는 기각안.
    name: '↩️ `/pass/:id` 에 pad 를 끼운다 — 대표가 고른 가득(1-가) 대신 여백(1-나)',
    why: '2026-10-13 대표가 시안 1-가(가득)와 1-나(여백) 중 가득을 골랐다. 여백이면 정사각 사진 양옆이 흰 띠가 된다.',
    file: DETAIL,
    find: "    const shareCard = id != null ? passShareCardUrl(id, origin, d.image_url ? photo : null) : productShareImage(photo, origin)",
    replace: "    const shareCard = productShareImage(photo, origin)",
    test: TEST,
  },
  {
    name: '🏪 몰(공구 서비스) 상품 카드를 원본으로 되돌린다',
    why: '운영자가 카톡으로 손님을 데려오는 바로 그 경로다 — 유어딜 소비자 레일과 함께 고쳐야 한쪽만 멀쩡해지지 않는다.',
    file: MALL,
    find: "    ogImage: productShareImage(absImage(product.image_url, origin), origin),",
    replace: "    ogImage: absImage(product.image_url, origin),",
    test: TEST,
  },
  {
    name: '🏪 몰 폴백을 SVG 로 되돌린다 — 렌더러마다 갈린다',
    why: '트위터는 문서상 SVG og:image 미지원이고, 다른 전 표면은 `og-image.png`(라스터 1200×630)를 쓴다.',
    file: MALL,
    find: "  if (!s) return `${origin}/og-image.png`",
    replace: "  if (!s) return `${origin}/og-image.svg`",
    test: TEST,
  },
  // ─── 봇 셸 선언 ───
  {
    name: '📣 봇 셸의 `og:image:width/height` 선언을 지운다',
    why: '카톡·페북·트위터·슬랙·디스코드가 전부 그 셸을 받는다. 선언이 없으면 렌더러가 이미지를 '
       + '받아 본 뒤에야 레이아웃을 정하거나 small card 로 떨어진다. 사람이 받는 index.html 엔 있어서 '
       + '한쪽만 보면 "선언돼 있다" 로 읽힌다 — 2026-10-11 브랜드 JSON-LD 와 같은 비대칭.',
    file: WORKER,
    find: '<meta property="og:image:width" content="${OG_CARD_W}" /><meta property="og:image:height" content="${OG_CARD_H}" />',
    replace: '',
    test: TEST,
  },
  {
    name: '📣 선언값을 손으로 적는다 — 그림이 바뀌는 날 선언이 거짓이 된다',
    why: '치수가 SSOT 상수에서 오지 않으면 `og-share-image.ts` 를 고쳐도 선언이 1200×630 에 남는다.',
    file: WORKER,
    find: '<meta property="og:image:width" content="${OG_CARD_W}" />',
    replace: '<meta property="og:image:width" content="1200" />',
    test: TEST,
  },
  {
    name: '↩️ 유어샵 카드 치수를 다시 손으로 — 선언과 갈린다',
    why: '유어샵 카드와 상품 카드와 봇 셸 선언, 셋이 같은 숫자여야 한다. 한 곳만 바꾸면 '
       + '그 표면의 선언이 조용히 거짓이 된다.',
    file: USHOP,
    // 🩸 되돌려-검증이 이 주입을 **통과**시켰다 — 내 첫 단언이 `SHARE_CARD_W === OG_CARD_W`
    //    숫자 비교였고, 하드코딩 값이 마침 같으면 **늘 참**이라 아무것도 안 지켰다.
    //    지키려는 것은 "같은 값" 이 아니라 **파생**이다(OG_CARD_W 를 고치면 따라와야 한다)
    //    ⇒ 단언을 소스 수준으로 옮겼다. 이 주입은 그 교훈의 영구 기록이다.
    find: 'export const SHARE_CARD_W = OG_CARD_W',
    replace: 'export const SHARE_CARD_W = 1200',
    test: TEST,
  },
  // ─── ④ SVG 를 og:image 로 주지 않는다 (2026-10-12 후속) ───
  {
    name: '📰 블로그 og:image 를 SVG 배너로 되돌린다 — 글 23편이 빈 카드',
    why: '`/blog/og/:slug` 는 실측 `image/svg+xml` 853B 다. 카카오·페북·트위터는 SVG 를 안 읽어 '
       + '카드가 통째로 빈다. 그 라우트 머리말의 근거(*"기본 OG 도 SVG"*)는 낡은 전제다.',
    file: BLOG,
    find: "const ogImage = photo ? productShareImage(photo, origin) : `${origin}/og-image.png`",
    replace: "const ogImage = `${origin}/blog/og/${encodeURIComponent(post.slug || '')}`",
    test: TEST,
  },
  {
    name: '📰 블로그 JSON-LD `image` 를 카드 주소로 — 구글 글 사진이 깎인다',
    why: '두 축을 섞는 쪽. `og:image` 는 1.91:1 카드, JSON-LD `image` 는 원본이다.',
    file: BLOG,
    find: "...(photo ? { image: photo } : {})",
    replace: "...(photo ? { image: ogImage } : {})",
    test: TEST,
  },
  {
    name: '📰 블로그 JSON-LD 사진의 절대화를 뺀다 — 구글이 그 필드를 조용히 버린다',
    why: '2026-10-11 유어샵 핀에서 값을 치른 자리. 상대 경로면 구글이 버리면서 **에러를 안 낸다**.',
    file: BLOG,
    find: 'const photo = ogAbsHttps(post.thumbnail_url, origin)',
    replace: "const photo = post.thumbnail_url ? String(post.thumbnail_url) : ''",
    test: TEST,
  },
  {
    name: '📰 사진이 없을 때도 JSON-LD `image` 를 낸다 — 브랜드 카드를 "이 글의 사진"이라 말한다',
    why: '지어내기. 이 레포가 `aggregateRating`·`Offer` 에서 지키는 규율과 같은 클래스다.',
    file: BLOG,
    find: "...(photo ? { image: photo } : {})",
    replace: 'image: photo || `${origin}/og-image.png`',
    test: TEST,
  },
  {
    name: '🏪 몰 입구(MALL 슬롯) 폴백을 SVG 로 되돌린다',
    why: '로고 없는 몰의 입구가 빈 카드로 공유된다. `mall-ssr-meta` 의 상품 폴백과 **다른 자리**라 '
       + '한쪽만 고치면 반쪽이 남는다(실제로 그랬다).',
    file: WORKER,
    find: '|| `${origin2}/og-image.png`;',
    replace: '|| `${origin2}/og-image.svg`;',
    test: TEST,
  },
  {
    name: '🏪 몰 로고를 카드로 감싸지 않는다 — 로고는 1.91:1 이 아니다',
    why: '정사각·세로 로고를 그대로 보내면 잘리거나 small card 로 떨어진다.',
    file: WORKER,
    find: "const mImg = ogCardUrl(",
    replace: "const mImg = ((x) => x)(",
    test: TEST,
  },
  {
    name: '🏪 몰 로고를 `cover` 로 자른다 — 로고 글자가 날아간다',
    why: 'pad 는 전체를 보존하고 cover 는 자른다. 로고에서 자르기는 글자 손실이다.',
    file: WORKER,
    find: "origin2, { fit: 'pad' })",
    replace: "origin2, { fit: 'cover' })",
    test: TEST,
  },
]
