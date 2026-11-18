/** 🖥️ 2026-11-18 실행기 스위치 — 가드: src/tests/unit/ci-runner-switch-2026-11-18.test.ts */
const TEST = 'src/tests/unit/ci-runner-switch-2026-11-18.test.ts'
export default [
  {
    name: '[ci-runner] 포크 PR 이 대표 PC 에서 돈다',
    file: '.github/workflows/verify.yml',
    find: "    if: always()\n    runs-on: ${{ (vars.CI_RUNNER == '' || contains(github.event.pull_request.title, '[ci-hosted]') || github.event.pull_request.head.repo.full_name != github.repository) && 'ubuntu-24.04' || vars.CI_RUNNER }}",
    replace: "    if: always()\n    runs-on: ${{ (vars.CI_RUNNER == '' || contains(github.event.pull_request.title, '[ci-hosted]')) && 'ubuntu-24.04' || vars.CI_RUNNER }}",
    test: TEST,
    why: '남이 올린 코드가 대표 PC 에서 실행된다.',
  },
  {
    name: '[ci-runner] 변수가 비어도 자체 실행기를 찾는다',
    file: '.github/workflows/deploy-ads.yml',
    find: "    runs-on: ${{ (vars.CI_RUNNER == '' || github.event.inputs.runner == 'hosted') && 'ubuntu-24.04' || vars.CI_RUNNER }}",
    replace: "    runs-on: self-hosted",
    test: TEST,
    why: '실행기가 없으면 배포가 영원히 대기한다 — 사이트에 새 코드가 안 나간다.',
  },
  {
    name: '[ci-runner] 배포의 비상구 입력이 사라진다',
    file: '.github/workflows/main.yml',
    find: "      runner:\n        description: \"실행기 — 비우면 저장소 변수 CI_RUNNER 를 따른다. 'hosted' 면 GitHub 기계(PC 가 꺼져 있을 때의 비상구).\"\n        type: string\n        default: ''\n",
    replace: '',
    test: TEST,
    why: 'PC 가 꺼져 있을 때 급한 수정을 내보낼 길이 없다.',
  },
  {
    name: '[ci-runner] 사이트 생존 확인이 스위치를 탄다',
    file: '.github/workflows/uptime.yml',
    find: 'runs-on: ubuntu-24.04',
    replace: "runs-on: ${{ vars.CI_RUNNER || 'ubuntu-24.04' }}",
    test: TEST,
    why: 'PC 가 꺼지면 사이트가 죽어도 아무도 모른다.',
  },
]
