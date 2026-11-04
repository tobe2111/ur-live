/**
 * 🪟 브라우저 기본 창(confirm·alert·prompt) 금지 — 2026-11-03 대표 신고
 *
 * 대표가 이용권 QR 시트에서 "환불 요청" 을 눌렀더니 `urdeal.kr 내용:` 이 찍힌 **브라우저 기본 창**이 떴다
 * (유리 확인창 통일 PR #2112 직후). 전수로 세니 `window.confirm/alert/prompt` 직접 호출이 **약 100곳**
 * (손님 화면 몇 곳 + 셀러·어드민 대부분)이었다. 전부 `confirmDialog`·`alertDialog`·`promptDialog`
 * (`components/ui/confirm-dialog.tsx` — 유리 확인창)로 옮겼고, 이 시험이 새로 생기는 것을 막는다.
 *
 * ⚠️ 못 보는 것: `const c = window.confirm; c(...)` 처럼 이름을 바꿔 부르는 경우 · 문자열로 조립한 호출.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { stripComments } from '../helpers/source-text'

/** 일부러 남긴 곳과 그 이유. 여기에 더하는 것은 "그 화면만 브라우저 기본 창" 을 허락하는 결정이다. */
const ALLOWED: Record<string, string> = {
  'src/components/ui/confirm-dialog.tsx': '확인창 자신 — Host 가 안 붙었을 때(초기·시험)의 안전한 대체',
  'src/pages/MallAdminPage.tsx': '공구 서비스(운영자 몰) — 다른 서비스라 이 작업 범위 밖',
}

const CALL = /(?<![\w.$])(?:window\.)?(?:confirm|alert|prompt)\(/g

const FILES = execFileSync('git', ['ls-files', 'src/*.ts', 'src/*.tsx', 'src/**/*.ts', 'src/**/*.tsx'], { encoding: 'utf-8' })
  .split('\n').filter(Boolean)
  .filter((f) => !f.includes('/tests/') && !f.endsWith('.d.ts'))

describe('브라우저 기본 창을 쓰지 않는다', () => {
  it('측정이 헛돌지 않는다 — 검사 대상이 충분하고, 유리 확인창 사용처가 있다', () => {
    expect(FILES.length).toBeGreaterThan(1000)
    const users = FILES.filter((f) => /\b(?:confirmDialog|promptDialog|alertDialog)\(/.test(readFileSync(f, 'utf-8')))
    expect(users.length, '유리 확인창을 쓰는 파일이 거의 없다 — 이행이 되돌아갔다').toBeGreaterThan(80)
  })

  it('confirm·alert·prompt 를 직접 부르지 않는다 (→ confirmDialog · alertDialog · promptDialog)', () => {
    const bad: string[] = []
    for (const f of FILES) {
      if (f in ALLOWED) continue
      const src = stripComments(readFileSync(f, 'utf-8'))
      // 같은 이름의 지역 함수(예: `async function confirm()`)를 정의한 파일은 그 함수 호출을 허용한다.
      if (/function\s+(?:confirm|alert|prompt)\s*\(/.test(src)) continue
      src.split('\n').forEach((line, i) => {
        if (CALL.test(line)) bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
        CALL.lastIndex = 0
      })
    }
    expect(bad, [
      '브라우저 기본 창은 `urdeal.kr 내용:` 이 찍히고 우리 디자인이 아니다.',
      "→ import { confirmDialog, alertDialog, promptDialog } from '@/components/ui/confirm-dialog'",
      ...bad,
    ].join('\n')).toEqual([])
  })
})

/**
 * 🪟 2026-11-04 대표 *"정산 계좌 등록 부분도 팝업 적용 필요해. 안되어있는거 전체 확인 필요"* —
 * 은행 고르기가 기본 `<select>` 라 폰에서 휴대폰 기본 목록 창이 떴다. 81파일의 기본 선택창을
 * `<Select>`(`components/ui/select.tsx` — 폰 유리 시트 · PC 유리 목록)로 바꿨고, 새로 생기는 것을 막는다.
 */
describe('브라우저 기본 선택창(<select>)을 쓰지 않는다', () => {
  const SELECT_ALLOWED: Record<string, string> = {
    'src/pages/MallAdminPage.tsx': '공구 서비스(운영자 몰) — 다른 서비스',
    'src/pages/MallHomePage.tsx': '공구 서비스(운영자 몰) — 다른 서비스',
    'src/pages/MallProductPage.tsx': '공구 서비스(운영자 몰) — 다른 서비스',
  }
  const TSX = FILES.filter((f) => f.endsWith('.tsx'))

  it('측정이 헛돌지 않는다 — <Select> 사용처가 충분하다', () => {
    const users = TSX.filter((f) => /<Select[\s>]/.test(readFileSync(f, 'utf-8')))
    expect(users.length, '<Select> 사용처가 거의 없다 — 이행이 되돌아갔다').toBeGreaterThan(60)
  })

  it('<select> 태그를 직접 쓰지 않는다 (→ <Select> from @/components/ui/select)', () => {
    const bad: string[] = []
    for (const f of TSX) {
      if (f in SELECT_ALLOWED) continue
      stripComments(readFileSync(f, 'utf-8')).split('\n').forEach((line, i) => {
        if (/<select(?=[\s>]|$)/.test(line)) bad.push(`${f}:${i + 1}  ${line.trim().slice(0, 90)}`)
      })
    }
    expect(bad, ['기본 <select> 는 폰에서 휴대폰 기본 목록 창이 뜬다.', ...bad].join('\n')).toEqual([])
  })
})
