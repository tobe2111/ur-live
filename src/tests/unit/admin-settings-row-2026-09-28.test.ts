/**
 * ⚙️ 2026-09-28 (대표 신고 — 폰으로 머니 스위치 ⑨ 를 켜다가) **설정 라벨이 한 글자씩 세로로 쌓였다.**
 *
 * ## 무엇이었나 (실제 페이지 렌더 실측 · 65행)
 *
 * | 뷰포트 | 깨진 행 | 최악 라벨 칸 | 가장 높은 행 |
 * |---|---|---|---|
 * | 360px 수정 전 | **29개** | **0px** | **3,739px** |
 * | 360px 수정 후 | 0개 | 262px | 259px |
 * | 1280px 수정 전/후 | 0개 / 0개 | 77 / 76px | **151px / 151px**(동일 — PC 무회귀) |
 *
 * 오타가 아니라 **산수**였다. 행이 `flex items-center justify-between gap-4 px-5 py-4` 이고 입력이
 * `shrink-0` 이라, 폰 폭에서 고정분(패딩 40 + 간격 16 + 입력 288~363)을 빼면 라벨 몫이 0~14px 다.
 * `min-w-0` 이 붙어 있어 그만큼까지 실제로 줄어든다. **PC 에서는 멀쩡해서 개발 중엔 안 보인다.**
 * 하필 가장 심한 것이 머니 스위치였다 — `<select>` 의 선택지 문구가 길어 고유 폭이 297~363px 다.
 *
 * ## 이 시험이 지키는 것
 * ① `SettingRow` 가 **좁으면 쌓고 `sm` 부터 한 줄**로 돌아간다.
 * ② 설정 화면들이 그 부품을 **실제로 쓴다**(클래스를 손으로 다시 쓰면 다음 줄에서 또 샌다).
 * ③ 그 파일들에 **짜부라지는 옛 패턴**(`w-NN shrink-0` · 반응형 없는 `justify-between` 행)이 안 남아 있다.
 * ④ 어드민은 **라이트 고정** — `dark:` 를 안 붙인다.
 *
 * ## ⚠️ 이 시험이 **못** 하는 것
 * - **픽셀은 못 잰다.** jsdom 은 레이아웃이 없어 "라벨이 짜부라졌나"를 판정할 수 없다 —
 *   위 표는 브라우저 프레임 캡처로 잰 것이고, 여기서는 *클래스가 붙어 있는가*만 본다.
 * - **어드민의 다른 화면들**은 대상이 아니다(이번 범위는 대표가 실제로 부딪힌 플랫폼 설정 한 장).
 *   같은 클래스가 어드민 곳곳에 남아 있고, 신고되면 같은 방식으로 옮기면 된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { settingControlCls } from '@/pages/admin-platform-settings/SettingRow'

const ROW = 'src/pages/admin-platform-settings/SettingRow.tsx'
const CALLERS = [
  'src/pages/AdminPlatformSettingsPage.tsx',
  'src/pages/admin-platform-settings/PromoBarSection.tsx',
  'src/pages/admin-platform-settings/CloudflareCredsSection.tsx',
]

const src = (p: string) => stripComments(readFileSync(p, 'utf-8'))

describe('① SettingRow — 좁으면 쌓고, sm 부터 한 줄', () => {
  const s = src(ROW)

  it('측정이 비어 있지 않다', () => {
    expect(s.length).toBeGreaterThan(400)
  })

  it('🔴 기본이 세로 쌓기다 (폰에서 라벨이 온전한 폭을 갖는다)', () => {
    expect(s, 'flex-col').toMatch(/className="[^"]*\bflex-col\b/)
    // items-stretch 여야 입력이 가로로 꽉 찬다 — center 면 내용 폭으로 쪼그라든다.
    expect(s, 'items-stretch').toMatch(/className="[^"]*\bitems-stretch\b/)
  })

  it('🔴 sm(640px)부터 종전 한 줄 레이아웃으로 돌아간다 (PC 무회귀)', () => {
    for (const c of ['sm:flex-row', 'sm:items-center', 'sm:justify-between']) {
      expect(s, c).toContain(c)
    }
  })

  it('🔴 좁을 때 입력을 `shrink-0` 으로 고정하지 않는다 — 그게 라벨을 0px 로 만든 원인이다', () => {
    // `sm:shrink-0` 은 허용(넓을 때만). 접두사 없는 `shrink-0` 은 금지.
    expect(s).not.toMatch(/(^|[\s"'`])shrink-0/m)
  })

  /**
   * 🩸 첫 판은 헬퍼의 **소스 문자열**을 정규식으로 봤다가 템플릿 리터럴의 백틱에 걸려 헛돌았다.
   *    문자열 대신 **함수를 호출해** 결과를 본다 — 어떻게 쓰였든 *나오는 클래스*가 규칙이다.
   */
  it('입력 폭은 호출부가 정한다 (필드마다 다르다 — 이 부품의 일이 아니다)', () => {
    expect(s).toContain('settingControlCls')
    const withWidth = settingControlCls('sm:w-72')
    const noWidth = settingControlCls()
    for (const out of [withWidth, noWidth]) {
      const cls = out.split(/\s+/)
      // 좁을 땐 꽉 찬다.
      expect(cls, out).toContain('w-full')
      // 넓을 때만 안 줄어든다 — 접두사 없는 shrink-0 이면 폰에서 라벨이 0px 가 된다.
      expect(cls, out).toContain('sm:shrink-0')
      expect(cls, out).not.toContain('shrink-0')
    }
    // 호출부가 준 폭은 sm 에서만 먹는다(그대로 실린다).
    expect(withWidth.split(/\s+/)).toContain('sm:w-72')
    expect(settingControlCls('sm:w-28', 'text-right').split(/\s+/)).toContain('text-right')
  })
})

describe('② 설정 화면이 그 부품을 실제로 쓴다', () => {
  it.each(CALLERS)('%s 가 반응형 행을 쓴다', (p) => {
    const s = src(p)
    const usesRow = /<SettingRow\b/.test(s)
    // CloudflareCredsSection 은 행 모양이 달라(설정됨 배지/교체 버튼) 같은 클래스를 직접 쓴다.
    const usesClasses = /flex-col[^"]*sm:flex-row/.test(s)
    expect(usesRow || usesClasses, '반응형 행 배선').toBe(true)
  })

  it('🔴 AdminPlatformSettingsPage 의 세 그룹이 전부 SettingRow 다', () => {
    const s = src('src/pages/AdminPlatformSettingsPage.tsx')
    // 기본 설정 · 커미션 예산(머니 스위치) · 운영 정책
    expect((s.match(/<SettingRow\b/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('🔴 프로모 바의 다섯 줄이 전부 SettingRow 다', () => {
    const s = src('src/pages/admin-platform-settings/PromoBarSection.tsx')
    expect((s.match(/<SettingRow\b/g) || []).length).toBe(5)
  })

  /**
   * 종전엔 행 전체가 `<label>` 이라 **설명을 눌러도 입력에 포커스**가 갔다.
   * 부품으로 옮기면서 `as` 를 빠뜨리면 `<div>` 가 되어 그 성질이 조용히 사라진다
   * (화면은 똑같아 보이고 아무 에러도 안 난다).
   */
  it('🔴 프로모 바 줄은 label 이다 — 설명을 눌러도 입력에 포커스가 간다', () => {
    const s = src('src/pages/admin-platform-settings/PromoBarSection.tsx')
    expect((s.match(/<SettingRow as="label"/g) || []).length).toBe(5)
  })
})

describe('③ 짜부라지는 옛 패턴이 안 남아 있다', () => {
  it.each(CALLERS)('%s — 반응형 없는 justify-between 설정 행 0개', (p) => {
    const s = src(p)
    // `flex items-center justify-between … px-5 py-4` = 폰에서 라벨을 0px 로 만드는 그 행.
    const rows = s.match(/className="flex items-center justify-between[^"]*px-5 py-4[^"]*"/g) || []
    expect(rows, `남은 행: ${rows.join(' | ')}`).toHaveLength(0)
  })

  it.each(CALLERS)('%s — 고정폭 + shrink-0 컨트롤 0개', (p) => {
    const s = src(p)
    // `w-64 px-3 …` / `w-28 shrink-0 …` 처럼 **접두사 없는** 고정폭이 남으면 같은 사고가 난다.
    const bad = s.match(/className="[^"]*(?<!sm:)\bw-\d+\b[^"]*\bshrink-0\b[^"]*"/g) || []
    expect(bad, `남은 컨트롤: ${bad.join(' | ')}`).toHaveLength(0)
  })
})

describe('④ 어드민은 라이트 고정 — dark: 를 안 붙인다', () => {
  it.each([ROW, ...CALLERS])('%s 에 dark: 가 없다', (p) => {
    expect(src(p)).not.toContain('dark:')
  })
})
