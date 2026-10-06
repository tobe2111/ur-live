/**
 * 🔤 **소비자 화면에서 터미널 고정폭(`font-mono`) 0** — 2026-09-23 대표 지시
 * *"영어나 숫자 폰트 좀 어떻게 수정 안될까? 너무 AI스러운데"*.
 *
 * ## 무엇이 문제였나
 * 본문 글꼴은 Pretendard 인데 **이용권 코드·실시간 시계·잔액·전화번호·우편번호**에만
 * `font-mono` 가 붙어 있었다. Tailwind 의 `font-mono` 는 우리가 고른 글꼴이 아니라
 * `ui-monospace, SFMono-Regular, Menlo, …` **터미널 폴백**이다. 그래서 그 자리만
 * 개발자 콘솔처럼 보였다 — 대표가 "AI스럽다"고 한 것이 정확히 이 자리다.
 *
 * ## 왜 `tabular-nums` 로 바꾸는가 (없애는 게 아니다)
 * `font-mono` 를 그냥 지우면 **시계가 떨린다.** 라이브 페이지에서 실제 Pretendard 15종을
 * 띄워 잰 값:
 *
 * | | 기본 | `tabular-nums` |
 * |---|---|---|
 * | `08:11:11` | 66.47px | 81.06px |
 * | `07:36:15` | 74.56px | 81.06px |
 *
 * 기본 숫자는 **비례폭**이라 1이 좁다 → 초가 바뀔 때마다 폭이 최대 8px 출렁인다.
 * `tabular-nums`(`font-variant-numeric`)는 **글꼴은 Pretendard 그대로 두고 숫자 폭만** 맞춘다.
 * ⇒ 자리맞춤이라는 원래 목적은 지키고, 터미널 글꼴만 걷어낸다.
 *
 * ## 이 시험이 **못 하는 것**
 * jsdom 은 레이아웃이 없어 **폭을 못 잰다.** 위 표는 브라우저 실측이고 여기서는 재현되지 않는다.
 * 여기서 지키는 것은 두 가지뿐이다:
 *   ① 소비자 표면에 `font-mono` 가 **0**(허용 목록 제외)
 *   ② 자리맞춤이 필요한 자리에 `tabular-nums` 가 **실제로 있다**
 * ②가 없으면 누가 `font-mono` 만 지워도 ①은 초록인데 시계는 다시 떨린다.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'fs'
import { resolve } from 'path'
import { readCode, stripComments, readRaw } from '../helpers/source-text'

const SRC = resolve(__dirname, '../..')
/** 이 파일의 경로는 전부 `src/` 상대다 — 헬퍼는 레포 상대라 접두사를 붙인다. */
const R = (f: string) => readRaw(`src/${f}`)
const C = (f: string) => readCode(`src/${f}`)

/** 소비자 표면 스캔 루트. 대시보드 전용 트리는 아래 규칙으로 걸러낸다. */
const ROOTS = ['pages', 'components', 'features', 'shared']

/**
 * 대시보드(어드민·셀러·에이전시·도매·유어애즈)는 이 규칙 밖이다 — 대표의 지적은 **소비자 화면**이고,
 * 대시보드에서 고정폭은 운영자가 값을 대조하는 실제 용도가 있다.
 *
 * ⚠️ **파일 이름으로 거르지 않는다.** `pages/payment-success/SellerConversionNudge.tsx` 는
 * 이름에 `Seller` 가 있지만 **결제 완료 화면**(소비자)이다 — 이름 규칙을 쓰면 그 파일이 조용히
 * 범위 밖으로 빠지고, 실제로 첫 판에서 그랬다(거기 URL 이 `font-mono` 로 남아 있었다).
 * 그래서 ⓐ `pages/` **바로 아래** 파일만 이름으로 판정하고 ⓑ 중첩 파일은 **디렉터리**로 판정한다.
 */
const DASHBOARD_DIR = /(^|\/)(admin|admin-[a-z0-9-]+|seller-[a-z0-9-]+|agency-[a-z0-9-]+|wholesale|wholesale-[a-z0-9-]+|supplier|supplier-[a-z0-9-]+|marketing|supply|ads)(\/)/
const DASHBOARD_TOP_PAGE = /^pages\/(Admin|Seller|Agency|Wholesale|Supplier)[A-Z0-9]/
const DEBUG_FILE = /Debug/

/**
 * 고정폭이 **맞는** 자리 — 전부 마크다운/코드 블록 렌더러다.
 * 코드를 코드처럼 보여 주는 것이 목적이라 여기서 `font-mono` 를 빼면 오히려 틀린다.
 * ⚠️ 잔액·시계·코드처럼 **읽는 숫자**를 여기에 추가하지 말 것 — 그건 고쳐야 하는 자리다.
 */
const ALLOW: Record<string, string> = {
  'components/MarkdownView.tsx': '마크다운 인라인 코드 스팬(`...`)',
  'components/guide/GuideViewer.tsx': '가이드 코드 블록 + 원본 HTML 편집 textarea',
  'components/auth/SellerPinPrompt.tsx': '셀러 대시보드 위젯(프로필 편집 전용) — 소비자 화면 아님',
}

function walk(dir: string, rel: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const abs = resolve(dir, name)
    const r = rel ? `${rel}/${name}` : name
    if (statSync(abs).isDirectory()) { walk(abs, r, out); continue }
    if (!/\.tsx?$/.test(name)) continue
    out.push(r)
  }
}

function consumerFiles(): string[] {
  const all: string[] = []
  for (const root of ROOTS) walk(resolve(SRC, root), root, all)
  return all.filter((f) => !DASHBOARD_DIR.test(f) && !DASHBOARD_TOP_PAGE.test(f) && !DEBUG_FILE.test(f))
}

describe('소비자 화면에 터미널 고정폭이 없다 (2026-09-23)', () => {
  const files = consumerFiles()

  it('검사 대상이 충분하다 — 0건이면 통과가 아니라 고장이다', () => {
    // 경로 규칙이 낡아 스캔이 조용히 비면 아래 단언이 전부 헛돈다(이 레포가 반복해 당한 클래스).
    expect(files.length, '소비자 파일을 못 찾았다 — ROOTS/제외 규칙을 확인할 것').toBeGreaterThan(300)
    expect(files).toContain('pages/my-vouchers/QRModal.tsx')
    expect(files).toContain('pages/payment-success/SellerConversionNudge.tsx') // 이름에 Seller 가 있어도 소비자다
  })

  it('제외 규칙이 대시보드를 실제로 걸러낸다 — 그리고 소비자를 안 삼킨다', () => {
    expect(files).not.toContain('pages/AdminUsersPage.tsx')
    expect(files).not.toContain('pages/seller-orders/OrderNumber.tsx')
    expect(files).not.toContain('pages/admin/AdminBuyerPoolPage.tsx')
    expect(files).toContain('pages/PaymentSuccessPage.tsx')
    expect(files).toContain('pages/MyLedgerPage.tsx')
  })

  it('`font-mono` 가 0 이다 (허용 목록 제외)', () => {
    const hits: string[] = []
    for (const f of files) {
      if (ALLOW[f]) continue
      // 주석 속 언급은 위반이 아니다 — 설명에 이름이 남는 건 흔하다.
      const code = stripComments(R(f))
      if (/\bfont-mono\b/.test(code)) hits.push(f)
    }
    expect(hits, `소비자 화면에 터미널 고정폭이 남아 있다:\n${hits.join('\n')}`).toEqual([])
  })

  it('허용 목록은 실제로 고정폭을 쓰는 파일만 담는다 — 낡으면 지운다', () => {
    for (const [f, why] of Object.entries(ALLOW)) {
      const code = stripComments(R(f))
      expect(/\bfont-mono\b/.test(code), `${f} 에 더는 font-mono 가 없다(${why}) — 허용 목록에서 빼라`).toBe(true)
    }
  })
})

describe('자리맞춤이 필요한 자리에 tabular-nums 가 있다', () => {
  it('이용권 QR 시트 — 코드와 실시간 시계', () => {
    const code = C('pages/my-vouchers/QRModal.tsx')
    const lines = code.split('\n')
    // ⚠️ `{voucher.code}` 만으로 찾으면 **QR URL 템플릿**(`/v/${voucher.code}`)이 먼저 잡힌다
    //    — 첫 판이 그래서 엉뚱한 줄을 검사했다. 렌더 형태로 앵커한다.
    const codeLine = lines.find((l) => l.includes('>{voucher.code}</code>'))
    expect(codeLine, '이용권 코드 렌더 줄을 못 찾았다').toBeTruthy()
    expect(codeLine!).toContain('tabular-nums')
    // 시계는 1초마다 값이 바뀐다 — 숫자 폭이 다르면 그때마다 좌우로 흔들린다.
    // className 과 값이 다른 줄에 있으므로 값 줄에서 위로 두 줄까지 본다.
    const clockIdx = lines.findIndex((l) => l.includes('toLocaleTimeString'))
    expect(clockIdx, '시계 줄을 못 찾았다').toBeGreaterThan(0)
    const clockBlock = lines.slice(Math.max(0, clockIdx - 2), clockIdx + 1).join('\n')
    expect(clockBlock).toContain('tabular-nums')
  })

  it('지갑 헤더 — 숫자 칸은 자리맞춤을 켠다', () => {
    const code = C('pages/my-vouchers/WalletHeader.tsx')
    expect(code).toMatch(/s\.mono\s*\?\s*'tabular-nums'/)
  })

  it('이용권 티켓 — 가격', () => {
    const code = C('pages/my-vouchers/VoucherTicket.tsx')
    expect(code).toContain('tabular-nums')
  })

  it('결제 완료 — 금액·주문번호', () => {
    const code = C('pages/PaymentSuccessPage.tsx')
    expect(code).toContain('tabular-nums')
  })
})
