#!/usr/bin/env node
/**
 * 🧾 소비자 화면 흐름 속 판 → 평면 (2026-11-02 대표 확정 **A안 — 평면** · 범위 **소비자 화면 전체**)
 *
 * 대표 원문: *"이용권 페이지도 한번 확인해볼래? 그림자 져있는 것들이라던지 개선이 필요해 디자인 통합을 해야지."*
 * → 지갑을 세 안(지금 그림자 판 · A 평면 · B 옅은 회색 면)으로 그려 보여 드렸고 **"A안 — 평면"**,
 *   범위는 **"소비자 화면 전체"**(사장님/어드민/에이전시 대시보드 제외).
 * ⚠️ 2026-11-01 "처방 1 그림자 12%" 를 대체한다(대표가 그 결정을 알고 골랐다).
 *
 * 하는 일: 흐름 속 판의 `shadow-lift`(+ `dark:shadow-none`·`lg:shadow-lift`)와 판 바탕
 * (`bg-surface`·`bg-white`·`dark:bg-[#1D1F29]`)을 걷는다. 판 **안의** 구분선·여백은 그대로 둔다.
 *
 * 🔴 걷지 않는 것(`--lift` 를 전역으로 none 으로 바꾸지 않는 이유와 같다 — index.css 의 `--lift` 주석):
 *   떠 있는 면(모달·시트·드롭다운·토스트·캐러셀 화살표·지도 오버레이·차트 툴팁 · absolute/fixed/sticky/z-) ·
 *   알약·원형 버튼(rounded-full) · 버튼/입력(조작 가능함의 표시) · 작은 로고/아이콘 타일 · light-island(토스 위젯) ·
 *   잠금표 파일(대표 승인 필요 — 지갑 MyVouchersPage 는 2026-11-02 허가) · 사장님 화면.
 *   🎫 티켓 카드(TicketCard/FieldCard)도 평면이다 — 대표 *"티켓도 평면"*(2026-11-02). 색 띠는 남는다.
 *
 * 판정은 시험(consumer-plate-flat-2026-11-02.test.ts)이 `--dry` 로 이 파일에 묻는다 — 조건을 두 벌로 두지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const LOCK = new Set([...readFileSync('CLAUDE.md', 'utf8').matchAll(/^\| `(src\/[^`]+?)`/gm)].map((m) => m[1]))
/** 잠금표 파일 중 **대표가 이 작업에 한해 허가한 것**(2026-11-02 AskUserQuestion "허가 — 평면으로").
 *  기록: docs/locks/loading/2026-11-02-wallet-plate-flat.md. 그 밖의 잠금 파일은 여전히 손대지 않는다. */
const LOCK_APPROVED = new Set(['src/pages/MyVouchersPage.tsx'])

/** 걷지 않는 파일(이유별). 시험이 이 목록을 그대로 읽는다. */
export const KEEP_FILES = [
  [/^src\/components\/dashboard\//, '대시보드 부품'],
  [/^src\/pages\/Store(OwnerDashboard|Stats|Seeding|Claim)Page\.tsx$|^src\/pages\/store-claim\/|^src\/pages\/VoucherVerifyPage\.tsx$|^src\/components\/voucher\/VoucherScanner\.tsx$/, '사장님 화면(사용 처리·매장 통계)'],
  [/^src\/pages\/restaurant-map\//, '지도 위 UI — 지도 타일 위에서는 흰 면 고정(2026-09-02 대표 B안)'],
  [/^src\/pages\/partners\/PartnerPaths\.tsx$/, '랜딩 강조 대비 — 강조 칸만 평면이 되면 회색 면 칸보다 약해져 강조가 뒤집힌다'],
  [/^src\/pages\/life\/pro\/|^src\/pages\/life\/LifePro/, '업체(프로) 화면 — 사장님 쪽'],
  [/(Modal|Sheet|Sheets|Picker|Popover|Dropdown|Toast|ToastContainer|Overlay|Tooltip)\.tsx$|\/charts\//, '떠 있는 면(파일 이름)'],
  [/^src\/worker\/generated\//, '빌드 산출물'],
  [/^src\/pages\/user-profile\/(list-grammar|MyStats)\.tsx$/,
    '마이 공용 판 — 폰은 `.ur-my-flat`, PC 는 `.ur-pc-card` 가 CSS 로 평면화한다(소스에서 걷으면 그 선택자가 안 잡혀 폰 마이의 블리드 여백이 사라진다). `LIST_PLATE_CLS` 는 에이전시 콘솔도 쓴다(판 유지)'],
]
/** 한 줄 판정 — 이 줄의 그림자는 떠 있는 면이거나 조작 요소다.
 *  `snap-start shrink-0` = 지도 위 가로 넘김 카드(부모가 absolute 라 줄만 보면 흐름 속처럼 보인다 — 2026-11-02 첫 판이 그걸 걷었다). */
export const KEEP_LINE = /\b(absolute|fixed|sticky)\b|\bz-(\d|\[)|rounded-full|max-h-|rounded-t-|\bur-btn\b|light-island|<(button|input|textarea|select)\b|\bh-1[0-9] items-center justify-center|\bw-1[0-9] h-1[0-9]|\b(chipOff|off)\s*[:=]|\bsnap-start shrink-0|: 'bg-white dark:bg-\[#1D1F29\] text-gray-700 dark:text-gray-300 shadow-lift/

export const consumerFiles = () => execSync("git ls-files 'src/*.tsx' 'src/**/*.tsx' 'src/**/*.ts'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .filter((f) => !/\/tests\//.test(f))
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))

export const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|\s)\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length))

const DROP = /^(shadow-lift|lg:shadow-lift|dark:shadow-none|bg-surface|bg-white|dark:bg-\[#1D1F29\]|bg-\[var\(--gbd-card\)\])$/

/** 판정: { flat: [{file,line,text}], keep: [{file,line,text,why}] } */
export function classify() {
  const flat = [], keep = []
  for (const f of consumerFiles()) {
    const raw = readFileSync(f, 'utf8')
    if (!raw.includes('shadow-lift')) continue
    const code = stripComments(raw).split('\n')
    code.forEach((l, i) => {
      if (!/\bshadow-lift\b/.test(l)) return
      const why = LOCK.has(f) && !LOCK_APPROVED.has(f) ? '잠금표 파일' : (KEEP_FILES.find(([re]) => re.test(f)) || [])[1]
        || (KEEP_LINE.test(l) ? '떠 있는 면·조작 요소(줄)' : null)
      ;(why ? keep : flat).push({ file: f, line: i + 1, text: l.trim(), why })
    })
  }
  return { flat, keep }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = !process.argv.includes('--dry')
  const { flat, keep } = classify()
  if (process.argv.includes('--list')) {
    for (const r of flat) console.log(`FLAT ${r.file}:${r.line} | ${r.text.slice(0, 150)}`)
    for (const r of keep) console.log(`KEEP ${r.file}:${r.line} [${r.why}] | ${r.text.slice(0, 120)}`)
  }
  if (write) {
    const byFile = new Map()
    for (const r of flat) byFile.set(r.file, [...(byFile.get(r.file) || []), r.line])
    for (const [f, lines] of byFile) {
      const src = readFileSync(f, 'utf8').split('\n')
      for (const n of lines) {
        // 그 줄의 따옴표 문자열 중 shadow-lift 를 품은 것만 손본다(같은 줄 다른 클래스 문자열은 그대로).
        src[n - 1] = src[n - 1].replace(/(["'`])([^"'`]*\bshadow-lift\b[^"'`]*)\1/g, (m, q, cls) =>
          q + cls.split(/(\s+)/).filter((t) => !DROP.test(t)).join('').replace(/\s{2,}/g, ' ').trim() + q)
      }
      writeFileSync(f, src.join('\n'))
    }
  }
  console.log(`${write ? '✍️' : '👀'} 흐름 속 판 → 평면 ${flat.length}건 · 남긴 그림자 ${keep.length}건`)
}
