import { describe, it, expect } from 'vitest'
import { classifyCategory } from '@/features/marketing/api/influencer-classify'

/**
 * 🏷️ 2026-07-29 — **라이브 표본에서 실제로 못 잡던 것**만 골라 잠근다.
 *
 *   측정 방법: 어드민 API 로 `맛집·뷰티·숙소·네일` 각 200명(총 800)을 받아 현재 분류기를 돌렸다.
 *   결과는 "불일치 0% · 신호없음 6~28%" 였다 — 즉 **틀리게 분류한 게 아니라, 판단을 못 해서
 *   수집 키워드를 그대로 물려받고 있었다**(그게 `category_source='keyword'` 의 정체다).
 *   신호없음 중 소개글이 빈 경우는 2/55 뿐이고 **나머지는 텍스트가 충분한데 규칙이 없었다.**
 *
 *   ⚠️ 이 파일의 픽스처는 전부 **실재 채널의 실제 소개글**이다(이름은 라이브 그대로).
 *   규칙을 손볼 때 여기가 빨개지면 라이브 분류가 그만큼 나빠진다는 뜻이다.
 *
 *   개선 실측: 뷰티 신호없음 23% → 16%(일치 78→84%) · 맛집 28% → 25%.
 *   덤으로 오분류 2건이 교정됐다(아래 '재분류가 고치는 것').
 */
describe('분류 규칙 공백 — 라이브에서 놓치던 것들', () => {
  it('🔒 뷰티: 한국 관용어 "뷰튜버"', () => {
    expect(classifyCategory('안다 ANDA', '멋쟁이 뷰튜버 ⸝⋆⊹🩰 📧 anda@example.com')).toBe('뷰티')
  })

  it('🔒 뷰티: 영어 헤어/살롱/미용사 — 한글 "헤어"만 있어 영어권 채널을 통째로 놓쳤다', () => {
    expect(classifyCategory('Learn Do Teach Hairstyles', 'I am a mom of 4 boys')).toBe('뷰티')
    expect(classifyCategory('Fancy Hair', "Hi! I'm Niki - I have an obsession with hair")).toBe('뷰티')
    expect(classifyCategory('Styles By Summer', 'Licensed Cosmetologist of 18 years')).toBe('뷰티')
  })

  it('🐛 "chair"·"hairline" 은 뷰티가 아니다(\\bhair 경계 확인)', () => {
    expect(classifyCategory('의자 리뷰', 'ergonomic chair review')).not.toBe('뷰티')
    expect(classifyCategory('하이라인', 'hairline crack in concrete')).not.toBe('뷰티')
  })

  it('🔒 맛집: "식당" — 매장 소개의 가장 흔한 단어인데 규칙에 없었다', () => {
    expect(classifyCategory('믿식당 I N잡 방랑식객', '가성비 가심비 좋은 스토리있는 식당을 소개합니다')).toBe('맛집')
  })

  it('🔒 "식당"이 창업/사장 맥락이면 외식창업이 먼저 가져간다(순서 보존)', () => {
    expect(classifyCategory('사장님TV', '식당 창업 노하우를 공유합니다')).toBe('외식창업')
    expect(classifyCategory('돈까스집 사장', '식당 사장 3년차 기록')).toBe('외식창업')
    expect(classifyCategory('가게일기', '식당 운영 일지')).toBe('외식창업')
  })

  it('🔒 여행: "세계 일주/한바퀴" — 여행 채널 상투어', () => {
    expect(classifyCategory('월터씨 walterC', '최소한의 돈으로 세계 한바퀴')).toBe('여행')
    expect(classifyCategory('떠나자', '세계 일주 중입니다')).toBe('여행')
  })

  it('🔒 취미: "독서" 없이 책을 말하는 형태', () => {
    expect(classifyCategory('도톰한 하루', '책과 함께 도톰하게 쌓아가는 하루의 기록')).toBe('취미')
    expect(classifyCategory('북로그', '책을 읽고 남깁니다')).toBe('취미')
  })

  it('🐛 "책상"은 취미가 아니다(뒤 글자 한정 확인)', () => {
    expect(classifyCategory('공부방', '책상 정리 브이로그')).not.toBe('취미')
  })
})

/**
 * 재분류 패스가 **틀린 라벨을 고치는** 사례 — 수집 키워드로 잘못 물려받은 카테고리가
 * 콘텐츠 신호로 교정된다. 위 규칙 추가의 부수 효과이자, 애초에 재분류가 존재하는 이유.
 */
describe('재분류가 고치는 것 — 키워드 상속 오류', () => {
  it('책 채널이 "맛집"으로 저장돼 있어도 취미로 교정된다', () => {
    expect(classifyCategory('도톰한 하루', '책과 함께 도톰하게 쌓아가는 하루의 기록')).not.toBe('맛집')
  })
  it('세계여행 채널이 "맛집"으로 저장돼 있어도 여행으로 교정된다', () => {
    expect(classifyCategory('월터씨 walterC', '최소한의 돈으로 세계 한바퀴')).not.toBe('맛집')
  })
})
