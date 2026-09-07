#!/usr/bin/env node
/**
 * 🏷️ 할인율은 사진 위에 올리지 않는다 (2026-09-01)
 *
 * ■ 왜 파일이 따로 생겼나 — **같은 규칙을 세 번 어겼다**
 *   대표 2026-08-31: *"할인율이 사진 안으로 들어가면 안돼. 할인율을 강조하기도 해야하고."*
 *   그 뒤 세 곳을 **각각** 고쳐야 했다:
 *     08-31  `GroupBuyFeedCard`      (홈·유어샵 동네딜 카드)
 *     09-01  `vouchers/shared.tsx`   (교환권 카드 + 목록 행)
 *     09-01  `group-buy/OtherDealsRow` (상세 '이 셀러의 다른 공구')
 *   기존 가드 둘은 **파일 이름을 박아 둔 계약 테스트**라, 넷째 구현이 생기면 또 비껴간다.
 *   그리고 `OtherDealsRow` 는 Tailwind 가 아니라 **인라인 스타일**이라 className 을 보는
 *   검사로는 애초에 못 잡는다. 그래서 규칙 자체를 파일 무관·표기 무관으로 옮겼다.
 *
 * ■ 무엇을 보는가
 *   한 줄에 [할인율 렌더] + [절대배치] 가 같이 있으면 위반.
 *   절대배치는 Tailwind `absolute` 와 인라인 `position: 'absolute'` 를 **둘 다** 본다.
 *
 * ■ 못 잡는 것 (사람이 봐야 한다)
 *   · 배지를 별도 컴포넌트로 빼서 부모가 absolute 로 감싸는 경우(줄이 갈린다)
 *   · CSS 클래스/`::before` 로 위치를 잡는 경우
 *   · "사진을 가리는가" 자체 — 렌더해서 눈으로 볼 것
 *
 * 예외: 그 줄에 `discount-on-photo-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SKIP = /[Aa]dmin|\/tests?\/|node_modules|\.git|dist/

/** 할인율을 화면에 그리는 표현. `{pct}%` · `{discountRate}%` · `{o.discount_pct}%` 등. */
const PCT = /\{[^}]*\b(pct|discount|discountRate|discount_pct|discountPct|discountRatio)\b[^}]*\}\s*%/i
/** 절대배치 — Tailwind 유틸과 인라인 스타일 양쪽. */
const ABS = /\babsolute\b|position:\s*['"`]absolute/

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!SKIP.test(p)) walk(p, out) }
    else if (/\.tsx$/.test(e.name) && !SKIP.test(p)) out.push(p)
  }
  return out
}

export function scan(files) {
  const hits = []
  for (const f of files) {
    const rel = path.relative(ROOT, f)
    fs.readFileSync(f, 'utf-8').split('\n').forEach((ln, i) => {
      const t = ln.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*') || t.startsWith('/*')) return
      if (ln.includes('discount-on-photo-ok')) return
      if (PCT.test(ln) && ABS.test(ln)) hits.push(`${rel}:${i + 1}`)
    })
  }
  return hits
}

/* 🧪 합성 대조 — 0 을 기대하는 검사는 정규식이 죽어도 0 이라 초록불이다.
   매 실행마다 "위반은 잡고 정상은 통과시키는지" 를 스스로 확인한다. */
const BAD = `const A = () => <div className="relative">
  {pct > 0 && <span className="absolute left-2 top-2">{pct}%</span>}
</div>
`
const BAD_INLINE = `const B = () => <div style={{ position: 'relative' }}>
  <span style={{ position: 'absolute', left: 8 }}>{discountRate}%</span>
</div>
`
const OK = `const C = () => <div>
  <p className="flex items-baseline gap-1"><span className="text-brand">{pct}%</span><span>{price}원</span></p>
  <span className="absolute left-2 top-2">NEW</span>
</div>
`
function selfTest() {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'discphoto-'))
  try {
    const w = (n, c) => { const p = path.join(dir, n); fs.writeFileSync(p, c); return p }
    const fail = []
    if (!scan([w('Bad.tsx', BAD)]).length) fail.push('Tailwind absolute 배지를 못 잡는다')
    if (!scan([w('BadInline.tsx', BAD_INLINE)]).length) fail.push('인라인 position:absolute 배지를 못 잡는다')
    if (scan([w('Ok.tsx', OK)]).length) fail.push('정상 코드를 오탐한다')
    return fail
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
}

const selfFail = selfTest()
if (selfFail.length) {
  console.error('❌ discount-on-photo: **가드 자신이 고장났다** — ' + selfFail.join(' · '))
  process.exit(1)
}

const files = walk(path.join(ROOT, 'src'))
if (files.length < 300) {
  console.error(`❌ discount-on-photo: .tsx 를 ${files.length}개밖에 못 찾았다 — 스캔 경로가 낡았다.`)
  process.exit(1)
}
const hits = scan(files)
if (hits.length) {
  console.error(`❌ discount-on-photo: 할인율이 사진 위에 있다 (${hits.length}건)`)
  hits.forEach((h) => console.error('   ' + h))
  console.error('\n   대표 2026-08-31: "할인율이 사진 안으로 들어가면 안돼."')
  console.error('   가격 줄 앞에 브랜드 로즈로 강조할 것. 의도적이면 `discount-on-photo-ok` 주석.')
  process.exit(1)
}
console.log(`✅ discount-on-photo: 할인율이 사진 위에 있는 카드 0건 (${files.length}개 .tsx 검사)`)
