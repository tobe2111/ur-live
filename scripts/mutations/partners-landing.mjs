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
