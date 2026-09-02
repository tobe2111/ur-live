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

const R = (p: string) => readFileSync(resolve(__dirname, '../../', p), 'utf-8')

describe('이용권 지갑', () => {
  const page = R('pages/MyVouchersPage.tsx')

  it('섹션 헤더가 요약 줄의 개수를 다시 말하지 않는다', () => {
    // 요약 줄(WalletHeader stats)은 대표 승인 시안 4 — 여기가 개수의 유일한 자리다.
    expect(page).toMatch(/heroUsable[\s\S]{0,120}unusedItems\.length/)
    // 섹션 헤더(groupUnused)와 같은 줄/직후에 개수를 또 렌더하면 위반.
    const at = page.indexOf("'voucher.groupUnused'")
    expect(at, 'groupUnused 라벨을 못 찾았다').toBeGreaterThan(-1)
    expect(page.slice(at, at + 260)).not.toMatch(/unusedItems\.length/)
  })

  it('카드 안 가격이 상품명보다 크지 않다 — 이미 산 것이라 영수증 정보다', () => {
    const lines = R('pages/my-vouchers/VoucherTicket.tsx').split('\n')
    // ⚠️ 클래스 문자열은 `>` 앞에서 끝나므로 한 정규식으로 `>{v.product_name}` 까지 못 건넌다
    //    (첫 판이 그래서 NaN 을 냈다). 줄을 먼저 찾고 그 줄에서 크기를 읽는다.
    const sizeOf = (l: string) => Number(l.match(/text-\[(\d+)px\]/)![1])
    const name = sizeOf(lines.find((l) => l.includes('{v.product_name}') && /text-\[\d+px\]/.test(l))!)
    const price = sizeOf(lines.find((l) => /font-mono|tabular-nums/.test(l) && /text-\[\d+px\]/.test(l) && /leading-none/.test(l))!)
    expect(name, '상품명 크기를 못 읽었다').toBeGreaterThan(0)
    expect(price).toBeLessThanOrEqual(name)
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
