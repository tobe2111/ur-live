/**
 * 🏷️ 2026-07-21 인플루언서 카테고리 콘텐츠 기반 자동 분류 (순수 — 테스트 가능).
 *   기존: 발굴 키워드의 카테고리를 물려받기만 → 자동확장 키워드('자동')·오분류(뷰티 채널이 "서울 맛집"
 *   검색에 걸리면 평생 맛집) 발생. 채널 **이름+소개글 텍스트 신호**로 분류하고, 신호 없을 때만 키워드
 *   카테고리 폴백. 신규 저장 + 기존 풀 재분류(백필) 양쪽에서 사용.
 */

/**
 * 분류 카테고리 — **첫 매치 승**이라 순서가 우선순위. 원칙:
 *   ① 구체·니치 신호를 먼저(네일<뷰티, 반려/육아/운동을 맛집보다 먼저 → "반려간식/이유식/다이어트식단"이 맛집으로 새지 않게).
 *   ② 음식은 창업(B2B)→카페→맛집(매장/리뷰)→푸드(요리/레시피 크리에이터) 순으로 세분.
 *   ③ 넓은 단어(맛있/음식 등)는 캐주얼 언급까지 잡아 오탐 → **강한 신호만** 사용.
 * SEED 수집 카테고리 14종 전부 + 카페 = 15종을 콘텐츠로 분류(과거엔 9종만 있어 운동/반려/리빙/IT/취미/푸드
 * 채널이 규칙에 없어, 소개글의 스치는 음식어에 걸려 맛집으로 오분류됐음). 인바운드 신청 폼과 정합.
 */
const RULES: { cat: string; re: RegExp }[] = [
  // ── 🛒 공동구매/라이브공구 (2026-07-29 대표 지시 — 이 축을 새로 모집) ──
  //   다른 규칙보다 **먼저** 본다: 이건 주제(뷰티/맛집)가 아니라 **행위**(자기 팔로워에게 직접 판다)이고,
  //   유어딜 링크샵 전환에는 그 행위가 주제보다 강한 신호다("뷰티 공구"는 뷰티 리뷰어보다 공구 셀러에 가깝다).
  //   ⚠️ **동음이의어 함정**: 맨 '공구'는 工具(전동공구·공구상가·공구함)와 겹친다. 반드시 공동구매 문맥이
  //   붙은 형태만 잡는다(`공구 오픈/진행/마감/링크/…` · `인스타/블로그/맘카페 공구`). bare '공구' 금지.
  //   ⚠️ bare '라방'도 금지 — 게임/소통 방송에서 더 흔하다(커머스 신호 아님).
  {
    cat: '공동구매',
    // ⚠️ `공구\s*중` 은 **중고**(工具 중고거래)를 삼키므로 부정전방탐색으로 뺀다 — 확장하다 실제로 뚫렸던 자리.
    re: /공동\s*구매|공구\s*(오픈|진행|마감|링크|신청|일정|후기|가격|공지|예약|안내|템)|공구\s*중(?!고)|(인스타|블로그|맘카페|카페|스토어|밴드|카톡|오픈채팅|맘|라방)\s*공구|(최저가|특가|한정|시즌)\s*공구|(뷰티|화장품|식품|반찬|간식|육아용품|리빙|패션)\s*공구|쇼핑\s*라이브|라이브\s*커머스|라이브\s*판매|그립\s*(라이브|방송)|공구\s*(전문|셀러|진행자)/i,
  },
  // ── 뷰티 계열(네일이 뷰티의 부분집합 → 먼저) ──
  { cat: '네일', re: /네일|nail\s*art|젤네일|손톱\s*아트|패디큐어|pedicure/i },
  // ── 사람/생활 니치(맛집보다 먼저 — 반려간식·이유식·다이어트식단이 맛집으로 새는 것 방지) ──
  { cat: '반려동물', re: /반려|강아지|고양이|댕댕|냥이|멍멍|반려견|반려묘|\bpet\b|puppy|kitten|수의사|동물병원/i },
  { cat: '육아', re: /육아|맘스타|아기(?!자기)|신생아|이유식|유아|키즈|워킹맘|엄마표|육아맘|출산|\bkids\b|toddler/i }, // '아기자기' 오탐 제외
  { cat: '뷰티', re: /뷰티|뷰튜버|메이크업|화장품|코스메틱|스킨케어|헤어(?!지|져|질)|미용|피부\s*관리|퍼스널\s*컬러|beauty|makeup|cosmetic|cosmetolog|skincare|\bhair(?!line)|\bsalon\b/i }, // '헤어지다/헤어질'·'hairline' 오탐 제외. \bhair 는 'chair' 를 경계로 배제
  { cat: '운동', re: /홈트|헬스|다이어트|요가|필라테스|피트니스|바디\s*프로필|스트레칭|크로스핏|(?<!이)러닝(?!\s*타임|타임)|헬스장|workout|fitness|\bgym\b|pilates/i }, // '러닝타임'·'이러닝' 오탐 제외
  // ── 음식 계열(창업 B2B → 카페 → 맛집(매장/리뷰) → 푸드(요리/레시피 크리에이터)) ──
  { cat: '외식창업', re: /외식업|자영업|소상공인|식당\s*(창업|사장|운영)|카페\s*창업|장사\s*노하우|매장\s*마케팅|요식업|음식점\s*사장|가게\s*운영|창업\s*(일기|스토리|브이로그|기)/i },
  { cat: '카페', re: /카페(?!인|트|24)|디저트|베이커리|빵집|브런치|커피|\bcafe\b|dessert|bakery|로스터리/i }, // 카페인·카페트·카페24(쇼핑몰 솔루션) 오분류 제외
  { cat: '맛집', re: /맛집|먹방|맛스타|먹스타|맛기행|노포|미슐랭|맛도리|맛투어|식당(?!\s*(창업|사장|운영))|\bfood\b|mukbang|restaurant/i }, // 맛있·음식·요리·레시피 제거(캐주얼 언급 오탐) → 강한 신호만. '식당'은 창업/사장 맥락을 위 규칙에 양보
  { cat: '푸드', re: /요리|레시피|홈쿠킹|집밥|베이킹|쿠킹|홈카페|자취요리|간편식|밀프렙|에어프라이어|cooking|recipe|baking/i },
  // ── 여행/숙박 ──
  { cat: '숙소', re: /숙소|호텔|펜션|리조트|글램핑|풀빌라|스테이(?!지)|게스트하우스|모텔|hotel|pension|airbnb|resort/i }, // '스테이지' 오탐 제외
  { cat: '여행', re: /여행|트래블|travel|배낭|투어|나들이|해외여행|국내여행|캠핑|백패킹|세계\s*(일주|한바퀴)|\btrip\b/i },
  // ── 스타일/생활/기타(넓음 → 뒤로) ──
  { cat: '패션', re: /패션|스타일링|코디|옷장|데일리룩|하울|fashion|ootd|스트릿|룩북|lookbook/i },
  { cat: '리빙', re: /인테리어|살림|홈스타일링|정리수납|리빙|집꾸미기|홈데코|셀프\s*인테리어|interior/i },
  { cat: 'IT/재테크', re: /가전\s*리뷰|it\s*리뷰|테크|언박싱|앱\s*추천|재테크|주식(?!회사)|부동산|투자|가상화폐|코인|gadget|unboxing/i }, // bare '리뷰' 금지 + '주식회사'(사업자 정보 관용구) 오탐 제외
  { cat: '취미', re: /캘리그라피|드로잉|그림\s*그리기|독서|책\s*(리뷰|과|을|읽)|공예|\bdiy\b|플랜테리어|사진\s*(촬영|기술)|악기\s*연주|낚시|등산\s*브이로그/i }, // '책상' 은 매치 안 됨(뒤 글자 한정)
]

/**
 * 🏷️ 이 분류기가 **만들어낼 수 있는** 카테고리 전체 — RULES 에서 파생(두 벌로 두면 갈라진다).
 *
 *   왜 export 하는가: 서버가 분류하는 축이 어드민 필터 목록에 없으면 **그 축으로 수집된 사람을
 *   화면에서 고를 수 없다**(수집은 되는데 안 보이는 반쪽 상태 — 가장 조용한 실패).
 *   실사고 2건: ① 2026-07-29 '공동구매' 신설 시 UI 목록 미갱신 ② 같은 날 실측에서 **'카페' 4,675명
 *   (풀의 12%)이 필터에 없어 통째로 안 보이고 있었다** — 기존 가드가 *우선 카테고리만* 봐서 놓쳤다.
 *   ⇒ 유닛이 이 목록 ⊆ `POOL_CATEGORIES` 를 강제한다(규칙을 늘리면 화면도 따라오게).
 */
export const CLASSIFIED_CATEGORIES: string[] = Array.from(new Set(RULES.map(r => r.cat)))

/** 실제 카테고리로 인정 안 하는 값(키워드 상속의 부산물) — 재분류 대상 판정에 사용. */
export const NON_CATEGORIES = new Set(['자동', '일반', '', null as unknown as string])

/**
 * 이름+소개글로 카테고리 판정. 신호 없으면 null(호출부가 키워드 카테고리 폴백).
 *   첫 매치 승 — RULES 순서가 우선순위(구체적 신호 먼저).
 */
export function classifyCategory(name: string, description?: string | null): string | null {
  const text = `${name} ${description || ''}`
  for (const r of RULES) if (r.re.test(text)) return r.cat
  return null
}

// 빈도 계산용 global 사본(모듈 로드 시 1회). 원본 RULES 는 첫-매치-승이라 `g` 를 붙이면 안 된다(lastIndex 오염).
const RULES_G = RULES.map(r => ({ cat: r.cat, re: new RegExp(r.re.source, r.re.flags.replace(/g/g, '') + 'g') }))

/**
 * 🔢 **빈도 기반** 분류 — 글 본문처럼 **긴 텍스트 전용**.
 *
 * ## 왜 별도 함수인가
 * `classifyCategory` 는 **첫 매치 승**이다. 이름·소개글처럼 짧고 밀도 높은 텍스트엔 맞지만,
 * 글 본문 수천 자에 그대로 쓰면 **스치는 한 단어**가 카테고리를 결정한다
 * (여행 후기에 나온 "카페" 한 번이 그 블로거를 카페 블로거로 만든다).
 * 그래서 본문에는 ① 최소 반복 횟수를 요구하고 ② 가장 많이 걸린 규칙을 고른다.
 *
 * ⚠️ 호출부 규약: 이 값으로 **기존 판정을 덮지 말 것.** `classifyCategory` 가 null 일 때
 *    (= 이름·소개글·제목 어디에도 신호가 없을 때)만 채우는 **폴백**으로 쓴다.
 *    정밀도를 지키면서 재현율만 올리는 방향이고, 반대로 쓰면 조용히 오분류가 늘어난다.
 */
export function classifyCategoryByHits(text: string, minHits = 3): string | null {
  if (!text || text.length < 80) return null   // 짧은 텍스트는 빈도 신호가 의미 없다 — 첫-매치 함수 몫
  let best: { cat: string; hits: number } | null = null
  for (const r of RULES_G) {
    r.re.lastIndex = 0
    let n = 0
    for (;;) {
      const prev = r.re.lastIndex
      if (r.re.exec(text) === null) break
      if (r.re.lastIndex === prev) r.re.lastIndex++   // 빈 매치 방어(무한루프 금지)
      if (++n >= 200) break                            // 병적 입력 상한
    }
    if (n >= minHits && (!best || n > best.hits)) best = { cat: r.cat, hits: n }  // 동점은 RULES 순서(우선순위) 유지
  }
  return best?.cat || null
}

/** 저장 시점 최종 카테고리 — 콘텐츠 신호 우선, 없으면 키워드 카테고리(단 '자동'/'일반'은 null 로). */
export function resolveCategory(name: string, description: string | null | undefined, keywordCat: string | null | undefined): string | null {
  const byContent = classifyCategory(name, description)
  if (byContent) return byContent
  const kc = (keywordCat || '').trim()
  return kc && !NON_CATEGORIES.has(kc) ? kc : null
}

// 🎯 YouTube topicDetails(구글 자체 영상기반 분류)가 구분 가능한 '거친' 카테고리 = topicToCategory 출력 범위.
export const YT_COARSE_CATEGORIES = new Set(['뷰티', '패션', '맛집', '여행', '운동', '반려동물', '취미'])
// 우리 세분 카테고리 → 유튜브가 뭉뚱그리는 상위. 이 관계면 유튜브 상위로 안 덮음(우리가 더 정확: 네일<뷰티, 카페/푸드/외식창업<맛집).
const FINE_PARENT: Record<string, string> = { 네일: '뷰티', 카페: '맛집', 푸드: '맛집', 외식창업: '맛집' }

/**
 * 🧭 최종 카테고리 종합(라이브 재조회/enrichment 용) — 우리 라이브 규칙(liveCat, 15종)을 1차, YouTube 신호(topicCat)를
 *   거친 카테고리 '교정자'로. 과거엔 topicCat 을 빈칸 채움만 했으나, 여기선 적극 교정:
 *   ① 우리 규칙 우선(없으면 저장값). ② 유튜브가 거친 수준에서 불일치하면 교정하되 — 우리가 더 세분(FINE_PARENT)이면 유지,
 *   우리 라이브 규칙이 저장값을 독립 지지하면 유지. ③ 유튜브가 못 판단하는 세분(육아/리빙/IT/숙소 등)은 우리값 유지.
 *   저장값이 있으면 절대 null 로 만들지 않음(정보 소실 방지).
 */
export function reconcileCategory(stored: string | null, liveCat: string | null, topicCat: string | null): string | null {
  const best = liveCat || stored || null
  if (topicCat && topicCat !== best) {
    if (best && FINE_PARENT[best] === topicCat) return best                        // 우리가 더 세분 → 유지
    if (!best) return topicCat                                                     // 미분류 → 유튜브로 채움
    // 🛡️ 2026-07-23 전수조사: '취미'(Hobby)는 유튜브가 매우 광범위하게 붙이는 토픽이라 **교정 권한 없음(채움 전용)** —
    //   About 빈약 채널(liveCat=null)에서 저장된 맛집/뷰티가 취미로 대량 전환되던 파괴적 덮어쓰기 차단.
    if (topicCat === '취미') return best
    if (YT_COARSE_CATEGORIES.has(best)) return liveCat === best ? best : topicCat  // 거친 불일치 → 라이브규칙 지지 없으면 유튜브 교정
  }
  return best
}
