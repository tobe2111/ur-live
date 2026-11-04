/** 🧬 주입 — 공유 카드(2026-11-04). 가드: src/tests/unit/share-cards-2026-11-04.test.ts */
const TEST = 'src/tests/unit/share-cards-2026-11-04.test.ts'
export default [
  {
    name: '💬 공용 공유 버튼이 카카오 실패(false)를 다시 버린다(누르면 아무 일 없음)',
    file: 'src/components/KakaoShareButton.tsx',
    find: '      if (!sent) markCopied(await shareNative(',
    replace: '      if (false && !sent) markCopied(await shareNative(',
    test: TEST,
    why: '카카오 SDK 를 못 받은 폰에서 이용권 공유 버튼이 먹통이 된다.',
  },
  {
    name: '💬 업체 소개 공유가 다시 주소만 보낸다(카드 없음)',
    file: 'src/pages/life/life-biz-share.ts',
    find: "  try { if (sendKakaoShare(payload) || await shareViaKakao(payload)) return } catch { /* 폴백 */ }\n",
    replace: '',
    test: TEST,
    why: '대표 "share card 형태로".',
  },
]
