#!/usr/bin/env node
/**
 * 📏 세로 스택에서 버튼 높이가 뭉개지는 것 (2026-09-16 대표 신고 "버튼 크기도 세로길이가 짧고")
 *
 * ## 실측 — PC 는 멀쩡하고 모바일만 깨진다
 * 입점 랜딩의 CTA 버튼 넷이 `h-[52px]` 를 달고도 **모바일에서 23~25px** 로 렌더됐다(PC 는 58~60px 정상).
 *
 * ```
 * <div className="flex flex-col sm:flex-row …">        ← 모바일은 세로 스택
 *   <a className="flex-1 h-[52px] …">                  ← flex-1 = flex: 1 1 0%
 * ```
 *
 * 세로 스택에서 **주축은 높이**다. `flex-basis: 0%` 가 `height` 를 이기고, 컨테이너 높이가 auto 라
 * 나눠 줄 여유 공간이 0 이므로 버튼은 **글자 높이까지 찌그러진다.** `sm:flex-row` 로 바뀌는 순간
 * 주축이 가로가 되어 `height` 가 되살아나므로 **PC 에서는 아무 문제가 없다.**
 *
 * ⇒ 개발도 리뷰도 PC 로 하니 **아무도 못 본다.** 눈으로 찾는 부류가 아니라 기계가 찾아야 하는 부류다.
 *
 * ## 판정
 * `flex-col` → `(sm|md|lg|xl):flex-row` 컨테이너 안에서, **접두사 없는 `flex-1`** 과
 * **고정 높이**(`h-[…]` · `h-<숫자>`)를 함께 단 자식.
 *
 * 고칠 때는 보통 `flex-1` → `sm:flex-1`(그 브레이크포인트에 맞춰) 하나면 된다.
 * 세로 스택에서는 `align-items: stretch` 가 이미 가로를 꽉 채우므로 `flex-1` 이 할 일이 없다.
 *
 * ## 이 가드가 **못** 보는 것
 * · 컨테이너와 자식이 **다른 파일**로 갈린 경우(부모가 prop 으로 className 을 내려 주는 형태).
 * · `style={{ height }}` 인라인 높이 · `py-` 로 만든 높이(그건 주축 basis 와 안 싸운다).
 * · 블록의 끝을 **들여쓰기**로 판정한다(컨테이너보다 안 들어간 줄이 나오면 닫힌 것으로 본다).
 *   포맷된 JSX 에선 잘 맞지만, 한 줄로 눌러 쓴 JSX 나 이상한 들여쓰기는 놓칠 수 있다.
 *   🩸 첫 판은 "이후 40줄" 로만 봤다가 **거짓 양성**이 났다 — 같은 파일 23줄 아래의
 *      모바일 고정 바(그 컨테이너는 `flex` 가로라 멀쩡하다)를 남의 블록으로 집었다.
 *
 * 예외: 그 줄에 `flex-col-height-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['src']
const CONTAINER = /flex-col[^"`]*\b(?:sm|md|lg|xl):flex-row/
/** 접두사 없는 flex-1 (sm:flex-1 은 대상 아님) */
const FLEX1 = /(?:^|[\s"'`{])flex-1(?=[\s"'`}]|$)/
/** 고정 높이 — h-[52px] · h-12. h-full/h-auto/h-screen 은 제외, 접두사 붙은 것도 제외 */
const FIXED_H = /(?:^|[\s"'`{])h-(?:\[[^\]]*\]|\d+(?:\.\d+)?)(?=[\s"'`}]|$)/

function* files(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) yield* files(p)
    else if (e.name.endsWith('.tsx')) yield p
  }
}

const findings = []
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue
  for (const file of files(root)) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!CONTAINER.test(lines[i])) continue
      const indent = lines[i].length - lines[i].trimStart().length
      for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
        const L = lines[j]
        if (!L.trim()) continue
        // 들여쓰기가 컨테이너 이하로 돌아오면 그 블록은 닫힌 것이다(남의 자식을 집지 않는다)
        if (L.length - L.trimStart().length <= indent) break
        if (L.includes('flex-col-height-ok')) continue
        // 중첩된 같은 종류의 컨테이너를 만나면 그 안쪽은 그쪽 소관이다
        if (CONTAINER.test(L)) break
        const m = L.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/)
        if (!m) continue
        const cls = m[1] ?? m[2] ?? ''
        if (FLEX1.test(cls) && FIXED_H.test(cls)) {
          findings.push({ file, line: j + 1, cls: cls.slice(0, 72) })
        }
      }
    }
  }
}

/**
 * 🔴 측정 대상이 0 이면 통과가 아니라 고장이다.
 *    경로가 낡아 파일을 하나도 안 읽고 "0건"을 찍는 것이 이 레포가 반복해 당한 사고다.
 */
let scanned = 0
for (const root of ROOTS) if (fs.existsSync(root)) for (const _ of files(root)) scanned++
if (scanned < 100) {
  console.error(`❌ flex-col-height: .tsx 를 ${scanned}개밖에 못 읽었다 — 경로가 낡았다(통과 아님)`)
  process.exit(1)
}

if (findings.length) {
  console.error(`❌ flex-col-height: 세로 스택에서 높이가 뭉개지는 자식 ${findings.length}건`)
  for (const f of findings) console.error(`   ${f.file}:${f.line}  ${f.cls}`)
  console.error('   → 보통 `flex-1` 을 `sm:flex-1`(해당 브레이크포인트)로 바꾸면 된다.')
  process.exit(1)
}
console.log(`✅ flex-col-height: 세로 스택 높이 뭉개짐 0건 (${scanned}개 .tsx 검사)`)
