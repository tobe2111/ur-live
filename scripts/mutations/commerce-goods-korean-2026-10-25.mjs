/**
 * 🏷️ 통신판매 업종 분류 — 한글 필드 우선 (2026-10-25) · 주입 매니페스트.
 *
 * 이 조가 막는 것은 **코드 필드가 한글 필드를 가리는 것**이다(라이브: 그 순서 하나 때문에 발송 가능
 * 리드의 93%가 `'통신판매'` 한 라벨이었다). 그리고 반대 방향 — **추측 라벨을 심는 것** — 도 막는다.
 *
 * 가드: src/tests/unit/commerce-goods-korean-2026-10-25.test.ts
 */
const TEST = 'src/tests/unit/commerce-goods-korean-2026-10-25.test.ts'
const SRC = 'src/features/marketing/api/commerce-notify-collect.ts'

export default [
  {
    name: '업종한글 🔤 별칭 순서가 되돌아간다(코드가 앞 → 한글을 영영 못 본다)',
    file: SRC,
    find: "  const goods = g(it, 'ntslPrdlstCn', 'trtmntPrdlstNm',",
    replace: "  const goods = g(it, 'trtmntPrdlstNm', 'ntslPrdlstCn',",
    test: TEST,
    why: '수리 전 라이브 그대로다 — `trtmntPrdlstNm` 은 `\'01 02\'` 로 **비어 있지 않아** 거기서 멈추고, 분류기는 한글 정규식이라 한 건도 안 맞아 전부 `\'통신판매\'` 가 된다. 에러 0건·수집량 불변이라 **아무 신호가 없다**(발송 가능 리드 93.0% = 58,389/62,757 이 그 상태였다).',
  },
  {
    name: '업종한글 🗑️ 한글 별칭이 목록에서 사라진다',
    file: SRC,
    find: "'ntslPrdlstCn', 'trtmntPrdlstNm',",
    replace: "'trtmntPrdlstNm',",
    test: TEST,
    why: '한글 출처를 통째로 빼면 코드만 남아 같은 고착으로 돌아간다. "정리" 하면서 중복처럼 보이는 별칭을 지우는 방향을 막는다 — 둘은 **같은 뜻의 다른 표기**이고 한쪽만 오는 레코드가 있다(status 에는 한글이 없다).',
  },
  {
    name: '업종한글 🥇 종합몰 항목이 사라진다(합성 문자열이 좁은 업종으로 간다)',
    file: SRC,
    find: "  ['종합몰', /종합몰|종합 ?쇼핑|백화점/],\n",
    replace: '',
    test: TEST,
    why: "실측 문자열 `'종합몰 교육/도서/완구/오락'` 은 코드 `'01 02'` 가 합쳐진 것이다. 가장 포괄적인 라벨이 없으면 뒤쪽 낱말 하나(`완구`)에 걸려 **유아동**으로 오분류된다 — 틀린 업종 라벨은 승격 뒤 코드 롤백으로 안 지워진다.",
  },
  {
    name: '업종한글 📚 도서·문구가 유아동 뒤로 밀린다(완구가 교육·도서를 가로챈다)',
    file: SRC,
    find: "  ['도서·문구', /교육|학습|도서|서적|문구|사무용품|음반|교재|오락/],\n  ['패션·잡화'",
    replace: "  ['패션·잡화'",
    test: TEST,
    why: '순서가 곧 우선순위다. 코드 02 단독(`교육/도서/완구/오락`)에서 `완구`(유아동)가 먼저 걸리면 교육·도서 업체가 유아동으로 분류된다 — 대표가 업종으로 필터링할 값이라 그 오분류가 그대로 영업 대상 선정을 틀리게 만든다.',
  },
  {
    name: '업종한글 🧾 판매방식도 코드가 앞으로 돌아간다',
    file: SRC,
    find: "  const method = g(it, 'ntslMthdCn', 'ntslMthdNm')",
    replace: "  const method = g(it, 'ntslMthdNm')",
    test: TEST,
    why: "`ntslMthdNm` 은 `'02 03'`, `ntslMthdCn` 은 `'인터넷 카탈로그'` 다. 분류에 쓰지는 않지만 `description` 에 남는 원문이라, 코드만 저장하면 사람도 다음 세션도 그 값을 읽을 수 없다.",
  },
  {
    name: '업종한글 📝 원문이 description 에서 빠진다(분포를 못 봐 표를 넓힐 수 없다)',
    file: SRC,
    find: '      goods && `취급 ${goods.slice(0, 120)}`,\n',
    replace: '',
    test: TEST,
    why: '나머지 코드(03~12)의 한글 라벨은 **회차가 쌓이며 description 에 모이는 것**이 유일한 관측 경로다(이 환경은 공정위 도메인이 막혀 직접 못 받는다). 여기서 빠지면 표를 넓힐 근거가 사라지고, 다음 세션이 기억으로 추측 라벨을 적게 된다.',
  },
  {
    name: '업종한글 🚫 추측 라벨을 표에 심는다(반대 방향)',
    file: SRC,
    find: "  ['종합몰', /종합몰|종합 ?쇼핑|백화점/],",
    replace: "  ['종합몰', /종합몰|종합 ?쇼핑|백화점/],\n  ['성인', /성인|상품권/],",
    test: TEST,
    why: '어제 상호명으로 역추론한 코드 09(성인?)·11(상품권?)은 **합쳐 8건 표본의 추측**이다. 그 라벨을 넣으면 거짓 라벨이 되고, `ON CONFLICT` 가 총칭만 승격하고 그 뒤로는 보존하므로 **코드 롤백으로 안 지워진다**(데이터 UPDATE = 별도 결재). 2026-10-24 인계: *"틀린 라벨은 `통신판매` 보다 나쁘다."*',
  },
]
