/**
 * 🧬 결제 콜백 주소 — 되돌려-검증 주입 (2026-09-13).
 *
 * 지키는 규칙 둘. **양쪽 다 있어야 의미가 있다**:
 *   ① 쿼리가 살아남는가 — 지워지면 결제가 마지막 화면에서 조용히 실패한다(대표 신고 그 버그)
 *   ② 오픈 리다이렉트가 막히는가 — 고치다 무너뜨리면 훨씬 큰 사고다
 *
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일해야 한다(`--only` 가 부분일치).
 */
export default [
  {
    name: '💳콜백 결제 화면이 옛 함수(쿼리 삭제)로 되돌아간다',
    file: 'src/pages/TossWidgetPayPage.tsx',
    find: `  const successUrl = \`\${window.location.origin}\${safePaymentReturnPath(successUrlRaw, '/')}\``,
    replace: `  const successUrl = \`\${window.location.origin}\${safeInternalPath(successUrlRaw, '/')}\``,
    test: 'src/tests/unit/payment-return-path-2026-09-13.test.ts',
    why:
      '이게 대표가 신고한 그 버그다. 쿼리가 지워지면 토스가 돌려보낼 때 productId 가 없어 ' +
      '"결제 정보가 올바르지 않습니다" 가 뜬다. 에러 로그도 실패 알림도 없이 마지막 화면만 틀린다.',
  },
  {
    name: '💳콜백 쿼리를 떼어 버린다 (경로만 반환)',
    file: 'src/utils/safe-internal-path.ts',
    find: `  if (!rawQuery) return path`,
    replace: `  if (rawQuery || !rawQuery) return path`,
    test: 'src/tests/unit/payment-return-path-2026-09-13.test.ts',
    why:
      '함수 이름만 새것이고 동작은 옛것인 경우. 배선 검사만 있으면 이걸 못 잡는다 — ' +
      '그래서 시험이 실제 입력으로 값을 확인한다.',
  },
  {
    name: '💳콜백 경로 검증을 건너뛴다 (오픈 리다이렉트)',
    file: 'src/utils/safe-internal-path.ts',
    find: `  if (!isSafeInternalPath(path)) return fallback`,
    replace: `  if (false && !isSafeInternalPath(path)) return fallback`,
    test: 'src/tests/unit/payment-return-path-2026-09-13.test.ts',
    why:
      '쿼리를 살리려다 경로 방어를 무너뜨리는 것이 이 수정의 가장 큰 위험이다. ' +
      '//evil.com 이 통과하면 결제 성공 직후 사용자를 외부로 보낼 수 있다.',
  },
  {
    name: '💳콜백 역슬래시·제어문자 사전 차단이 사라진다',
    file: 'src/utils/safe-internal-path.ts',
    find: `  if (raw.includes('\\\\') || /[\\n\\t\\r\\0]/.test(raw)) return fallback`,
    replace: `  if (false) return fallback`,
    test: 'src/tests/unit/payment-return-path-2026-09-13.test.ts',
    why:
      '경로만 검사하고 쿼리를 안 보면, 제어문자·역슬래시가 쿼리 쪽으로 들어온다. ' +
      '쪼개기 **전에** 통째로 거르는 이유가 그것이다.',
  },
  {
    name: '💳콜백 조각(#)을 그대로 남긴다',
    file: 'src/utils/safe-internal-path.ts',
    find: `  const noHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw`,
    replace: `  const noHash = raw`,
    test: 'src/tests/unit/payment-return-path-2026-09-13.test.ts',
    why:
      '조각은 서버 리다이렉트에서 살아남지 못한다. 남겨 두면 "왔겠거니" 하고 읽는 코드를 부르고, ' +
      '그 코드는 실제로는 늘 빈 값을 본다.',
  },
]
