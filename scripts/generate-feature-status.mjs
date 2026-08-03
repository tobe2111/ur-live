#!/usr/bin/env node
/**
 * 🚦 기능 현황판 자동 생성 — `src/shared/feature-flags.ts` → `docs/FEATURE_STATUS.md`
 *
 * ## 왜 (2026-08-03 — 이 세션이 저지른 오류의 근본원인)
 *
 * 대표에게 실결제 절차로 **"딜 충전 5,000원"** 을 제안했다. 그 기능은 **2026-07-18 에 종료**됐고
 * 서버는 403 을 준다. 내가 그렇게 판단한 이유는 하나다 — **코드에 라우트가 살아 있었다.**
 * `/points/charge` 도 있고 `PointsChargePage` 도 있고 결제 위젯 코드도 그대로다.
 * 종료는 `TOPUP_DISABLED = true` 한 줄로만 표현돼 있고, 그 한 줄은 **찾아봐야 보인다.**
 *
 * 같은 함정이 최소 4개 더 있다(라이브커머스·쇼핑탭·공구호스팅·동네공구제안). 전부 코드가 남아 있고
 * 전부 플래그로만 꺼져 있다. ⇒ **파일을 열어보는 것으로는 살았는지 죽었는지 알 수 없다.**
 *
 * 그래서 "지금 무엇이 꺼져 있는가"를 **한 장으로** 만든다. 세션은 소비자 경로를 제안하기 전에
 * 이 표를 본다(CLAUDE.md 룰). 손으로 관리하면 반드시 낡으므로 **플래그 파일에서 생성**한다.
 *
 * 사용: `node scripts/generate-feature-status.mjs`        — 생성
 *       `node scripts/generate-feature-status.mjs --check` — 드리프트 검사(CI/훅)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src/shared/feature-flags.ts')
const OUT = path.join(ROOT, 'docs/FEATURE_STATUS.md')

/**
 * 플래그 이름이 "꺼짐"을 뜻하는가 — true 가 곧 OFF 인 이름들.
 * ⚠️ `_HIDDEN`(형용사)뿐 아니라 `_HIDE_`(동사)도 잡아야 한다 — `IOS_HIDE_DIGITAL_TOPUP` 이
 *    접미사 규칙에만 걸려 방향이 뒤집혀 표시됐다(2026-08-03 첫 생성에서 실제로 틀렸다).
 */
function isOffWhenTrue(name) {
  return /_(DISABLED|HIDDEN|SUSPENDED|OFF)$/.test(name) || /(^|_)HIDE(_|$)/.test(name)
}

/**
 * 표시용 상태 — **그 플래그 자신의 효과**만 말한다.
 * ⚠️ 기능 하나가 여러 플래그·서버 게이트에 걸려 있으면 이 칸만으로 판단하면 안 된다
 *    (예: iOS 충전 숨김이 🟢 여도 `TOPUP_DISABLED` 로 충전 자체가 죽어 있다).
 */
function liveState(name, value) {
  const off = isOffWhenTrue(name) ? value : !value
  return off ? '🔴 꺼짐' : '🟢 켜짐'
}

/** 표 가독성 — 첫 문장까지만. 길면 자른다(전문은 feature-flags.ts 주석). */
function short(desc) {
  if (!desc) return '—'
  const first = desc.split(/(?<=\.)\s|(?<=다)\.\s/)[0] || desc
  const t = first.length > 140 ? first.slice(0, 137) + '…' : first
  return t.replace(/\|/g, '\\|')
}

function parseFlags(code) {
  const flags = []
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^export const ([A-Z0-9_]+)\s*=\s*(true|false)\b/.exec(lines[i])
    if (!m) continue
    const [, name, raw] = m
    // 바로 위 블록주석에서 설명을 캔다. 첫 줄(이름 — 설명)이 요약이다.
    let desc = ''
    for (let j = i - 1; j >= 0 && j > i - 30; j--) {
      const dm = new RegExp(`^\\s*\\*\\s*${name}\\s*[—-]\\s*(.+)$`).exec(lines[j])
      if (dm) {
        desc = dm[1].trim()
        // 다음 줄이 이어지는 문장이면 한 번 더 붙인다(문장이 잘려 뜻이 반대가 되는 것 방지).
        const cont = /^\s*\*\s{2,}(\S.*)$/.exec(lines[j + 1] || '')
        if (cont && !/^[A-Z0-9_]+\s*[—-]/.test(cont[1])) desc += ' ' + cont[1].trim()
        break
      }
    }
    flags.push({ name, value: raw === 'true', desc: desc.replace(/\s+/g, ' ').trim() })
  }
  return flags
}

function render(flags) {
  const off = flags.filter((f) => liveState(f.name, f.value).startsWith('🔴'))
  const on = flags.filter((f) => !liveState(f.name, f.value).startsWith('🔴'))
  const row = (f) => `| \`${f.name}\` | ${liveState(f.name, f.value)} | \`${f.value}\` | ${short(f.desc)} |`

  return `# 🚦 기능 현황판 (자동 생성)

> ⚠️ **이 파일을 손으로 고치지 마라.** \`src/shared/feature-flags.ts\` 에서 생성된다.
> 갱신: \`node scripts/generate-feature-status.mjs\` (pre-commit 이 자동 재생성 + stage)

## 왜 이 표가 있나

이 레포에는 **종료됐는데 코드가 그대로 남아 있는 기능**이 여럿이다. 라우트도 페이지도 API 도
살아 있고, 꺼진 사실은 플래그 한 줄로만 표현된다. ⇒ **파일을 열어보는 것으로는 판단할 수 없다.**

2026-08-03 에 실제로 그 함정에 빠졌다 — 이미 종료된 **딜 충전**을 대표에게 실결제 절차로 제안했다.
코드가 온전했기 때문이다.

🔑 **소비자 경로·구매 절차·테스트 시나리오를 제안하기 전에 이 표를 먼저 볼 것.**

## 🔴 꺼진 기능 — 코드는 있지만 사용자에게 없다 (${off.length})

| 플래그 | 상태 | 값 | 설명 |
|---|---|---|---|
${off.map(row).join('\n') || '| — | — | — | (없음) |'}

## 🟢 켜진 기능 (${on.length})

| 플래그 | 상태 | 값 | 설명 |
|---|---|---|---|
${on.map(row).join('\n') || '| — | — | — | (없음) |'}

## ⚠️ 이 표가 담지 못하는 것

- **서버측 게이트**(\`platform_settings\` · env)는 여기 없다. 예: \`SHOPPING_LEDGER_ENABLED\`,
  \`commission_budget_enabled\`, \`pickup_unclaimed_policy_enabled\`. 그건 어드민에서 실측할 것.
- **플래그 없이 데이터로만 꺼진 것**도 없다. 예: 공구 특가는 "세션이 열린 상품이 있는가"로 정해지고,
  추첨 상품은 \`product_supply_meta.fcfs_enabled\` 로 정해진다.
- ⇒ 여기서 🟢 라고 해서 **그 경로가 실제로 완주된다는 보장은 아니다.** 표면 노출만 말한다.
`
}

const code = fs.readFileSync(SRC, 'utf8')
const flags = parseFlags(code)
if (flags.length === 0) {
  console.error('❌ feature-status: 플래그를 하나도 못 읽었다 — 파서가 낡았거나 경로가 틀렸다(통과 아님).')
  process.exit(1)
}
const next = render(flags)

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (cur !== next) {
    console.error('❌ feature-status: docs/FEATURE_STATUS.md 가 feature-flags.ts 와 어긋난다.')
    console.error('   고치는 법: node scripts/generate-feature-status.mjs')
    process.exit(1)
  }
  console.log(`✅ feature-status: 동기 (플래그 ${flags.length}개)`)
  process.exit(0)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, next)
console.log(`✅ feature-status: docs/FEATURE_STATUS.md 생성 (플래그 ${flags.length}개)`)
