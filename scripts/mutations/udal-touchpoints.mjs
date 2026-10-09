/**
 * 🧬 주입 — 유달이 새 자리 6곳 (대표 확정 시안 "좋다 모두 해줘", 2026-10-09)
 *
 * 전부 에러 없이 조용히 틀어지는 것들이다: 카드가 깨진 XML 이어도 200, 축하가 매번 떠도 화면은 멀쩡하다.
 */
const TEST = 'src/tests/unit/udal-touchpoints-2026-10-09.test.tsx'

export default [
  {
    name: '[유달이자리] 🖼️사진을 못 박았는데 사진 빠진 카드를 그대로 낸다',
    file: 'src/worker/routes/og-image.routes.ts',
    find: 'if (!photoUri && photoAbs) return c.redirect(photoAbs, 302)',
    replace: 'void photoAbs',
    test: TEST,
    why: '2026-10-09 라이브에서 이용권 링크 미리보기의 상품 사진이 사라졌다(서버 안 리사이즈 불가 → 원본이 한도 초과).',
  },
  {
    name: '[유달이자리] 🖼️상세 공유 버튼이 판 번호 없는 카드 주소로 돌아간다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: 'imageUrl={passShareCardUrl(productId)}',
    replace: 'imageUrl={`https://urdeal.kr/api/og/group-buy/${productId}`}',
    test: TEST,
    why: '카카오는 주소 단위로 카드 그림을 캐시한다 — 판 번호가 빠지면 고친 카드를 배포해도 옛 카드가 나간다.',
  },
  {
    name: '[유달이자리] 🖼️판 번호가 카드 주소에서 빠진다',
    file: 'src/shared/pass-share-card.ts',
    find: '/api/og/group-buy/${id}?v=${PASS_OG_VERSION}',
    replace: '/api/og/group-buy/${id}',
    test: TEST,
    why: '서버 og:image 와 화면 공유 버튼이 같이 판 번호를 잃는다.',
  },
  {
    name: '[유달이자리] 🖼️유어샵 카드 font-family 가 다시 큰따옴표로 XML 을 깨뜨린다',
    file: 'src/worker/utils/og-curator-card.ts',
    find: `font-size="52" font-family='\${OG_FONT}'`,
    replace: `font-size="52" font-family="\${OG_FONT}"`,
    test: TEST,
    why: '2026-10-09 라이브 실측으로 유어샵 공유 카드가 깨진 XML 이었다. 응답은 200 이라 아무도 몰랐다.',
  },
  {
    name: '[유달이자리] 🖼️이용권 공유 카드가 사진을 바깥 주소로 불러온다',
    file: 'src/worker/utils/og-pass-card.ts',
    find: '<image href="${photoUri}"',
    replace: '<image href="https://img.example.com/${photoUri}"',
    test: TEST,
    why: '카카오 스크래퍼는 SVG 속 바깥 그림을 안 가져온다 — 사진 자리가 빈다(유어샵 카드가 그렇게 까맸다).',
  },
  {
    name: '[유달이자리] 🖼️이용권 상세 og:image 가 사진 원본으로 돌아간다',
    file: 'src/worker/utils/detail-ssr-meta.ts',
    find: 'ogImage: shareCard,',
    replace: 'ogImage,',
    test: TEST,
    why: '대표가 "바꾸기"로 승인한 공유 카드가 조용히 사진 원본으로 되돌아간다.',
  },
  {
    name: '[유달이자리] 🎟️만료 임박 줄이 접힌 줄과 다른 기준을 쓴다',
    file: 'src/pages/my-vouchers/ExpiryNotice.tsx',
    find: 'd !== null && d <= URGENT_DAYS',
    replace: 'd !== null && d <= URGENT_DAYS + 3',
    test: TEST,
    why: '위에선 "곧 끝나요" 라는데 아래 줄은 회색인 화면이 된다.',
  },
  {
    name: '[유달이자리] 🎉첫 이용권 축하가 여러 장 가진 사람에게도 뜬다',
    file: 'src/pages/my-vouchers/FirstVoucherSheet.tsx',
    find: 'const only = items.length === 1 ? items[0] : null',
    replace: 'const only = items.length >= 1 ? items[0] : null',
    test: TEST,
    why: '이미 여러 장 가진 사람에게 "첫 이용권이에요!" 는 거짓말이다.',
  },
  {
    name: '[유달이자리] 🎉첫 이용권 축하가 매번 뜬다',
    file: 'src/pages/my-vouchers/FirstVoucherSheet.tsx',
    find: "try { localStorage.setItem(SEEN_KEY, '1') } catch { return }",
    replace: 'try { void SEEN_KEY } catch { return }',
    test: TEST,
    why: '축하가 매번 뜨면 금방 소음이 된다 — 기기에 남기는 표시가 그 한 번을 지킨다.',
  },
  {
    name: '[유달이자리] ⭐별점이 직원 확인 화면 위로 바로 뜬다',
    file: 'src/components/voucher/VoucherRedeemModal.tsx',
    find: '{cancelLeft === 0 && productId ? <RedeemReviewCard',
    replace: '{productId ? <RedeemReviewCard',
    test: TEST,
    why: '첫 60초는 직원에게 보여주는 확인 화면이다 — 그 위에 별점이 올라오면 무엇을 확인하는 화면인지 흐려진다.',
  },
]
