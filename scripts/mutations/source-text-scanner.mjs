/**
 * 🔬 주석 제거기(가드들의 눈) — 주입 매니페스트 (2026-09-13).
 * 가드: src/tests/unit/source-text-scanner.test.ts
 *
 * 🔴 이 항목들은 **가드의 가드**다. 여기가 헛돌면 레포의 텍스트 가드 수십 개가 동시에 눈이 먼다.
 */
const TEST = 'src/tests/unit/source-text-scanner.test.ts'
const FILE = 'src/tests/helpers/source-text.ts'

export default [
  {
    name: '🔬 닫는 태그 `</div>` 를 다시 정규식 시작으로 읽는다 (.tsx 주석이 통째로 살아남는다)',
    file: FILE,
    find: "    if (c === '/' && prev !== '<' && /[(,=:[!&|?{};+\\-*%^~<>]/.test(prev)) {",
    replace: "    if (c === '/' && /[(,=:[!&|?{};+\\-*%^~<>]/.test(prev)) {",
    test: TEST,
    why:
      '2026-09-13 실측: 이 한 글자 때문에 RegisterPage.tsx 는 15,428자 중 141자만 지워졌다 — ' +
      '사실상 주석 제거를 안 한 것이고, 그 상태로 모든 가드가 초록이었다.',
  },
  {
    name: '🔬 그 줄에서 안 닫히는 따옴표도 문자열로 본다 (JSX 아포스트로피가 파일을 삼킨다)',
    file: FILE,
    find: "      if (c !== '`' && !hasCloserOnLine(text, i, c)) { out += c; prev = c; i++; continue }",
    replace: '',
    test: TEST,
    why: "JSX 본문의 `don't` 가 문자열을 열어 다음 따옴표까지의 주석을 전부 살려 둔다.",
  },
  {
    name: '🔬 정규식이 줄을 넘어가도 계속 먹는다 (한 줄 안전판 제거)',
    file: FILE,
    find: "      if (!hasCloserOnLine(text, i, '/')) { out += c; prev = c; i++; continue }",
    replace: '',
    test: TEST,
    why: '휴리스틱이 틀렸을 때 피해를 한 줄로 가두는 안전판이다 — 없으면 오판 하나가 파일 뒤쪽을 통째로 살린다.',
  },
  {
    name: '🔬 여러 줄 템플릿까지 한 줄로 가둔다 (정상 코드가 잘린다)',
    file: FILE,
    find: "      if (c !== '`' && !hasCloserOnLine(text, i, c)) { out += c; prev = c; i++; continue }",
    replace: '      if (!hasCloserOnLine(text, i, c)) { out += c; prev = c; i++; continue }',
    test: TEST,
    why: '백틱은 여러 줄이 정상이다 — 백틱까지 막으면 템플릿 안의 `//` 가 주석으로 지워진다.',
  },
]
