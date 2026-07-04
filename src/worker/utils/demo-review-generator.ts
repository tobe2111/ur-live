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

type Topic = 'gogi' | 'western' | 'cafe' | 'hair' | 'waxing' | 'eyelash' | 'nail' | 'pet' | 'climbing' | 'stay' | 'meal' | 'beauty' | 'etc'

/** 상품명/카테고리로 업종(리뷰 특색) 판별 — 세밀 키워드 우선, 없으면 카테고리 폴백. */
function detectTopic(name: string, category: string): Topic {
  const n = (name || '')
  if (/한우|오마카세|고기|삼겹|스테이크|정육|구이|갈비/.test(n)) return 'gogi'
  if (/피자|파스타|화덕|이탈리|스테이크|브런치|양식/.test(n)) return 'western'
  if (/커피|카페|핸드드립|디저트|원두|브런치|베이커리|빵/.test(n)) return 'cafe'
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

/** 업종별 실감 리뷰 문구 풀. pos=만족(4~5점), mid=보통(3점). {s}=매장명 자리(선택). 배송어 없음. */
const POOLS: Record<Topic, { pos: string[]; mid: string[] }> = {
  gogi: {
    pos: ['고기 질이 확실히 다르네요. 마블링 예술이에요', '직원분이 직접 구워주셔서 편하게 먹었어요', '2인 코스인데 양도 넉넉하고 부위별로 다 맛있었어요', '가격 생각하면 이 퀄리티 어디서도 못 먹어요', '반찬이랑 된장찌개까지 정갈해서 좋았어요', '예약하고 갔더니 자리 바로 안내해주셨어요', '회식으로 다시 오려고요. 다들 만족했어요'],
    mid: ['맛은 좋은데 웨이팅이 좀 있었어요', '고기는 괜찮았는데 매장이 살짝 협소해요'],
  },
  western: {
    pos: ['화덕피자 도우가 쫄깃하고 토핑도 푸짐했어요', '파스타 면 삶기가 딱 알덴테라 좋았어요', '분위기 좋아서 데이트로 딱이에요', '2인 세트로 둘이 배부르게 먹었어요', '치즈 인심이 후해요. 또 올게요', '플레이팅도 예쁘고 사진 잘 나와요'],
    mid: ['맛은 무난한데 좀 짠 편이에요', '피자는 맛있는데 파스타는 평범했어요'],
  },
  cafe: {
    pos: ['원두 향이 살아있어요. 핸드드립 추천해요', '디저트랑 같이 먹으니 궁합이 좋네요', '사장님이 커피 내려주시는 정성이 느껴져요', '조용하고 아늑해서 책 읽기 좋아요', '라떼 부드럽고 디저트도 수제라 신선해요', '창가 자리 분위기가 특히 좋았어요'],
    mid: ['커피는 좋은데 자리가 몇 개 안 돼요', '맛은 괜찮은데 조금 붐볐어요'],
  },
  hair: {
    pos: ['두피 스케일링 받고 두피가 개운해졌어요', '원장님이 꼼꼼하게 상담해주시고 시술도 섬세해요', '클리닉 받고 머릿결이 확실히 부드러워졌어요', '예약제라 기다림 없이 바로 받았어요', '스타일 추천을 잘해주셔서 만족했어요', '재방문 의사 100%예요. 단골 될 것 같아요'],
    mid: ['시술은 만족인데 시간이 좀 걸렸어요', '결과는 좋은데 예약이 잘 안 잡혀요'],
  },
  waxing: {
    pos: ['1회용 재료만 쓰셔서 위생 걱정 없었어요', '아프지 않게 빠르게 해주셔서 놀랐어요', '원장님이 꼼꼼하고 마무리 진정까지 완벽해요', '예약 시간 딱 맞춰서 시술해주셨어요', '처음이라 긴장했는데 편하게 잘 받았어요', '피부 자극 없이 깔끔하게 됐어요. 재방문할게요'],
    mid: ['시술은 만족인데 매장이 좀 작아요', '괜찮았는데 예약 잡기가 조금 어려워요'],
  },
  eyelash: {
    pos: ['연장 자연스럽게 잘 붙여주셨어요', '리터치까지 포함이라 가성비 좋아요', '눈매가 또렷해져서 화장 시간이 줄었어요', '이물감 없이 편하고 지속력도 좋아요', '디자인 상담 꼼꼼히 해주셔서 마음에 들어요', '시술 내내 편하게 누워 있다가 왔어요'],
    mid: ['예쁜데 지속력은 사람마다 다를 것 같아요', '만족스러운데 시술 시간이 길어요'],
  },
  nail: {
    pos: ['디자인 시안대로 예쁘게 해주셨어요', '큐티클 정리까지 꼼꼼해서 좋아요', '젤 유지력이 좋아서 오래가요', '손이 화사해져서 기분 좋아요', '분위기도 좋고 손도 빨라요'],
    mid: ['예쁜데 살짝 오래 걸렸어요', '결과는 만족인데 대기가 있었어요'],
  },
  pet: {
    pos: ['우리 아이 미용 너무 예쁘게 해주셨어요', '겁 많은 아인데 편하게 잘 다뤄주세요', '목욕 후 냄새도 안 나고 보송보송해요', '커트 스타일 요청대로 딱 나왔어요', '사장님이 아이 스트레스 안 받게 신경 써주세요', '다음에도 여기서 미용할게요'],
    mid: ['미용은 만족인데 예약이 빨리 차요', '결과는 좋은데 조금 기다렸어요'],
  },
  climbing: {
    pos: ['초보 강습이 친절해서 처음인데도 재밌었어요', '홀드 세팅이 다양해서 지루할 틈이 없어요', '암벽화 대여까지 포함이라 몸만 가면 돼요', '강사님이 자세 하나하나 봐주세요', '시설 깨끗하고 매트도 잘 돼 있어요', '운동 제대로 되고 또 오고 싶어요'],
    mid: ['재밌는데 주말엔 사람이 많아요', '초보한테 좋은데 난이도 편차가 커요'],
  },
  stay: {
    pos: ['객실 깨끗하고 뷰가 정말 좋았어요', '체크인 친절하고 편하게 쉬다 왔어요', '조식이 알차서 만족스러웠어요', '가격 대비 시설이 훌륭해요', '조용해서 힐링하고 왔어요', '재방문 의사 있어요. 잘 쉬었습니다'],
    mid: ['깨끗한데 방음이 조금 아쉬워요', '위치는 좋은데 주차가 불편해요'],
  },
  meal: {
    pos: ['맛도 좋고 사장님도 친절하세요', '양 넉넉하고 정갈하게 잘 나와요', '방문해서 QR 보여주니 바로 이용됐어요', '가격 대비 만족스러운 한 끼였어요', '재방문 의사 있어요'],
    mid: ['맛은 좋은데 웨이팅이 있어요', '무난하게 잘 먹었어요'],
  },
  beauty: {
    pos: ['원장님이 꼼꼼하게 잘 해주셨어요', '위생 신경 쓰시는 게 느껴져요', '예약제라 기다림 없이 받았어요', '결과 만족스러워서 재방문할게요'],
    mid: ['만족인데 예약이 조금 어려워요', '괜찮은데 매장이 아담해요'],
  },
  etc: {
    pos: ['친절하고 만족스럽게 이용했어요', '방문해서 편하게 잘 썼어요', '가격 대비 좋아서 추천해요', '다음에 또 이용할게요'],
    mid: ['무난하게 이용했어요', '괜찮은데 조금 붐볐어요'],
  },
}

const TAILS = ['', '', '', ' 추천해요!', ' 강추합니다', ' 또 갈게요', ' 만족스러워요', ' :)']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

/** 결정론 폴백 — 업종 특색 문구 조합(배송어 없음, 별점별 톤). */
export function composeDemoReview(rating: number, topic: Topic, storeName?: string | null): string {
  const pool = POOLS[topic] || POOLS.etc
  const base = rating >= 4 ? pick(pool.pos) : (pool.mid.length ? pick(pool.mid) : pick(pool.pos))
  let s = base
  // 20% 확률로 매장명 자연스럽게 앞에 붙임
  if (storeName && Math.random() < 0.22) s = `${storeName} 다녀왔어요. ${s}`
  if (rating >= 5) s += pick(TAILS)
  return s
}

interface DemoProduct { id: number; name: string; category: string; storeName?: string | null; price?: number }
interface GenReview { rating: number; content: string }

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
- 매장명을 가끔 자연스럽게 녹여도 좋다(전부는 아님).
- 실제 손님처럼 1~2문장, 구어체, 표현 다양하게(반복 최소). 별점별 톤: 5=매우 만족, 4=만족, 3=보통.
- 약 15%는 content 를 빈 문자열("")로(별점만).
- 이모지는 20% 정도만 가볍게.
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
 * 데모 상품 1건에 매장 특색 리뷰를 시드(이미 리뷰 있으면 skip). LLM 우선, 실패 시 결정론 폴백.
 * review_count/avg_rating/sold_count 갱신까지 — 시간당 generic cron 이 안 건드리게(review_count>0).
 */
export async function seedDemoReviews(env: Env, p: DemoProduct, count = 8): Promise<number> {
  const DB = env.DB
  const existing = await DB.prepare('SELECT COUNT(*) AS c FROM product_reviews WHERE product_id = ?')
    .bind(p.id).first<{ c: number }>().catch(() => ({ c: 0 }))
  if ((existing?.c ?? 0) > 0) return 0

  const topic = detectTopic(p.name, p.category)
  const n = Math.max(4, Math.min(20, count))
  let reviews: GenReview[]
  try {
    reviews = await generateReviewsLLM(env, p, n)
  } catch {
    reviews = Array.from({ length: n }, () => {
      const rating = ratingSample()
      const content = Math.random() < 0.15 ? '' : composeDemoReview(rating, topic, p.storeName)
      return { rating, content }
    })
  }

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
