/**
 * 🗑️ 안 주는 0.5% 레퍼럴 보너스를 약속하던 자리 전부 (2026-10-15 대표 결재 "0.5% 레퍼럴은 아예 없어") — 주입 매니페스트.
 * 가드: src/tests/unit/ref-bonus-dead-promise-2026-10-15.test.ts
 *
 * 절반이 **반대 방향**이다 — 거짓 약속을 지우다가 소개 귀속·결제 ref 전송·본인추천 차단을
 * 같이 지우는 쪽이 더 조용하고 더 나쁘다(에러가 안 난다).
 */
const TEST = 'src/tests/unit/ref-bonus-dead-promise-2026-10-15.test.ts'
const DETAIL = 'src/pages/GroupBuyDetailPage.tsx'
const GB_TERMS = 'src/pages/GroupBuyTermsPage.tsx'
const INF_TERMS = 'src/pages/InfluencerTermsPage.tsx'
const DISCOVER = 'src/pages/InfluencerDiscoverPage.tsx'

export default [
  {
    name: '[ref05] 🗑️ `?ref=` 배너 플래그를 되살린다',
    file: DETAIL,
    find: '  const qc = useQueryClient()',
    replace: "  const isInfluencerLanding = !!searchParams.get('ref')\n  const qc = useQueryClient()",
    test: TEST,
    why: '플래그가 돌아오면 배너도 따라 돌아온다 — 라이브 보상이 0인데 첫 방문자에게 0.5% 를 약속한다.',
  },
  {
    name: '[ref05] 🗑️ 상세에 0.5% 보너스 문구를 되살린다',
    file: DETAIL,
    find: "              buttonText=\"구매하기\"",
    replace: "              buttonText=\"참여 시 양쪽 0.5% 보너스 딜\"",
    test: TEST,
    why: '원장 referral_bonus 0행 — 한 번도 지급된 적 없는 보상을 공유 링크 첫 화면이 약속한다.',
  },
  {
    name: '[ref05] 🗑️ 약관 제5조에 "회사가 보장" 을 되살린다',
    file: GB_TERMS,
    find: '          <li><strong>진입한 사용자(구매자)에게 지급되는 추천 보너스는 운영하지 않습니다.</strong></li>',
    replace: '          <li>매장이 인플을 차단한 경우에도 사용자 보너스는 회사가 보장 (회사 운영비에서 충당).</li>',
    test: TEST,
    why: '약관은 분쟁 때 꺼내 읽는 문서다 — 안 주는 보상을 회사가 보장한다고 적어 두면 그게 채무다.',
  },
  {
    name: '[ref05] 🗑️ 약관 제6조에 referral 보너스 딜 유효기간을 되살린다',
    file: GB_TERMS,
    find: '          <li>이벤트 / 보너스 딜은 별도 유효기간 (보통 1년).</li>',
    replace: '          <li>이벤트 / referral / 보너스 딜은 별도 유효기간 (보통 1년).</li>',
    test: TEST,
    why: '지급된 적 없는 딜의 유효기간을 약관이 규정한다 — 그 보상이 있다는 뜻으로 읽힌다.',
  },
  {
    name: '[ref05] 🗑️ 약관 제1조 적용 범위에 "referral 보너스" 를 되살린다',
    file: GB_TERMS,
    find: '결제·voucher 사용·환불·추천 링크를 규정합니다.',
    replace: '결제·voucher 사용·환불·referral 보너스를 규정합니다.',
    test: TEST,
    why: '제5조만 고치면 머리 조항이 낡는다 — 약관이 없는 제도를 "규정한다" 고 선언한다(렌더로 눈 확인하다 찾았다).',
  },
  {
    name: '[ref05] 🗑️ 약관 제재 조항의 "부정 referral" 을 되살린다',
    file: GB_TERMS,
    find: '<li>다중 계정 / 부정한 추천 링크 사용 (소개비 편취).</li>',
    replace: '<li>다중 계정 / 부정 referral.</li>',
    test: TEST,
    why: '같은 클래스 — 제재 대상이 존재하지 않는 "referral(보너스)" 을 가리킨다.',
  },
  {
    name: '[ref05] 🗑️ 인플 카탈로그 공유 문구에 보너스 약속을 되살린다',
    file: DISCOVER,
    find: '      text: `${product.restaurant_name || \'\'} ${product.name}`,',
    replace: '      text: `${product.restaurant_name || \'\'} ${product.name} 공동구매 — 친구 추천 시 양쪽 보너스`,',
    test: TEST,
    why: 'navigator.share 로 나가는 글이라 카톡방에 박힌다 — 회수할 방법이 우리에게 없다.',
  },
  {
    name: '[ref05] 🔒 반대 방향 — `?ref=` 저장 effect 를 지운다',
    file: DETAIL,
    find: "  useEffect(() => { storeAffiliateRef(searchParams.get('aff') || searchParams.get('ref')) }, [searchParams])",
    replace: '  // (effect 제거)',
    test: TEST,
    why: '배너를 지우면서 같이 지우기 쉬운 자리다 — 소개 귀속이 통째로 깨지는데 에러가 0이다(2026-07-11 §R2 가 고친 그 사고).',
  },
  {
    name: '[ref05] 🔒 반대 방향 — 결제 때 ref 전송을 지운다',
    file: DETAIL,
    find: "          quantity, payment_method: 'deal', ref, idempotency_key,",
    replace: "          quantity, payment_method: 'deal', idempotency_key,",
    test: TEST,
    why: '살아 있는 레일(매장이 건 딜 소개비)이 이 ref 로만 귀속된다 — 안 보내면 소개자가 무적립이다.',
  },
  {
    name: '[ref05] 🔒 반대 방향 — 약관의 본인 추천 차단 조항을 지운다',
    file: GB_TERMS,
    find: '          <li>본인 추천 (?ref=내ID) 차단 — 적발 시 소개비 미지급·회수 + 계정 정지.</li>',
    replace: '',
    test: TEST,
    why: '실제로 막고 계정 정지까지 하는 규칙인데(affiliate-credit self_referral) 약관에 근거가 없어진다.',
  },
  {
    name: '[ref05] 🔒 반대 방향 — 두 약관을 다시 갈라 놓는다',
    file: INF_TERMS,
    find: '<li>사용자 친구 추천 보너스는 별도 프로그램이며 현재 운영하지 않습니다.</li>',
    replace: '<li>사용자 친구 추천 보너스는 별도 프로그램입니다.</li>',
    test: TEST,
    why: '수리 전 상태 — 공구 약관과 인플 약관이 같은 프로그램을 두고 반대로 말했다.',
  },
  {
    name: '[ref05] 🧪 잠금표 계약 — SSR 시드 소비를 중성화한다',
    file: DETAIL,
    find: '() => pickSeedDetail<GroupBuyDetail>(Number(id), {',
    replace: '() => false ? pickSeedDetail<GroupBuyDetail>(Number(id), {',
    // 🔁 이 주입은 **기존** 가드가 잡는다(`pass-description-ssot` :163 · `pass-share-card-ssot` :142 가
    //    이미 `useMemo` 본문 **모양**을 고정한다). 내 시험에 세 번째 사본을 넣으면 중복 잠금이 되어
    //    어느 쪽도 출력으로 판정할 수 없다 — 그래서 여기서는 그 가드를 가리킨다.
    //    내 시험이 지키는 것은 **개수**(배너를 지우면서 같이 지우지 않았다)이고, 둘은 다른 불변식이다.
    test: 'src/tests/unit/pass-description-ssot-2026-10-15.test.ts',
    why: '배너를 지우면서 0-RTT 첫 화면을 같이 죽이는 쪽 — 화면은 멀쩡하고 느려질 뿐이라 안 보인다.',
  },
]
