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
import { type ReviewTuning, DEFAULT_TUNING, getReviewGenTuning } from './review-gen-tuning'

const KOREAN_NAMES = ['김민서', '이서연', '박지훈', '최유진', '정도윤', '한서진', '오재원', '신다은', '윤하준', '장예린',
  '조현우', '임수아', '강민재', '백서윤', '문지호', '서하은', '권태윤', '홍채원', '류지안', '배소율',
  '남지우', '고은비', '전우진', '손예은', '허준영', '노아라', '심규민', '차하늘', '주민경', '유서준',
  '엄태호', '방시현', '구본희', '민가온', '표지원']

/** 실제 리뷰 표기처럼 마스킹 다양화 — 김*서 / 김** / ㅅㅇ 님 등. */
function maskName(nm: string): string {
  const r = Math.random()
  if (r < 0.5) return nm[0] + '*' + nm[nm.length - 1]      // 김*서
  if (r < 0.82) return nm[0] + '**'                         // 김**
  return nm[0] + nm[1] + '*'                                // 김민*
}

type Topic = 'gogi' | 'sushi' | 'western' | 'cafe' | 'bakery' | 'hair' | 'waxing' | 'eyelash' | 'nail' | 'pet' | 'climbing' | 'stay' | 'meal' | 'beauty' | 'etc'

/** 상품명/카테고리로 업종(리뷰 특색) 판별 — 세밀 키워드 우선, 없으면 카테고리 폴백. */
function detectTopic(name: string, category: string): Topic {
  const n = (name || '')
  if (/초밥|스시|사시미/.test(n)) return 'sushi'  // ⚠️ '오마카세'보다 먼저 — 스시 오마카세가 한우 풀로 빠지지 않게
  if (/한우|오마카세|고기|삼겹|스테이크|정육|구이|갈비|흑돼지|항정살/.test(n)) return 'gogi'
  if (/피자|파스타|화덕|이탈리|스테이크|브런치|양식/.test(n)) return 'western'
  // ☕ 음료 키워드 있으면 카페(케이크·디저트 곁들여도 카페 — '라떼+케이크'가 빵집으로 오분류되던 버그 수정)
  if (/커피|카페|핸드드립|원두|라떼|아메리카노|에스프레소|음료|에이드|스무디|버블티/.test(n)) return 'cafe'
  if (/베이커리|소금빵|크루아상|식빵|바게트|앙버터|빵/.test(n)) return 'bakery'  // 순수 빵집 키워드
  if (/케이크|디저트|타르트|마카롱/.test(n)) return 'cafe'  // 케이크·디저트만 있으면 디저트카페로
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
    pos: ['고기 상태가 진짜 다르네요 마블링 보고 놀람', '등심부터 살치살까지 차례로 구워주시는 코스 흐름이 좋았어요. 마지막 된장찌개도 진하고요', '직원분이 굽는 타이밍 다 잡아주셔서 편했어요', '부모님 모시고 갔는데 어머니가 또 오자고 하시네요', '2인 코스인데 양도 넉넉하고 부위별로 다 맛있었어요', '이 가격에 이 퀄리티면 솔직히 남는 게 있나 싶을 정도.. 육회비빔밥 추가 추천', '반찬이랑 찌개까지 정갈해서 좋았어요', '회식으로 갔는데 다들 만족. 예약이 좀 빡센 것만 빼면 완벽', '숯불 향이 제대로예요. 냉면으로 마무리하세요', '결혼기념일이라 큰맘 먹고 갔는데 후회 없어요', '고기 두께가 남달라요. 굽기 어려울까 걱정했는데 다 구워주심', '특수부위가 진짜예요. 갈매기살 처음 먹어봤는데 신세계', '기름장 대신 소금이랑 곁들임이 고급스러워요. 고기 질이 받쳐주니까', '숙성 정도가 딱 좋아요. 질기지 않고 육향이 진하게 올라옵니다', '아이랑 갔는데 불판 자주 갈아주셔서 신경 안 쓰고 먹었어요', '된장찌개 리필되는 줄 몰랐네요. 마무리 볶음밥은 필수예요', '자리 간격이 넓어서 옆 눈치 안 보고 편하게 먹었어요', '점심 특선 가서 저녁 가격 생각하니 완전 이득이었어요', '고기 좋아하는 친구가 데려간 곳인데 왜 자꾸 오자는지 알겠어요'],
    mid: ['맛은 좋은데 주말 저녁엔 예약 필수입니다. 저희는 30분 기다렸어요', '고기는 훌륭한데 룸이 아니라 좀 시끄러웠어요. 데이트보단 모임용', '맛있긴 한데 주차가 불편해요', '고기는 최고인데 반찬 가짓수가 살짝 아쉬웠어요'],
  },
  sushi: {
    pos: ['니기리 밥 온도가 딱 맞아요. 셰프님이 하나씩 설명해주시는 것도 좋고', '런치 오마카세 이 가격이면 진짜 혜자예요', '광어 숙성이 잘 돼서 감칠맛이 다르네요', '카운터석에서 바로바로 받아먹는 재미가 있어요', '와사비를 직접 갈아 올려주시는 집. 퀄리티가 다릅니다', '우니랑 참치 뱃살이 하이라이트였어요', '조용하고 깔끔해서 접대 자리로도 좋을 듯', '스시 좋아하면 무조건 가보세요', '제철 생선 위주라 갈 때마다 조금씩 달라서 또 오고 싶어요', '오도로 나올 때 다들 눈 커졌어요. 입에서 녹는다는 게 이런 거구나', '적당히 산미 있는 샤리가 생선이랑 밸런스가 좋네요', '연어보다 흰살생선이 더 인상적이었어요. 광어 지느러미살 최고', '초생강도 직접 절이시는 것 같아요. 디테일이 살아있는 집', '가격대 있지만 특별한 날 오기엔 아깝지 않아요. 서비스도 세심하고', '미소된장국 마무리까지 깔끔했어요. 군더더기 없는 코스'],
    mid: ['맛은 좋은데 예약이 빡세요. 2주 전엔 잡아야 함', '가성비 좋은데 양이 살짝 아쉬워요', '훌륭한데 코스가 생각보다 빨리 끝난 느낌이에요', '맛있는데 좌석이 몇 개 안 돼서 예약은 필수'],
  },
  western: {
    pos: ['화덕 마르게리타 도우가 쫀득하고 끝이 살짝 탄 맛이 예술이에요', '파스타 면 삶기가 딱 알덴테라 좋았어요', '동네 피자집 여기저기 가봤는데 여기가 제일 낫습니다. 파스타는 오일 쪽이 맛있어요', '둘이서 딱 배부르게 먹었어요', '분위기 아늑해서 데이트로 좋아요. 창가자리 노리세요', '치즈 인심이 후해요', '친구 추천으로 갔는데 왜 추천했는지 알겠음', '플레이팅 예쁘고 사진 잘 나와요. 인스타 각', '라구 파스타 진하게 맛있어요. 빵 추가해서 소스 싹싹 긁어먹음', '트러플 파스타 향이 진짜배기예요. 인스턴트 향 아님', '도우를 직접 숙성하시는지 화덕피자 도우가 다릅니다. 살짝 탄 마진이 별미', '리조또가 꾸덕하게 잘 나와요. 짜지 않고 간이 딱', '스테이크 미디움레어로 딱 맞춰주셨어요. 육즙 살아있음', '브런치로 갔는데 커피까지 포함이라 가성비 좋았어요', '와인 한 잔 곁들이니 분위기까지 완벽했어요', '캐주얼해서 혼밥도 부담 없어요. 종종 오는 단골집'],
    mid: ['피자는 맛있는데 파스타가 저한텐 좀 짰어요. 다음엔 피자만 두 판 시킬 듯', '맛은 좋은데 웨이팅 20분 정도 있었어요', '무난히 맛있는데 양이 살짝 아쉬움', '맛은 좋은데 테이블이 좁아서 조금 붙어 앉게 돼요'],
  },
  cafe: {
    pos: ['핸드드립 산미 밸런스가 좋네요. 카페 투어 중 발견한 보석', '조용해서 책 읽기 좋아요. 두 시간 있다 왔는데 눈치 안 주셔서 감사', '디저트 바스크 치즈케이크 꼭 드세요 커피보다 이게 더 기억남', '사장님이 원두 설명을 정성껏 해주세요. 오늘은 에티오피아였는데 향이 좋았어요', '라떼 부드럽고 디저트도 수제라 신선해요', '커피 좋아하는 사람이면 무조건', '걷다가 우연히 들어갔는데 득템한 기분. 드립 두 잔에 디저트까지 이 가격이면 개이득', '창가 자리 분위기가 특히 좋았어요', '원두 사서 집에서도 내려 마시는 중이에요', '싱글 오리진 여러 종 있어서 골라 마시는 재미가 있어요', '디저트가 매일 조금씩 바뀌는 것 같아요. 오늘 무화과 타르트 맛있었어요', '노트북 하기 좋게 콘센트 자리가 많아요. 오래 있어도 눈치 안 주셔서 감사', '라떼 아트도 예쁘고 우유 스티밍이 곱게 돼서 부드러워요', '통유리라 채광이 좋아서 사진이 예쁘게 나와요', '디카페인도 맛있게 내려주셔서 저녁에 부담 없이 마셨어요', '동네 카페인데 커피 퀄리티는 시내 유명 카페 못지않아요'],
    mid: ['맛은 좋은데 자리가 적어서 주말 오후엔 자리 잡기 어려워요', '커피는 훌륭한데 디저트 종류가 적어요', '괜찮은데 조금 붐볐어요', '분위기 좋은데 주말엔 웨이팅이 조금 있어요'],
  },
  bakery: {
    pos: ['소금빵 겉바속촉 그 자체예요. 오전에 가야 있어요', '빵 나오는 시간 맞춰 가면 따뜻한 걸 살 수 있어요', '버터 향이 진하고 안 느끼해요. 단골 확정', '크루아상 결이 살아있네요. 커피랑 최고 조합', '동네 빵집 중에 제일 맛있어요. 자주 갈 듯', '당일 생산만 하시는 게 느껴져요. 신선함이 달라요', '아이 간식으로 샀는데 저희 부부가 더 먹었어요 ㅋㅋ', '뺑오쇼콜라 초콜릿이 꽉 차 있어요. 겉은 바삭 속은 촉촉', '식빵이 쫄깃해서 그냥 뜯어 먹어도 맛있어요. 우유랑 최고', '천연발효라 속이 편해요. 다음날 먹어도 안 딱딱하고', '앙버터 진짜 잘해요. 버터 인심 후하고 팥도 안 달아요', '무슨 빵을 골라도 실패가 없네요. 시식도 챙겨주시고', '포장도 예뻐서 선물용으로 사갔는데 반응 좋았어요'],
    mid: ['맛있는데 인기 빵은 금방 품절돼요', '좋은데 주차가 어려워서 걸어가야 해요', '맛있는데 자리가 없어서 포장만 돼요', '좋은데 오후엔 인기 빵이 거의 다 나가요'],
  },
  hair: {
    pos: ['두피 스케일링 처음 받아봤는데 머리가 이렇게 가벼울 일인가요.. 신세계', '원장님 상담이 꼼꼼하세요. 두피 사진 보여주면서 설명해주심', '클리닉 받고 나서 며칠은 확실히 머릿결이 부드러워요', '지루성 두피라 고민 많았는데 관리 받고 가려움이 확 줄었어요', '예약제라 기다림 없이 바로 받았어요', '스타일 추천을 잘해주셔서 만족했어요', '단골 될 것 같아요. 머리 만지는 손이 다르심', '커트 라인 살아있어요. 그동안 다닌 곳 중 최고', '머리숱 많아서 늘 힘들었는데 층 정리 잘해주셔서 관리가 편해졌어요', '펌 오래 가게 해주셔서 두 달째 컬 살아있어요', '염색 컬러 상담 꼼꼼히 해주셔서 원하던 색 딱 나왔어요. 손상도 덜하고', '두피 마사지가 시원해서 스트레스 풀렸어요', '얼굴형 보고 어울리는 스타일 추천해주시는 게 감사했어요'],
    mid: ['효과는 있는데 60분이라기엔 대기 포함 두 시간 가까이 걸렸어요', '시술은 만족. 예약 시간대가 빨리 차는 편이라 미리 잡으세요', '결과는 좋은데 가격대가 있는 편', '만족스러운데 주말은 예약이 빨리 차요'],
  },
  waxing: {
    pos: ['왁싱샵 여러 군데 다녀봤는데 여기가 제일 안 아프게 하세요. 손 빠르심', '1회용 재료 개봉하는 걸 눈앞에서 보여주셔서 안심됐어요', '처음이라 긴장했는데 원장님이 계속 말 걸어주셔서 편하게 받았습니다', '마무리 진정 관리까지 해주시는 게 차이점. 붉은기 금방 가라앉았어요', '전신 이 가격이면 진짜 저렴한 거예요', '예약 시간 딱 맞춰서 시술 시작하는 것도 좋아요', '여름 준비 완료. 재방문 각', '피부 자극 없이 깔끔하게 됐어요', '브라질리언 처음이라 걱정 많았는데 프로페셔널하게 해주셔서 편했어요', '왁스 온도가 딱 맞아서 자극이 덜해요. 손이 빠르셔서 금방 끝', '시술 후 인그로운 관리법까지 알려주셔서 좋았어요', '프라이빗 룸이라 신경 안 쓰고 받을 수 있어요', '피부 예민한 편인데 트러블 없이 깔끔하게 됐어요'],
    mid: ['만족했습니다. 100% 예약제라 당일 예약은 어려워요', '시술은 좋은데 매장이 좀 아담해요', '괜찮았는데 예약 잡기가 살짝 어려워요'],
  },
  eyelash: {
    pos: ['자연스러운 C컬로 해달라고 했는데 딱 원하던 눈매 나왔어요. 아침 화장 10분 단축', '리터치 포함 가격이라 다른 데보다 훨씬 합리적이에요', '시술 90분 동안 편하게 자다 왔어요. 이물감도 없고', '디자인 상담 자세히 해주셔서 좋았어요. 눈 모양 보고 길이 추천해주심', '3주째인데 유지력 좋네요. 리터치 예약하러 갑니다', '눈매가 또렷해져서 민낯 자신감 생겼어요', '속눈썹 하실 분들 여기 가세요', '볼륨 래쉬 풍성하게 잘 붙여주셔서 눈이 확 커 보여요', '이물감 없이 가벼워서 붙인 것도 잊고 지냈어요', '리터치 텀 여유 있게 주셔서 관리 부담이 적어요', '자연스러운 걸 원했는데 딱 티 안 나게 예쁘게 해주셨어요', '유지력 좋아서 한 달 가까이 예쁘게 갔어요'],
    mid: ['결과물은 예쁜데 예약이 진짜 안 잡혀요.. 2주 기다렸습니다', '예쁜데 지속력은 사람마다 다를 것 같아요', '만족스러운데 시술 시간이 좀 길어요'],
  },
  nail: {
    pos: ['디자인 시안대로 예쁘게 해주셨어요', '큐티클 정리까지 꼼꼼해서 좋아요', '젤 유지력이 좋아서 3주 넘게 가요', '손이 화사해져서 기분 좋아요', '원장님 손이 빠르신데 꼼꼼해요. 수다 떨다 보면 끝나있음', '시즌 아트 디자인이 다양해서 고르는 재미가 있어요', '겨울 시즌 아트가 예뻐서 고르느라 한참 고민했어요', '젤 두께 얇게 올려주셔서 자연스럽고 오래가요', '손 모양 보고 어울리는 컬러 추천해주셔서 만족', '발관리까지 받았는데 꼼꼼해서 여름 준비 끝', '예약 시간 딱 맞고 시술도 빨라서 점심시간에 다녀왔어요'],
    mid: ['예쁜데 살짝 오래 걸렸어요', '결과는 만족인데 대기가 있었어요', '괜찮은데 아트 추가 가격이 좀 있어요', '만족인데 주말은 예약이 빨리 차요'],
  },
  pet: {
    pos: ['겁 많은 아이인데 미용 내내 달래가면서 해주셨대요. 끝나고 사진도 보내주심', '곰돌이컷 요청했는데 인생 미용 나왔습니다. 산책 나가면 다들 물어봐요', '목욕 후 특유의 꿉꿉한 냄새가 안 나요. 드라이 꼼꼼히 해주시는 듯', '발톱 귀청소까지 포함이라 따로 챙길 게 없어요', '우리 애가 미용 후에 안 떠는 건 처음이에요. 스트레스 관리 잘해주시는 곳', '위생 관리가 눈에 보여서 믿고 맡겨요', '댕댕이 미용 고민이면 여기로', '가위컷으로 부탁드렸는데 라인 정리가 깔끔해요. 눈 찌르던 털도 시원하게', '노견이라 조심스러웠는데 무리 없이 살살 해주셨어요', '스포츠컷 시원하게 잘 나왔어요. 여름엔 이게 최고', '피부 트러블 있는 걸 발견하고 알려주셔서 병원 갔어요. 세심하심'],
    mid: ['미용은 예쁘게 됐는데 주말 예약이 몰려서 픽업 시간이 좀 늦어졌어요', '결과는 좋은데 예약이 빨리 차요', '만족인데 대형견은 가격 문의 필요해요'],
  },
  climbing: {
    pos: ['초보 강습이 친절해서 처음인데도 재밌었어요. 다음날 팔이 후들거리는 건 함정', '홀드 세팅이 자주 바뀌어서 지루할 틈이 없어요', '암벽화 초크 대여 포함이라 운동복만 가면 돼요', '강사님이 자세 하나하나 봐주세요. 혼자 유튜브 보고 하던 것과 차원이 다름', '시설 깨끗하고 매트 푹신해서 떨어져도 안 아파요', '운동 진짜 제대로 됩니다. 헬스 지겨운 분들 강추', '혼자 가도 어색하지 않은 분위기예요', '난이도별로 색깔 구분돼 있어서 초보도 도전하기 좋아요', '강사님이 무서워하지 않게 천천히 리드해주셔서 끝까지 완등했어요', '실내라 날씨 상관없이 운동돼서 좋아요. 요즘 여기 빠졌어요', '친구랑 갔는데 서로 응원하면서 하니까 더 재밌더라고요'],
    mid: ['재밌는데 주말 오후엔 사람이 많아서 벽 기다려야 해요', '초보한테 좋은데 난이도 편차가 커요', '샤워실이 좀 좁은 것만 빼면 만족'],
  },
  stay: {
    pos: ['객실 깨끗하고 뷰가 정말 좋았어요', '체크인 친절하고 편하게 쉬다 왔어요', '조식이 알차서 만족스러웠어요', '가격 대비 시설이 훌륭해요', '침구가 포근해서 꿀잠 잤어요', '조용해서 힐링하고 왔어요. 노트북 들고 워케이션으로도 좋을 듯', '체크인 때 룸 업그레이드 해주셔서 기분 좋게 시작했어요', '어메니티가 좋아서 호캉스 제대로 즐겼어요', '뷰가 사진보다 실물이 더 좋네요. 노을 질 때 최고였어요', '방음 잘 되고 청소 상태 깔끔해서 푹 쉬었어요', '직원분들 응대가 친절해서 다시 오고 싶어요'],
    mid: ['깨끗한데 방음이 조금 아쉬워요', '위치는 좋은데 주차가 불편해요', '만족인데 체크인 시간이 좀 늦어요', '만족인데 성수기라 조금 붐볐어요'],
  },
  meal: {
    pos: ['반찬이 하나하나 정성이라 밑반찬만으로도 밥 한 공기 뚝딱했어요. 리필도 흔쾌히 해주시고', '기본이 탄탄한 집이에요. 국물 간이 세지 않아서 어른들 모시고 가기 딱 좋았습니다', '점심 특선이 이 구성에 이 가격이라는 게 놀라워요. 근처 직장인이면 단골 될 만함', '재료 신선한 게 딱 느껴져요. 반찬 안 남기고 다 먹은 건 오랜만이에요', '혼밥하기도 눈치 안 보이고 편했어요. 사장님이 조용히 챙겨주시는 스타일', '메뉴가 알차서 뭘 시켜도 실패가 없더라고요. 다음엔 다른 메뉴 도전해보려고요', '동네에 이런 집 하나 있으면 든든하죠. 이미 세 번째 방문이에요', '사장님이 직접 끓이시는 국물이 깊어요. 조미료 맛 안 나고', '양이 푸짐해서 든든하게 먹었어요. 남기기 아까워서 다 비웠네요', '재료 아끼지 않는 게 느껴져요. 건강해지는 맛', '점심 회전 빠른데 음식은 정성 그대로예요', 'QR 보여드리니 바로 처리해주셔서 편했어요'],
    mid: ['맛은 정말 좋은데 점심 피크엔 자리가 금방 차요. 12시 전에 가시길', '음식은 만족스러웠고 매장이 조금 아담한 것만 감안하면 좋아요', '맛있게 잘 먹었어요. 반찬 종류가 조금만 더 있으면 완벽할 듯', '맛은 좋은데 주말엔 웨이팅이 조금 있어요'],
  },
  beauty: {
    pos: ['상담부터 다르네요. 제 피부 상태 보면서 오늘은 뭘 하고 뭘 빼는 게 좋을지 짚어주셨어요', '위생 관리가 눈에 보여요. 도구 꺼내는 것부터 믿음이 갔습니다', '시술 내내 아프거나 불편한 부분 없는지 계속 확인해주셔서 편하게 받았어요', '결과물이 딱 원하던 느낌이라 만족스러워요. 과하지 않고 자연스럽게', '예약 시간 정확히 지켜서 시작하고, 끝나고 관리법까지 알려주셔서 좋았어요', '원장님 손이 꼼꼼하세요. 마무리 디테일에서 실력 차이가 나더라고요', '피부 타입 물어보고 그에 맞게 진행해주셔서 자극 없이 받았어요', '시술 후 홍조 관리까지 챙겨주셔서 바로 일상 복귀했어요', '설명을 쉽게 해주셔서 처음인데도 뭘 받는지 이해가 됐어요', '재방문인데 매번 꼼꼼하셔서 믿고 맡겨요', '프라이빗하게 받을 수 있어서 편했어요'],
    mid: ['시술은 아주 만족스러웠어요. 인기 시간대는 미리 예약하셔야 해요', '결과는 좋은데 매장이 아담한 편이라 참고하세요', '만족합니다. 주말 예약이 빨리 차는 게 유일한 아쉬움'],
  },
  etc: {
    pos: ['처음이라 걱정했는데 하나하나 친절하게 알려주셔서 어렵지 않게 즐겼어요', '생각보다 훨씬 알차서 놀랐어요. 이 가격에 이 구성이면 무조건 이득', '설명이 자세하고 응대가 편안해서 시간 가는 줄 몰랐어요', '기대 없이 갔다가 제대로 즐기고 왔습니다. 사진도 잘 나오고요', '혼자 가도 어색하지 않게 챙겨주셔서 편했어요. 재방문 의사 있습니다', '원데이 클래스로 갔는데 결과물 가져갈 수 있어서 뿌듯했어요', '체험 위주라 지루할 틈 없이 알차게 즐겼어요', '초보도 따라 할 수 있게 차근차근 알려주셔서 좋았어요', '연인이랑 갔는데 특별한 추억 만들고 왔어요', '사진 찍기 좋은 공간이라 인생샷 건졌어요', '강습 시간이 알차서 시간 가는 줄 몰랐어요. 초보 배려 잘해주심', '장비 대여까지 포함이라 준비물 신경 안 써도 돼서 좋았어요', '주말 데이트 코스로 딱이에요. 색다른 경험이라 기억에 남아요', '분위기가 편해서 처음 온 사람도 금방 적응했어요', '아이랑 같이 했는데 눈높이 맞춰 알려주셔서 둘 다 즐거웠어요'],
    mid: ['만족스럽게 즐겼어요. 주말엔 사람이 조금 몰리는 편이에요', '좋았는데 주차 공간이 협소해서 대중교통 추천드려요', '전반적으로 만족. 인기 시간대는 예약이 빨리 차요'],
  },
}

// 🎭 5점 리뷰 끝에 가끔 붙는 짧은 마무리 — 대부분 빈 문자열(본문이 이미 완결이라 과다 append 방지).
const TAILS = ['', '', '', '', '', '', '', '', '', ' 또 갈 것 같아요', ' 담에 또 올게요']

// 🎭 방문 맥락 오프너 — 대부분 빈 문자열(바로 본론). 07-07: '~했어요. ' 처럼 마침표로 끝나 본문과
//   두 조각으로 붙던 형태(조작 티) 제거 → 본문에 자연스럽게 이어지는 연결형('~는데 ')만 소량 유지.
const OPENERS = ['', '', '', '', '', '', '', '', '', '', '주말에 다녀왔는데 ', '동네라 종종 가는데 ', '지인 추천으로 갔는데 ', '오랜만에 갔는데 ']
// 🎭 아주 짧은 한마디형(clichés 제거) — 실제 최빈 패턴. 캐주얼 풀(CASUAL)이 주가 되고 이건 보조.
const SHORTS_POS = ['여긴 실패가 없어요', '기대 이상이라 놀랐어요', '주변에 다 추천하는 중', '가격 생각하면 더 좋게 느껴져요']
// 🎭 2026-07-07 (대표 "이모티콘도 동일 — 더 다양화, 더 이상적으로"): 업종별 이모지 풀 + 가변 개수.
//   기존: 4종(👍😋🙏🥰) 고정·업종 무관 → 전부 비슷. 개선: 음식/뷰티/활동/숙소/반려 풀을 분리(각 8~14종)
//   해 매장 특색에 맞는 이모지가 붙고, 절반 이상은 무이모지(진짜 후기 다수) + 가끔 2개(다른 것).
const EMOJI_POOLS = {
  food:   ['😋', '🤤', '👍', '😍', '🔥', '💯', '👏', '🙏', '🥰', '😊', '👌', '✨', '🍽️', '😆'],
  beauty: ['💕', '✨', '😍', '🥰', '👍', '💅', '😊', '🙏', '👏', '💯', '🫶', '😌', '💖', '🤍'],
  active: ['👍', '😊', '🥰', '✨', '👏', '🙏', '💯', '😆', '🤩', '🙌', '👌'],
  stay:   ['😌', '🥰', '✨', '👍', '😊', '🏡', '🙏', '💯', '🫶', '🌿'],
  pet:    ['🐶', '🥰', '😊', '👍', '✨', '🙏', '🐾', '💕', '🤍'],
} as const

function emojiGroup(topic: Topic): keyof typeof EMOJI_POOLS {
  if (topic === 'pet') return 'pet'
  if (topic === 'stay') return 'stay'
  if (topic === 'climbing') return 'active'
  if (topic === 'hair' || topic === 'waxing' || topic === 'eyelash' || topic === 'nail' || topic === 'beauty') return 'beauty'
  if (topic === 'gogi' || topic === 'sushi' || topic === 'western' || topic === 'cafe' || topic === 'bakery' || topic === 'meal') return 'food'
  return 'active'
}

/** 업종별 이모지 1~2개(대부분 0개). emojiPct=이모지 포함 비중(자동튜닝). 앞에 공백 포함. */
function pickEmoji(topic: Topic, emojiPct = 0.23): string {
  const r = Math.random()
  const noEmoji = 1 - emojiPct  // 예: 0.23 → 77% 무이모지
  if (r < noEmoji) return ''
  const pool = EMOJI_POOLS[emojiGroup(topic)]
  const e1 = pool[Math.floor(Math.random() * pool.length)]
  // 이모지 구간 내 ~83% 한 개, ~17% 두 개(서로 다르게)
  if (r < noEmoji + (1 - noEmoji) * 0.83) return ' ' + e1
  let e2 = pool[Math.floor(Math.random() * pool.length)]
  for (let i = 0; i < 4 && e2 === e1; i++) e2 = pool[Math.floor(Math.random() * pool.length)]
  return ' ' + e1 + e2
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// 🎯 2026-07-06 (대표 "더 올려야" — 진짜 후기 밀도): 상품명에서 **실제 메뉴/시술 명사**를 뽑아 리뷰에 녹임.
//    보쌈집 리뷰가 '보쌈'을, 왁싱샵 리뷰가 '왁싱'을 실제로 언급 → 업종-generic 티 제거 + 매장별 유니크(같은
//    템플릿도 term 이 달라 자동 분화). 조사(은/는) 의존 문구는 배제(받침 무관 안전 구문만).
const TERM_WORDS = ['오마카세', '한우', '삼겹살', '곱창', '막창', '대창', '보쌈', '족발', '갈비', '스테이크', '초밥', '스시', '사시미', '장어',
  '파스타', '피자', '리조또', '라멘', '우동', '돈까스', '규동', '덮밥', '쌀국수', '마라탕', '떡볶이', '김밥', '국밥', '찜닭', '닭갈비', '냉면', '짬뽕', '탕수육',
  '라떼', '아메리카노', '핸드드립', '에스프레소', '소금빵', '크루아상', '바게트', '케이크', '타르트', '마카롱', '빙수',
  '왁싱', '속눈썹', '젤네일', '네일', '페디', '뿌리염색', '염색', '두피', '스케일링', '클리닉', '필링', '태닝', '반영구',
  '필라테스', '요가', '클라이밍', '볼링', '도자기', '스크린골프', '방탈출', '드로잉', '베이킹', '가죽공예']
function extractKeyTerm(name: string): string | null {
  const n = name || ''
  for (const w of TERM_WORDS) if (n.includes(w)) return w
  return null
}
type TermGroup = 'food' | 'beauty' | null
function topicGroup(topic: Topic): TermGroup {
  if (topic === 'gogi' || topic === 'sushi' || topic === 'western' || topic === 'cafe' || topic === 'bakery' || topic === 'meal') return 'food'
  if (topic === 'hair' || topic === 'waxing' || topic === 'eyelash' || topic === 'nail' || topic === 'beauty') return 'beauty'
  return null  // 활동/숙소/반려 등은 term 주입 없이 일반 풀(문장이 이미 구체적)
}
// {t}=추출 명사. 조사 없이 어떤 명사에도 자연스러운 구문만.
const FOOD_TERM_TEMPLATES: ((t: string) => string)[] = [
  (t) => `${t} 먹으러 또 갈 것 같아요. 그 맛이 자꾸 생각나요`,
  (t) => `${t} 하나는 진짜 잘하네요. 여기 자주 올 듯`,
  (t) => `${t} 제대로 하는 집 찾았어요. 또 오고 싶어요`,
  (t) => `${t} 좋아하는 분이면 여기 꼭 가보세요`,
  (t) => `${t} 양도 넉넉하고 간도 딱 맞았어요`,
  (t) => `오늘 ${t} 먹었는데 실패 없이 만족했어요`,
  (t) => `${t} 이 가격에 이 퀄리티면 자주 올 것 같아요`,
]
const BEAUTY_TERM_TEMPLATES: ((t: string) => string)[] = [
  (t) => `${t} 받으러 갔는데 꼼꼼하게 잘해주셨어요`,
  (t) => `${t} 하러 종종 가는데 늘 만족스러워요`,
  (t) => `${t} 잘하는 곳 찾아서 기뻐요. 또 올 듯`,
  (t) => `${t} 처음 받아봤는데 결과 마음에 들어요`,
  (t) => `${t} 여기서 받고 다른 데 못 가겠어요`,
]

// 🗣️ 2026-07-07 (대표 "리뷰 내용이 문제 — 조작 티"): 실제 후기의 '거친 질감'(구어체·명사형 종결·slang·
//   ㅋㅋ/ㅎㅎ/ㅠ·무구두점·잡관찰)을 담은 캐주얼 풀. 기존 풀이 전부 '완결된 깔끔한 문장'이라 조작 티가 났음.
//   업종군(food/beauty/active)별. 5점 리뷰의 상당수를 이 캐주얼 톤으로 → 손글 리뷰 실감.
const CASUAL: Record<'food' | 'beauty' | 'active', string[]> = {
  food: [
    '존맛탱ㅋㅋ 또 올거임', '여기 찐이에요 진짜', '가성비 미쳤다..', '사장님 친절하시고 맛도 굿굿',
    '배부르게 잘 먹고 갑니다ㅎㅎ', '재방문 각인데요?', '별로일까봐 걱정했는데 웬걸 완전 맛있었음',
    '친구가 데려왔는데 내가 더 반함ㅋㅋ', '주차 편하고 좋네요', '양 많아서 든든했어요',
    '혼자 갔는데 눈치 안 보여서 좋았음', '가격은 좀 있지만 그만한 값어치 함', '웨이팅 있었는데 먹을만함',
    '분위기도 좋고 맛도 좋고 다 좋음', '여기 왜 이제 알았지ㅠㅠ', '동네 맛집 발견', '사진보다 실물이 더 맛있어요',
    '직원분들 다 친절하심', '또 가고싶다 진짜', '가족들이 다 좋아했어요ㅎㅎ', '무난하게 맛있었어요',
    '기대 안했는데 생각보다 괜찮', '든든하게 잘 먹었습니다',
  ],
  beauty: [
    '손 빠르셔서 금방 끝남 굿', '안 아프게 잘해주세요ㅠㅠ 강추', '원장님 실력 인정합니다',
    '예약 잡기 힘든 이유가 있네요', '결과물 만족스러워요ㅎㅎ', '다른데 다녀봤는데 여기가 젤 나음',
    '친절하시고 꼼꼼하세요', '생각보다 자연스럽게 잘 나옴', '재방문 의사 있어요', '깔끔하게 잘됐어요',
    '분위기 좋고 편했어요', '설명 자세히 해주셔서 좋았음', '여기 단골될듯', '뭔가 믿음이 가는 곳',
    '처음이라 긴장했는데 편하게 해주심ㅎㅎ', '위생 신경 쓰시는 게 느껴짐', '만족 또 만족',
  ],
  active: [
    '재밌게 잘 배웠어요ㅎㅎ', '초보인데 친절하게 알려주심', '시설 깨끗하고 좋네요', '또 오고싶어요',
    '생각보다 훨씬 재밌음', '강사님 친절하세요', '분위기 좋아요', '시간 가는 줄 몰랐어요',
    '가성비 좋네요ㅎㅎ', '처음인데 어렵지 않게 잘 알려주심', '스트레스 풀림', '주말에 또 갈듯',
  ],
}
function casualGroup(topic: Topic): keyof typeof CASUAL {
  const g = emojiGroup(topic)
  if (g === 'beauty') return 'beauty'
  if (g === 'food') return 'food'
  return 'active'
}

/** 결정론 폴백 — 업종 특색 문구 조합(배송어 없음, 별점별 톤).
 *  🎭 2026-07-04 (대표 "최대 다양성, AI 티 0"): 길이 극단(한마디~2문장)·오프너·말투 꼬리 조합으로
 *  같은 상품 안에서도 문장 구조가 겹치지 않게. avoid(이미 쓴 문구) 재시도는 buildStoreReviews 가 담당. */
export function composeDemoReview(rating: number, topic: Topic, storeName?: string | null, seen?: Set<string>, term?: string | null, tuning: ReviewTuning = DEFAULT_TUNING): string {
  const pool = POOLS[topic] || POOLS.etc
  const emojiPct = tuning.emojiPct
  // 상품 실제 메뉴/시술 명사를 녹인 후기(진짜 후기 밀도·매장별 유니크). **주입 개수는 호출측(buildStoreReviews)
  //   이 쿼터로 제어** — term 이 non-null 로 넘어온 리뷰만 사용(한 매장에 몰리는 것 방지).
  const grp = topicGroup(topic)
  if (term && grp) {
    const tmpls = grp === 'food' ? FOOD_TERM_TEMPLATES : BEAUTY_TERM_TEMPLATES
    let ts = pick(tmpls)(term)
    if (seen) { for (let i = 0; i < 6 && seen.has(ts); i++) ts = pick(tmpls)(term); seen.add(ts) }
    if (rating >= 5) ts += pick(TAILS)
    return ts + pickEmoji(topic, emojiPct)
  }
  // 📏 2026-07-07 길이 분포 — 손튜닝 기본(짧25%/긴22%/중53%)이되, 실제 리뷰가 쌓이면 자동튜닝(review-gen-tuning)
  //   이 shortPct/longPct 를 실제 분포로 대체(피드백 루프). 실제 리뷰 목록의 길이 스펙트럼 재현.
  const shortCut = tuning.shortPct
  const longCut = tuning.shortPct + tuning.longPct
  const roll = Math.random()
  // 🗣️ 짧은 한마디(거친 질감 — ㅋㅋ/명사형/slang/잡관찰).
  if (roll < shortCut) {
    const cg = CASUAL[casualGroup(topic)]
    const shPool = Math.random() < 0.82 ? cg : SHORTS_POS
    let sh = pick(shPool)
    if (seen) { for (let i = 0; i < 8 && seen.has(sh); i++) sh = pick(shPool); seen.add(sh) }
    return sh + pickEmoji(topic, emojiPct)
  }
  // 📝 긴 정성 후기 — 같은 업종 특색 문장 2~3개를 이어붙여 여러 포인트(맛·서비스·분위기·재방문) 커버.
  if (roll < longCut) {
    const nParts = Math.random() < 0.33 ? 3 : 2
    const parts: string[] = []
    for (let k = 0; k < nParts; k++) {
      let s = pick(pool.pos)
      for (let i = 0; i < 8 && parts.includes(s); i++) s = pick(pool.pos)
      if (!parts.includes(s)) parts.push(s)
    }
    let joined = parts.map((p) => p.replace(/[.\s]+$/, '')).join('. ')
    if (Math.random() < 0.6) joined += '.'
    if (seen) {
      if (seen.has(joined)) { const extra = pick(pool.pos).replace(/[.\s]+$/, ''); joined = `${joined} ${extra}.` }
      seen.add(joined)
    }
    if (rating >= 5 && Math.random() < 0.4) joined += pick(TAILS)
    return joined + pickEmoji(topic, emojiPct)
  }
  // 🎭 53%: 중간 — 단일 특색 문장 + 오프너. 4점은 순한 아쉬움 한마디(넷 긍정)를 절반쯤 섞어 리얼함.
  const src = (rating === 4 && pool.mid.length && Math.random() < 0.45) ? pool.mid : pool.pos
  let base = pick(src)
  // 🎭 같은 상품 안 '핵심 문장' 중복 방지 — 오프너/꼬리만 다른 사실상 같은 리뷰 차단(최종 문자열 dedup 의 사각지대).
  if (seen) { for (let i = 0; i < 8 && seen.has(base); i++) base = pick(src); seen.add(base) }
  // 🎭 본문이 이미 방문 맥락으로 시작하면 오프너 생략(‘가봤는데 회식으로 갔는데’ 같은 이중 맥락 방지).
  const opener = /^(회식|부모님|가족|친구|지인|결혼|아이|혼자|두 번째|처음|딸|아들|엄마|남편|아내|동료|오랜만|연인|커플|둘이)/.test(base) ? '' : pick(OPENERS)
  let s = opener + base
  // 6%: 매장명 자연스럽게 앞에(오프너 없을 때만) — 과하면 조작 티라 낮게
  if (!opener && storeName && Math.random() < 0.06) s = `${storeName} 다녀왔어요. ${base}`
  if (rating >= 5) s += pick(TAILS)
  s += pickEmoji(topic, emojiPct)
  return s
}

interface DemoProduct { id: number; name: string; category: string; storeName?: string | null; price?: number }
export interface StoreReviewInput { name: string; category: string; storeName?: string | null; price?: number }
export interface GenReview { rating: number; content: string }

function ratingSample(): number {
  // 대표 결정(2026-07-06): 데모는 전부 긍정(4~5점, 나쁜 후기 없음). 5 다수 + 4 소수 → 평점 ~4.6.
  return Math.random() < 0.64 ? 5 : 4
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
export async function buildStoreReviews(env: Env, p: StoreReviewInput, count = 8, seenShared?: Set<string>): Promise<GenReview[]> {
  const topic = detectTopic(p.name, p.category)
  const term = extractKeyTerm(p.name)  // 🎯 상품 실제 메뉴/시술 명사(있으면 일부 리뷰에 녹임)
  const tuning = await getReviewGenTuning(env)  // 📈 실제 리뷰 통계 자동튜닝(표본 부족 시 손튜닝 기본값)
  const total = Math.max(1, Math.min(2000, count))
  const out: GenReview[] = []
  const CHUNK = 40
  // 🎭 문구 중복 방지 — 같은 상품 안(기본) + seenShared 넘기면 **여러 매장 간에도** 같은 리뷰 안 뜨게
  //    (배치 시드에서 보쌈집·곱창집에 동일 리뷰가 뜨던 '조작 티' 제거). 풀 소진 시 graceful 재사용.
  const seen = seenShared ?? new Set<string>()
  for (let i = 0; i < total; i += CHUNK) {
    const n = Math.min(CHUNK, total - i)
    try {
      out.push(...await generateReviewsLLM(env, { id: 0, ...p }, n))
    } catch {
      // 🎯 상품 명사 후기는 한 매장당 1~3개만(전부 'term 매장' 문구면 그것도 티) — 쿼터로 소수 유지.
      let termQuota = (term && topicGroup(topic)) ? Math.min(3, Math.max(1, Math.round(n * 0.3))) : 0
      for (let k = 0; k < n; k++) {
        const rating = ratingSample()
        if (Math.random() < 0.1) { out.push({ rating, content: '' }); continue }  // 별점만(실제 패턴, 소량)
        const useTerm = termQuota > 0 && Math.random() < 0.55
        if (useTerm) termQuota--
        // dedup 은 composeDemoReview 가 '핵심 문장' 기준으로 수행(오프너/꼬리 변형까지 커버).
        out.push({ rating, content: composeDemoReview(rating, topic, p.storeName, seen, useTerm ? term : null, tuning) })
      }
    }
  }
  return out
}

/**
 * 데모 상품 1건에 매장 특색 리뷰를 시드(이미 리뷰 있으면 skip).
 * review_count/avg_rating/sold_count 갱신까지 — 시간당 generic cron 이 안 건드리게(review_count>0).
 */
export async function seedDemoReviews(env: Env, p: DemoProduct, count = 8, seenShared?: Set<string>): Promise<number> {
  const DB = env.DB
  const existing = await DB.prepare('SELECT COUNT(*) AS c FROM product_reviews WHERE product_id = ?')
    .bind(p.id).first<{ c: number }>().catch(() => ({ c: 0 }))
  if ((existing?.c ?? 0) > 0) return 0

  const reviews = await buildStoreReviews(env, p, Math.max(4, Math.min(20, count)), seenShared)

  const stmts = reviews.map((r) => {
    const masked = maskName(pick(KOREAN_NAMES))
    // 🗓️ 최근일수록 촘촘 + 오래된 후기 꼬리(실제 리뷰 목록의 시간 분포). 0~약 140일.
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.7) * 140)
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

interface DemoRow { id: number; name: string; category: string; restaurant_name: string | null; price: number }

/**
 * 🔒 2026-07-06 (대표 "리뷰 퀄리티 영구 유지?"): 데모(slug demo-deal-%) 중 리뷰 없는 것을 **좋은 composer**로
 *   시드. 매시간 cron 에서 호출 — generic 템플릿(auto-seed-fake-reviews)이 데모를 낮은 품질로 채우는 것을
 *   구조적으로 대체(그쪽은 데모 제외됨). 배치 공용 seen 으로 매장 간 리뷰 중복 방지.
 */
export async function seedMissingDemoReviews(env: Env, maxBatch = 400): Promise<{ seeded: number }> {
  const DB = env.DB
  const rows = await DB.prepare(
    `SELECT p.id, p.name, p.category, p.restaurant_name, p.price FROM products p
      WHERE p.slug LIKE 'demo-deal-%' AND COALESCE(p.slug,'') NOT LIKE 'retired-%'
        AND COALESCE(p.is_active,1) = 1
        AND (p.review_count IS NULL OR p.review_count = 0)
        AND NOT EXISTS (SELECT 1 FROM product_reviews r WHERE r.product_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM product_supply_meta m WHERE m.product_id = p.id AND m.key='prelaunch' AND m.value='1')
      ORDER BY p.created_at DESC LIMIT ?`
  ).bind(maxBatch).all<DemoRow>().catch(() => ({ results: [] as DemoRow[] }))
  const seen = new Set<string>()
  let seeded = 0
  for (const r of (rows.results || [])) {
    const n = await seedDemoReviews(env, { id: r.id, name: r.name, category: r.category, storeName: r.restaurant_name, price: r.price }, 6 + Math.floor(Math.random() * 7), seen).catch(() => 0)
    if (n > 0) seeded++
  }
  return { seeded }
}

/**
 * 🔄 2026-07-06 (대표 "기존 100개+도 다 작업"): 기존 데모의 옛 리뷰를 **새 품질로 재생성**. 청크 단위 —
 *   `review_gen_v='7'` 메타 마커로 이미 새로고침한 데모는 skip(반복 호출이 전체를 진행, 멱등). limit 개씩.
 *   반환 remaining>0 이면 다시 호출(클라 루프). force 로 마커 무시 재실행 가능.
 */
export async function refreshDemoReviews(env: Env, limit = 20, force = false): Promise<{ refreshed: number; reviews: number; remaining: number }> {
  const DB = env.DB
  const markerFilter = force ? '' : `AND NOT EXISTS (SELECT 1 FROM product_supply_meta m2 WHERE m2.product_id = p.id AND m2.key='review_gen_v' AND m2.value='7')`
  const baseWhere = `p.slug LIKE 'demo-deal-%' AND COALESCE(p.slug,'') NOT LIKE 'retired-%' AND COALESCE(p.is_active,1)=1
      AND NOT EXISTS (SELECT 1 FROM product_supply_meta m WHERE m.product_id=p.id AND m.key='prelaunch' AND m.value='1')`
  const rows = await DB.prepare(
    `SELECT p.id, p.name, p.category, p.restaurant_name, p.price FROM products p
      WHERE ${baseWhere} ${markerFilter}
      ORDER BY p.created_at ASC LIMIT ?`
  ).bind(Math.max(1, Math.min(50, limit))).all<DemoRow>().catch(() => ({ results: [] as DemoRow[] }))
  const seen = new Set<string>()
  let refreshed = 0, reviews = 0
  const { setSupplyMeta } = await import('./product-supply-meta')
  for (const r of (rows.results || [])) {
    try {
      await DB.prepare('DELETE FROM product_reviews WHERE product_id = ? AND is_generated = 1').bind(r.id).run()
      const n = await seedDemoReviews(env, { id: r.id, name: r.name, category: r.category, storeName: r.restaurant_name, price: r.price }, 6 + Math.floor(Math.random() * 7), seen)
      await setSupplyMeta(DB, r.id, { review_gen_v: '7' }).catch(() => {})
      refreshed++; reviews += n
    } catch { /* skip this one */ }
  }
  const rem = await DB.prepare(
    `SELECT COUNT(*) AS c FROM products p WHERE ${baseWhere}
      AND NOT EXISTS (SELECT 1 FROM product_supply_meta m2 WHERE m2.product_id=p.id AND m2.key='review_gen_v' AND m2.value='7')`
  ).first<{ c: number }>().catch(() => ({ c: 0 }))
  return { refreshed, reviews, remaining: force ? 0 : (rem?.c ?? 0) }
}
