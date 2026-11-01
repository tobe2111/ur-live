/**
 * ✍️ 2026-10-27 (대표 "AI 연결했으면 데모 이용권 상품 구성 및 설명도 더 자세히"): 데모 매장은 **실제 가게**라
 *   확인 못 한 사실을 쓰면 남의 가게에 대해 거짓말을 하게 된다. 금지어에 걸리면 글을 버린다.
 * 못 보는 것: 실제 AI 출력 품질(라이브 회차의 하트비트 `descWritten` + 눈 판정).
 */
import { describe, it, expect } from 'vitest'
import { parseDescReply, descPrompt } from '@/worker/cron/demo-description'
import { readCode } from '../helpers/source-text'

const ok = JSON.stringify({ items: ['곱창 모둠 2인분', '볶음밥 1인분'], intro: '사진 속 매장은 테이블마다 불판이 놓인 넓은 홀이에요. 노릇하게 구운 곱창 사진이 많아요.' })

describe('AI 데모 설명', () => {
  it('정상 응답은 상품 구성 글머리 + 가게 소개로', () => {
    const r = parseDescReply(ok)
    expect(r?.description).toBe('• 곱창 모둠 2인분\n• 볶음밥 1인분')
    expect(r?.longDescription).toContain('불판')
  })
  it.each([
    ['영업시간', '영업시간은 오전 11시부터예요. 넓은 홀이 보여요.'],
    ['주차', '주차 가능한 넓은 매장이에요. 사진 속 홀이 밝아요.'],
    ['금액', '1인 15,000원 정도예요. 사진 속 홀이 밝아요.'],
    ['수상', '미슐랭에 소개된 집이에요. 사진 속 홀이 밝아요.'],
  ])('확인 못 한 사실(%s)이 있으면 버린다', (_k, intro) => {
    expect(parseDescReply(JSON.stringify({ items: ['곱창 모둠 2인분', '볶음밥 1인분'], intro }))).toBeNull()
  })
  it('형식이 틀리면 버린다', () => {
    expect(parseDescReply('좋은 가게예요')).toBeNull()
    expect(parseDescReply(JSON.stringify({ items: ['하나'], intro: '사진 속 홀이 밝고 넓어요. 테이블이 많아요.' }))).toBeNull()
  })
  it('프롬프트가 지어내기 금지를 말한다', () => {
    const p = descPrompt({ storeName: '가게', category: 'meal_voucher', offerName: 'A', offerDesc: 'B', photos: 2 })
    expect(p).toMatch(/지어내지 마라/)
    expect(p).toMatch(/영업시간, 주차/)
  })
  it('사진 정비 크론에 배선되고, 동네딜 데모만 대상이다', () => {
    expect(readCode('src/worker/cron/demo-image-rehost.ts')).toMatch(/writeDemoDescriptions\(env\)/)
    expect(readCode('src/worker/cron/demo-description.ts')).toMatch(/slug LIKE 'demo-deal-%'/)
  })
})
