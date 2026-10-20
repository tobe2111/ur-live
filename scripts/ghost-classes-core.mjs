/**
 * 👻 유령 클래스 판정의 **순수 부분** — `check-ghost-classes.mjs` 와 유닛 테스트가 같이 쓴다.
 *
 * 가드 본체는 `dist/` 산출물이 있어야 돌아서 CI 에서 build 뒤에만 실행된다(그래서 주입 검증의
 * 대상이 될 수 없다 — 주입 러너는 build 앞에서 돈다). 판정의 핵심을 여기로 빼면 **동작 자체를
 * 테스트가 직접 잴 수 있고**, 그 테스트에는 주입을 걸 수 있다.
 */

/**
 * CSS 셀렉터에서 클래스명을 복원한다.
 * ⚠️ 유니코드 이스케이프(`\2022`)를 **먼저** 풀어야 한다 — 나중에 풀면 `\2` 가 문자 `2` 로
 *    먼저 먹혀 `content-['•']` 같은 임의값이 영영 안 맞는다(실제로 오탐이 났던 자리다).
 */
export function generatedClasses(css) {
  const out = new Set()
  for (const m of css.matchAll(/\.((?:\\.|[^\s.,:{>~+[\])])+)/g)) {
    const c = m[1]
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\\(.)/g, '$1')
      .replace(/^(?:[a-z-]+:)+/, '')
    out.add(c)
  }
  return out
}

/**
 * 소스의 `className="…"` 리터럴에서 클래스 토큰을 뽑는다.
 * 변수 보간(`${...}`)이 섞인 조각은 건너뛴다 — 런타임에 조립되는 것은 문자열로 판정할 수 없다.
 */
export function sourceTokens(src) {
  const out = []
  for (const m of src.matchAll(/(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\})/g)) {
    const blob = m[1] ?? m[2] ?? m[3] ?? m[4] ?? ''
    const line = src.slice(0, m.index).split('\n').length
    for (let tok of blob.split(/\s+/)) {
      tok = tok.replace(/^[`'"({]+/, '').replace(/[`'")},;]+$/, '').replace(/^(?:[a-z-]+:)+/, '')
      if (!tok || tok.includes('${') || tok.includes('{') || tok.includes('(')) continue
      if (!/^-?[a-z]/.test(tok) || !tok.includes('-')) continue
      out.push({ tok, line })
    }
  }
  return out
}

/**
 * 🕳️ **`className=` 밖에 사는 클래스 뭉치**도 본다 (2026-10-13 신설 — 실측으로 사각지대 확인).
 *
 * ## 왜 필요했나
 * `sourceTokens` 는 `className=`/`class=` **속성 리터럴만** 본다. 그런데 이 레포는 클래스 뭉치를
 * 조회 표·상수·배열·함수 반환으로도 들고 다닌다. 그 자리의 유령은 가드가 **구조적으로** 못 봤고,
 * 재 보니 셋이 있었다(전부 `var()` 색 + 투명도 접미사이거나 없는 단계):
 *
 *     src/pages/AboutPage.tsx          toneBg 조회 표      bg-brand-tint/40   ← 라이브 시각 결함
 *     src/pages/seller-register/…      export const       text-tone-bad/50
 *     src/styles/tokens.ts             토큰 표            shadow-3xl         (Tailwind 에 없는 단계)
 *
 * ⚠️ 셋째 파일(`src/styles/tokens.ts`)은 2026-10-13 에 **삭제**됐다 — importer 0 인 죽은 파일이었다
 *   (`styles/themes.ts` 와 짝). 위 표는 *이 스캔이 왜 필요했나* 의 기록이므로 그대로 둔다.
 *
 * ## 판정 방법 — "클래스 뭉치인지"를 **스스로 증명**하게 만든다
 * 아무 문자열이나 토큰화하면 산문·URL·SQL 이 쏟아진다. 그래서 한 리터럴이
 * **① 모양이 맞는 토큰 2개 이상**이고 **② 그중 하나는 이미 생성된 클래스**일 때만 뭉치로 본다.
 * ②가 핵심이다 — 산문에 실제 Tailwind 클래스가 들어 있을 일은 거의 없다.
 *
 * ## 🩸 되돌려-검증에서 실제로 걸러낸 오탐 셋 (규칙을 지우면 되돌아온다)
 * - **주석 속 산문**: 문서 주석이 클래스명을 백틱으로 인용한다(`bg-surface/95`·`px-6/8`·`bg-*-500`).
 *   백틱 인용은 템플릿 리터럴과 **모양이 같다** ⇒ 그래서 **주석을 먼저 걷어낸다**(`comment-strip.mjs`).
 * - **문자열 안의 HTML**: 워커 SSR 빌더·마크다운 렌더러가 `class="…"` 를 문자열로 조립한다
 *   (`gap-2">` · `my-3"><code>`) ⇒ 토큰에 `<`·`>` 가 있으면 버린다. 그 자리는 애초에
 *   좁은 `class=` 스캔이 이미 본다.
 * - **런타임 조립 조각**: `.replace('text-', 'bg-')` 의 `'bg-'` ⇒ `-` 로 끝나는 토큰은 버린다.
 *
 * ⚠️ **이 스캔이 여전히 못 보는 것**: 여러 줄 템플릿 리터럴 · 토큰에 따옴표·괄호가 든 임의값
 *   (`content-['•']` — 좁은 스캔이 본다) · `classList.add(변수)`. 넓혔지만 전수는 아니다.
 */
export function wideTokens(src, generated, stripComments) {
  const out = []
  const code = stripComments ? stripComments(src) : src
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
      const blob = m[1] ?? m[2] ?? m[3] ?? ''
      if (blob.length < 3 || blob.length > 400) continue
      const ok = []
      for (let tok of blob.split(/\s+/)) {
        // 꼬리 구두점을 떼고 본다 — inline CSS 의 값 목록
        // (`'opacity 220ms ease-out, filter 200ms ease-out'`)이 `ease-out,` 로 잡혔다.
        tok = tok.replace(/[,;]+$/, '').replace(/^(?:[a-z-]+:)+/, '')
        if (!tok || !/^-?[a-z]/.test(tok) || !tok.includes('-')) continue
        if (/[<>${}()"'*\\]/.test(tok)) continue
        if (/[-/]$/.test(tok)) continue
        ok.push(tok)
      }
      // 뭉치임을 스스로 증명하지 못하면 통째로 버린다(위 머리말 ①②).
      if (ok.length < 2 || !ok.some((t) => generated.has(t))) continue
      for (const tok of ok) out.push({ tok, line: i + 1 })
    }
  }
  return out
}

/** 생성된 집합에서 "유틸리티 루트"(첫 하이픈 앞)만 모은다 — 커스텀 클래스 오탐을 걸러내는 장치. */
export function utilityRoots(generated) {
  const roots = new Set()
  for (const g of generated) { const r = g.replace(/^-/, '').split('-')[0]; if (r) roots.add(r) }
  return roots
}

/** 소스 토큰 중 **생성되지 않은** 것. allow 는 이유와 함께 등록된 예외. */
export function findGhosts({ generated, roots, tokens, allow = new Set() }) {
  const hits = new Map()
  for (const { tok, line, file } of tokens) {
    if (generated.has(tok) || allow.has(tok)) continue
    if (!roots.has(tok.replace(/^-/, '').split('-')[0])) continue
    if (!hits.has(tok)) hits.set(tok, [])
    hits.get(tok).push(file ? `${file}:${line}` : String(line))
  }
  return hits
}
