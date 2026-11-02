/**
 * 🧬 주입 — verify.yml 단계 *추가만* 은 전수가 아니다 (2026-11-01 대표 *"모두 다 해줘"*)
 *    가드: src/tests/unit/guard-mutations-scope.test.ts
 *
 * 이 판정은 **좁히는 쪽**이라 틀리면 위험하다 — 기존 줄을 바꾼 PR 까지 좁혀 돌면, 러너 환경이 바뀐
 * 채 주입 대부분이 검증 안 된다. 그래서 주입이 전부 "좁히지 말아야 할 때 좁히는" 방향을 겨눈다.
 */
const T = 'src/tests/unit/guard-mutations-scope.test.ts'
const F = 'scripts/guard-mutations-scope.mjs'
export default [
  {
    name: '단계추가판정 — 기존 줄이 바뀌어도 통과시킨다',
    file: F,
    find: '  if (j !== base.length) return false // ① 기존 줄이 지워지거나 바뀌었다',
    replace: '  // (주입) 기존 줄 대조 생략',
    test: T,
    why: '주입 단계 자신이나 strict 플래그를 고친 PR 까지 좁혀 돈다 — 러너 환경이 바뀐 채 주입 대부분이 검증 안 된다.',
  },
  {
    name: '단계추가판정 — 실행 환경 줄(uses·env)을 허용한다',
    file: F,
    find: '  return added.every((l) => STEP_ADD_LINE.some((re) => re.test(l))) // ③ 실행 환경 줄 0',
    replace: '  return true',
    test: T,
    why: 'setup-node 나 env 를 끼워 넣은 변경이 좁혀진다 — 그건 주입이 도는 환경 자체를 바꿀 수 있다.',
  },
  {
    name: '단계추가판정 — 새 단계 없이 기존 단계에 줄만 끼워도 통과',
    file: F,
    find: "  if (!added.some((l) => /^      - name: \\S/.test(l))) return false // ② 새 단계가 아니다",
    replace: '  // (주입) 새 단계 요구 생략',
    test: T,
    why: '기존 strict 단계에 continue-on-error: true 를 끼우는 변경(검사 약화)까지 "추가" 로 읽힌다.',
  },
  {
    name: '단계추가판정 — 판정 결과를 무시하고 언제나 좁힌다',
    file: F,
    find: '    why = verifyChangeIsStepAdditionOnly(baseSrc, headSrc)\n      ? null\n',
    replace: '    why = true\n      ? null\n',
    test: T,
    why: 'verify.yml 을 어떻게 바꾸든 전수가 안 돈다 — 이 변경 전보다 훨씬 나쁘다.',
  },
  {
    name: '단계추가판정 — 다른 전수 사유를 가린다',
    file: F,
    find: '  if (other) why = other',
    replace: '  if (other) why = null',
    test: T,
    why: 'package.json 같은 진짜 전수 사유가 있는데 verify.yml 이 단계 추가라는 이유로 좁혀진다.',
  },
]
