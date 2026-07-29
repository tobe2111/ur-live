#!/usr/bin/env node
/**
 * 🌐 2026-07-29: 구 도메인(`live.ur-team.com`)이 **사용자에게 보이는 자리**로 돌아오는 것 차단.
 *
 * 2026-07-20 에 정본이 `urdeal.kr` 로 옮겨졌고 구 도메인은 **전 경로 영구 301** 이다.
 * 그런데 이전은 "리다이렉트를 걸었다"로 끝나지 않는다 — 코드 곳곳에 박힌 문자열은 그대로 남는다.
 * 실측: 결제 완료 직후 넛지가 소비자에게 *"이미 `live.ur-team.com/u/{handle}` 링크샵이 준비돼
 * 있어요"* 를 보여주고 있었다(2026-07-03 배선 당시 문자열). 링크는 301 로 도착하니 **아무 에러가
 * 없고**, 그래서 아무도 몰랐다 — 이 레포가 반복해 만난 *실패가 아니라 침묵* 그대로다.
 *
 * ## 무엇을 보나
 *
 * 사용자에게 **보이거나 전달되는** 표면만 본다: `src/pages` · `src/components` ·
 * `src/features/**` 의 UI/문자열 · `public/locales`. 여기에 `live.ur-team.com` 이 있으면 위반.
 *
 * ## 무엇을 안 보나 (의도적)
 *
 *   · **워커의 호스트 판별 집합** — `CONSUMER_FAST_PATH` / `LEGACY_CONSUMER_HOSTS` 는 301 을
 *     *구현하는* 코드다. 지우면 이전 자체가 깨진다.
 *   · **CORS 허용 목록**(`ALLOWED_ORIGINS`) — 전환기 동안 구 SPA 세션·토스 웹훅이 그 오리진으로
 *     들어온다. 소스 주석이 "목록에서 제거하지 말 것" 이라고 명시한다.
 *   · **테스트** — 쿠키 도메인 판정 등 구 호스트를 *입력으로* 주는 것이 목적이다.
 *   · `media.ur-team.com`(R2 커스텀 도메인) · `@ur-team.com`(회사 이메일) — 사이트 도메인이 아니다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_LEGACY_DOMAIN=1 또는 `-s`.
 * 의도적 예외: 그 줄에 `legacy-domain-ok` 주석.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_LEGACY_DOMAIN === '1' || process.argv.includes('-s')
const ALLOW_MARK = 'legacy-domain-ok'
const LEGACY = 'live.ur-team.com'

/** 사용자에게 보이거나 전달되는 표면. */
const ROOTS = ['src/pages', 'src/components', 'src/features', 'src/shared', 'public/locales']
const EXT = /\.(tsx?|json)$/
/** 이전을 *구현하는* 코드와 테스트는 대상이 아니다(위 주석 참조). */
const EXEMPT_FILES = [
  'src/shared/constants/index.ts',   // ALLOWED_ORIGINS — 전환기 CORS
]
const EXEMPT_PATH = /(\/tests?\/|\.test\.tsx?$|\.spec\.tsx?$)/

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    let st
    try { st = statSync(p) } catch { continue }
    if (st.isDirectory()) walk(p, out)
    else if (EXT.test(p)) out.push(p)
  }
  return out
}

const files = ROOTS.flatMap((r) => walk(r))
if (files.length === 0) {
  // "측정 0 = 통과 아님" — 경로가 낡아 훑을 게 없어진 것을 초록으로 넘기지 않는다.
  console.error('❌ legacy-domain: 검사 대상 파일이 0개다 — ROOTS 경로가 낡았다(통과 아님).')
  process.exit(1)
}

const hits = []
for (const f of files) {
  if (EXEMPT_FILES.includes(f) || EXEMPT_PATH.test(f)) continue
  let src
  try { src = readFileSync(f, 'utf8') } catch { continue }
  if (!src.includes(LEGACY)) continue
  src.split('\n').forEach((l, i) => {
    if (!l.includes(LEGACY) || l.includes(ALLOW_MARK)) return
    hits.push(`${f}:${i + 1}  ${l.trim().slice(0, 110)}`)
  })
}

if (hits.length === 0) {
  console.log(`✅ legacy-domain: 사용자 표면 ${files.length}개 파일에 구 도메인 노출 0건.`)
  process.exit(0)
}

const say = STRICT ? console.error : console.warn
say(`${STRICT ? '❌' : '⚠️'} legacy-domain: 사용자에게 보이는 자리에 구 도메인(${LEGACY}) ${hits.length}건`)
for (const h of hits) say(`   ${h}`)
say(`
  정본은 https://urdeal.kr 다(2026-07-20 이전 완료). 구 도메인은 전 경로 301 이라
  **링크는 도착하고 에러도 안 난다** — 그래서 조용히 낡은 채로 남는다. 표시 문자열은 정본으로.
  이전을 구현하는 코드(워커 호스트 집합·CORS 목록)나 테스트라면 그 줄에 '${ALLOW_MARK}' 주석.`)
process.exit(STRICT ? 1 : 0)
