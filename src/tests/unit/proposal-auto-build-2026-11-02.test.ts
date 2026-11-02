/**
 * 📄 대외 소개서 자동 생성 — 2026-11-02 (대표 *"제안서는 계속 자동 업데이트가 안돼"* → *"응 진행해줘. 가장 이상적으로."*)
 *
 * 왜: 덱 숫자는 손으로 적은 그날 값이었고(11-02 실측: 판매 중 이용권 165 → 160 · 식사 평균 32,521 → 33,724),
 * 완성본은 세션이 손으로 다시 뽑아 커밋해야만 바뀌었다(다섯 중 넷이 10-26 에 멈춰 있었다).
 *
 * 고정하는 것:
 *   ① 숫자의 정의 — 판매 중 이용권 · 실제 매장 · 판매가 평균(정가 아님) · 데모 제외 · 앵커가 내려가면 바꾸고 알린다
 *   ② 덱에 라이브 숫자를 손으로 다시 적지 못한다(deck-common 에 리터럴이 없다 · 파일이 없으면 빌드가 멈춘다)
 *   ③ "덱이 말하는 것 ↔ 지금 설정" 이 어긋나면 경고가 난다(broker_share 가 꺼졌는데 "직접 송금" 이라고 말하는 덱)
 *   ④ 배선 — 공개 숫자 경로 · 어드민 경로(어드민 인증 아래) · 매일 도는 워크플로 · Release 업로드 · 화면 폴백
 *   ⑤ 완성본(PDF·PPTX)을 다시 커밋하지 못한다 — 바뀌면 빨간불(완성본은 Release 에 산다)
 * ⚠️ 못 보는 것: 실제 워크플로가 GitHub 에서 도는지(머지 뒤 실행으로 판정) · 문장(설명)이 맞는지(경고만 낸다) ·
 *    인플루언서 DB 규모(공개 경로에서 30만 행 COUNT 는 비싸 손으로 남는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { readCode } from '../helpers/source-text'
import {
  PROPOSAL_FACTS_SQL as Q,
  PROPOSAL_SAMPLE_PRODUCT_ID,
  shapeProposalFacts,
  kstDate,
  type SampleRow,
} from '../../shared/proposal-live-facts'
import { formatLiveFacts } from '../../../docs/business/proposals/facts-live.mjs'
import { claimWarnings, expectedSlides, DECKS } from '../../../docs/business/proposals/build-all.mjs'
import { PROPOSAL_ASSET_NAME } from '../../worker/routes/proposal-facts.routes'

const anchor: SampleRow = { id: PROPOSAL_SAMPLE_PRODUCT_ID, name: '홍대 돈가스 버크셔 프리미엄 돈가스 1인 세트', price: 7500, original_price: 14500, is_active: 1 }
const base = {
  counts: { active: 160, real_stores: 2 },
  averages: [
    { category: 'meal_voucher', avg: 33724 },
    { category: 'beauty_voucher', avg: 42683 },
    { category: 'stay_voucher', avg: 147800 },
    { category: 'etc_voucher', avg: 38598 },
  ],
  anchor,
  fallback: null as SampleRow | null,
  settings: [
    { key: 'broker_share_enabled', value: 'true' },
    { key: 'payout_requires_voucher_use', value: 'true' },
    { key: 'fee_channel_rates_enabled', value: 'true' },
    { key: 'influencer_payout_min', value: '100000' },
  ],
  now: new Date('2026-11-02T03:00:00Z'),
}

describe('① 숫자의 정의', () => {
  it('SQL: 판매 중 = is_active · deal_only=0 · 이용권 4종, 실제 매장 = seller_id 있음 + 데모 제외, 평균 = 판매가', () => {
    expect(Q.counts).toMatch(/is_active = 1/)
    expect(Q.counts).toMatch(/COALESCE\(deal_only, 0\) = 0/)
    for (const c of ['meal_voucher', 'beauty_voucher', 'stay_voucher', 'etc_voucher']) expect(Q.counts).toContain(`'${c}'`)
    expect(Q.counts).toMatch(/seller_id IS NOT NULL AND COALESCE\(slug, ''\) NOT LIKE 'demo-%'/)
    expect(Q.averages).toMatch(/AVG\(price\)/)
    expect(Q.averages).not.toMatch(/original_price/)
  })

  it('정상: 앵커 상품 · 짧은 이름 · 설정 스위치', () => {
    const f = shapeProposalFacts(base)
    expect(f.activeVouchers).toBe(160)
    expect(f.avg.meal).toBe(33724)
    expect(f.sample).toEqual({ id: PROPOSAL_SAMPLE_PRODUCT_ID, name: '프리미엄 돈가스 1인 세트', orig: 14500, price: 7500 })
    expect(f.sampleMoved).toBe(false)
    expect(f.flags.brokerShareEnabled).toBe(true)
  })

  it('앵커가 내려가면 다른 실제 상품으로 바꾸고 sampleMoved 를 켠다', () => {
    const fb: SampleRow = { id: 3001, name: '다른 가게 정식', price: 9000, original_price: 12000, is_active: 1 }
    const f = shapeProposalFacts({ ...base, anchor: { ...anchor, is_active: 0 }, fallback: fb })
    expect(f.sample?.id).toBe(3001)
    expect(f.sample?.name).toBe('다른 가게 정식')
    expect(f.sampleMoved).toBe(true)
  })

  it('설정 행이 없으면 null(모름) — false 와 섞지 않는다', () => {
    const f = shapeProposalFacts({ ...base, settings: [] })
    expect(f.flags.brokerShareEnabled).toBeNull()
    expect(f.influencerPayoutMin).toBeNull()
  })

  it('기준일은 한국 날짜 — UTC 15시 이후는 다음 날', () => {
    expect(kstDate(new Date('2026-11-01T15:30:00Z'))).toBe('2026-11-02')
    expect(kstDate(new Date('2026-11-01T14:59:00Z'))).toBe('2026-11-01')
  })
})

describe('② 덱에 라이브 숫자를 손으로 적지 못한다', () => {
  const deck = readCode('docs/business/proposals/deck-common.mjs')
  const facts = deck.slice(deck.indexOf('export const FACTS'), deck.indexOf('};', deck.indexOf('export const FACTS')))

  it('FACTS 에 라이브 키의 리터럴이 없고, 라이브 값을 합친다', () => {
    for (const k of ['activeVouchers', 'realStores', 'catalogMeasuredAt', 'avgNums', 'avgMeal', 'sampleOrig', 'samplePrice', 'sampleName']) {
      expect(facts, `deck-common.mjs FACTS 에 ${k} 를 손으로 적었다 — 라이브에서 읽는다`).not.toMatch(new RegExp(`\\b${k}:`))
    }
    expect(facts).toMatch(/\.\.\.LIVE,/)
    expect(deck).toMatch(/const LIVE = formatLiveFacts\(readLive\(\)\.data\)/)
  })

  it('라이브 값을 덱 표기로 바꾼다 (수수료 10% · 판매가 기준)', () => {
    const f = formatLiveFacts(shapeProposalFacts(base))
    expect(f.activeVouchers).toBe('160')
    expect(f.avgMeal).toBe('33,724원')
    expect(f.avgNums.stay).toBe(147800)
    expect(f.samplePrice).toBe('7,500원')
    expect(f.sampleFee).toBe('−750원')
    expect(f.sampleNet).toBe('6,750원')
  })

  it('숫자가 비면 덱을 만들지 않는다 (옛 값·빈 값으로 조용히 뽑지 않는다)', () => {
    expect(() => formatLiveFacts({ ...shapeProposalFacts(base), sample: null })).toThrow(/sample/)
    expect(() => formatLiveFacts({ ...shapeProposalFacts(base), avg: { meal: null } })).toThrow(/avg/)
  })
})

describe('③ 덱이 말하는 것 ↔ 지금 설정', () => {
  it('중개 몫 송금이 꺼져 있으면 그 말을 하는 덱에 경고', () => {
    const f = shapeProposalFacts({ ...base, settings: [{ key: 'broker_share_enabled', value: 'false' }, ...base.settings.slice(1)] })
    const w = claimWarnings(f)
    expect(w.map((x) => x.id)).toEqual(['broker-share-payout'])
    expect(w[0].decks).toContain('urdeal-agency-proposal')
  })

  it('새 에이전시 지급 경로가 켜져 있으면 중개 몫 경고는 없다 (둘 중 하나면 약속이 참)', () => {
    const f = shapeProposalFacts({ ...base, settings: [{ key: 'broker_share_enabled', value: 'false' }, { key: 'agency_share_payout_enabled', value: 'true' }, ...base.settings.slice(1)] })
    expect(claimWarnings(f).map((x) => x.id)).not.toContain('broker-share-payout')
  })

  it('전부 맞으면 경고 0', () => {
    expect(claimWarnings(shapeProposalFacts(base))).toEqual([])
  })

  it('예시 상품이 바뀌었으면 경고', () => {
    const fb: SampleRow = { id: 3001, name: 'x', price: 9000, original_price: 12000, is_active: 1 }
    const w = claimWarnings(shapeProposalFacts({ ...base, anchor: null, fallback: fb }))
    expect(w.map((x) => x.id)).toContain('sample-still-selling')
  })
})

describe('④ 배선', () => {
  it('생성기의 덱 다섯 = 어드민 화면의 덱 다섯 (장수 대조가 헛돌지 않는다)', () => {
    const exp = expectedSlides(readFileSync('src/pages/admin/AdminProposalsPage.tsx', 'utf8'))
    expect(Object.keys(exp).sort()).toEqual([...DECKS].sort())
    expect(Object.values(exp).every((n) => n > 0)).toBe(true)
  })

  it('파일 이름 허용 — 덱 PDF·PPTX·manifest 만, 경로 조작은 거절', () => {
    for (const ok of ['urdeal-agency-proposal.pdf', 'urdeal-store-owner-deck.pptx', 'manifest.json']) expect(PROPOSAL_ASSET_NAME.test(ok), ok).toBe(true)
    for (const bad of ['../secret.pdf', 'a/urdeal-x.pdf', 'urdeal-x.pdf?x=1', 'urdeal-x.exe', 'other.pdf', '']) expect(PROPOSAL_ASSET_NAME.test(bad), bad).toBe(false)
  })

  it('워커: 공개 숫자 경로와 어드민 경로(어드민 인증 아래)가 붙어 있다', () => {
    const idx = readCode('src/worker/index.ts')
    expect(idx).toMatch(/app\.route\('\/api\/public\/proposal-facts', proposalFactsPublicRoutes\)/)
    expect(idx).toMatch(/adminApp\.route\('\/', adminProposalsRoutes\)/)
    expect(idx).toMatch(/adminApp\.use\('\*', requireAdmin\(\)\)/)
  })

  it('워크플로: 매일 · 라이브 숫자 받기 · 다섯 덱 · Release 업로드 · 실패를 삼키지 않는다', () => {
    const wf = readFileSync('.github/workflows/proposals.yml', 'utf8')
    expect(wf).toMatch(/schedule:\n\s+- cron: '[^']+'/)
    expect(wf).toMatch(/node facts-live\.mjs fetch/)
    expect(wf).toMatch(/run: node build-all\.mjs/)
    expect(wf).toMatch(/gh release upload proposals-latest [^\n]*manifest\.json --clobber/)
    expect(wf).toMatch(/contents: write/)
    expect(wf).not.toMatch(/continue-on-error: true/)
  })

  it('어드민 화면: 자동 생성본을 먼저 쓰고, 못 받으면 저장된 판이라고 말한다', () => {
    const page = readCode('src/pages/admin/AdminProposalsPage.tsx')
    expect(page).toMatch(/useProposalManifest\(\)/)
    expect(page).toMatch(/const viewUrl = pdf\.url \?\? active\.url/)
    expect(page).toMatch(/저장소에 있는 판을 보여 줍니다/)
    expect(page).toMatch(/src=\{viewUrl\}/)
  })
})

/**
 * ⑤ 완성본은 커밋하지 않는다 — 워크플로가 Release 에 올린다.
 *   지금 저장소의 PDF·PPTX 는 **자동 생성이 실패했을 때 보여 줄 마지막 판**으로만 남는다(동결).
 *   다시 뽑아 커밋하면 수 MB 가 git 에 영구로 쌓이고 세션들이 그 바이너리를 다툰다.
 *   🗑️ 자동 생성이 라이브에서 확인되면 이 판들은 지워도 된다 — 그때 이 목록을 비우고 화면 폴백도 함께 정리한다.
 */
const FROZEN_BINARIES: Record<string, string> = {
  'urdeal-agency-proposal.pdf': '3970523037af6d42',
  'urdeal-influencer-deck.pdf': 'c7a10e8639a2fd32',
  'urdeal-merchant-association-deck.pdf': 'e1136bb851ae094f',
  'urdeal-store-owner-deck-detail.pdf': '38170d778784190d',
  'urdeal-store-owner-deck.pdf': '996bbbfa9550d3e2',
  'urdeal-agency-proposal.pptx': '58cfc3deb136ad59',
  'urdeal-influencer-deck.pptx': '9ee0a4088a0ef66a',
  'urdeal-merchant-association-deck.pptx': '4643e3a23227ac96',
  'urdeal-store-owner-deck-detail.pptx': '6874926ad49904c9',
  'urdeal-store-owner-deck.pptx': '192142aba0a7d7b9',
}

describe('⑤ 완성본을 다시 커밋하지 못한다', () => {
  const dir = 'docs/business/proposals'
  const files = readdirSync(dir).filter((f) => /\.(pdf|pptx)$/.test(f))

  it('저장소의 PDF·PPTX 가 동결 목록과 정확히 같다 (새로 더하거나 다시 뽑아 바꾸면 빨간불)', () => {
    expect(files.length, '동결 판을 못 찾았다').toBeGreaterThan(0)
    expect(files.sort()).toEqual(Object.keys(FROZEN_BINARIES).sort())
    for (const f of files) {
      const h = createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex').slice(0, 16)
      expect(h, `${f} 를 다시 뽑아 커밋했다 — 완성본은 워크플로가 Release(proposals-latest)에 올린다`).toBe(FROZEN_BINARIES[f])
    }
  })
})
