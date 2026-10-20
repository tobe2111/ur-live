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
    /**
     * 🩸 **2026-10-11: 이 검사가 주석을 오탐하고 있었다(멀쩡한 커밋이 막혔다).**
     *
     * 종전엔 줄의 **첫 글자**만 보고 주석을 걸렀다(`//` · `*` · `/*` · `{/*`). 그런데 이 레포는
     * 긴 한국어 블록 주석을 쓰고, 그 **이어지는 줄은 `*` 로 시작하지 않는다**:
     *
     *     {/* 🎗️ 안 5 — PC 는 이 자리가 머리 한 줄 띠다:
     *         [아바타 · 이름 · 프로필 편집] … [숫자 셋/넷] [알림].   ← 첫 글자가 `[` 라 **본문으로 셌다**
     *
     * 그래서 *설명을 쓰는 것만으로* 대외 문구 래칫이 올라가 푸시가 막혔다. 문구 규칙은 사람이 읽는
     * 화면 글자에 대한 것이지 주석에 대한 것이 아니다 — 가드가 틀렸던 것이라 가드를 고친다.
     * (CLAUDE.md 의 *"텍스트 가드가 자기 주석 제거기를 만든다"* 클래스. 여기선 블록 **상태**만 추적하면
     *  되므로 범용 제거기를 또 만들지 않는다.)
     *
     * ⚠️ 블록의 **시작 판정은 종전과 똑같다**(줄이 `/*`·`{/*` 로 시작할 때만). 즉 새로 눈머는 자리가
     *    없다 — 그 줄들은 **이미 오늘도 건너뛰던** 줄이고, 바뀐 건 *그 뒤를 언제까지 건너뛰나* 뿐이다.
     *    문자열 안의 `/*` 로 블록이 잘못 열리는 일도 없다(줄 **시작**만 본다).
     */
    let inBlock = false
    fs.readFileSync(f, 'utf-8').split('\n').forEach((ln, i) => {
      const t = ln.trim()
      const closes = ln.includes('*/')
      if (inBlock) { if (closes) inBlock = false; return }
      if (t.startsWith('{/*') || t.startsWith('/*')) { if (!closes) inBlock = true; return }
      if (t.startsWith('//') || t.startsWith('*')) return
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
    // 🩸 2026-10-11: 블록 주석의 **이어지는 줄**(첫 글자가 `*` 가 아니다)을 본문으로 세던 오탐.
    const cmt = '{/* 설명\n          [아바타 · 이름 · 프로필 편집] 이라고 적는다\n          끝 */}\n'
    if (scanTsx([w('Cmt.tsx', cmt)]).length) fail.push('블록 주석 이어지는 줄을 본문으로 센다(오탐)')
    // 그리고 주석이 끝난 **뒤**의 진짜 문구는 여전히 잡아야 한다 — 안 그러면 이 수정이 눈가리개가 된다.
    if (!scanTsx([w('CmtThen.tsx', cmt + '<p>즉시 발급 · 전 지점 · 결제 즉시</p>\n')]).length) fail.push('주석 뒤 본문을 놓친다(눈이 멀었다)')
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
