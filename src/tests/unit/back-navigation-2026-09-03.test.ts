/**
 * 🔙 **뒤로가기는 "이전 화면"으로 가야 한다** (2026-09-03 대표 신고).
 *
 * 대표: *"이용권 페이지 들어갔다가 뒤로가기를 하면 무조건 메인페이지로 돌아가는 것 같아.
 * 뒤로가기 이전페이지로 가는 것 이상적으로 체계적으로 세팅 전체적으로 해줘."*
 *
 * ## 실측으로 확인한 원인
 * 목록 화면의 **필터가 히스토리를 쌓고 있었다.** 브라우저로 재현:
 * `/vouchers` 진입 → 브랜드 칩 1회 → `history.length` 2 → 3.
 * 칩을 서너 번 누르고 상세에 들어가면 목록 밖으로 나가는 데 네다섯 번을 눌러야 하는데,
 * 그 사이 화면은 계속 **같은 목록**이라 사용자는 계속 누른다 → 히스토리 맨 앞(홈)으로 떨어진다.
 * "무조건 메인으로 간다"는 체감은 이 누적의 결과다.
 *
 * ## 규칙
 * **필터·정렬·탭은 이동이 아니라 그 화면의 상태다 → `replace`.**
 * 한 화면에서 어떤 조작은 뒤로가기를 만들고 어떤 조작은 안 만들면 뒤로가기가 예측 불가가 된다.
 * (실제로 `VouchersPage` 안에서 정렬·검색어는 replace, 칩 둘만 push 로 갈려 있었다.)
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 브라우저 히스토리(라우터 런타임)와 페이지 이동용 `navigate`.
 *   여기서 고정하는 것은 **URL 상태 쓰기의 규약**이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 검사 대상을 **손으로 적지 않는다.** 목록 세 개만 적어 두면 내일 만들 목록 화면이 빠지고,
 * 그게 이 결함이 처음 생긴 방식이다(VouchersPage 안에서도 정렬은 replace, 칩만 push 로 갈렸다).
 * ⇒ `src/pages` 의 **소비자 화면 전부**를 훑어 URL 을 쓰는 파일을 스스로 찾는다.
 *
 * 대시보드(어드민·셀러·에이전시·도매)는 제외한다 — 거기서 `?tab=` 은 사이드바 이동을 대신하는
 * **진짜 이동**이라 뒤로가기 한 칸이 생기는 게 맞다(`WholesaleDashboardPage.goTab`).
 */
const DASHBOARD = /(Admin|Seller|Agency|Wholesale|Supplier|Distributor|admin|seller|agency|wholesale|supplier)/

function consumerPages(dir = 'src/pages', out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) consumerPages(f, out)
    else if (f.endsWith('.tsx') && !DASHBOARD.test(f)) out.push(f)
  }
  return out
}

const consumerPagesWritingUrl = () =>
  consumerPages().filter(f => readFileSync(f, 'utf8').includes('setSearchParams('))

/** 주석을 뺀 코드만 본다 — 설명 문장 속 `setSearchParams(` 까지 세면 가짜 빨강이 된다. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('① 소비자 목록의 URL 쓰기는 전부 replace', () => {
  const files = consumerPagesWritingUrl()

  it('검사 대상이 실제로 잡힌다', () => {
    // 0건이면 통과가 아니라 실패다 — 경로가 바뀌어 검사가 조용히 비는 것을 막는다.
    expect(files.length, 'src/pages 에서 URL 쓰는 소비자 화면을 하나도 못 찾았다').toBeGreaterThanOrEqual(5)
  })

  for (const file of files) {
    it(`${file.split('/').pop()} — push 로 쓰는 곳이 없다`, () => {
      const src = code(readFileSync(file, 'utf8'))
      if (src.includes('back-nav-push-ok')) return // 의도적 예외(이유를 그 줄에 적을 것)
      // `setSearchParams(...)` 호출을 전부 찾아 각각 replace 가 붙었는지 본다.
      const calls = [...src.matchAll(/setSearchParams\(/g)]
      for (const m of calls) {
        // 호출부터 그 문장 끝까지 잘라 replace 유무를 본다(중첩 괄호가 있어 정규식 하나로는 안 된다).
        const tail = src.slice(m.index!, m.index! + 400)
        const stmtEnd = tail.indexOf('\n  }')
        const stmt = stmtEnd > 0 ? tail.slice(0, stmtEnd) : tail
        expect(stmt, `${file}: 필터가 히스토리를 쌓는다 → { replace: true } 필요\n${stmt.slice(0, 160)}`)
          .toContain('replace: true')
      }
    })
  }
})

describe('② 뒤로 버튼은 브라우저 히스토리를 쓴다 — 목적지를 손으로 정하지 않는다', () => {
  /**
   * `navigate('/어딘가')` 로 고정하면 **어디서 왔든 그리로** 간다 — 대표가 겪은 증상 그 자체다.
   * 게다가 그건 push 라 뒤로가기가 한 칸 **늘어난다**(줄어야 하는 자리에서).
   * 히스토리가 없을 때만(새 탭·공유 링크) 폴백하는 건 정상 — `LocalTownPage` 패턴:
   *   `window.history.length > 1 ? navigate(-1) : navigate('/')`
   *
   * 여기도 파일 목록을 손으로 안 적는다 — 새 화면의 뒤로 버튼이 자동으로 검사에 들어온다.
   */
  const back = /aria-label=\{?[^\n]{0,60}(뒤로|common\.back)[^\n]{0,60}/

  /** 뒤로 버튼 마크업 근처(앞 320자)를 잘라 본다 — onClick 이 aria-label 앞에 오는 게 보통이다. */
  function backButtonRegions(src: string): string[] {
    const out: string[] = []
    for (const m of src.matchAll(new RegExp(back, 'g')))
      out.push(src.slice(Math.max(0, m.index! - 320), m.index! + 120))
    return out
  }

  const files = consumerPages().filter(f => back.test(readFileSync(f, 'utf8')))

  it('뒤로 버튼을 가진 소비자 화면이 실제로 잡힌다', () => {
    expect(files.length, '뒤로 버튼을 하나도 못 찾았다 — 마크업이 바뀌었는지 확인할 것').toBeGreaterThanOrEqual(8)
  })

  for (const file of files) {
    it(`${file.split('/').pop()} — 목적지를 고정하지 않는다`, () => {
      const src = code(readFileSync(file, 'utf8'))
      if (src.includes('back-nav-push-ok')) return
      for (const region of backButtonRegions(src)) {
        const hard = region.match(/navigate\(\s*['"]\/[^'"]*['"]\s*\)/)
        if (!hard) continue
        // 히스토리 폴백이면 통과 — 그게 올바른 형태다.
        expect(region, `${file}: 뒤로가 목적지를 고정하고 있다 — history.length 폴백이 필요하다\n${hard[0]}`)
          .toMatch(/history\.length|navigate\(\s*-1\s*\)/)
      }
    })
  }
})
