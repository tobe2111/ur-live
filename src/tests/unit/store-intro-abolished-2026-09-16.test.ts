/**
 * 🛑 매장 영입 2% 폐지 (2026-09-16 대표 *"매장 데려온 사람 2%는 이제 아예 없는거야"*).
 *
 * ## 이 가드가 막는 것은 "죽은 코드"가 아니라 **거짓 약속**이다
 *   적립 함수는 2026-08-31 에 이미 호출부가 끊겼고(`order-commissions.ts` "적립만 없앴다"),
 *   라이브 `influencer_attributions` 는 **0건**이다. 그런데 **화면 셋이 계속 2% 를 약속하고 있었다**:
 *     · 유어샵 수익 사다리 1단 — "내 초대 링크로 등록한 가게는 매출의 2%를 1년간 받습니다"
 *     · 정산 페이지 매장 초대 링크 — "그 매장 매출의 2%를 1년간 받습니다"
 *     · 정산 페이지 빈 상태 — "6개월간 +1% 추가 commission" (값조차 낡은 옛 규칙)
 *
 *   같은 레포가 다른 파일에서 이 위험을 정확히 적어 뒀다 — *"화면은 'N% 받는다'인데 정산은 0 이 된다.
 *   그건 버그가 아니라 **약속 위반**이고, 되돌리는 데 드는 비용(환급 + 신뢰)이 훨씬 크다"*
 *   (`influencer-deal.ts`). 그 상태로 몇 주가 지났다.
 *
 * 🩸 그리고 이 괴리가 실제로 사람을 속였다: 2026-09-15 에 세션이 대표에게 **"영입 2% 가 살아 있다"**
 *   고 보고했다. 설정값과 환불 역전 코드만 보고 단정한 것이다. 대표가 *"그런거 없어"* 로 바로잡았다.
 *   ⇒ 화면·설정이 코드보다 뒤처지면 **사람도 코드를 오독한다.**
 *
 * ⚠️ 이 테스트가 **안 지우는 것**(의도적):
 *   · `introduced_by_influencer_id` — "누가 데려왔나" 는 사실이고 중개사 모델이 쓸 기록이다
 *   · `reverseInfluencerStoreIntroOnRefund` — 적립 0건이라 no-op 이지만, 머니 경로를 건드려
 *     얻을 게 없다. 과거 데이터 안전망으로 둔다
 *   · `platform_settings` 의 값 — 지우면 저장 payload 가 흔들린다. 화면에서 **끈 채로** 보인다
 *
 * 주입 매니페스트: scripts/mutations/store-intro-abolished.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))

/** 사용자(소비자·소개자·매장)가 보는 화면만. 어드민은 별도 규칙(폐지 표시를 *남긴다*). */
function userFacingFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) { walk(p); continue }
      if (!e.name.endsWith('.tsx')) continue
      // 어드민 화면은 제외 — 거기선 "폐지됨" 이라고 *말해야* 한다.
      if (/Admin|admin-/.test(p)) continue
      out.push(p)
    }
  }
  walk('src/pages'); walk('src/components')
  return out
}

describe('① 사용자 화면이 영입 커미션을 약속하지 않는다', () => {
  const FILES = userFacingFiles()

  it('검사 대상이 실제로 있다 (경로가 낡아 0건이면 통과가 아니라 실패)', () => {
    expect(FILES.length).toBeGreaterThan(200)
  })

  it('"영입 + 퍼센트" 를 나란히 약속하는 문구가 없다', () => {
    const hits: string[] = []
    for (const f of FILES) {
      const src = read(f)
      for (const line of src.split('\n')) {
        // 같은 줄에 "영입"(또는 "데려온")과 숫자% 가 함께 있으면 보상 약속으로 본다.
        if (/(영입|데려온|데려오)/.test(line) && /\d+(\.\d+)?\s*%/.test(line)) hits.push(`${f}: ${line.trim().slice(0, 90)}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('죽은 적립 축(store_intro)을 사용자 화면이 참조하지 않는다', () => {
    const hits = FILES.filter(f => /source=['"]store_intro|influencer_store_intro/.test(read(f)))
    expect(hits).toEqual([])
  })
})

describe('② 적립은 어디서도 되살아나지 않는다', () => {
  it('creditInfluencerStoreIntroCommission 의 호출부가 0 이다', () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { if (!p.includes('/tests')) walk(p); continue }
        if (!/\.tsx?$/.test(e.name)) continue
        if (p.endsWith('influencer-store-intro-commission.ts')) continue // 정의부
        if (read(p).includes('creditInfluencerStoreIntroCommission')) hits.push(p)
      }
    }
    walk('src')
    expect(hits).toEqual([])
  })

  it('커미션 축 타입에 store_intro 가 없다 (있으면 오케스트레이터가 다시 부를 수 있다)', () => {
    const axes = read('src/worker/utils/order-commissions.ts')
    const m = axes.match(/export type CommissionAxis = ([^\n]+)/)
    expect(m).toBeTruthy()
    expect(m![1]).not.toMatch(/store_intro|influencer_intro/)
  })
})

describe('③ 어드민에는 폐지 사실이 남아 있다 (지우면 다음 사람이 다시 만든다)', () => {
  it('커미션 설정 화면이 폐지됐다고 말한다', () => {
    const src = readFileSync('src/pages/AdminCommissionSettingsPage.tsx', 'utf8')
    expect(src).toMatch(/매장 영입 커미션 — 폐지됨/)
    // 값은 보이되 **수정할 수 없어야** 한다 — 켤 수 있으면 폐지가 아니다.
    expect(src).toMatch(/form\.influencer_store_intro_pct\}\s*disabled/)
    expect(src).toMatch(/form\.influencer_store_intro_months\}\s*disabled/)
  })
})

describe('④ 남기기로 한 것은 그대로 있다', () => {
  it('"누가 데려왔나" 기록은 지우지 않았다 — 중개사 모델이 쓴다', () => {
    // 🩸 첫 판은 `toContain('introduced_by_influencer_id')` 였는데, 주입이 곧바로 구멍을 보여 줬다:
    //    이름 뒤에 아무 글자나 붙여도(`..._REMOVED`) 부분일치라 통과했다. **컬럼을 만드는 문장**을 본다.
    const repair = readFileSync('src/worker/routes/repair-schema/column-repairs.ts', 'utf8')
    expect(repair).toContain('ADD COLUMN introduced_by_influencer_id INTEGER')
  })
  it('환불 역전은 남겨 둔다 (적립 0건이라 no-op 이지만 머니 경로를 건드릴 이유가 없다)', () => {
    expect(read('src/worker/utils/order-refund.ts')).toContain('reverseInfluencerStoreIntroOnRefund')
  })
})
