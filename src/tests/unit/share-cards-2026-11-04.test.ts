/**
 * 💬 공유 = 버튼 달린 카톡 카드 (2026-11-04 대표 *"share card 로 공유가 안 되고 있는 것들 정리를 해서 share card 형태로 … 전체적으로"*).
 *
 * 지키는 것:
 *  ① 공용 공유 버튼(`KakaoShareButton` — 이용권·상품·공구 상세 · 블로그 · 숙소 · 추천)이 카카오로 **못 보냈을 때**(false) 일반 공유로 넘어간다.
 *     🩸 종전엔 예외만 잡아서, 카카오가 안 되는 순간 버튼이 **아무 일도 안 했다**.
 *  ② 견적 공유 · 업체 소개 · 친구 초대가 카드(`feedPayload`)를 먼저 보낸다.
 * ⚠️ 못 보는 것: 카카오가 실제로 그리는 모양 · 의도적으로 '링크 복사' 인 버튼(인플루언서 추천 링크 등 — SNS 프로필에 붙이는 용도).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => stripComments(readFileSync(p, 'utf8'))

describe('공유 카드', () => {
  it('① 공용 버튼: 카카오가 false 면 일반 공유로', () => {
    const b = read('src/components/KakaoShareButton.tsx')
    expect(b).toMatch(/\): Promise<boolean> \{/)
    expect(b).toContain('return sendKakaoShare(p) || await shareViaKakao(p)')
    expect(b).toContain('if (!sent) markCopied(await shareNative(')
  })
  it('② 견적·업체 소개는 카드부터', () => {
    for (const f of ['src/pages/life/life-shared.tsx', 'src/pages/life/life-biz-share.ts']) {
      const s = read(f)
      // 만들기(feedPayload)만으로는 부족하다 — **보내기**(sendKakaoShare)가 공유 시트보다 먼저 있어야 한다(주입이 그 차이를 잡았다).
      const i = s.indexOf('sendKakaoShare(payload)'), j = s.indexOf('navigator.share')
      expect(s, f).toContain('feedPayload(')
      expect(i, f).toBeGreaterThan(0)
      expect(i, `${f} — 카드 보내기가 공유 시트보다 먼저`).toBeLessThan(j)
    }
  })
  it('② 친구 초대에 카톡 카드 버튼', () => {
    expect(read('src/components/MyReferralCard.tsx')).toMatch(/<KakaoShareButton[\s\S]{0,400}buttonText=/)
  })
})
