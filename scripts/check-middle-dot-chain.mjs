#!/usr/bin/env node
/**
 * · 띄어 쓴 가운뎃점 사슬 래칫 (2026-09-01 신설)
 *
 * ■ 무엇이 흔적이고 무엇이 아닌가 — 여기가 핵심이다
 *   한국어에서 붙여 쓴 가운뎃점(`맛집·카페·뷰티`, `대·소문자`)은 **표준 표기**다. 명사 나열의 정식 구분자라
 *   막으면 안 된다. 흔적은 **띄어 쓴** ` · ` 로 **구·절을 엮은 사슬**이다:
 *     "즉시 교환권 발급 · 전 지점 사용 · 결제 즉시 사용"   ← 메타 스트립을 점으로 이은 것, 영어 랜딩 습관
 *   같은 줄에 ` · ` 가 둘 이상이면 그 줄은 사슬이다. 하나는 허용한다(주소 · 거리 같은 짝은 정당).
 *
 * ■ 왜 래칫인가
 *   소비자 tsx 21줄 + 로케일 7키가 이미 있다. 한 번에 전부 고치면 랜딩 문안까지 손대는 범위가 되고,
 *   실제 필요한 것은 **더 늘지 않는 것**이다. 동결값보다 줄어들면 `--rebaseline` 로 내린다.
 *
 * ■ 못 잡는 것
 *   · 동적으로 조립되는 사슬(`[a,b,c].join(' · ')`) — `join(' · ')` 은 잡는다. 다른 조립은 못 본다.
 *   · 어드민·셀러·도매·유어애즈·블로그 표면은 대상이 아니다(스킬이 대시보드를 제외한다).
 *
 * 예외: 그 줄에 `middle-dot-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE = 'scripts/middle-dot-baseline.json'
const REBASE = process.argv.includes('--rebaseline')
const SKIP = /\/(admin|Admin|seller|Seller|wholesale|Wholesale|supplier|Supplier|agency|Agency|marketing|ads|blog|Blog|dashboard|Dashboard)|\/tests?\/|node_modules|\.git|dist/
const CHAIN = /( · )[^\n]*( · )/
const JOIN = /\.join\(\s*['"`] · ['"`]\s*\)/
/** 로케일에서 소비자 키만 — 대시보드 네임스페이스는 뺀다. */
const LOCALE_SKIP = /^(seller|admin|agency|wholesale|supplier|marketing|ads|blog)\b/

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p, out) }
    else if (/\.tsx$/.test(e.name) && !SKIP.test(p)) out.push(p)
  }
  return out
}

export function scanTsx(files) {
  const hits = []
  for (const f of files) {
    const rel = path.relative(ROOT, f)
    fs.readFileSync(f, 'utf-8').split('\n').forEach((ln, i) => {
      const t = ln.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*') || t.startsWith('/*')) return
      if (ln.includes('middle-dot-ok')) return
      if (CHAIN.test(ln) || JOIN.test(ln)) hits.push(`${rel}:${i + 1}`)
    })
  }
  return hits
}

export function scanLocale(file) {
  const hits = []
  const d = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const walkObj = (o, p) => {
    if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) walkObj(v, p ? `${p}.${k}` : k); return }
    if (typeof o === 'string' && !LOCALE_SKIP.test(p) && (o.match(/ · /g) || []).length >= 2) hits.push(`${path.relative(ROOT, file)}:${p}`)
  }
  walkObj(d, '')
  return hits
}

/* 🧪 합성 대조 — 붙여 쓴 점은 통과, 띄어 쓴 사슬·join 은 잡는지 매 실행 확인. */
function selfTest() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'mdot-'))
  try {
    const w = (n, c) => { const p = path.join(dir, n); fs.writeFileSync(p, c); return p }
    const fail = []
    if (!scanTsx([w('Bad.tsx', '<p>즉시 발급 · 전 지점 사용 · 결제 즉시 사용</p>\n')]).length) fail.push('띄어 쓴 사슬을 못 잡는다')
    if (!scanTsx([w('BadJoin.tsx', "{[a, b, c].join(' · ')}\n")]).length) fail.push("join(' · ') 을 못 잡는다")
    if (scanTsx([w('Ok.tsx', '<p>맛집·카페·뷰티 이용권</p><span>{addr} · {dist}</span>\n')]).length) fail.push('붙여 쓴 점 / 점 하나를 오탐한다')
    const lj = w('ko.json', JSON.stringify({ my: { a: '추천 적립 · 유어샵 수익 · 친구 초대' }, seller: { b: 'x · y · z' } }))
    const lh = scanLocale(lj)
    if (lh.length !== 1 || !lh[0].endsWith('my.a')) fail.push('로케일 소비자 키만 잡아야 한다')
    return fail
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}
const selfFail = selfTest()
if (selfFail.length) { console.error('❌ middle-dot: **가드 자신이 고장났다** — ' + selfFail.join(' · ')); process.exit(1) }

const files = [...walk(path.join(ROOT, 'src/pages')), ...walk(path.join(ROOT, 'src/components'))]
if (files.length < 200) { console.error(`❌ middle-dot: .tsx 를 ${files.length}개밖에 못 찾았다 — 스캔 경로가 낡았다(통과 아님).`); process.exit(1) }
const localeFile = path.join(ROOT, 'public/locales/ko/translation.json')
const hits = [...scanTsx(files), ...scanLocale(localeFile)]

if (REBASE) {
  fs.writeFileSync(path.join(ROOT, BASELINE), JSON.stringify({ count: hits.length, _comment: '띄어 쓴 가운뎃점 사슬 동결값. 줄이면 --rebaseline 로 내린다.' }, null, 2) + '\n')
  console.log(`📌 middle-dot: 동결 ${hits.length}건`)
  process.exit(0)
}
if (!fs.existsSync(path.join(ROOT, BASELINE))) { console.error('❌ middle-dot: 동결 파일이 없다 — 첫 실행이 늘 통과하는 것을 막는다. --rebaseline 로 만들 것.'); process.exit(1) }
const base = JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE), 'utf-8')).count
if (hits.length > base) {
  console.error(`❌ middle-dot: 띄어 쓴 가운뎃점 사슬 ${hits.length}건 (동결 ${base})`)
  hits.forEach((h) => console.error('   ' + h))
  console.error('\n   같은 줄에 " · " 가 둘 이상이면 사슬이다. 줄바꿈·쉼표·붙여 쓴 가운뎃점(명사 나열)으로. 예외 `middle-dot-ok`.')
  process.exit(1)
}
console.log(`✅ middle-dot: 띄어 쓴 가운뎃점 사슬 ${hits.length}건 (≤${base}) · ${files.length}개 .tsx + ko 로케일 검사`)
