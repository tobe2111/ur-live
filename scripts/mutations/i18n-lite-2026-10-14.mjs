/**
 * 🌐 i18next → i18n-lite (2026-10-14) — 주입 매니페스트.
 * 가드: src/tests/unit/i18n-lite-2026-10-14.test.tsx
 * 어긋나면 에러 없이 화면에 키 이름이나 `{{x}}` 가 뜬다 — 결함을 심어 가드가 실제로 잡는지 본다.
 */
const TEST = 'src/tests/unit/i18n-lite-2026-10-14.test.tsx'
const LITE = 'src/lib/i18n-lite.ts'

export default [
  {
    name: '[i18n-lite] 그룹 안의 점 든 키를 못 찾는다',
    file: LITE,
    find: '    for (let j = i; j < tokens.length; ++j) {',
    replace: '    for (let j = i; j <= i; ++j) {',
    test: TEST,
    why: '`cancelOrder.title` 같은 키 129개가 화면에 키 이름으로 뜬다.',
  },
  {
    name: '[i18n-lite] 안 넘긴 변수를 빈칸으로 지운다',
    file: LITE,
    find: "Object.prototype.hasOwnProperty.call(data, name) ? '' : whole",
    replace: "''",
    test: TEST,
    why: 'i18next 는 `{{x}}` 를 그대로 둔다 — 문구 모양이 바뀐다.',
  },
  {
    name: '[i18n-lite] 빈 문자열 번역을 "없음" 으로 보고 기본값을 낸다',
    file: LITE,
    find: '    } else if (found !== undefined) {',
    replace: "    } else if (found !== undefined && found !== '') {",
    test: TEST,
    why: '의도적으로 비워 둔 문구 자리에 기본값이 뜬다.',
  },
  {
    name: '[i18n-lite] fallbackLng 를 안 본다',
    file: LITE,
    find: "    return fb && fb !== this.language ? [this.language, fb] : [this.language]",
    replace: '    return [this.language]',
    test: TEST,
    why: '다른 언어 사용자에게 한국어 폴백 대신 키 이름이 뜬다.',
  },
  {
    name: '[i18n-lite] 문구가 더해져도 다시 그리지 않는다',
    file: LITE,
    find: "    i18n.on('languageChanged added', f)",
    replace: "    i18n.on('languageChanged', f)",
    test: TEST,
    why: '첫 화면이 critical 키만으로 그려진 뒤 전체 번역이 도착해도 기본값·키 이름이 남는다.',
  },
  {
    name: '[i18n-lite] 빠진 키 안전망을 안 부른다',
    file: LITE,
    find: '      if (this.options.saveMissing && this.options.missingKeyHandler) {',
    replace: '      if (false) {',
    test: TEST,
    why: '대시보드 문구가 영영 안 불러와진다.',
  },
  {
    name: '[i18n-lite] 후처리기(TODO 표식 제거)를 건너뛴다',
    file: LITE,
    find: '      if (p) res = p.process(res, key, opts)',
    replace: '      void p',
    test: TEST,
    why: '`[TODO:en]` 번역자 표식이 화면에 나간다.',
  },
]
