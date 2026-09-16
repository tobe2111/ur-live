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
    find: `            그래서 얼마 남나`,
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
    file: 'src/pages/partners/PartnerPaths.tsx',
    find: `          어느 길이든 사업자등록번호는 국세청에 자동으로 조회됩니다. 등록증 사본은 사람이 한 번 보고 승인합니다.`,
    replace: `          어느 길이든 사업자등록번호만 맞으면 자동 승인됩니다.`,
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
    find: `    d: '소개해 준 사람별로 몇 건이 팔렸고 소개비가 얼마 나갔는지가 쌓입니다.`,
    replace: `    d: '소개해 준 사람별로 몇 명이 눌렀고 소개비가 얼마 나갔는지가 쌓입니다.`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      'influencer_attributions(migration 0247)는 order_id·voucher_id·commission_amount 를 담는다. ' +
      '**결제 건**이지 클릭이 아니다. 클릭 수는 어디에도 안 쌓이므로 "몇 명이 눌렀는지" 는 ' +
      '사장님이 화면에서 찾다가 없는 것을 발견하게 되는 문장이다.',
  },
  {
    name: '🏪 꺼진 공구 엔진을 랜딩이 약속한다',
    file: 'src/pages/partners/PartnerBenefits.tsx',
    find: `    k: '가입비 0원, 월 이용료 0원, 광고비 0원',`,
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
    find: `      <div className="ur-content-wide mx-auto px-5 lg:px-10 py-16 lg:py-28">`,
    replace: `      <div className="px-5 lg:px-10 py-16 lg:py-28">`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '액자를 벗기면 폭 제한은 페이지 자신이 져야 한다. 없으면 1920 모니터에서 표 한 줄이 ' +
      '화면 끝까지 늘어나 읽을 수 없게 된다 — 액자를 푸는 변경과 짝을 이루는 불변식이다.',
  },
  {
    name: '🏪 안 B 가 사라진다 (사진 0장으로 회귀)',
    file: 'src/pages/partners/PartnerTools.tsx',
    find: `              <PartnerPhone src={SHOT(shot)} alt={cap} />`,
    replace: `              <span />`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '대표가 1차 판을 보고 "지금 디자인이라곤 뭐가 없네" 라고 한 것의 정체는 취향이 아니라 ' +
      '**사진 0장**이었다(1440 실측 `main img` 0개). 2026-09-16 에 안 B(라이브 캡처 + 폰 프레임)로 ' +
      '확정했고, 히어로만 남기고 아래를 지우면 조용히 그 상태로 돌아간다.',
  },
  {
    name: '🏪 캡처 경로가 다시 /partners/*.jpg 로 돌아간다 (라이브 404)',
    file: 'src/pages/partners/PartnerPhone.tsx',
    find: `export const SHOT = (n: string) => \`/static/partners/\${n}.jpg\``,
    replace: `export const SHOT = (n: string) => \`/partners/\${n}.jpg\``,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '실제로 났던 사고다. `public/_routes.json` 은 `/*` 를 전부 워커로 보내고 **명시 목록만** ' +
      '정적으로 뺀다. `/partners/*.jpg` 는 그 목록에 없어 워커로 갔고 404 가 났다 — 빌드도 ' +
      '타입체크도 통과하고 **라이브에서만** 프레임이 하얗게 남는다.',
  },
  {
    name: '🏪 PC 타이포가 모바일 치수로 되돌아간다',
    file: 'src/pages/partners/PartnerCompare.tsx',
    find: `        <h2 className="text-[26px] lg:text-[40px] xl:text-[46px] font-extrabold tracking-[-0.03em] text-ink leading-[1.2] max-w-[14em]">`,
    replace: `        <h2 className="text-[23px] lg:text-[38px] font-extrabold tracking-[-0.02em] text-ink leading-[1.28] max-w-[14em]">`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '대표 *"PC 버전은 전혀 PC 버전 같지 않은데?"* 의 절반이 이것이었다 — 1440px 에서도 제목이 ' +
      '38px 이라 화면이 "잘 정리된 문서" 로 읽혔다. 한 섹션만 되돌려도 리듬이 깨지므로 ' +
      '섹션별로 하한을 건다.',
  },
  {
    name: '🏪 히어로 폰이 다시 섹션 밖으로 잘린다',
    file: 'src/pages/partners/PartnerHero.tsx',
    find: `              className="w-[38%] max-w-[12.5rem] lg:w-[44%] lg:mb-12" />`,
    replace: `              className="w-[38%] max-w-[12.5rem] lg:absolute lg:w-[54%] lg:-right-2 lg:bottom-[-2.5rem]" />`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '1차에서 실제로 그랬다. 섹션이 `overflow-hidden` 이라 폰 아랫부분이 잘렸고, 랜딩에서 ' +
      '잘린 스크린샷은 의도가 아니라 **고장**으로 읽힌다.',
  },
  {
    name: '🏪 장점 섹션에 01/02/03 번호가 돌아온다',
    file: 'src/pages/partners/PartnerBenefits.tsx',
    find: `              <p className="text-[21px] lg:text-[32px] xl:text-[36px] font-extrabold text-ink leading-[1.3] tracking-[-0.025em]">{k}</p>`,
    replace: `              <p className="text-[13px] font-extrabold text-brand-text tabular-nums">0{i + 1}</p>
              <p className="text-[21px] lg:text-[32px] xl:text-[36px] font-extrabold text-ink leading-[1.3] tracking-[-0.025em]">{k}</p>`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '대표가 *"AI 가 만든 디자인"* 이라고 한 화면에서 가장 큰 단일 원인이었다. anti-slop 스킬이 ' +
      '"section-number eyebrow" 로 이름 붙여 금지한 그림이고, 순서에 뜻이 없는 셋이라 번호는 ' +
      '아무것도 안 알려 주는 장식이다.',
  },
  {
    name: '🏪 h1 이 다시 "…입니다" 완결문이 된다',
    file: 'src/pages/partners/PartnerHero.tsx',
    find: `            <span className="text-brand-text">계산하는 손님</span>`,
    replace: `            <span className="text-brand-text">계산하는 손님</span>을 부르는 방법입니다`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '2차 판의 제목 아홉 개가 전부 "-습니다/-입니다" 로 끝났고, 그 균일함이 대표가 지적한 ' +
      '말투의 정체였다. h1 이 그 클래스의 대표 사례다 — *"…부르는 방법입니다"* 에서 뒤 네 글자는 ' +
      '뜻을 안 보태고 말투만 얹었다. 페이지 전체가 되돌아가는 경우는 한 줄 주입으로 못 만들지만, ' +
      'h1 한 줄은 만들 수 있고 그 자리가 가장 많이 읽힌다.',
  },
  {
    name: '🏪 캡션 회색이 다시 옅어진다 (AA 미달)',
    file: 'src/pages/partners/PartnerCompare.tsx',
    find: `              <p key={i} className="text-[13px] font-bold text-gray-500 dark:text-gray-400">{h}</p>`,
    replace: `              <p key={i} className="text-[13px] font-bold text-gray-400 dark:text-gray-500">{h}</p>`,
    test: 'src/tests/unit/partners-landing-2026-09-16.test.ts',
    why:
      '대표 신고 당시 이 짝이 라이트 3.21~3.65 · 다크 3.10~3.48 로 **두 테마 모두** AA(4.5) 미달이었다 ' +
      '(1440 렌더 · 알파 합성 실측). 다크만의 문제로 오해하기 쉬운데 처음부터 안 읽히는 회색이었고, ' +
      '표 머리·캡션·주석처럼 "작아도 읽어야 하는" 자리에 쓰여 있었다.',
  },
]
