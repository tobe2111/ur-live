/**
 * 🧟 러너가 **없는 가드 스크립트**를 부른다 (2026-10-12 실측 3건에서 도출) — 주입 매니페스트.
 *
 * 가드: scripts/check-guard-registry.mjs 의 R3 · 시험: src/tests/unit/guard-registry-r3-2026-10-12.test.ts
 *
 * 2026-10-11 도매몰 철거로 가드 셋이 삭제됐는데 `install-git-hooks.sh` 가 계속 불렀고,
 * 전부 `|| true` 라 매 커밋마다 `MODULE_NOT_FOUND` 스택만 찍고 조용히 넘어갔다.
 * verify.yml 엔 없어서 **CI 는 영원히 못 본다** — 커밋하는 사람만 스택을 보고, 그마저 삼켜졌다.
 */
const TEST = 'src/tests/unit/guard-registry-r3-2026-10-12.test.ts'
const GUARD = 'scripts/check-guard-registry.mjs'

export default [
  {
    name: '🧟 R3 — 죽은 호출을 세지 않는다',
    file: GUARD,
    find: 'if (!existsSync(c[1])) deadCalls.push({ runner: src, script: c[1] })',
    replace: 'void c',
    test: TEST,
    why:
      'R1(가드 → 러너)만 남으면 이 방향이 통째로 눈먼다 — 가드 파일이 **사라지면** R1 의 순회 ' +
      '대상에서도 빠져 아무 말도 안 한다. 2026-10-12 에 셋이 그 상태로 발견됐다.',
  },
  {
    name: '🧟 R3 — 워크플로는 안 본다(훅만 본다)',
    file: GUARD,
    find: "...readdirSync('.github/workflows').filter((f) => /\\.ya?ml$/.test(f)).map((f) => `.github/workflows/${f}`),",
    replace: '',
    test: TEST,
    why:
      '죽은 호출은 훅에서만 생기는 게 아니다. CI 에서 삭제된 가드를 부르면 그쪽은 `|| true` 가 ' +
      '없어 잡히지만, **경고만 내는 스텝**(`continue-on-error`)이면 똑같이 조용히 넘어간다.',
  },
  {
    name: '🧟 R3 — 호출을 한 건도 못 찾아도 통과한다',
    file: GUARD,
    find: "    console.error('❌ [guard-registry] R3 이 가드 호출을 한 건도 못 찾았다 — 이 검사가 헛돈다.')\n    process.exit(1)",
    replace: '    void 0',
    test: TEST,
    why:
      '정규식이나 러너 경로가 낡으면 매칭이 0 이 되고, 그때 **없는 호출은 당연히 0** 이라 ' +
      '초록이 뜬다. 이 레포가 반복해 당한 "검사가 실패할 수 없음" 이라 하한을 둔다.',
  },
  {
    name: '🧟 R3 — 주석 속 예시 호출까지 센다',
    file: GUARD,
    find: "      .split('\\n').filter((l) => !/^\\s*#/.test(l)).join('\\n')",
    replace: '',
    test: TEST,
    why:
      '훅 파일은 주석에 **제거 기록**을 남긴다(이 수리가 바로 그걸 적었다). 주석을 세면 ' +
      '"지웠다" 고 적어 둔 그 줄이 거짓 빨간불을 낸다 — 2026-10-12 에 robots.txt 에서 같은 함정을 두 번 밟았다.',
  },
]
