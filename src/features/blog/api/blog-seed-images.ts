/**
 * 🖼️ 블로그 본문 사이 사진 (2026-11-04 대표 *"글 중간중간에도 그림들을 넣어야 안되겠어? 진짜 블로그처럼?"*).
 *
 * 글마다 두 장 — 각 사진은 `before` 에 적힌 **소제목 줄 바로 위**에 `![alt](src)` 로 끼워진다.
 * 시드 본문(blog-seed.ts)은 손대지 않고 이 표만 고치면 된다. 사진: Figma generate_image → 1024×576 webp.
 * ⚠️ 소제목 문구가 바뀌면 그 사진은 조용히 빠진다 — 가드(blog-thumbnails-2026-11-04.test.ts)가 전부 매칭되는지 본다.
 * ⚠️ 표를 바꾸면 BLOG_SEED_VERSION +1. 사진을 바꾸면 파일 이름 v 숫자 +1(`/assets/*` 1년 immutable).
 */
export interface BlogInlineImage { before: string; src: string; alt: string }

const img = (slug: string, k: 'a' | 'b', before: string, alt: string): BlogInlineImage =>
  ({ before, src: `/assets/blog/${slug}-${k}-v1.webp`, alt })

export const BLOG_SEED_INLINE_IMAGES: Record<string, BlogInlineImage[]> = {
  'what-is-urdeal': [
    img('what-is-urdeal', 'a', '## 세 가지 핵심 혜택', '비빔밥, 커피와 선물상자, 지도 앱이 나란히 놓인 테이블'),
    img('what-is-urdeal', 'b', '## 결제는 안전하게', '카페 계산대에서 휴대폰으로 결제하는 손님'),
  ],
  'voucher-guide': [
    img('voucher-guide', 'a', '## 어떤 이용권이 있나요?', '식당과 미용실, 숙소가 나란히 있는 동네 거리'),
    img('voucher-guide', 'b', '## 구매부터 사용까지', '매장 직원이 손님 휴대폰의 QR 코드를 찍는 모습'),
  ],
  'voucher-how-to-use': [
    img('voucher-how-to-use', 'a', '## 2단계 — 내 이용권함 확인', '휴대폰 화면에 이용권 목록이 보이는 모습'),
    img('voucher-how-to-use', 'b', '## 유효기간을 꼭 확인하세요', '날짜에 표시를 한 탁상 달력과 휴대폰'),
  ],
  'exchange-voucher-guide': [
    img('exchange-voucher-guide', 'a', '## 이용권과 교환권, 무엇이 다른가요?', '커피와 기프트카드, 식당 식기가 나란히 놓인 테이블'),
    img('exchange-voucher-guide', 'b', '## 교환권은 이럴 때 좋아요', '선물 메시지를 받고 웃는 사람'),
  ],
  'dongne-deal-guide': [
    img('dongne-deal-guide', 'a', '## 왜 동네딜인가요?', '아침 햇살이 드는 동네 빵집'),
    img('dongne-deal-guide', 'b', '## 이렇게 활용해 보세요', '저녁 골목에서 식당을 고르는 두 친구'),
  ],
  'linkshop-my-store': [
    img('linkshop-my-store', 'a', '## 핀으로 추천하기', '휴대폰 사진 목록에서 핀을 누르는 손가락'),
    img('linkshop-my-store', 'b', '## 공유하는 방법', '카페에서 휴대폰으로 링크를 주고받는 두 사람'),
  ],
  'become-business-user': [
    img('become-business-user', 'a', '## 유저에서 사업자 유저로', '가게 한쪽에서 서류를 작성하는 사장님'),
    img('become-business-user', 'b', '## 셀러 대시보드로 관리하기', '노트북으로 판매 현황을 보는 모습'),
  ],
  'deal-points-guide': [
    img('deal-points-guide', 'a', '## 모으기 — 활동이 곧 딜이 됩니다', '카페에서 휴대폰으로 적립 현황을 보는 모습'),
    img('deal-points-guide', 'b', '## 후원 — 응원하는 마음 전하기', '하트가 뜬 휴대폰을 두 손으로 든 모습'),
  ],
  'safe-payment-system': [
    img('safe-payment-system', 'a', '## 결제가 안전한 이유', '휴대폰과 자물쇠가 놓인 모습'),
    img('safe-payment-system', 'b', '## 결제 흐름', '집에서 휴대폰으로 결제를 마치는 모습'),
  ],
  'review-reward-guide': [
    img('review-reward-guide', 'a', '## 리뷰 작성 방법', '카페에서 휴대폰으로 리뷰를 쓰는 손'),
    img('review-reward-guide', 'b', '## 좋은 리뷰를 쓰는 팁', '음식을 휴대폰 카메라로 찍는 모습'),
  ],
  'business-user-settlement': [
    img('business-user-settlement', 'a', '## 정산 흐름 한눈에 보기', '계산기와 영수증, 노트가 놓인 책상'),
    img('business-user-settlement', 'b', '## 셀러 대시보드에서 정산 확인하기', '영업을 마치고 휴대폰을 확인하는 식당 사장님'),
  ],
  'meal-voucher-lifestyle': [
    img('meal-voucher-lifestyle', 'a', '## 상황별 추천', '밝은 식당에서 국수를 먹으며 웃는 두 사람'),
    img('meal-voucher-lifestyle', 'b', '## 200% 활용하는 팁', '저녁에 친구들과 고기를 굽는 모습'),
  ],
  'beauty-voucher-guide': [
    img('beauty-voucher-guide', 'a', '## 카테고리별 추천', '네일숍에서 손톱을 칠하는 모습'),
    img('beauty-voucher-guide', 'b', '## 미용 이용권 활용 루틴', '피부 관리실에서 마스크팩을 하고 쉬는 모습'),
  ],
  'stay-voucher-guide': [
    img('stay-voucher-guide', 'a', '## 여행 목적별 고르는 법', '한옥 숙소 마당으로 들어가는 두 여행자'),
    img('stay-voucher-guide', 'b', '## 숙소 유형 비교', '바다가 보이는 호텔 발코니의 의자 두 개'),
  ],
  'activity-voucher-guide': [
    img('activity-voucher-guide', 'a', '## 이런 활동에 딱', '실내 클라이밍장에서 벽을 오르는 친구'),
    img('activity-voucher-guide', 'b', '## 즐기기 전 체크리스트', '베이킹 클래스에서 컵케이크를 꾸미는 사람들'),
  ],
  'first-purchase-guide': [
    img('first-purchase-guide', 'a', '## 2단계 — 둘러보기', '휴대폰으로 매장 사진 목록을 넘겨 보는 모습'),
    img('first-purchase-guide', 'b', '## 4단계 — 매장에서 사용하기', '카페 계산대에서 휴대폰을 보여 주는 손님과 직원'),
  ],
  'voucher-faq': [
    img('voucher-faq', 'a', '## 유효기간·사용', '카페 테이블 위의 휴대폰과 모래시계'),
    img('voucher-faq', 'b', '## 결제·환불', '헤드셋을 쓰고 웃으며 상담하는 직원'),
  ],
  'deal-points-support-culture': [
    img('deal-points-support-culture', 'a', '## 왜 후원하나요?', '카페에서 디저트를 찍어 추천글을 준비하는 사람'),
    img('deal-points-support-culture', 'b', '## 후원하는 법', '휴대폰의 하트 버튼을 누르려는 엄지'),
  ],
  'linkshop-decorate-tips': [
    img('linkshop-decorate-tips', 'a', '## 매력적으로 꾸미는 3가지 팁', '사진과 마스킹테이프로 꾸밀 자료를 펼친 책상'),
    img('linkshop-decorate-tips', 'b', '## 공유 전략', '창가 자리에서 라떼를 휴대폰으로 찍는 사람'),
  ],
  'smart-saving-lifestyle': [
    img('smart-saving-lifestyle', 'a', '## 상황별 알뜰 루틴', '가계부 노트와 동전 유리병, 휴대폰이 놓인 책상'),
    img('smart-saving-lifestyle', 'b', '## 알뜰 습관 체크리스트', '동네 식당에서 저녁을 먹는 가족'),
  ],
  'gift-guide': [
    img('gift-guide', 'a', '## 대상·상황별 추천', '파란 리본으로 포장한 여러 크기의 선물'),
    img('gift-guide', 'b', '## 선물 전 체크리스트', '선물상자 옆에서 카드를 쓰는 손'),
  ],
}

/** 소제목 줄 바로 위에 사진을 끼운다. 못 찾은 소제목은 건너뛴다(가드가 잡는다). */
export function withInlineImages(slug: string, content: string): string {
  const imgs = BLOG_SEED_INLINE_IMAGES[slug]
  if (!imgs?.length) return content
  const lines = content.split('\n')
  for (const im of imgs) {
    const i = lines.findIndex((l) => l.trim() === im.before)
    if (i >= 0) lines.splice(i, 0, `![${im.alt}](${im.src})`, '')
  }
  return lines.join('\n')
}
