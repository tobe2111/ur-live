/**
 * 🔒 sitemap 이 서류 사진을 구글에 넘기지 않는다 (2026-10-11 라이브 실측) — 주입 매니페스트.
 * 가드: src/tests/unit/sitemap-private-image-2026-10-11.test.ts
 */
const TEST = 'src/tests/unit/sitemap-private-image-2026-10-11.test.ts'

export default [
  {
    name: '🔒 sitemap — 거부 목록에서 biz-cert 가 빠져 사업자등록증이 다시 색인 요청된다',
    file: 'src/shared/seo/indexable-image.ts',
    find: "  'biz-cert',   // 사업자등록증\n",
    replace: '',
    test: TEST,
    why: '라이브에서 실제로 샜던 바로 그 접두사다(/pass/2916). 빠지면 에러 없이 구글에 다시 넘어가고, 색인은 배포로 못 되돌린다.',
  },
  {
    name: '🔒 sitemap — 초크포인트가 판정을 건너뛰고 원시 URL 을 그대로 내보낸다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: "    const imgLoc = isIndexableImageUrl(rawImg) ? rawImg : '';",
    replace: '    const imgLoc = rawImg;',
    test: TEST,
    why: '마지막 방어선이다 — 여기가 뚫리면 출처(공구·상품·블로그·셀러) 어느 쪽으로 들어온 서류든 전부 샌다.',
  },
  {
    name: '🔒 sitemap — 판정이 경로가 아니라 호스트만 봐서 cdn-cgi 변환본 속 서류를 놓친다',
    file: 'src/shared/seo/indexable-image.ts',
    find: "    if (lower.includes(`/uploads/${p}/`)) return false",
    replace: "    if (lower.startsWith(`/uploads/${p}/`)) return false",
    test: TEST,
    why: 'cdn-cgi 변환본은 원본 URL 을 **경로 한가운데** 품는다 — 앞자락만 보면 상세 히어로가 쓰는 바로 그 모양이 통째로 샌다.',
  },
  {
    name: '🔒 sitemap — 공구 커버가 비공개여도 OG 카드로 대체하지 않고 그대로 싣는다',
    file: 'src/worker/routes/sitemap.routes.ts',
    find: '          image: (isIndexableImageUrl(g.image_url) && g.image_url) || `${origin}/api/og/group-buy/${g.id}`,',
    replace: '          image: g.image_url || `${origin}/api/og/group-buy/${g.id}`,',
    test: TEST,
    why: '라이브가 정확히 이 모양이었다 — products.image_url 을 그대로 실어 보내던 줄.',
  },
  {
    name: '🔒 sitemap — 판정이 무엇이든 통과시켜 가드가 헛돈다',
    file: 'src/shared/seo/indexable-image.ts',
    find: '  const lower = path.toLowerCase()',
    replace: '  const lower = ""',
    test: TEST,
    why: '함수는 남고 판정만 죽는 모양 — 배선 검사만 있으면 초록이 뜬다. 규칙 검사가 실제로 값을 재는지 확인한다.',
  },
  {
    name: '🔒 sitemap — 새 업로드 접두사가 분류 없이 들어와도 조용히 통과한다',
    file: 'src/features/district/api/district-coupon.routes.ts',
    find: 'const key = `uploads/district/${camp.id}/${ym}/${randomKey(32)}.${ext}`',
    replace: 'const key = `uploads/receipt-scan/${camp.id}/${ym}/${randomKey(32)}.${ext}`',
    test: TEST,
    why: '새 업로드 경로가 생기는 **실제 모양**이다. 거부 목록은 새 비공개 접두사를 놓치는 방향으로 틀리므로, "분류 안 된 접두사가 나타나면 빨간불" 이 그 유일한 보완이다 — 이게 헛돌면 다음 서류 유출을 아무도 못 막는다.',
  },
]
