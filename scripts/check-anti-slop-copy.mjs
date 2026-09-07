#!/usr/bin/env node
/**
 * 🎨 anti-slop 문구·라벨 가드 (2026-09-01 — 대표 *"AI 스럽지 않은 디자인으로 마무리"*)
 *
 * ■ 왜 만들었나
 *   CLAUDE.md "🎨 anti-slop 디자인 스킬" 절이 *"가장 자주 걸리는 것 다섯 개(이 레포에서 실제로
 *   전부 위반했었다)"* 를 적어 두고도 **강제하는 검사가 하나도 없었다.** 이 레포의 규칙
 *   ("규율은 문서가 아니라 테스트로")대로라면 기계가 지켜야 한다. 실제로 2026-09-01 에 재 보니
 *   대외 랜딩 `/about` 이 그 다섯 개를 **전부** 위반하고 있었다.
 *
 * ■ 무엇을 보는가 (기계로 판정 가능한 셋만)
 *   R1 em-dash `—` 가 **사용자에게 보이는 문구**에 있는가 (주석·문서는 대상 아님)
 *   R2 `01` `02` 같은 **섹션번호 뱃지**를 라벨 배열에 넣었는가
 *   R3 한글 라벨에 `uppercase` 를 걸었는가 — 한글엔 아무 효과가 없고(=죽은 스타일),
 *      남는 `tracking-wider` 만 자간을 벌려 가독성을 떨어뜨린다. 영문 편집 디자인의
 *      small-caps eyebrow 를 그대로 옮겨 붙인 자국이다.
 *
 * ■ 이 가드가 **못 잡는 것** (사람이 봐야 한다)
 *   · eyebrow 예산(섹션수/3) · 같은 레이아웃 계열 반복 · 가운뎃점 밀도 —
 *     셋 다 "무엇이 한 섹션인가" 를 정적으로 못 정한다. 렌더해서 눈으로 볼 것.
 *   · `<input>` 의 `uppercase` 는 **기능**(입력 글자를 대문자로)이라 R3 대상이 아니다.
 *
 * 래칫: scripts/anti-slop-baseline.json. 줄이면 --rebaseline.
 * 예외: 그 줄에 `anti-slop-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE = path.join(ROOT, 'scripts/anti-slop-baseline.json')
/** 어드민은 대표가 이 과업 범위에서 명시적으로 뺐다(내부 운영 도구). */
const SKIP = /[Aa]dmin|\/tests?\/|node_modules/
/**
 * R1(em-dash)만 **대외·마케팅 표면**으로 좁힌다.
 * CLAUDE.md "🎨 anti-slop 디자인 스킬" 이 적용 대상을 *"제안서·랜딩·소비자 마케팅 표면"* 으로
 * 규정하고 **어드민/셀러 대시보드는 대상 아님**(스킬 자신이 dashboard 제외를 명시)이라고 못박는다.
 * 전 범위로 재면 401건이 나오는데(대부분 대시보드 토스트·aria-label), 그 값을 래칫으로 삼으면
 * **랜딩에 새로 생긴 em-dash 한 개가 401건 사이에 숨는다.** 범위를 좁혀야 0 이 의미를 갖는다.
 * ⚠️ 여기 없는 대외 페이지를 새로 만들면 이 목록에 추가할 것 — 안 그러면 그 페이지는 무검사다.
 */
const MARKETING = new RegExp([
  'src/pages/(AboutServicePage|AboutPage|PartnersPage|CreatorsPage|CreatorApplyPage',
  '|InfluencerLandingPage|BusinessPage|IntroducePage|JoinPage|BlogListPage|BlogDetailPage)\\.tsx$',
  '|src/components/(SEO|ConsumerFrameRails)\\.tsx$',
  '|src/components/main/SiteFooter\\.tsx$',
].join(''))
const KO = /[가-힣]/

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git|dist/.test(p)) walk(p, out) }
    else if (/\.tsx$/.test(e.name)) out.push(p)
  }
  return out
}

/**
 * 주석을 **문자 단위로** 걷어낸다.
 * ⚠️ 첫 판은 "줄이 `*`·`//`·`{/*` 로 시작하면 주석" 으로 판정했는데, 이 레포는 여러 줄 JSX
 *   주석(`{/* … 여러 줄 … *\/}`)을 정식으로 쓰고 그 **중간 줄**은 아무 접두사가 없다.
 *   그래서 em-dash 가 635건으로 잡혔고(거의 전부 주석), 그 값을 래칫으로 삼으면
 *   **진짜 문구에 생긴 회귀를 635건 사이에 숨겨 놓게 된다.** 상태 기계로 바꾼다.
 */
function stripComments(src) {
  const out = []
  let i = 0, line = 1, mode = 'code', buf = ''
  const flush = () => { out.push([line, buf]); buf = '' }
  while (i < src.length) {
    const c = src[i], c2 = src.slice(i, i + 2), c3 = src.slice(i, i + 3)
    if (c === '\n') { flush(); line++; i++; continue }
    if (mode === 'code') {
      // ⚠️ 이 분기는 자기검사가 **독립적으로 못 지킨다**: 지워도 바로 아래 `/*` 분기가
      //    같은 주석을 삼켜서(잔재는 `{}` 뿐) 판정 결과가 같다. 더 정확하니 남기지만,
      //    "되돌려-검증 초록" 을 이 줄의 안전 근거로 삼지 말 것.
      if (c3 === '{/*') { mode = 'jsx'; i += 3; continue }
      if (c2 === '/*') { mode = 'block'; i += 2; continue }
      if (c2 === '//') { while (i < src.length && src[i] !== '\n') i++; continue }
      buf += c; i++; continue
    }
    if (mode === 'jsx') { if (c3 === '*/}') { mode = 'code'; i += 3; continue } i++; continue }
    if (c2 === '*/') { mode = 'code'; i += 2; continue }
    i++
  }
  flush()
  return out.filter(([, t]) => t.trim() && !t.includes('anti-slop-ok'))
}

export function scan(files) {
  const hits = { emDash: [], sectionNum: [], koUpper: [] }
  for (const f of files) {
    const rel = path.relative(ROOT, f)
    if (SKIP.test(rel)) continue
    const src = fs.readFileSync(f, 'utf-8')
    const lines = src.split('\n')
    for (const [n, ln] of stripComments(src)) {
      if (ln.includes('—') && MARKETING.test(rel.replace(/\\/g, '/'))) hits.emDash.push(`${rel}:${n}`)
      // 라벨 배열의 섹션번호: ['01', '제목', …] 형태
      if (/\[\s*'0[1-9]'\s*,|\[\s*"0[1-9]"\s*,/.test(ln)) hits.sectionNum.push(`${rel}:${n}`)
      if (/\buppercase\b/.test(ln)) {
        // 입력창은 기능이다 — 같은 요소 안에 input/textarea/placeholder 가 있으면 제외
        const ctx = lines.slice(Math.max(0, n - 6), n + 3).join(' ')
        if (/<input|<textarea|placeholder=/.test(ctx)) continue
        // 라벨이 한글인가: 같은 줄 + 뒤 2줄 (주석 제거 후)
        const label = [ln, lines[n] || '', lines[n + 1] || ''].map(x => x.replace(/\/\/.*$/, '')).join(' ')
        if (KO.test(label)) hits.koUpper.push(`${rel}:${n}`)
      }
    }
  }
  return hits
}

/* 🧪 합성 픽스처 — **매 실행마다** 스스로를 검사한다.
   래칫 기준이 0 이면 `hits > 0` 만으로는 "정규식이 죽었는지" 를 못 가린다.
   (이 레포가 반복해 당한 "검사가 실패할 수 없음" 클래스.) */
const FIXTURE_BAD = `export const A = () => (
  <div>
    <p className="text-xs uppercase tracking-widest">카테고리</p>
    <p>공동구매 수수료 5% — 판매되는 만큼만</p>
    {[['01', '매장 등록', '설명']].map(x => x)}
  </div>
)
`
/* ⚠️ OK 픽스처에는 **여러 줄 JSX 주석**이 반드시 들어 있어야 한다.
   주석 제거기(stripComments)가 망가지면 이 픽스처가 오탐으로 잡혀야 하는데,
   주석이 없으면 제거기를 통째로 부숴도 자기검사가 통과한다(실제로 그랬다). */
const FIXTURE_OK = `/**
 * JSDoc 블록 주석 — 여기 em-dash 가 있어도 사용자에게는 안 보인다.
 * \`{/*\` 와 \`/*\` 는 stripComments 의 **서로 다른 분기**라 픽스처도 둘 다 있어야 한다
 * (하나만 두면 나머지 분기를 통째로 부숴도 자기검사가 통과한다 — 실제로 그랬다).
 */
export const A = () => (
  <div>
    {/* 여러 줄 주석 — 이 안의 em-dash 와 '카테고리 uppercase' 는
        사용자에게 보이지 않으므로 세면 안 된다.
        <p className="uppercase">카테고리</p> 같은 예시도 여기 들어간다. */}
    <p className="text-xs uppercase tracking-widest">MENU</p>
    <p>공동구매 수수료 5%, 판매되는 만큼만</p>
    <input className="uppercase" placeholder="AG-A8K3F1" />
  </div>
)
`
function selfTest() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'slopcopy-'))
  try {
    fs.mkdirSync(path.join(dir, 'src/pages'), { recursive: true })
    const bad = path.join(dir, 'src/pages/AboutPage.tsx'); fs.writeFileSync(bad, FIXTURE_BAD)
    const ok = path.join(dir, 'src/pages/PartnersPage.tsx'); fs.writeFileSync(ok, FIXTURE_OK)
    const b = scan([bad]), o = scan([ok])
    const fail = []
    if (!b.emDash.length) fail.push('em-dash 를 못 잡는다')
    if (!b.sectionNum.length) fail.push('섹션번호를 못 잡는다')
    if (!b.koUpper.length) fail.push('한글 uppercase 를 못 잡는다')
    if (o.emDash.length || o.sectionNum.length || o.koUpper.length) fail.push('정상 코드를 오탐한다')
    return fail
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

const selfFail = selfTest()
if (selfFail.length) {
  console.error('❌ anti-slop: **가드 자신이 고장났다** — ' + selfFail.join(' · '))
  process.exit(1)
}

const files = walk(path.join(ROOT, 'src'))
if (files.length < 300) {
  console.error(`❌ anti-slop: .tsx 를 ${files.length}개밖에 못 찾았다 — 스캔 경로가 낡았다.`)
  process.exit(1)
}
const hits = scan(files)
const cur = { emDash: hits.emDash.length, sectionNum: hits.sectionNum.length, koUpper: hits.koUpper.length }

if (process.argv.includes('--rebaseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    _comment: 'anti-slop 문구·라벨 허용 상한(래칫). 줄이면 --rebaseline 으로 갱신.',
    _measured: new Date().toISOString().slice(0, 10), ...cur,
  }, null, 2) + '\n')
  console.log(`✅ anti-slop: 기준 갱신 — em-dash ${cur.emDash} · 섹션번호 ${cur.sectionNum} · 한글 uppercase ${cur.koUpper}`)
  process.exit(0)
}

if (!fs.existsSync(BASELINE)) {
  console.error('❌ anti-slop: 기준 파일이 없다 — 없으면 첫 실행이 무조건 통과해 검사가 무의미해진다.')
  console.error('   `node scripts/check-anti-slop-copy.mjs --rebaseline` 로 만들 것.')
  process.exit(1)
}
const base = JSON.parse(fs.readFileSync(BASELINE, 'utf-8'))
let bad = false
for (const [k, ko] of [['emDash', 'em-dash(—) 사용자 문구'], ['sectionNum', '섹션번호 뱃지(01/02…)'], ['koUpper', '한글 라벨에 uppercase']]) {
  if (cur[k] > (base[k] ?? 0)) {
    bad = true
    console.error(`❌ anti-slop: ${ko} ${base[k] ?? 0} → ${cur[k]} (신규 ${cur[k] - (base[k] ?? 0)}건)`)
    hits[k].slice(0, 12).forEach((h) => console.error('   ' + h))
  }
}
if (bad) {
  console.error('\n   고치는 법: em-dash 는 쉼표·마침표·괄호로 · 순서는 목록이 말하게(번호 뱃지 금지)')
  console.error('   · 한글 라벨의 uppercase 는 효과가 없으니 제거(tracking 도 함께).')
  console.error('   의도적이면 그 줄에 `anti-slop-ok` 주석.')
  process.exit(1)
}
console.log(`✅ anti-slop: em-dash ${cur.emDash}(≤${base.emDash}) · 섹션번호 ${cur.sectionNum}(≤${base.sectionNum}) · 한글 uppercase ${cur.koUpper}(≤${base.koUpper})`)
