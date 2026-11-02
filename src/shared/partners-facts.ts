/**
 * 🏪 입점 랜딩(/partners)이 쓰는 "지금 살아 있는 값" — 사장님 덱과 **같은 숫자**
 *
 * ■ 왜 파일로 두나
 *   2026-09-13 기획(`docs/business/proposals/three-decks-plan-2026-09.md` §0-5)이 실측한 사고가
 *   이것이다: 대표가 카톡으로 보내는 **PDF 소개서**와 **라이브 랜딩**이 서로 다른 말을 하고 있었다
 *   (`/partners` 는 "수수료 5% 업계 최저", 덱은 10%). 사장님은 PDF 를 받고 사이트를 열어 본다.
 *   두 값이 다른 순간 둘 다 신뢰를 잃는다.
 *
 * ■ 어디가 진짜인가
 *   값의 원본은 `docs/business/proposals/deck-common.mjs` 의 `FACTS` 다(세 소개서가 함께 쓴다).
 *   이 파일은 그 **거울**이고, `partners-facts.test.ts` 가 두 파일을 실제로 읽어 대조한다.
 *   ⇒ 덱의 숫자를 고치면 이 파일도 고쳐야 CI 가 통과한다. 한쪽만 바뀌는 길을 막는 것이 목적이다.
 *
 * ■ 여기에 넣지 않는 것 (기획 §0-4 · §2-6)
 *   성과 수치("매출 N% 증가") · 수익 사례 · "업계 최저" · 자동 승인 · 자동 송금 · 트래픽 약속.
 *   실측 근거가 없거나 코드가 그렇게 동작하지 않는다.
 */

export const PARTNER_FACTS = {
  /** 3P 플랫폼 수수료 — 직접 입점. SSOT `worker/utils/fee-resolver.ts` (fee_platform_pct_3p_direct 기본 10) */
  feeDirect: '10%',
  /** 중개(대행사 경유) 매장. 같은 SSOT */
  feeBrokered: '5%',
  /** 사장님 순수취 — 직접 입점 기준 */
  storeShareDirect: '90%',
  /**
   * 카드 수수료. ⚠️ 대표 2026-09-13 지시: **고정값처럼 쓰지 말 것**(카드사 정책에 따라 변동).
   * 그래서 숫자 앞에 "현재 약" 을 붙이고 변동 가능을 같은 문장에 적는다.
   */
  pgNote: '카드 수수료(현재 약 2.75%, 카드사 정책에 따라 바뀔 수 있음)는 유어딜이 자기 몫 안에서 냅니다.',
  /** 정산 최소 지급액 — `payouts-generate.ts` */
  minPayout: '1만원',
  /** 등록 소요 — 기획 §7-3 확정값(1분·3분·5분 혼용을 이것 하나로 통일) */
  signupMinutes: '10분',

  /** 📏 규모 실측. 정직 고지에 그대로 쓴다.
   * ⚠️ 이 값들은 `docs/business/proposals/deck-common.mjs` 의 FACTS 와 **같아야 한다** —
   *    `partners-landing-2026-09-16.test.ts` R2 가 두 곳을 대조한다(덱만 고치면 푸시가 막힌다).
   * 🔀 2026-10-31 날짜를 둘로 갈랐다: `liveMeasuredAt`(2026-10-12)은 덱이 인플루언서 DB·소개 적립
   *    문장의 기준일로도 쓴다. 판매 중 이용권만 다시 셌으므로 그 날짜를 올리면 **다시 안 센 숫자에
   *    새 날짜가 붙는다.** 정직 고지는 `catalogMeasuredAt` 을 쓴다.
   * 정의(2026-10-31 D1): is_active=1 · deal_only=0 · 이용권 4종 = 165건, 그중 seller_id 있는 것
   *    (실제 매장) 2건(2915 홍대돈까스 · 2919 달빛한스푼). 2026-10-12 는 359건이었다(데모 정리분). */
  liveMeasuredAt: '2026-10-12',
  // 🔄 2026-11-02 — catalogMeasuredAt · activeVouchers · realStores 를 **지웠다**. 어떤 화면도 쓰지 않는 거울이었고
  //    (덱과 같은지 시험만 대조했다), 덱 쪽은 이제 빌드 때 라이브에서 읽는다(src/shared/proposal-live-facts.ts).
  //    거울을 남기면 다시 손으로 고칠 숫자가 된다 — 11-02 에 이미 165 ↔ 라이브 160 으로 어긋나 있었다.

  /**
   * 💴 실계산에 쓰는 **라이브 실제 상품**(id 2915, 홍대돈까스). 데모 시드 가격은 쓰지 않는다 — 기획 §2-5.
   *
   * 🩸 2026-10-06: 종전 앵커 **id 2888**(치즈돈가스 25,000 → 16,500)이 `is_active=0` 이 됐는데
   *    이 화면과 소개서가 *"지금 팔리고 있는 실제 상품"* 이라고 말하고 있었다. 에러가 나지 않아
   *    아무도 신고하지 않는 종류다. ⇒ 앵커를 바꿀 때는 아래 쿼리로 **아직 파는지부터** 확인할 것.
   *    SELECT id,name,price,original_price,is_active FROM products
   *      WHERE seller_id IS NOT NULL AND group_buy_status='active'
   *        AND category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher')
   */
  // 🔗 덱의 셈법 앵커(PROPOSAL_SAMPLE_PRODUCT_ID)와 같은 상품 — 시험이 id·이름을 대조한다. 가격은 이 화면의 계산기 값이다.
  sample: { id: 2915, name: '프리미엄 돈가스 1인 세트', list: 14500, sale: 7500 },

  /** 🤝 소개 트랙 (기획 §0-3 실측). 사장님이 "손님을 더 부르는 법" 으로 보는 숫자 */
  influencerDb: '337,842명',
  influencerReachable: '65,431명',
  /**
   * 첫 카카오·네이버 후기 보너스 — **지금은 운영하지 않는다**(2026-10-12 대표 *"카카오맵 후기 관련
   * 보너스 지금 없어"* · `KAKAO_REVIEW_BONUS_ENABLED=false` · 서버 410). 종전 값 '1,000딜'을
   * 그대로 두면 사장님 덱이 없는 혜택을 약속한다. 다시 켜면 이 값과 덱을 함께 고칠 것.
   */
  reviewBonus: '지금은 운영하지 않음',
  /** 매장이 인플루언서에게 거는 소개비 — 요율은 매장이 정하고 매장이 낸다(상한 없음, 입력검증 90) */
  introNote: '소개비 %는 사장님이 정합니다',

  /** 📞 연락 (기획 §7-6 확정) */
  contactEmail: 'jiwon@ur-team.com',
  kakaoChannel: 'http://pf.kakao.com/_AITdn/chat',
  biz: '리스터코퍼레이션 · 사업자등록번호 479-09-02930',
} as const

/** 수수료율을 숫자로 — 계산기가 문자열을 파싱하지 않게. `feeDirect` 와 갈리면 테스트가 잡는다. */
export const FEE_DIRECT_RATE = 0.1
