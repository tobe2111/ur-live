import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/**
 * 🧾 **소비자 화면의 흐름 속 판은 평면이다** — 2026-11-02 대표 확정
 *
 * 대표: *"이용권 페이지도 한번 확인해볼래? 그림자 져있는 것들이라던지 개선이 필요해 디자인 통합을 해야지."*
 * 지갑을 세 안(그림자 판 · A 평면 · B 옅은 회색 면)으로 그려 보여 드렸고 **"A안 — 평면"**, 범위
 * **"소비자 화면 전체"**(사장님/어드민/에이전시 대시보드 제외). 잠금 파일(지갑 `MyVouchersPage`)은
 * 같은 날 **"허가 — 평면으로"**, 결제 완료 티켓은 **"티켓도 평면"**.
 * ⚠️ 2026-11-01 "처방 1 그림자 12%"(흐름 속 카드에 그림자)를 대체한다.
 *
 * ## 무엇을 지키나
 * ① 흐름 속 판에 `shadow-lift` 가 **다시 생기지 않는다** — 판정은 코드모드(`consumer-plate-flat.mjs --dry`)
 *    한 벌이다(조건을 여기 복제하면 둘이 갈린다).
 * ② 남겨 둔 그림자(떠 있는 면 · 조작 요소 · 사장님 화면 · 잠금 파일)는 **늘지 않는다**(래칫).
 *    🔴 그것들은 `--lift` 를 계속 쓴다 — 흰 바탕에서 평면이면 모달·시트·토스트·지도 칩이 통째로 사라진다.
 *    그래서 `--lift` 토큰을 none 으로 바꾸는 대신 **요소 단위**로 걷었다.
 * ③ `--lift` 토큰 자체는 살아 있다(떠 있는 면이 쓴다).
 *
 * ## ⚠️ 못 보는 것
 * - 변수 이름이 판정 규칙에 안 걸리는 조건부 클래스(같은 줄에 absolute 가 없으면 흐름으로 본다 —
 *   그래서 지갑 지도 위 가로 카드를 첫 판이 걷었고, `snap-start shrink-0` 를 규칙에 더했다)
 * - 인라인 `style={{ boxShadow }}` · CSS 파일(`.ur-pc-card` 는 index.css 에서 따로 평면화)
 * - **걷은 자리가 보기 좋은지**(여백 정렬) — `node scripts/visual-preview.mjs` 로 그려서 본다.
 */
const run = (a: string) => execSync(`node scripts/codemods/consumer-plate-flat.mjs --dry ${a}`, { encoding: 'utf8' })

/** 남겨 둔 그림자 실측(2026-11-02). 줄이는 건 자유, 늘리는 건 차단. */
const KEPT_BASELINE = 69

describe('🧾 소비자 화면 — 흐름 속 판은 평면 (2026-11-02 A안)', () => {
  it('① 자동으로 걷을 판이 남아 있지 않다 (코드모드와 한 벌)', () => {
    const out = run('')
    const m = out.match(/평면 (\d+)건 · 남긴 그림자 (\d+)건/)
    expect(m, `코드모드 출력 형식이 바뀌었다 — 이 검사가 헛돈다: ${out.trim()}`).toBeTruthy()
    expect(Number(m![1]), `흐름 속 판에 그림자가 ${m![1]}건 생겼다.\n` +
      run('--list').split('\n').filter((l) => l.startsWith('FLAT')).join('\n') +
      '\n→ 판 없이 그리거나(`node scripts/codemods/consumer-plate-flat.mjs`), 떠 있는 면이면 그 줄에 absolute/fixed 를 둔다.').toBe(0)
  })

  it('② 남겨 둔 그림자가 늘지 않는다 + 측정이 헛돌지 않는다', () => {
    const n = Number((run('').match(/남긴 그림자 (\d+)건/) || [])[1])
    expect(n, '남긴 그림자가 0 — 판정이 헛돌고 있다(떠 있는 면은 분명히 있다)').toBeGreaterThan(30)
    expect(n, `남긴 그림자 ${n}건 (기준 ${KEPT_BASELINE}). 새 그림자는 떠 있는 면에만.`).toBeLessThanOrEqual(KEPT_BASELINE)
  })

  it('③ 떠 있는 면은 그림자를 지킨다 — 토스트 · 지도 위 가로 카드 · 캐러셀 화살표', () => {
    expect(readFileSync('src/components/ToastContainer.tsx', 'utf8')).toMatch(/shadow-lift/)
    expect(readFileSync('src/pages/MyVouchersPage.tsx', 'utf8')).toMatch(/snap-start shrink-0[^"`]*bg-surface shadow-lift/)
    expect(readFileSync('src/components/home/SectionRail.tsx', 'utf8')).toMatch(/rounded-full bg-surface[^"`]*shadow-lift/)
    // 토큰은 살아 있어야 한다 — 전역 none 이면 위 셋이 흰 바탕에서 사라진다.
    // ⚠️ 대시보드·light-island 되박기 자리도 같은 값이라, 그 줄만 잡으면 :root 가 none 이 돼도 통과한다(주입이 잡았다).
    expect(readFileSync('src/index.css', 'utf8')).toMatch(/--lift: 0 2px 10px rgb\(22 24 28 \/ 0\.12\); \/\* 화이트 카드 들림/)
  })

  it('④ 지갑 · 티켓 · PC 마이 카드가 평면이다 (대표가 직접 고른 자리)', () => {
    const wallet = readFileSync('src/pages/MyVouchersPage.tsx', 'utf8')
    expect(wallet).toMatch(/<div className="-mx-4 overflow-hidden divide-y divide-rule">/)
    expect(readFileSync('src/components/ticket/TicketCard.tsx', 'utf8')).not.toMatch(/className=[^\n]*shadow-lift/)
    const css = readFileSync('src/index.css', 'utf8')
    const pc = css.slice(css.indexOf('.ur-account-pc .ur-pc-card {'))
    expect(pc.slice(0, pc.indexOf('}'))).toMatch(/box-shadow: none/)
  })
})
