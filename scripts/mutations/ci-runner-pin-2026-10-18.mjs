// 🧱 2026-10-18 CI 러너 이미지 고정 — `ubuntu-latest` 가 2026-10-19 부터 Ubuntu 26.04 로 옮겨 가고,
//   설치된 Playwright 1.58.2 는 그 OS 의 Chromium 을 모른다(필수 체크 Verify 가 브라우저를 깐다).
export default [
  {
    name: '🧱 필수 체크(verify.yml)가 다시 떠다니는 라벨로 돌아간다',
    why: '`ubuntu-latest` 는 커밋 없이 26.04 로 바뀐다. 점진 이전이라 같은 커밋이 어떤 날은 초록, 어떤 날은 빨강인 "플레이크"로 보인다.',
    file: '.github/workflows/verify.yml',
    // 🎯 2026-11-01 재조준: verify.yml 에 주입 판정·분할 잡이 생겨 `runs-on` 이 세 곳이 됐다.
    //   지키려던 것은 **필수 검사 `Verify` 의 실행 환경 고정**이라 그 잡의 줄을 함께 묶어 가른다.
    find: '    if: always()\n    runs-on: ubuntu-24.04\n    name: Verify',
    replace: '    if: always()\n    runs-on: ubuntu-latest\n    name: Verify',
    test: 'src/tests/unit/ci-runner-pin-2026-10-18.test.ts',
  },
  {
    name: '🧱 브라우저 워크플로를 Playwright 가 아직 모르는 26.04 로 올린다',
    why: '고정 자체는 지켰지만 그 이미지에서 `npx playwright install chromium` 이 "does not support chromium on ubuntu26.04-x64" 로 던진다. 이 시험이 Verify 보다 먼저 빨간불을 내야 한다.',
    file: '.github/workflows/render-smoke.yml',
    find: 'runs-on: ubuntu-24.04',
    replace: 'runs-on: ubuntu-26.04',
    test: 'src/tests/unit/ci-runner-pin-2026-10-18.test.ts',
  },
  {
    name: '🧱 브라우저가 아닌 워크플로도 떠다니는 라벨이면 잡는다',
    why: '브라우저 말고도 apt 패키지 이름·기본 도구 버전이 OS 와 함께 바뀐다. 고정은 전 워크플로 공통 규칙이다.',
    file: '.github/workflows/sns-reply-comments.yml',
    find: 'runs-on: ubuntu-24.04',
    replace: 'runs-on: ubuntu-latest',
    test: 'src/tests/unit/ci-runner-pin-2026-10-18.test.ts',
  },
]
