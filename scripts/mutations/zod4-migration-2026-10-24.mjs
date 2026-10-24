/**
 * 🧬 주입 — zod 3 → 4 이행(2026-10-24). 가드: src/tests/unit/zod4-migration-2026-10-24.test.ts
 */
const T = 'src/tests/unit/zod4-migration-2026-10-24.test.ts'
export default [
  {
    name: 'zod4 — 사라진 ZodError.errors 를 다시 읽는다',
    file: 'src/lib/validation-schemas.ts',
    find: "    const errors = result.error.issues.map((e) => e.message).join(', ');",
    replace: "    const errors = (result.error as any).errors.map((e: any) => e.message).join(', ');",
    test: T,
    why: 'zod 4 에 errors 가 없어 검증 실패 순간 TypeError 로 500 이 난다(as any 라 tsc 도 못 본다).',
  },
  {
    name: 'zod4 — z.record 를 한 인자로 되돌린다',
    file: 'src/worker/routes/order.routes.ts',
    find: 'options: z.record(z.string(), z.string()).optional(),',
    replace: 'options: z.record(z.string()).optional(),',
    test: T,
    why: 'zod 4 에서 한 인자 z.record 는 값 타입을 잃어 주문 옵션 검증이 무력해진다.',
  },
]
