/**
 * 🔏 **추출 규칙 지문** — `REEXTRACT_RULES_VERSION` 을 언제 올려야 하는지 정확히 판정한다 (2026-08-05).
 *
 * ## 왜 만들었나 — 기존 가드가 "파일이 바뀌었나"만 봤다
 * `check-rules-version-bump` 는 감시 파일 셋(`influencer-discovery`·`-email-rules`·`-parse`)의
 * **주석 뺀 전체 내용**을 비교한다. 그래서 그 파일 안의 **계측 카운터 한 줄**에도 bump 를 요구한다.
 * 그런데 bump 는 공짜가 아니다:
 * ```
 *   올리면  → 36,880행 재추출 패스가 처음부터 다시 돈다(진행 중이던 패스는 버려진다)
 *   안 올리면 → 개선된 추출기가 기존 행에 영원히 안 닿는다(시간 폴백 없음)
 * ```
 * 그 파일에 계측을 넣으려면 **둘 중 하나를 골라야 했다**: 헛도는 재추출로 CPU(지금 가장 희소한 자원)를
 * 태우거나, `rules-version-ok` 로 그 가드를 **영구히** 침묵시키거나. 둘 다 나쁘다.
 *
 * ## 그래서 판정을 좁혔다 — "파일이 바뀌었나"가 아니라 **"규칙이 바뀌었나"**
 * 추출 결과를 실제로 바꾸는 것만 지문에 넣는다: **정규식 상수 + 추출 함수 본문**.
 * 계측 카운터·로깅·주석은 지문 밖이므로 안 걸리고, 정규식 한 글자만 바뀌어도 걸린다.
 *
 * ⚠️ **이 시험이 못 보는 것 — 과신 금지**
 * - **간접 규칙 변경**: 지문 밖 헬퍼(`uniqLower`·`normHandle`)나 다른 모듈(`contact-deobfuscate`)이
 *   바뀌면 추출 결과가 달라져도 안 걸린다. 그래서 아래 `INDIRECT` 로 그 헬퍼들도 함께 지문에 넣는다 —
 *   **넣은 목록이 전부라는 보장은 없다.** 새 헬퍼를 추출 경로에 끼우면 여기 추가할 것.
 * - **버전을 올려야 하는지 여부만** 말한다. 올린 뒤 재추출이 실제로 도는지는 라이브 관측(`classified_v`).
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = (p: string) => {
  const s = readFileSync(resolve(process.cwd(), p), 'utf8')
  // 대상이 비면 **통과가 아니라 실패**다(경로가 낡으면 지문이 조용히 무의미해진다).
  expect(s.length, `${p} 를 못 읽었다 — 경로가 낡았나`).toBeGreaterThan(100)
  return s
}

/**
 * 정규식 상수 한 줄 — **값이 정규식 리터럴로 시작하는 모든 top-level const**.
 *
 * ⚠️ 첫 판은 이름으로 골랐다(`_RE` 로 끝나는 것). 되돌려-검증에서 `NOT_EMAIL_SUFFIX` 의 정규식을
 *   바꿔 봤더니 **초록이 떴다** — 이름 규칙에서 빠져 지문에 안 들어갔던 것이다.
 *   이름은 사람이 짓는 것이라 규칙이 될 수 없다. **값의 모양**으로 고른다.
 */
const regexLines = (src: string): string[] =>
  src.split('\n')
    .filter(l => /^\s*(?:export\s+)?const\s+\w+\s*(?::\s*RegExp\s*)?=\s*\//.test(l))
    .map(l => l.replace(/\s*\/\/.*$/, '').trim())

/** 규칙 전용 모듈 — 통째로 지문에 넣는다(그 파일엔 규칙 말고 다른 게 없다). 주석·빈 줄은 뺀다. */
const wholeModule = (src: string): string =>
  src.split('\n')
    .map(l => l.replace(/\s*\/\/.*$/, '').trim())
    .filter(l => l && !l.startsWith('*') && !l.startsWith('/*'))
    .join('\n')

/** 이름으로 함수 본문을 집는다 — 선언줄부터 **열 0 의 닫는 중괄호**까지(이 코드베이스의 포맷 규약). */
function fnBody(src: string, name: string): string {
  const i = src.search(new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`, 'm'))
  expect(i, `함수 ${name} 을 못 찾았다 — 이름이 바뀌었으면 이 목록도 함께 고쳐라(낡은 지도)`).toBeGreaterThan(-1)
  const end = src.indexOf('\n}', i)
  expect(end, `${name} 의 끝을 못 찾았다`).toBeGreaterThan(i)
  return src.slice(i, end + 2)
}

/**
 * 화살표 상수 선언 **블록** — `const x = …` 부터 다음 top-level 선언/빈 줄 직전까지.
 *
 * ⚠️ 첫 판은 **한 줄만** 집었다. `stripVideoTitles` 는 정규식이 **둘째 줄**에 있어 그 규칙을 통째로
 *   놓쳤다(그리고 `fnBody` 는 `function` 키워드만 찾아 아예 못 찾았다). 선언 형태는 사람이 고르는
 *   것이라 규칙이 될 수 없다 — **블록으로** 집는다.
 */
function arrowLine(src: string, name: string): string {
  const lines = src.split('\n')
  const i = lines.findIndex(l => new RegExp(`^(?:export\\s+)?const\\s+${name}\\s*[=:]`).test(l))
  expect(i, `헬퍼 ${name} 을 못 찾았다 — 이름이 바뀌었나(낡은 지도)`).toBeGreaterThan(-1)
  const out = [lines[i]]
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j]
    if (!l.trim() || /^(?:export\s+)?(?:const|let|function|class|interface|type|\/\*)/.test(l)) break
    out.push(l)
  }
  return out.map(l => l.replace(/\s*\/\/.*$/, '').trimEnd()).join('\n')
}

/**
 * 🎯 **지문에 들어가는 것** — 바뀌면 추출 결과가 달라지는 것만.
 *   ⚠️ 여기 없는 것은 안 걸린다. 추출 경로에 새 함수를 끼우면 **반드시 추가**할 것.
 */
function fingerprint(): string {
  const disc = read('src/features/marketing/api/influencer-discovery.ts')
  const mail = read('src/features/marketing/api/influencer-email-rules.ts')
  const parse = read('src/features/marketing/api/influencer-parse.ts')
  const deob = read('src/features/marketing/api/contact-deobfuscate.ts')
  const parts = [
    // 🧱 **규칙 전용 모듈은 통째로** — 그 파일엔 규칙 말고 다른 게 없으므로 골라 담을 이유가 없다.
    //   골라 담으면 빠뜨린다(이 시험의 첫 판이 그랬다).
    wholeModule(mail), wholeModule(deob),
    // 🎯 혼재 모듈은 규칙 부분만 — 정규식 상수 + 추출 함수 본문 + 그 함수가 부르는 헬퍼.
    ...regexLines(disc), ...regexLines(parse),
    fnBody(disc, 'extractContacts'),
    fnBody(disc, 'pickBusinessEmail'),
    fnBody(disc, 'isLikelyNoise'),
    arrowLine(parse, 'stripVideoTitles'), // 화살표 상수다 — `function` 이 아니다(첫 판이 여기서 깨졌다)
    // 🔗 INDIRECT — 추출 함수가 **부르는** 헬퍼. 여기가 바뀌면 결과도 바뀐다.
    arrowLine(disc, 'uniqLower'),
    arrowLine(disc, 'normHandle'),
    arrowLine(disc, 'isPlatformLabelEmail'),
  ]
  return createHash('sha256').update(parts.join('\n---\n')).digest('hex').slice(0, 16)
}

/**
 * 🔒 **동결값** — 2026-08-05, `REEXTRACT_RULES_VERSION = 3` 시점의 규칙 지문.
 *
 *   이 값이 안 맞으면 **추출 규칙이 실제로 바뀐 것**이다. 그때 해야 할 일:
 *     1. `influencer-maintenance.ts` 의 `REEXTRACT_RULES_VERSION` 을 **+1** (안 올리면 기존 36,880행에
 *        새 규칙이 영원히 안 닿는다 — 이 상수엔 시간 폴백이 없다).
 *     2. 아래 값을 실패 메시지에 찍힌 새 지문으로 교체.
 *   ⛔ **지문만 갱신하고 버전을 안 올리는 것이 이 시험을 무의미하게 만드는 유일한 방법이다.**
 */
const FROZEN = 'a09686d25964a0d7'

describe('추출 규칙 지문', () => {
  it('🔒 규칙이 그대로면 지문도 그대로다', () => {
    const now = fingerprint()
    expect(now, [
      '',
      '추출 규칙이 바뀌었다. 두 가지를 함께 해야 한다:',
      '  ① influencer-maintenance.ts 의 REEXTRACT_RULES_VERSION 을 +1',
      `  ② 이 파일의 FROZEN 을 '${now}' 로 교체`,
      '규칙이 아니라 계측/리팩토링이라면 지문이 애초에 안 바뀐다 — 바뀌었다면 규칙이 바뀐 것이다.',
      '',
    ].join('\n')).toBe(FROZEN)
  })

  /**
   * 🔒 **재료가 실제로 잡히는지**를 이름으로 확인한다.
   *   첫 판은 `_RE` 로 끝나는 이름만 골라 `NOT_EMAIL_SUFFIX` 를 놓쳤고, 그 정규식을 바꿔도 **초록**이었다.
   *   개수만 세면 그 구멍이 안 보인다 — 그래서 **실제 이름**을 확인한다.
   */
  it('🔒 지문 재료가 실제로 잡힌다 — 개수가 아니라 이름으로 본다', () => {
    const disc = read('src/features/marketing/api/influencer-discovery.ts')
    const names = regexLines(disc).join('\n')
    for (const n of ['EMAIL_RE', 'IG_RE', 'IG_AT_RE', 'TT_RE', 'LINKINBIO_RE', 'NOISE_RE', 'NOT_EMAIL_SUFFIX', 'BIZ_CONTEXT_RE', 'NON_OWNER_EMAIL_RE']) {
      expect(names, `${n} 이 지문에서 빠졌다 — 그 규칙을 바꿔도 아무도 안 잡는다`).toContain(`const ${n} `)
    }
    expect(fnBody(disc, 'extractContacts')).toContain('EMAIL_RE')
  })

  it('🔒 계측 카운터는 지문에 안 들어간다 — 그게 이 시험의 존재 이유다', () => {
    const disc = read('src/features/marketing/api/influencer-discovery.ts')
    // `videos_*` 카운터는 발굴 루프에 있고 추출 함수 밖이다
    expect(disc, '계측이 사라졌다면 이 전제를 다시 확인하라').toContain('calls.videos_empty')
    expect(fnBody(disc, 'extractContacts')).not.toContain('videos_empty')
    expect(fnBody(disc, 'pickBusinessEmail')).not.toContain('videos_empty')
  })

  it('🔌 면제 주석이 이 시험을 가리킨다 — 근거 없이 가드를 끈 게 아님을 코드에 남긴다', () => {
    const m = read('src/features/marketing/api/influencer-maintenance.ts')
    const line = m.split('\n').find(l => l.includes('REEXTRACT_RULES_VERSION ='))
    expect(line, 'REEXTRACT_RULES_VERSION 선언을 못 찾았다').toBeTruthy()
    expect(line, '면제 주석이 사라졌다면 이 지문 시험도 함께 재검토하라').toContain('rules-version-ok')
    expect(line).toContain('reextract-rules-fingerprint')
  })
})
