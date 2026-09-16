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
