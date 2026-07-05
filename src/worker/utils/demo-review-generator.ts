/**
 * 🎯 2026-07-03 (대표 "데모 리뷰가 너무 AI 조작 같고 매장 특색에 안 맞음 — 가장 이상적으로"):
 *   데모 이용권 리뷰를 **매장/업종 특색에 맞게** 생성.
 *
 * 문제(기존): 데모 리뷰는 시간마다 도는 cron(auto-seed-fake-reviews)의 **generic 15문장 풀**에서 뽑혀
 *   왁싱샵에도 "빠른 배송에 만족합니다" 같은 배송형 문구가 붙었음. 오프라인 방문형 이용권과 안 맞고
 *   전부 똑같아 "AI 조작" 티가 남.
 *
 * 이상적 해법(2단):
 *   ① LLM(Claude Haiku): **오프라인 이용권 + 실제 매장명 + 업종**을 grounding 해 자연스럽고 매장 특색에
 *      맞는 리뷰를 생성(배송 언급 금지, 방문·예약·QR/PIN·업종별 포인트 반영). 키/실패 시 ② 폴백.
 *   ② 결정론 composer: 업종(키워드) 감지 → 업종별 실감 문구 풀에서 조합. 배송어 없음, 매장/재방문 언급.
 *
 * 데모 시드 시점에 리뷰를 채워 review_count>0 → 시간당 generic cron 이 건드리지 않음(이중/generic 방지).
 */
import type { Env } from '../types/env'

const KOREAN_NAMES = ['김민서', '이서연', '박지훈', '최유진', '정도윤', '한서진', '오재원', '신다은', '윤하준', '장예린',
  '조현우', '임수아', '강민재', '백서윤', '문지호', '서하은', '권태윤', '홍채원', '류지안', '배소율']

type Topic = 'gogi' | 'sushi' | 'western' | 'cafe' | 'bakery' | 'hair' | 'waxing' | 'eyelash' | 'nail' | 'pet' | 'climbing' | 'stay' | 'meal' | 'beauty' | 'etc'

/** 상품명/카테고리로 업종(리뷰 특색) 판별 — 세밀 키워드 우선, 없으면 카테고리 폴백. */
function detectTopic(name: string, category: string): Topic {
  const n = (name || '')
  if (/초밥|스시|사시미/.test(n)) return 'sushi'  // ⚠️ '오마카세'보다 먼저 — 스시 오마카세가 한우 풀로 빠지지 않게
  if (/한우|오마카세|고기|삼겹|스테이크|정육|구이|갈비|흑돼지|항정살/.test(n)) return 'gogi'
  if (/피자|파스타|화덕|이탈리|스테이크|브런치|양식/.test(n)) return 'western'
  if (/베이커리|소금빵|케이크|크루아상|빵/.test(n)) return 'bakery'  // ⚠️ 카페보다 먼저 — 빵집에 원두 리뷰 방지
  if (/커피|카페|핸드드립|디저트|원두|브런치/.test(n)) return 'cafe'
  if (/헤어|두피|펌|염색|클리닉|미용실|살롱|커트/.test(n)) return 'hair'
  if (/왁싱/.test(n)) return 'waxing'
  if (/속눈썹|래쉬|연장/.test(n)) return 'eyelash'
  if (/네일|젤네일|패디/.test(n)) return 'nail'
  if (/반려|강아지|애견|댕댕|펫|고양이/.test(n)) return 'pet'
  if (/클라이밍|암벽|볼더|클라임/.test(n)) return 'climbing'
  if (/숙소|호텔|펜션|스테이|글램핑|리조트|풀빌라/.test(n)) return 'stay'
  if (category === 'meal_voucher') return 'meal'
  if (category === 'beauty_voucher') return 'beauty'
  if (category === 'stay_voucher') return 'stay'
  return 'etc'
}

/** 업종별 실감 리뷰 뱅크. pos=만족(4~5점), mid=보통(3점). 배송어 없음.
 *  ✍️ 2026-07-04 (대표 "지금 수준 퀄리티를 AI 없이"): 운영 Claude 세션이 **직접 작성한 문장**을 뱅크로
 *  코드에 새겨둠 — 서버는 키 없이 여기서 뽑기만. 구체 디테일(동행/시점/부위/시술)·말투 혼합·아쉬움 후기
 *  포함 = 라이브에 넣었던 손글 리뷰와 동일 스타일. 새 업종/문장 추가는 이 뱅크에 append. */
const POOLS: Record<Topic, { pos: string[]; mid: string[] }> = {
  gogi: {
    pos: ['고기 상태가 진짜 다르네요 마블링 보고 놀람', '등심부터 살치살까지 차례로 구워주시는 코스 흐름이 좋았어요. 마지막 된장찌개도 진하고요', '직원분이 굽는 타이밍 다 잡아주셔서 편했어요', '부모님 모시고 갔는데 어머니가 또 오자고 하시네요', '2인 코스인데 양도 넉넉하고 부위별로 다 맛있었어요', '이 가격에 이 퀄리티면 솔직히 남는 게 있나 싶을 정도.. 육회비빔밥 추가 추천', '반찬이랑 찌개까지 정갈해서 좋았어요', '회식으로 갔는데 다들 만족. 예약이 좀 빡센 것만 빼면 완벽', '숯불 향이 제대로예요. 냉면으로 마무리하세요', '결혼기념일이라 큰맘 먹고 갔는데 후회 없어요', '고기 두께가 남달라요. 굽기 어려울까 걱정했는데 다 구워주심'],
    mid: ['맛은 좋은데 주말 저녁엔 예약 필수입니다. 저희는 30분 기다렸어요', '고기는 훌륭한데 룸이 아니라 좀 시끄러웠어요. 데이트보단 모임용', '맛있긴 한데 주차가 불편해요'],
  },
  sushi: {
    pos: ['니기리 밥 온도가 딱 맞아요. 셰프님이 하나씩 설명해주시는 것도 좋고', '런치 오마카세 이 가격이면 진짜 혜자예요', '광어 숙성이 잘 돼서 감칠맛이 다르네요', '카운터석에서 바로바로 받아먹는 재미가 있어요', '와사비를 직접 갈아 올려주시는 집. 퀄리티가 다릅니다', '우니랑 참치 뱃살이 하이라이트였어요', '조용하고 깔끔해서 접대 자리로도 좋을 듯', '스시 좋아하면 무조건 가보세요'],
    mid: ['맛은 좋은데 예약이 빡세요. 2주 전엔 잡아야 함', '가성비 좋은데 양이 살짝 아쉬워요'],
  },
  western: {
    pos: ['화덕 마르게리타 도우가 쫀득하고 끝이 살짝 탄 맛이 예술이에요', '파스타 면 삶기가 딱 알덴테라 좋았어요', '동네 피자집 여기저기 가봤는데 여기가 제일 낫습니다. 파스타는 오일 쪽이 맛있어요', '둘이서 딱 배부르게 먹었어요', '분위기 아늑해서 데이트로 좋아요. 창가자리 노리세요', '치즈 인심이 후해요', '친구 추천으로 갔는데 왜 추천했는지 알겠음', '플레이팅 예쁘고 사진 잘 나와요. 인스타 각', '라구 파스타 진하게 맛있어요. 빵 추가해서 소스 싹싹 긁어먹음'],
    mid: ['피자는 맛있는데 파스타가 저한텐 좀 짰어요. 다음엔 피자만 두 판 시킬 듯', '맛은 좋은데 웨이팅 20분 정도 있었어요', '무난히 맛있는데 양이 살짝 아쉬움'],
  },
  cafe: {
    pos: ['핸드드립 산미 밸런스가 좋네요. 카페 투어 중 발견한 보석', '조용해서 책 읽기 좋아요. 두 시간 있다 왔는데 눈치 안 주셔서 감사', '디저트 바스크 치즈케이크 꼭 드세요 커피보다 이게 더 기억남', '사장님이 원두 설명을 정성껏 해주세요. 오늘은 에티오피아였는데 향이 좋았어요', '라떼 부드럽고 디저트도 수제라 신선해요', '커피 좋아하는 사람이면 무조건', '걷다가 우연히 들어갔는데 득템한 기분. 드립 두 잔에 디저트까지 이 가격이면 개이득', '창가 자리 분위기가 특히 좋았어요', '원두 사서 집에서도 내려 마시는 중이에요'],
    mid: ['맛은 좋은데 자리가 적어서 주말 오후엔 자리 잡기 어려워요', '커피는 훌륭한데 디저트 종류가 적어요', '괜찮은데 조금 붐볐어요'],
  },
  bakery: {
    pos: ['소금빵 겉바속촉 그 자체예요. 오전에 가야 있어요', '빵 나오는 시간 맞춰 가면 따뜻한 걸 살 수 있어요', '버터 향이 진하고 안 느끼해요. 단골 확정', '크루아상 결이 살아있네요. 커피랑 최고 조합', '동네 빵집 중에 제일 맛있어요. 자주 갈 듯', '당일 생산만 하시는 게 느껴져요. 신선함이 달라요', '아이 간식으로 샀는데 저희 부부가 더 먹었어요 ㅋㅋ'],
    mid: ['맛있는데 인기 빵은 금방 품절돼요', '좋은데 주차가 어려워서 걸어가야 해요'],
  },
  hair: {
    pos: ['두피 스케일링 처음 받아봤는데 머리가 이렇게 가벼울 일인가요.. 신세계', '원장님 상담이 꼼꼼하세요. 두피 사진 보여주면서 설명해주심', '클리닉 받고 나서 며칠은 확실히 머릿결이 부드러워요', '지루성 두피라 고민 많았는데 관리 받고 가려움이 확 줄었어요', '예약제라 기다림 없이 바로 받았어요', '스타일 추천을 잘해주셔서 만족했어요', '단골 될 것 같아요. 머리 만지는 손이 다르심', '커트 라인 살아있어요. 그동안 다닌 곳 중 최고'],
    mid: ['효과는 있는데 60분이라기엔 대기 포함 두 시간 가까이 걸렸어요', '시술은 만족. 예약 시간대가 빨리 차는 편이라 미리 잡으세요', '결과는 좋은데 가격대가 있는 편'],
  },
  waxing: {
    pos: ['왁싱샵 여러 군데 다녀봤는데 여기가 제일 안 아프게 하세요. 손 빠르심', '1회용 재료 개봉하는 걸 눈앞에서 보여주셔서 안심됐어요', '처음이라 긴장했는데 원장님이 계속 말 걸어주셔서 편하게 받았습니다', '마무리 진정 관리까지 해주시는 게 차이점. 붉은기 금방 가라앉았어요', '전신 이 가격이면 진짜 저렴한 거예요', '예약 시간 딱 맞춰서 시술 시작하는 것도 좋아요', '여름 준비 완료. 재방문 각', '피부 자극 없이 깔끔하게 됐어요'],
    mid: ['만족했습니다. 100% 예약제라 당일 예약은 어려워요', '시술은 좋은데 매장이 좀 아담해요', '괜찮았는데 예약 잡기가 살짝 어려워요'],
  },
  eyelash: {
    pos: ['자연스러운 C컬로 해달라고 했는데 딱 원하던 눈매 나왔어요. 아침 화장 10분 단축', '리터치 포함 가격이라 다른 데보다 훨씬 합리적이에요', '시술 90분 동안 편하게 자다 왔어요. 이물감도 없고', '디자인 상담 자세히 해주셔서 좋았어요. 눈 모양 보고 길이 추천해주심', '3주째인데 유지력 좋네요. 리터치 예약하러 갑니다', '눈매가 또렷해져서 민낯 자신감 생겼어요', '속눈썹 하실 분들 여기 가세요'],
    mid: ['결과물은 예쁜데 예약이 진짜 안 잡혀요.. 2주 기다렸습니다', '예쁜데 지속력은 사람마다 다를 것 같아요', '만족스러운데 시술 시간이 좀 길어요'],
  },
  nail: {
    pos: ['디자인 시안대로 예쁘게 해주셨어요', '큐티클 정리까지 꼼꼼해서 좋아요', '젤 유지력이 좋아서 3주 넘게 가요', '손이 화사해져서 기분 좋아요', '원장님 손이 빠르신데 꼼꼼해요. 수다 떨다 보면 끝나있음', '시즌 아트 디자인이 다양해서 고르는 재미가 있어요'],
    mid: ['예쁜데 살짝 오래 걸렸어요', '결과는 만족인데 대기가 있었어요', '괜찮은데 아트 추가 가격이 좀 있어요'],
  },
  pet: {
    pos: ['겁 많은 아이인데 미용 내내 달래가면서 해주셨대요. 끝나고 사진도 보내주심', '곰돌이컷 요청했는데 인생 미용 나왔습니다. 산책 나가면 다들 물어봐요', '목욕 후 특유의 꿉꿉한 냄새가 안 나요. 드라이 꼼꼼히 해주시는 듯', '발톱 귀청소까지 포함이라 따로 챙길 게 없어요', '우리 애가 미용 후에 안 떠는 건 처음이에요. 스트레스 관리 잘해주시는 곳', '위생 관리가 눈에 보여서 믿고 맡겨요', '댕댕이 미용 고민이면 여기로'],
    mid: ['미용은 예쁘게 됐는데 주말 예약이 몰려서 픽업 시간이 좀 늦어졌어요', '결과는 좋은데 예약이 빨리 차요', '만족인데 대형견은 가격 문의 필요해요'],
  },
  climbing: {
    pos: ['초보 강습이 친절해서 처음인데도 재밌었어요. 다음날 팔이 후들거리는 건 함정', '홀드 세팅이 자주 바뀌어서 지루할 틈이 없어요', '암벽화 초크 대여 포함이라 운동복만 가면 돼요', '강사님이 자세 하나하나 봐주세요. 혼자 유튜브 보고 하던 것과 차원이 다름', '시설 깨끗하고 매트 푹신해서 떨어져도 안 아파요', '운동 진짜 제대로 됩니다. 헬스 지겨운 분들 강추', '혼자 가도 어색하지 않은 분위기예요'],
    mid: ['재밌는데 주말 오후엔 사람이 많아서 벽 기다려야 해요', '초보한테 좋은데 난이도 편차가 커요', '샤워실이 좀 좁은 것만 빼면 만족'],
  },
  stay: {
    pos: ['객실 깨끗하고 뷰가 정말 좋았어요', '체크인 친절하고 편하게 쉬다 왔어요', '조식이 알차서 만족스러웠어요', '가격 대비 시설이 훌륭해요', '침구가 포근해서 꿀잠 잤어요', '조용해서 힐링하고 왔어요. 노트북 들고 워케이션으로도 좋을 듯'],
    mid: ['깨끗한데 방음이 조금 아쉬워요', '위치는 좋은데 주차가 불편해요', '만족인데 체크인 시간이 좀 늦어요'],
  },
  meal: {
    pos: ['맛도 좋고 사장님도 친절하세요', '양 넉넉하고 정갈하게 잘 나와요', '점심시간에 갔는데 회전이 빨라서 금방 먹었어요', '가격 대비 만족스러운 한 끼였어요', '동네 단골집 될 듯. 메뉴 다 돌아볼 예정', 'QR 보여주니 바로 처리해주셔서 편했어요'],
    mid: ['맛은 좋은데 웨이팅이 있어요', '무난하게 잘 먹었어요', '맛있는데 매장이 좀 협소해요'],
  },
  beauty: {
    pos: ['원장님이 꼼꼼하게 잘 해주셨어요', '위생 신경 쓰시는 게 눈에 보여서 안심돼요', '예약제라 기다림 없이 받았어요', '결과 만족스러워서 재방문할게요', '상담부터 시술까지 설명이 자세해요'],
    mid: ['만족인데 예약이 조금 어려워요', '괜찮은데 매장이 아담해요', '좋은데 인기 시간대는 한 달 전 예약 필요'],
  },
  etc: {
    pos: ['친절하고 만족스럽게 이용했어요', '방문해서 편하게 잘 썼어요', '가격 대비 좋아서 추천해요', '설명을 자세히 해주셔서 처음인데도 어렵지 않았어요', '생각보다 알차서 놀랐어요'],
    mid: ['무난하게 이용했어요', '괜찮은데 조금 붐볐어요', '만족인데 주차 공간이 협소해요'],
  },
}

const TAILS = ['', '', '', '', ' 또 갈게요', ' 재방문 의사 있어요', ' 만족합니다', ' ㅎㅎ', '~']

// 🎭 방문 맥락 오프너(업종 무관 안전) — 빈 문자열 비중 높게(대부분 리뷰는 바로 본론).
const OPENERS = ['', '', '', '', '', '주말에 다녀왔는데 ', '평일 저녁에 방문했어요. ', '지인 추천으로 가봤는데 ', '두 번째 방문이에요. ', '예약하고 갔습니다. ', '동네라 자주 가는데 ', '처음 가봤는데 ']
// 🎭 아주 짧은 한마디형(실제 리뷰 최빈 패턴) — 길이 다양성의 핵심.
const SHORTS_POS = ['만족합니다', '잘 이용했어요', '좋았어요 또 갈게요', '굿', '재방문 의사 있습니다', '만족스러웠어요 ㅎㅎ', '좋아요', '괜찮았습니다']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

/** 결정론 폴백 — 업종 특색 문구 조합(배송어 없음, 별점별 톤).
 *  🎭 2026-07-04 (대표 "최대 다양성, AI 티 0"): 길이 극단(한마디~2문장)·오프너·말투 꼬리 조합으로
 *  같은 상품 안에서도 문장 구조가 겹치지 않게. avoid(이미 쓴 문구) 재시도는 buildStoreReviews 가 담당. */
export function composeDemoReview(rating: number, topic: Topic, storeName?: string | null): string {
  const pool = POOLS[topic] || POOLS.etc
  if (rating >= 4) {
    // 25%: 아주 짧은 한마디(업종 무관 실제 최빈 패턴 — 길이 다양성)
    if (Math.random() < 0.25) return pick(SHORTS_POS)
    let s = pick(pool.pos)
    // 30%: 두 번째 긍정 문구 결합(조합 수 급증) / 오프너와 동시엔 안 씀(과장 방지)
    const opener = pick(OPENERS)
    if (!opener && Math.random() < 0.3) { const b = pick(pool.pos); if (b !== s) s = `${s} ${b}` }
    s = opener + s
    // 15%: 매장명 자연스럽게 앞에(오프너 없을 때만)
    if (!opener && storeName && Math.random() < 0.15) s = `${storeName} 다녀왔어요. ${s}`
    if (rating >= 5) s += pick(TAILS)
    return s
  }
  let s = pool.mid.length ? pick(pool.mid) : pick(pool.pos)
  if (storeName && Math.random() < 0.12) s = `${storeName} ${s}`
  return s
}

interface DemoProduct { id: number; name: string; category: string; storeName?: string | null; price?: number }
export interface StoreReviewInput { name: string; category: string; storeName?: string | null; price?: number }
export interface GenReview { rating: number; content: string }

function ratingSample(): number {
  // 4.3~4.9 평균 근사 — 대부분 5, 가끔 4, 드물게 3.
  const r = Math.random()
  return r < 0.62 ? 5 : r < 0.9 ? 4 : 3
}

/** LLM(Claude Haiku) — 오프라인 이용권 + 실매장 grounding 리뷰. 실패/키없음 시 throw(호출측 폴백). */
async function generateReviewsLLM(env: Env, p: DemoProduct, count: number): Promise<GenReview[]> {
  const apiKey = (env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('NO_KEY')
  const ratings = Array.from({ length: count }, ratingSample)
  const prompt = `너는 한국의 오프라인 매장 이용권을 실제로 방문해서 써본 손님들의 리뷰를 작성한다.

## 이용권 정보 (이 매장/업종 특색에 맞게)
- 이용권명: ${p.name}
- 매장명: ${p.storeName || '해당 매장'}
- 업종 카테고리: ${p.category}
- 가격: ${p.price ? p.price.toLocaleString('ko-KR') + '원' : '온라인 할인가'}

## 규칙 (반드시 지킬 것)
- 이건 **온라인에서 할인가로 사서 매장에 방문해 QR/PIN 으로 쓰는 오프라인 이용권**이다.
  절대 "배송/택배/포장/도착" 같은 배송형 표현 쓰지 말 것.
- 그 **업종의 실제 경험**을 구체적으로: (식사=맛/양/직원/재방문, 왁싱·뷰티=위생/시술/예약/원장님,
  숙소=객실/뷰/체크인, 반려미용=아이 상태/스타일, 클라이밍=강습/시설/난이도, 카페=원두/분위기 등)

## 🎭 다양성 — "여러 명의 진짜 사람"이 쓴 것처럼 (가장 중요)
- 리뷰들끼리 **문장 구조·길이·말투가 절대 겹치지 않게**. 같은 시작 패턴("~가 좋아요") 반복 금지.
- **길이 극단 섞기**: 30%는 아주 짧게(한 단어~한 마디: "만족합니다", "잘 먹었어요 또 올게요", "굿"),
  50%는 1~2문장, 20%는 2~3문장으로 디테일 있게.
- **말투 섞기**: ~요/~습니다/~네요/~음(명사형)/ㅎㅎ/ㅠㅠ 등 실제 리뷰 말투 다양하게. 마침표 없는 문장도 섞기.
- **구체 디테일**을 절반 이상에 1개씩: 방문 시점(주말 저녁/평일 점심), 동행(친구랑/아이랑/혼자),
  구체 메뉴·부위·시술 단계·직원 응대 같은 실제 있었을 법한 것. 지어낸 티 나는 과장 금지.
- **광고체 금지**: "인생맛집", "강추", "최고예요!!" 남발 금지. 담백하고 무심한 톤도 섞기.
- 별점 3점은 만족+아쉬운 점 1개를 구체적으로(예: "맛은 좋은데 주차가 좀").
- 매장명은 2~3개 리뷰에만 자연스럽게.
- 약 15%는 content 를 빈 문자열("")로(별점만 남기는 사람).
- 이모지는 15% 정도만, 한 개씩.
- 각 리뷰 별점은 아래 배열을 그대로 사용: [${ratings.join(', ')}]

## 출력
JSON 배열로만. 각 항목 {"content": "리뷰", "rating": 별점}. 그 외 텍스트/코드블록 금지.`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error('LLM_HTTP_' + res.status)
  const data = await res.json() as { content?: Array<{ text?: string }> }
  const text = (data?.content?.[0]?.text || '[]').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed)) throw new Error('NOT_ARRAY')
  const out: GenReview[] = []
  for (const r of parsed) {
    const o = r as { content?: unknown; rating?: unknown }
    if (typeof o?.content !== 'string' || typeof o?.rating !== 'number') continue
    const rating = Math.min(5, Math.max(1, Math.round(o.rating)))
    // 🛡️ 배송어가 섞이면 그 항목은 폴백 문구로 교체(오프라인 이용권 불변식).
    const content = /배송|택배|포장|도착|발송/.test(o.content) ? '' : o.content.slice(0, 300)
    out.push({ rating, content })
  }
  if (!out.length) throw new Error('EMPTY')
  return out
}

/**
 * 매장/업종 특색 리뷰 **생성만**(삽입 X) — LLM(오프라인 이용권·실매장 grounding) 우선, 실패/키없음 시
 * 업종별 결정론 composer 폴백. 대량(어드민)도 40개씩 배치(배치별 LLM→실패분만 compose). 데모·어드민 공용.
 */
export async function buildStoreReviews(env: Env, p: StoreReviewInput, count = 8): Promise<GenReview[]> {
  const topic = detectTopic(p.name, p.category)
  const total = Math.max(1, Math.min(2000, count))
  const out: GenReview[] = []
  const CHUNK = 40
  const seen = new Set<string>()  // 🎭 같은 상품 안 문구 중복 방지(작은 n 에서 특히 티 남)
  for (let i = 0; i < total; i += CHUNK) {
    const n = Math.min(CHUNK, total - i)
    try {
      out.push(...await generateReviewsLLM(env, { id: 0, ...p }, n))
    } catch {
      for (let k = 0; k < n; k++) {
        const rating = ratingSample()
        if (Math.random() < 0.15) { out.push({ rating, content: '' }); continue }  // 별점만(실제 최빈 패턴)
        let content = composeDemoReview(rating, topic, p.storeName)
        for (let attempt = 0; attempt < 6 && seen.has(content); attempt++) content = composeDemoReview(rating, topic, p.storeName)
        seen.add(content)
        out.push({ rating, content })
      }
    }
  }
  return out
}

/**
 * 데모 상품 1건에 매장 특색 리뷰를 시드(이미 리뷰 있으면 skip).
 * review_count/avg_rating/sold_count 갱신까지 — 시간당 generic cron 이 안 건드리게(review_count>0).
 */
export async function seedDemoReviews(env: Env, p: DemoProduct, count = 8): Promise<number> {
  const DB = env.DB
  const existing = await DB.prepare('SELECT COUNT(*) AS c FROM product_reviews WHERE product_id = ?')
    .bind(p.id).first<{ c: number }>().catch(() => ({ c: 0 }))
  if ((existing?.c ?? 0) > 0) return 0

  const reviews = await buildStoreReviews(env, p, Math.max(4, Math.min(20, count)))

  const stmts = reviews.map((r) => {
    const nm = pick(KOREAN_NAMES)
    const masked = nm[0] + '*' + nm[nm.length - 1]
    const daysAgo = Math.floor(Math.random() * 75)
    return DB.prepare(
      `INSERT INTO product_reviews (product_id, user_id, user_name, rating, content, is_generated, created_at)
       VALUES (?, 'system-generated', ?, ?, ?, 1, datetime('now', '-' || ? || ' days'))`,
    ).bind(p.id, masked, r.rating, r.content || null, daysAgo)
  })
  try {
    for (let i = 0; i < stmts.length; i += 50) await DB.batch(stmts.slice(i, i + 50))
    const soldBump = reviews.length * (3 + Math.floor(Math.random() * 3))
    await DB.prepare(`
      UPDATE products SET
        review_count = COALESCE((SELECT COUNT(*) FROM product_reviews WHERE product_id = ?), 0),
        avg_rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = ?), 0),
        sold_count = MAX(COALESCE(sold_count,0) + ?, (SELECT COUNT(*) FROM product_reviews WHERE product_id = ?) * 3),
        updated_at = datetime('now')
      WHERE id = ?
    `).bind(p.id, p.id, soldBump, p.id, p.id).run()
    return reviews.length
  } catch { return 0 }
}
