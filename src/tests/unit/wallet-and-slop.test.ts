/**
 * 🎟️ 지갑 · 🎨 design-slop 가드 계약 (2026-09-01 — 대표 *"이용권 지갑도, 남은 것들 다 해줘"*)
 *
 * ■ 왜 테스트인가
 *   ① 지갑 상단은 **대표 승인 시안 4**(2026-08-31)라 요약 줄의 "사용 가능 N장" 은 못 건드린다.
 *      그러면 아래 섹션 헤더가 같은 숫자를 다시 말하는 것이 유일한 고칠 자리인데, 섹션 헤더는
 *      "개수를 보여 준다" 는 이유로 언제든 다시 붙는다. 못으로 박는다.
 *   ② `check-design-slop` 은 이 레포에서 **두 번** 헛돌았다. 2026-08-31 에는 인라인 CSS 표기를
 *      못 봤고, 2026-09-01 에는 `dark:` 변형 stop 을 못 봤다(`CouponClaimPage` 가 다크에서
 *      `#11141C → #11141C` 를 세 줄 갖고도 몇 달간 초록불). 가드가 **실패할 수 있는지**를
 *      테스트가 직접 확인한다 — 가드 자신을 믿지 않는다.
 *
 * ⚠️ 이 파일이 **못 잡는 것**: 실제 렌더 결과 · CSS 로 크기를 다시 키우는 경우 ·
 *    이 세 파일 밖의 같은 결함.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'

const R = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')

describe('이용권 지갑', () => {
  const page = R('pages/MyVouchersPage.tsx')

  it('같은 말을 반복하지 않는다 — 금액은 머리글 한 번·장수는 탭 배지 한 번, 칩 줄·요약 지표 줄은 없다 (2026-10-07 A안 + 10-08)', () => {
    // 종전엔 '사용 가능' 이 요약 줄·탭·칩·카드 띠에 네 번 나왔다(대표 "이 페이지 자체가 못생겼어").
    // 🎫 2026-10-08 (대표 "굳이 없어도 될 것 같아"): A안이 남겨 둔 마지막 중복을 걷었다.
    //   종전 머리글은 `88,900원 · 3장` 이었고 40px 아래 탭 배지가 같은 `unusedItems.length` 를 또 말했다.
    //   ⇒ 불변식이 "장수는 머리글 한 번" → **"장수는 탭 배지 한 번"** 으로 옮겨갔다(0번이 되는 것도 막는다).
    // 🩸 거리(`{0,600}`)로 앵커를 잡으면 **그 사이에 주석을 쓰는 것만으로** 빨간불이 난다(실제로 났다).
    //   코드만 보면 거리가 안 변하므로, 아래 단언은 전부 주석 제거본을 본다.
    const pageCode = stripComments(page)
    expect(pageCode.length, '주석 제거기가 파일을 통째로 먹었다').toBeGreaterThan(page.length * 0.4)
    expect(pageCode).toMatch(/<WalletHeader[\s\S]{0,600}eyebrow=/)
    expect(pageCode, '머리글에 장수가 돌아왔다 — 탭 배지와 같은 숫자를 두 번 말한다').not.toMatch(/countText=/)
    expect(pageCode, '탭 배지(개수)가 사라졌다 — 이제 장수를 말하는 곳이 한 곳도 없다')
      .toMatch(/key === 'unused' && unusedItems\.length > 0 &&/)
    expect(page, '요약 지표 줄(stats)이 돌아왔다').not.toMatch(/heroUsable/)
    expect(page, '칩 줄(전체 N·만료 임박)이 돌아왔다').not.toMatch(/voucher\.chipAll|voucher\.chipSoon/)
    // 탭의 개수는 라벨 옆 브랜드색 숫자 한 번뿐이다 — 라벨 문자열에 개수를 이어 붙이면 '사용 가능 3 3' 이 된다.
    const tabLabels = page.match(/\[\['unused',[\s\S]*?\]\] as const\)/)?.[0] ?? ''
    expect(tabLabels.length, '탭 라벨 목록을 못 찾았다').toBeGreaterThan(40)
    expect(tabLabels, '탭 라벨에 개수가 들어왔다').not.toMatch(/unusedItems/)
  })

  /**
   * 🎫 2026-09-03 (대표 "내 이용권 문장 삭제해줘")
   * 화면에서 제목 줄을 지웠다. 다만 **없앤 것이 아니라 `sr-only` 로 남겼다** — 페이지가 h1 없는
   * 문서가 되면 보조기술·크롤러가 이 화면이 무엇인지 알 방법이 사라진다.
   * ⚠️ 이 테스트가 못 잡는 것: CSS 로 sr-only 를 무력화하는 경우(실제 렌더는 안 잰다).
   */
  it('제목 줄은 화면에 안 뜨지만 sr-only h1 로 남아 있다', () => {
    expect(page).toMatch(/<WalletHeader[\s\S]{0,400}hideTitle/)
    const header = R('pages/my-vouchers/WalletHeader.tsx')
    expect(header).toMatch(/hideTitle && <h1 className="sr-only">\{title\}<\/h1>/)
    // 보이는 제목은 hideTitle 이면 렌더되지 않는다(그냥 색만 바꾸는 식이면 위반).
    expect(header).toMatch(/\{!hideTitle && \([\s\S]{0,200}<h1/)
  })

  it('카드는 가격을 다시 말하지 않는다 — 금액은 머리글 합계 한 번 (2026-10-07 A안)', () => {
    const card = R('pages/my-vouchers/VoucherTicket.tsx')
    const internal = card.slice(card.indexOf('export default function VoucherTicket'), card.indexOf('function KtAlphaVoucherCard'))
    expect(internal.length, '이용권 카드 본문을 못 찾았다').toBeGreaterThan(500)
    expect(internal).toMatch(/\{menu\}/)
    expect(internal, '카드 안에 가격이 돌아왔다').not.toMatch(/applied_price|product_price/)
  })
})

describe('check-design-slop 가드가 실제로 실패할 수 있다', () => {
  /** 임시 파일 하나만 담은 src 트리를 만들어 가드를 돌린다 — 레포를 건드리지 않는다. */
  function runOn(content: string): { code: number; out: string } {
    const dir = mkdtempSync(join(tmpdir(), 'slop-'))
    try {
      execFileSync('mkdir', ['-p', join(dir, 'src'), join(dir, 'scripts')])
      // 스캔 하한(300개)을 넘기려면 파일이 많아야 한다 → 결함 파일 1 + 무해한 파일 다수.
      writeFileSync(join(dir, 'src/Bad.tsx'), content)
      for (let i = 0; i < 320; i++) writeFileSync(join(dir, `src/Ok${i}.tsx`), 'export const x = 1\n')
      writeFileSync(join(dir, 'scripts/design-slop-baseline.json'), JSON.stringify({ flat: 0, emoji: 0 }))
      const guard = resolve(__dirname, '../../../scripts/check-design-slop.mjs')
      try {
        const out = execFileSync('node', [guard], { cwd: dir, encoding: 'utf-8' })
        return { code: 0, out }
      } catch (e: unknown) {
        const err = e as { status?: number; stdout?: string; stderr?: string }
        return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  it('변형(dark:) stop 이 같은 색이면 잡는다 — 2026-09-01 에 뚫려 있던 구멍', () => {
    const r = runOn('export const A = () => <div className="bg-gradient-to-b from-gray-50 dark:from-[#11141C] to-white dark:to-[#11141C]" />\n')
    expect(r.code, r.out).not.toBe(0)
  })

  it('붙어 있는 기본 stop 이 같은 색이면 잡는다 — 원래 잡던 것을 계속 잡는가', () => {
    const r = runOn('export const A = () => <div className="bg-gradient-to-br from-[#111827] to-[#111827]" />\n')
    expect(r.code, r.out).not.toBe(0)
  })

  it('투명도만 다른 페이드는 평면이 아니다 — 오탐을 내지 않는다', () => {
    const r = runOn('export const A = () => <div className="bg-gradient-to-br from-[#6b7280]/20 to-[#6b7280]/10" />\n')
    expect(r.code, r.out).toBe(0)
  })

  it('진짜 그라디언트는 통과한다', () => {
    const r = runOn('export const A = () => <div className="bg-gradient-to-b from-gray-50 to-white dark:bg-none dark:bg-[#11141C]" />\n')
    expect(r.code, r.out).toBe(0)
  })
})
