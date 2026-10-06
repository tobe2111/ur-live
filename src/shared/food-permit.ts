/**
 * 🍽️ 영업신고증이 필요한 업종인가 — **화면에 표시할 힌트**를 만드는 한 자리.
 *
 * 2026-09-21 대표 확정 둘:
 *   1. *"1번은 알겠어. 판매 전으로 하자."* — 영업신고증은 **판매가 시작되기 전**에 본다.
 *      유어딜에서 판매가 시작되는 순간은 어드민이 **승인 버튼을 누를 때**다.
 *   2. *"등록증이 없어도 승인 되게끔 해줘. 어차피 내가 보고 승인해야하잖아."* —
 *      ⇒ **코드가 서류로 승인을 막지 않는다.** 이 파일도 아무것도 막지 않는다.
 *
 * ## 🚧 그래서 이 함수가 하는 일은 딱 하나
 * 승인 화면에 *"이 매장은 음식을 파는 것 같습니다 — 영업신고증을 보세요"* 라고 **띄우는 것**.
 * 판단은 사람이 한다.
 *
 * ## ⚠️ 이건 법 해석이 아니다
 * 어느 업종이 식품위생법상 영업신고 대상인지는 **세션이 단정할 영역이 아니다**(대표·전문가 판단).
 * 여기 규칙은 *"화면에 한 줄 띄울지"* 를 고르는 휴리스틱이고, 틀려도 **승인을 막지 않으므로**
 * 최악의 결과는 "안 띄웠어야 할 곳에 안내가 한 줄 떴다" 이다.
 *
 * ## 무엇을 보고 판단하나
 * 가입 문과 매장 등록 문이 **둘 다** 남기는 값을 본다(2026-09-21 안 B 이후):
 *   · `store_category` — 우리 8종 (`restaurant`·`cafe` …)
 *   · `kakao_category` — 카카오 원문 (`음식점 > 한식 > 육류,고기 > 갈비`)
 * 둘 중 하나만 있어도 판단한다. 둘 다 없으면 `false`(= 안 띄운다 — 모르면 조용히).
 */

/** 우리 8종 중 음식을 파는 것. `STORE_CATEGORIES`(RegisterFields) 의 부분집합이다. */
const FOOD_STORE_CATEGORIES = new Set(['restaurant', 'cafe'])

/** 카카오 업종 원문에서 음식 계열을 가리키는 말. 좁은 것부터 볼 필요가 없다(있기만 하면 참). */
const FOOD_KAKAO_WORDS = /음식점|카페|베이커리|제과|디저트|주점|술집|분식|치킨|피자/

export function needsFoodPermit(
  storeCategory?: string | null,
  kakaoCategory?: string | null,
): boolean {
  const ours = String(storeCategory || '').trim()
  if (ours && FOOD_STORE_CATEGORIES.has(ours)) return true
  const kakao = String(kakaoCategory || '').trim()
  if (kakao && FOOD_KAKAO_WORDS.test(kakao)) return true
  return false
}
