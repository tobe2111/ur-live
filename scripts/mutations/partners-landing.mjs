/**
 * 🧬 입점 랜딩(/partners) — 되돌려-검증 주입 (2026-09-16).
 *
 * 지키는 규칙 넷은 `src/tests/unit/partners-landing-2026-09-16.test.ts` 머리말에 있다.
 * 여기서 확인하는 것은 **그 테스트가 실제로 실패할 수 있는가** 다 — 이 레포가 반복해 당한 사고는
 * "검사가 실패한다"가 아니라 **"검사가 실패할 수 없다"** 였다.
 */
export default [
  {
    name: '🏪 /partners 가 다시 430px 소비자 액자에 갇힌다',
    file: 'src/components/MobileAppLayout.tsx',
    find: `  '/partners',\n]`,
    replace: `]`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '이 한 줄이 빠지면 입점 검토하러 온 사장님 화면이 폰 폭으로 접히고, 빈 거터를 ' +
      'ConsumerFrameRails(홈·교환권·유어샵 바로가기 + 앱 설치 QR)가 채운다. ' +
      '에러가 나지 않고 "모바일 최적화" 처럼 보여서 아무도 신고하지 않는다 — 실제로 그랬다.',
  },
  {
    name: '🏪 랜딩 수수료가 덱과 갈린다 (5% 로 되돌아감)',
    file: 'src/shared/partners-facts.ts',
    find: `  feeDirect: '10%',`,
    replace: `  feeDirect: '5%',`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '기획 §0-5 가 실측한 그 사고. 사장님은 카톡으로 받은 PDF(10%)와 사이트(5%)를 나란히 본다. ' +
      '둘이 다른 순간 숫자 하나가 아니라 문서 전체의 신뢰가 없어진다.',
  },
  {
    name: '🏪 계산기 요율이 표기와 갈린다',
    file: 'src/shared/partners-facts.ts',
    find: `export const FEE_DIRECT_RATE = 0.1`,
    replace: `export const FEE_DIRECT_RATE = 0.05`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '화면엔 "유어딜 수수료 10%" 라고 쓰여 있는데 그 아래 숫자는 5% 로 계산된다. ' +
      '사장님이 첫 정산에서 발견한다. 표기와 계산은 한 값에서 나와야 한다.',
  },
  {
    name: '🏪 금지된 표시광고 문구가 들어온다 ("업계 최저")',
    file: 'src/pages/partners/PartnerMath.tsx',
    find: `            여기는 손님이 돈을 내고 옵니다`,
    replace: `            업계 최저 수수료입니다`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '기획 §0-4 가 금지한 문구. 근거 없는 최상급은 표시광고법 위험이고, 이 랜딩에 실제로 ' +
      '2026-09-15 까지 살아 있었다("수수료 5% 업계 최저").',
  },
  {
    name: '🏪 시작하는 길이 다시 하나로 줄어든다',
    file: 'src/pages/partners/PartnerPaths.tsx',
    find: `    title: '유어딜이 대신',`,
    replace: `    title: '유어딜이 대신 (숨김)',`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '"저희가 대신 등록해 드립니다" 가 사라지면, 폰으로 가게를 등록해 본 적 없는 사장님에게는 ' +
      '문이 없다. 이전 랜딩이 정확히 그 상태였다(길이 "셀러 가입하기" 하나뿐).',
  },
  {
    name: '🏪 정직 고지가 사라진다 (초기 서비스라는 사실)',
    file: 'src/pages/partners/PartnerFaq.tsx',
    find: `            유어딜은 초기 서비스입니다.`,
    replace: `            유어딜과 함께하세요.`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '세 소개서(사장님·인플루언서·대행사)가 **같은 문장**으로 쓰기로 한 공통 블록이다. ' +
      '랜딩만 빼면 PDF 를 받은 사장님이 사이트에서 다른 태도를 본다.',
  },
  {
    name: '🏪 "자동 승인" 이 랜딩에 들어온다 (라이브는 수동 승인)',
    file: 'src/pages/partners/PartnerTools.tsx',
    find: `    t: '사업자번호는 국세청에 자동으로 조회됩니다',`,
    replace: `    t: '사업자번호만 맞으면 자동 승인됩니다',`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      'seller-registration.routes.ts:239 이 명시한다 — "자동승인 말고 수동 승인. 모든 사업자 가입은 ' +
      '어드민 수동 승인." 국세청 결과는 승인 화면의 참고 신호로만 저장된다. 랜딩이 "당일 판매" 를 ' +
      '약속하면 사장님은 가입하고 기다리다가 속았다고 느낀다.',
  },
  {
    name: '🏪 예약솔루션과의 축("새 손님")이 흐려진다',
    file: 'src/pages/partners/PartnerCompare.tsx',
    find: `  { k: '예약, 포스 솔루션', cells: ['매달 구독료 선지불', '이미 오기로 한 손님', '온 손님 관리. 새 손님은 각자 알아서'] },`,
    replace: `  { k: '예약, 포스 솔루션', cells: ['매달 구독료 선지불', '손님', '매장 관리'] },`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '이 행의 존재 이유가 그 대비다 — 예약솔루션은 **온 손님을 관리**하고 유어딜은 **새 손님을 데려온다**. ' +
      '축이 흐려지면 사장님 눈에 "또 하나의 매장 솔루션" 으로 읽히고, 그 순간 이 페이지는 설득을 멈춘다.',
  },
  {
    name: '🏪 인플루언서 성과를 "유입 몇 명" 으로 부풀린다',
    file: 'src/pages/partners/PartnerTools.tsx',
    find: `    d: '소개해 준 사람별로 몇 건이 팔렸고 소개비가 얼마 나갔는지가 매장 화면에 쌓입니다.`,
    replace: `    d: '소개해 준 사람별로 몇 명이 눌렀고 소개비가 얼마 나갔는지가 매장 화면에 쌓입니다.`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      'influencer_attributions(migration 0247)는 order_id·voucher_id·commission_amount 를 담는다. ' +
      '**결제 건**이지 클릭이 아니다. 클릭 수는 어디에도 안 쌓이므로 "몇 명이 눌렀는지" 는 ' +
      '사장님이 화면에서 찾다가 없는 것을 발견하게 되는 문장이다.',
  },
  {
    name: '🏪 꺼진 공구 엔진을 랜딩이 약속한다',
    file: 'src/pages/partners/PartnerBenefits.tsx',
    find: `    k: '선불 비용 0원',`,
    replace: `    k: '기간한정 공구를 원할 때 켜고 끕니다',`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      'GB_ENGINE_ENABLED = false. 공구 엔진(기간한정·링크 전용가·인플루언서 딜 제안)은 코드가 ' +
      '완성돼 있지만 표면이 꺼져 있어 사장님이 오늘 쓸 수 없다. 대표가 2026-09-16 에 ' +
      '"공구 내용은 빼줘" 로 확정했다. 켜지기 전에 되돌아오는 길을 막는다.',
  },
  {
    name: '🏪 섹션이 폭 제한을 잃는다 (액자를 벗은 뒤의 함정)',
    file: 'src/pages/partners/PartnerCompare.tsx',
    find: `      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-14 lg:py-24">`,
    replace: `      <div className="px-5 lg:px-10 py-14 lg:py-24">`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '액자를 벗기면 폭 제한은 페이지 자신이 져야 한다. 없으면 1920 모니터에서 표 한 줄이 ' +
      '화면 끝까지 늘어나 읽을 수 없게 된다 — 액자를 푸는 변경과 짝을 이루는 불변식이다.',
  },
]
