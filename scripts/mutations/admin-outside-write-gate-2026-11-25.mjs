/** 🔐 2026-11-25 `/api/admin` 밖 쓰기의 어드민 역할 게이트 — 가드: src/tests/unit/admin-outside-write-gate-2026-11-25.test.ts */
const TEST = 'src/tests/unit/admin-outside-write-gate-2026-11-25.test.ts'

export default [
  {
    name: '[rbac-out] 전역 쓰기 게이트가 빠진다 (밖의 쓰기 66곳이 다시 역할을 안 본다)',
    file: 'src/worker/index.ts',
    find: "app.use('/api/*', adminOutsideWriteGate());\n",
    replace: '',
    test: TEST,
    why: '조회 전용 어드민이 이용권 일괄 환불·주문 취소·출금 승인·기능 플래그 변경을 한다.',
  },
  {
    name: '[rbac-out] 조회 전용 어드민이 밖에서 쓰기를 한다',
    file: 'src/shared/admin-roles.ts',
    find: "  if (isAdminSelfServiceOutside(pathname)) return true\n  if (role === 'viewer') return false\n",
    replace: "  if (isAdminSelfServiceOutside(pathname)) return true\n",
    test: TEST,
    why: '읽기 전용 계정이 돈이 나가는 경로를 포함해 표에 없는 모든 쓰기를 통과한다.',
  },
  {
    name: '[rbac-out] 역할 판정이 다시 쿠키로 내려간다 (손님·사장님 요청을 어드민 역할로 막는다)',
    file: 'src/worker/middleware/admin-rbac.ts',
    find: "        return null;\n      }\n    } catch { /* fall through to cookie */ }",
    replace: "      }\n    } catch { /* fall through to cookie */ }",
    test: TEST,
    why: '같은 브라우저에 제한 역할 어드민 쿠키가 남아 있으면 유효한 유저·셀러 토큰의 구매·반품 처리가 403 이 된다.',
  },
  {
    name: '[rbac-out] 주문 취소(카드 환불)가 역할 표에서 빠진다',
    file: 'src/shared/admin-roles.ts',
    find: "  { pattern: /^\\/api\\/orders\\/[^/]+\\/cancel(?:$|[/?])/, allow: ['cs', 'finance'] },",
    replace: '',
    test: TEST,
    why: 'ops 역할이 주문을 취소해 카드 환불을 낸다(환불은 cs·finance 의 일이다).',
  },
  {
    name: '[rbac-out] 어드민 토큰이 번호가 같은 매장으로 동작한다',
    file: 'src/features/seller/api/seller-analytics.routes.ts',
    find: "  if (user.type !== 'seller') return null\n",
    replace: "  if (user.type !== 'seller' && user.type !== 'admin') return null\n",
    test: TEST,
    why: '어드민 #N 이 매장 #N 의 쿠폰을 만들고 리뷰에 답글을 단다.',
  },
]
