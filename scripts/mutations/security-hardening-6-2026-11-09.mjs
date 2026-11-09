/**
 * 🔐 2026-11-09 보안 전수조사 6차 — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-6-2026-11-09.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-6-2026-11-09.test.ts'

export default [
  {
    name: '[sec6] 셀러 PIN 화면이 다시 별칭 verify 로 로그인 확인',
    file: 'src/features/seller/api/seller-pin.routes.ts',
    find: "const payload = await verifyLogin(authorization.substring(7), jwtSecret, 'HS256')",
    replace: "const payload = await verifyJwt(authorization.substring(7), jwtSecret, 'HS256')",
    test: TEST,
    why: '90일짜리 옛 재발급 토큰으로 PIN 을 바꾼다.',
  },
  {
    name: '[sec6] 유튜브 연결이 다시 hono verify',
    file: 'src/features/youtube/api/youtube.routes.ts',
    find: "import { verifyLogin as honoVerify } from '../../../worker/utils/login-token-policy'",
    replace: "import { verify as honoVerify } from 'hono/jwt'",
    test: TEST,
    why: '옛 재발급 토큰이 유튜브 연결 로그인으로 통한다.',
  },
  {
    name: '[sec6] 로그인 상태 확인이 용도 토큰을 유저로 본다',
    file: 'src/worker/routes/auth.routes.ts',
    find: "const p = await verifyLogin(bearer, c.env.JWT_SECRET, 'HS256')",
    replace: "const p = await jwtVerify(bearer, c.env.JWT_SECRET, 'HS256')",
    test: TEST,
    why: 'type 없는 PIN 토큰(sub=셀러 id)이 같은 번호 유저의 세션이 된다.',
  },
  {
    name: '[sec6] OCR 횟수 제한을 뺀다',
    file: 'src/features/seller/api/seller-profile.routes.ts',
    find: " rateLimit({ action: 'seller_ocr_verify', max: 10, windowSec: 3600 }),",
    replace: '',
    test: TEST,
    why: 'AI 판독을 무한히 불러 비용이 샌다.',
  },
  {
    name: '[sec6] 카카오 프록시가 size 를 그대로 붙인다',
    file: 'src/worker/routes/proxy.routes.ts',
    find: "  const size = kakaoSize(c.req.query('size')); // 🔐",
    replace: "  const size = c.req.query('size') || '15'; // 🔐",
    test: TEST,
    why: '우리 카카오 키로 임의 파라미터를 끼운 요청이 나간다.',
  },
]
