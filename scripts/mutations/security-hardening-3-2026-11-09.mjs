/**
 * 🔐 2026-11-09 보안 전수조사 3차(낮음) — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-3-2026-11-09.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-3-2026-11-09.test.ts'

export default [
  {
    name: '[sec3] 결제 점검이 비밀키 앞 12자를 다시 보인다',
    file: 'src/worker/routes/healthcheck.routes.ts',
    find: "        masked: secretKey ? `${secretKey.split('_').slice(0, 2).join('_')}_…(${secretKey.length}자)` : '(empty)',",
    replace: '        masked: mask(secretKey),',
    test: TEST,
    why: '공개 응답에 Toss 비밀키 일부가 실린다.',
  },
  {
    name: '[sec3] 재호스팅이 SVG 를 받는다',
    file: 'src/worker/utils/rehost-image.ts',
    find: "          if (isRasterImageType(rct)) {",
    replace: "          if (rct.startsWith('image/')) {",
    test: TEST,
    why: '스크립트가 든 SVG 가 우리 출처에 올라간다.',
  },
  {
    name: '[sec3] 디지털 상품 미리보기 주소를 검증 없이 저장',
    file: 'src/features/seller/api/product-field-writers.ts',
    find: "    ['preview_url', safeHttpHref(body.preview_url) || null],",
    replace: "    ['preview_url', body.preview_url || null],",
    test: TEST,
    why: 'javascript: 주소가 저장돼 구매자 화면에서 열린다.',
  },
  {
    name: '[sec3] 관리자 증빙 링크를 그대로 그린다',
    file: 'src/pages/AdminProspectsPage.tsx',
    find: '<a href={safeHttpHref(p.proof_image_url)}',
    replace: '<a href={p.proof_image_url}',
    test: TEST,
    why: '관리자가 증빙을 누르면 소개자가 넣은 스크립트가 관리자 세션에서 돈다.',
  },
  {
    name: '[sec3] 몰 공지 링크가 // 를 다시 받는다',
    file: 'src/features/mall/api/mall-admin.routes.ts',
    find: '!/^(https?:\\/\\/|\\/(?![\\/\\\\]))/i.test(link)',
    replace: '!/^(https?:\\/\\/|\\/)/i.test(link)',
    test: TEST,
    why: '몰 공지에서 외부 사이트로 보내는 링크를 걸 수 있다.',
  },
  {
    name: '[sec3] SSR 시드가 </script 만 이스케이프',
    file: 'src/worker/utils/ssr-payload.ts',
    find: "  return body.replace(/</g, '\\\\u003c');",
    replace: "  return body.replace(/<\\/script/gi, '<\\\\/script');",
    test: TEST,
    why: '상품명에 <!--<script> 가 들어가면 첫 화면 시드가 뒤 문서를 삼킨다.',
  },
  {
    name: '[sec3] 지오코딩 횟수 제한을 뺀다',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: " rateLimit({ action: 'ensure_geocode', max: 30, windowSec: 60 }),",
    replace: '',
    test: TEST,
    why: '로그인 없이 외부 지도 API 호출을 무한히 일으킨다.',
  },
]
