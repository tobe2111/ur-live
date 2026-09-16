/**
 * 🏪 매장 채널(직접/중개) **필수 선택 — 미지정 폴백 폐지** (2026-09-07 대표 결재 Q3-3)
 *
 * 결재: `docs/decisions/2026-09-07-actor-benefit-conflicts.md` — *"기본안대로 모두 승인"* ⇒ Q3-3
 *   "미지정 매장은 등록 시 채널을 반드시 고르게 폼을 바꾼다".
 *
 * ## 무엇을 고정하나
 *   ① `pickStoreChannel` — 저장값이 없으면 화면용 채널은 **null** 이다(중개로 추측하지 않는다).
 *      정산용 `effective` 는 종전 폴백(brokered) 그대로 — 머니 경로는 이 결재의 실행 범위 밖.
 *   ② `GET /fee-context` 가 그 null 을 그대로 내보내고(`channel_set` 동봉), 종전의
 *      `=== 'direct' ? 'direct' : 'brokered'` 응답 강제가 되살아나지 않는다.
 *   ③ `POST /fee-context/channel` 이 있고 **set-once** 다(이미 정해진 좌석은 409) — 수수료가 바뀌는
 *      *변경*은 어드민의 일이다.
 *   ④ 이용권 등록 위저드가 1단계에서 `channelSet === false` 를 막고 선택 카드를 그린다.
 *   ⑤ 선택 카드는 두 선택지를 모두 내고 그 엔드포인트로 저장한다.
 *   ⑥ 미지정 매장을 **D1 일괄 UPDATE 로 채우지 않는다**(결재 실행 계획 명시 — 사실은 사장님이 정한다).
 *
 * ⚠️ 못 막는 것: 실제 화면에서 카드가 보이는지(렌더 스모크의 몫) · 정산이 그 채널로 걷히는지(머니 경로 —
 *    staging 실결제). 여기서 고정하는 건 "미지정을 중개로 말하지 않는다" 와 "고르기 전엔 못 간다" 뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { pickStoreChannel } from '@/features/seller/api/seller-store-channel.routes'

const ROUTES = 'src/features/seller/api/seller-stores.routes.ts'
const CHANNEL_ROUTES = 'src/features/seller/api/seller-store-channel.routes.ts'
const PAGE = 'src/pages/SellerMealVoucherNewPage.tsx'
const CARD = 'src/pages/seller-meal-voucher/StoreChannelRequired.tsx'
const NET = 'src/pages/seller-meal-voucher/NetProceedsCard.tsx'
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
const read = (p: string) => strip(readFileSync(p, 'utf8'))

describe('① pickStoreChannel — 미지정은 null, 정산 폴백은 그대로', () => {
  it('저장값 없음 → channel null · set false · effective brokered(정산 종전 폴백)', () => {
    for (const v of [undefined, null, '', 'x', 'DIRECT']) {
      expect(pickStoreChannel(v)).toEqual({ channel: null, effective: 'brokered', set: false })
    }
  })
  it('direct / brokered 는 있는 그대로', () => {
    expect(pickStoreChannel('direct')).toEqual({ channel: 'direct', effective: 'direct', set: true })
    expect(pickStoreChannel('brokered')).toEqual({ channel: 'brokered', effective: 'brokered', set: true })
  })
})

describe('② GET /fee-context 가 미지정을 "중개" 로 말하지 않는다', () => {
  const src = read(ROUTES)
  const handler = src.slice(src.indexOf("app.get('/fee-context'"), src.indexOf('registerVoucherDraftRoutes(app)'))
  it('핸들러가 pickStoreChannel 을 쓰고 응답 channel 은 picked.channel(null 가능) 이다', () => {
    expect(handler).toMatch(/pickStoreChannel\(/)
    expect(handler).toMatch(/channel:\s*picked\.channel/)
    expect(handler).toMatch(/channel_set:\s*picked\.set/)
  })
  it('종전 응답 강제(=== direct ? direct : brokered 를 channel 로 내보내기)가 없다', () => {
    expect(handler).not.toMatch(/store_channel\s*===\s*'direct'\s*\?\s*'direct'\s*:\s*'brokered'/)
  })
  it('채널 라우트 모듈이 같은 앱에 등록된다', () => {
    expect(src).toMatch(/registerStoreChannelRoutes\(app\)/)
  })
})

describe('③ POST /fee-context/channel — set-once', () => {
  const src = read(CHANNEL_ROUTES)
  it('경로가 있고 셀러 토큰으로 인증한다', () => {
    expect(src).toMatch(/app\.post\('\/fee-context\/channel'/)
    expect(src).toMatch(/getSellerIdFromToken\(/)
  })
  it('이미 정해진 좌석은 409 — 변경은 어드민의 일', () => {
    expect(src).toMatch(/current\.set[\s\S]{0,400}CHANNEL_ALREADY_SET[\s\S]{0,200}409/)
  })
  it('direct/brokered 외 값은 400', () => {
    expect(src).toMatch(/if\s*\(!isStoreChannel\(b\.channel\)\)[\s\S]{0,300}400/)
  })
})

describe('④ 이용권 등록 위저드 — 고르기 전엔 1단계를 못 넘는다', () => {
  const src = read(PAGE)
  it('validateStep 이 channelSet === false 를 막는다', () => {
    const v = src.slice(src.indexOf('function validateStep'), src.indexOf('return true', src.indexOf('function validateStep')))
    expect(v).toMatch(/s === 0 && channelSet === false/)
  })
  it('fee-context 의 channel_set 을 읽고, false 면 선택 카드를 그린다', () => {
    expect(src).toMatch(/\/api\/seller\/fee-context'/)
    expect(src).toMatch(/channel_set/)
    expect(src).toMatch(/channelSet === false && \(\s*<StoreChannelRequired/)
  })
})

describe('⑤ 선택 카드', () => {
  const src = read(CARD)
  it('두 선택지를 모두 내고 그 엔드포인트로 저장한다', () => {
    expect(src).toMatch(/opt\('direct'/)
    expect(src).toMatch(/opt\('brokered'/)
    expect(src).toMatch(/api\.post\('\/api\/seller\/fee-context\/channel'/)
  })
  it('실수령 카드는 null 채널을 "중개" 라고 부르지 않는다', () => {
    const net = read(NET)
    expect(net).toMatch(/fee\.channel === 'brokered' \? ' · 중개 운영'/)
    expect(net).not.toMatch(/fee\.channel === 'direct' \? ' · 직접 운영' : ' · 중개 운영'/)
  })
})

describe('⑥ 미지정 매장을 일괄 UPDATE 로 채우지 않는다', () => {
  it('repair-schema 에 store_channel 백필이 없다', () => {
    for (const p of ['src/worker/routes/repair-schema.routes.ts', 'src/worker/routes/repair-schema-extra.routes.ts']) {
      if (!existsSync(p)) continue
      expect(read(p), `${p}: store_channel 백필은 사장님 대신 사실을 정하는 일이다`).not.toMatch(/store_channel/)
    }
  })
  it('채널 라우트 모듈은 한 좌석의 값만 쓴다 — 집합 UPDATE 없음', () => {
    const src = read(CHANNEL_ROUTES)
    expect(src).not.toMatch(/UPDATE\s+seller_meta/i)
    expect(src).not.toMatch(/INSERT\s+INTO\s+seller_meta[\s\S]{0,300}SELECT/i)
  })
})
