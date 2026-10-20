/**
 * 되돌려-검증 주입 — `/urshorts` 크롤러 본문의 **딜 링크** (2026-10-14).
 *
 * 이 처방의 위험은 **양방향**이다:
 *   · 링크가 사라지면 → 색인 대상 허브가 다시 **막다른 길**이 된다(에러 0, 본문은 그대로다).
 *   · 링크가 **넓어지면** → `deal_only` 를 안 싣는 행이라 교환권을 링크하고, 그 상세는
 *     2026-07-07 결정으로 **noindex** 다 ⇒ 색인하지 말라고 한 URL 로 크롤 예산이 빠진다.
 * 그래서 절반을 반대 방향으로 심는다.
 */
const SRC = 'src/worker/utils/urshorts-noscript.ts'
const CAT = 'src/shared/constants/voucher-categories.ts'
const T = 'src/tests/unit/urshorts-deal-link-2026-10-14.test.ts'

export default [
  {
    name: '🎬 유어쇼츠 딜 링크 — 링크를 다시 떼고 글만 남긴다(허브가 막다른 길로)',
    file: SRC,
    find: "        ? ` · <a href=\"${esc(href)}\">${esc(dealName)} 판매가 ${won(d.price)}원${d.discount > 0 ? ` (${d.discount}% 할인)` : ''}</a>`",
    replace: "        ? ` · ${esc(dealName)} 판매가 ${won(d.price)}원`",
    test: T,
    why: '본문 글자수는 거의 그대로라 "고쳤다" 로 보이는데, 크롤러가 그 딜로 갈 길이 사라진다(실측: 이 표면 내부 링크 0).',
  },
  {
    name: '🎬 유어쇼츠 딜 링크 — 주소를 손으로 적는다(sitemap·ItemList 와 갈린다)',
    file: SRC,
    find: '        : canonicalDetailPath({ id: pid as string | number, category: (String(v.category ?? \'\') || null) })',
    replace: '        : `/pass/${pid}`',
    test: T,
    why: '정본은 종류마다 다르다(교환권 /vouchers · 숙소 /stays · 이용권 /pass) — 손으로 적으면 같은 상품이 두 URL 로 제출된다.',
  },
  {
    name: '🎬 유어쇼츠 딜 링크 — `/products/:id` 폴백을 넣는다(교환권을 noindex URL 로 링크)',
    file: SRC,
    find: '        : canonicalDetailPath({ id: pid as string | number, category: (String(v.category ?? \'\') || null) })',
    replace: '        : (canonicalDetailPath({ id: pid as string | number, category: (String(v.category ?? \'\') || null) }) || `/products/${pid}`)',
    test: T,
    why: '이 행은 deal_only 를 안 실어 교환권 구분이 불가능하다 — 폴백을 열면 2,260건의 noindex 상세로 크롤 경로가 열린다(반대 방향).',
  },
  {
    name: '🎬 유어쇼츠 딜 링크 — 카테고리 게이트를 없애고 product_id 만 보면 링크한다',
    file: SRC,
    find: '      const href = pid == null || pid === \'\' ? null',
    replace: '      const href = pid == null || pid === \'\' ? null : `/pass/${pid}` || null',
    test: T,
    why: '게이트가 하는 일은 "종류를 모르는 행을 링크하지 않는 것" 이다 — 없애면 교환권·쇼핑이 전부 /pass 로 간다(반대 방향).',
  },
  {
    name: '🎬 유어쇼츠 딜 링크 — 줄 전체를 anchor 안에 넣는다(목적지를 설명하지 않는 링크)',
    file: SRC,
    find: '      return `<li>${line}${deal}</li>`',
    replace: '      return `<li>${deal ? `<a href="${esc(href || \'\')}">${line}${deal}</a>` : line}</li>`',
    test: T,
    why: 'anchor 글자가 영상 제목·채널이 되면 그 링크는 딜 페이지를 설명하지 않는다 — 미끼 링크다(그리고 남의 채널명이 우리 링크 글자가 된다).',
  },
  {
    name: '🎬 유어쇼츠 딜 링크 — 게이트의 전제를 깬다(한글 카테고리를 voucher 로 매핑)',
    file: CAT,
    find: "  activity_voucher: 'etc_voucher',",
    replace: "  activity_voucher: 'etc_voucher',\n  '외식': 'meal_voucher',",
    test: T,
    why: '그 매핑이 생기면 교환권(카테고리 `외식` 18건)이 isVoucherCategory 를 통과해 /pass 로 링크된다 — 게이트가 조용히 샌다.',
  },
]
