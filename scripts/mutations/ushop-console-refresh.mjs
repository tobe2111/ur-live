/**
 * 🎫 2026-09-29 (대표 *"개선안으로 하고 배고프다 뭐먹지?는 아예 빼기. 소개콘솔도 일단 변경은 해줘"*) 주입 매니페스트.
 *
 * 지키는 것 여섯: **할인율 SSOT · 순번은 사진 밖 · 새 슬롯은 선택 · 이모지 0 · 목록 문법 · 마퀴 부활 금지**.
 * 아래 결함을 심으면 해당 시험이 빨간불이어야 한다. 통과하면 그 가드는 아무것도 안 지키는 것이다.
 */
const T_NEW = 'src/tests/unit/ushop-console-refresh-2026-09-29.test.ts'
const T_TOP = 'src/tests/unit/ushop-top-chrome-2026-09-28.test.ts'
const ROW = 'src/components/deal/DealRow.tsx'
const PIN = 'src/pages/curator-page/PinRow.tsx'
const CONSOLE = 'src/pages/CuratorEarningsPage.tsx'
const HEADER = 'src/pages/curator-page/CuratorHeader.tsx'
const MANAGE = 'src/pages/ushop-manage/ShopInfoCards.tsx'

export default [
  {
    name: '유어샵 — 할인율을 다시 선언값으로 (서버가 0 을 주면 배지가 통째로 사라진다)',
    file: ROW,
    find: '{pd.discount > 0 && (',
    replace: '{discountPct > 0 && (',
    test: T_NEW,
    why:
      '이게 라이브에서 실제로 난 일이다. 유어샵 세 상품이 17·14·23% 할인 중인데 화면엔 **0개**였고, ' +
      '같은 상품이 홈 카드에선 23% 로 떴다(홈은 `priceDisplay` 를 쓰고 이 부품만 안 썼다). ' +
      '에러가 안 나서 아무도 신고하지 않는 종류다 — 화면마다 할인율이 다르면 버그가 아니라 거짓말이다.',
  },
  {
    name: '유어샵 — priceDisplay 호출만 지우고 import 는 남긴다 (헛도는 배선 검사 차단)',
    file: ROW,
    find: '  const pd = priceDisplay({ price, original_price: originalPrice, discount_rate: discountPct })',
    replace: '  const pd = { discount: discountPct, showOriginal: true, price: 0, originalPrice: 0, hasDiscountLine: true }',
    test: T_NEW,
    why:
      '🩸 이 레포가 반복해 당한 함정: 배선 검사를 `toContain(\'priceDisplay\')` 로 쓰면 **import 줄 때문에** ' +
      '호출을 지워도 초록이 뜬다(2026-09-16 에 실제로 네 건). 그래서 시험이 **호출 형태**를 앵커한다.',
  },
  {
    name: '유어샵 — 순번을 다시 사진 위 절대배치로',
    file: PIN,
    find: '      thumbSize="lg"\n      leading={',
    replace: '      thumbSize="lg"\n      trailing={',
    test: T_NEW,
    why:
      '순번을 사진 위로 되돌리면 사진의 가장 좋은 자리를 흰 원이 덮는다 — 2026-08-31 대표 ' +
      '*"할인율이 사진 안으로 들어가면 안돼"* 와 같은 자리다. 순번 **삭제**는 더 나쁘다(SNS 에서 ' +
      '"N번 사세요" 로 부르는 주소라 소개비 귀속이 엉뚱한 상품으로 샌다) — 그래서 시험은 ' +
      '"사진 밖에 있는가" 와 "남아 있는가" 를 **둘 다** 본다.',
  },
  {
    name: 'DealRow — 할인율을 브랜드 블루로 (행동 색과 가격 색이 섞인다)',
    file: ROW,
    find: 'text-[15px] font-extrabold text-sale tracking-tight',
    replace: 'text-[15px] font-extrabold text-brand tracking-tight',
    test: 'src/tests/unit/discount-is-sale-red.test.ts',
    why:
      '할인율은 `--sale` **한 색**이고 브랜드 블루는 *행동* 전용이다(표면 규칙 ②). ' +
      '🩸 그 가드의 렌더 줄 앵커가 이름 목록(`discountPct` 등)이라, SSOT 배선으로 `{pd.discount}%` 가 ' +
      '되자 **검사 대상이 0줄**이 됐다 — 목록을 넓혀 재조준했고 이 주입이 그 재조준을 고정한다. ' +
      '(그 가드는 7개 표면을 보지만 `DealRow` 를 겨누는 주입은 없었다.)',
  },
  {
    name: '유어샵 — 순번의 숫자 폭 고정을 뺀다 (1 과 10 이 나란히 서면 칸이 흔들린다)',
    file: PIN,
    find: 'font-bold tabular-nums text-gray-400',
    replace: 'font-bold text-gray-400',
    test: 'src/tests/unit/ushop-a3-p1.test.ts',
    why:
      '순번이 사진 밖으로 나오면서 "흰 원" 계약이 녹았고, `ushop-a3-p1` 의 그 시험을 **남은 것으로 ' +
      '재조준**했다(순번 존재 + 숫자 폭 고정 + 흰 원 아님). 이 주입은 그 재조준이 실제로 일하는지 본다 — ' +
      '자리·크기는 저쪽 시험이 보므로 여기선 폭 고정만 겨눈다(같은 것을 두 번 재지 않는다).',
  },
  {
    name: 'DealRow — leading 에 기본값을 준다 (나머지 5개 화면에 숫자 칸이 갑자기 생긴다)',
    file: ROW,
    find: "thumbSize = 'md', leading, className = ''",
    replace: "thumbSize = 'md', leading = null, className = ''",
    test: T_NEW,
    why:
      '`DealRow` 는 **6개 화면이 공유**한다(교환권 목록·내 이용권 같은매장·유어샵 핀·인플루언서 탐색· ' +
      '공구 마켓·동네 페이지). 새 슬롯에 기본값이 붙으면 유어샵 하나를 고치려던 변경이 다섯 화면을 ' +
      '같이 바꾼다 — 이 PR 이 "유어샵만" 이라는 전제가 깨진다.',
  },
  {
    name: '소개 콘솔 — 이모지를 다시 넣는다',
    file: CONSOLE,
    find: "<h1 className=\"text-[17px] font-bold\">{t('curator.console.title'",
    replace: "<h1 className=\"text-[17px] font-bold\">🎤 {t('curator.console.title'",
    test: T_NEW,
    why:
      '확정 디자인 시스템 규칙 ⑥(이모지 0). 이 화면에만 12개가 남아 있어서 다른 화면과 따로 놀았다. ' +
      '🩸 첫 판에서 내 grep 이 좁아 셋(💰 🟡 📈)을 놓쳤고 **이 시험이 잡았다** — 그래서 시험은 ' +
      '목록이 아니라 **유니코드 범위**로 센다.',
  },
  {
    name: '소개 콘솔 — 카드에 테두리를 다시 그린다',
    file: CONSOLE,
    find: '<div className="bg-surface shadow-lift rounded-2xl p-4 mb-5">',
    replace: '<div className="bg-surface border border-line rounded-xl p-4 mb-5">',
    test: T_NEW,
    why: '표면 규칙 ①: 카드는 테두리 0 + 들림(`shadow-lift`) 한 값. 선을 그리면 면이 둘로 안 나뉜다.',
  },
  {
    name: '소개 콘솔 — 영입 매장 줄에 공구 대행 버튼을 되살린다',
    file: CONSOLE,
    find: '              onClick={() => setProxyFor({ id: s.id, name })}\n            />',
    replace: '              onClick={() => setProxyFor({ id: s.id, name })}\n            />,\n            <button key={`b${s.id}`} className="px-2 py-0.5 rounded-full bg-brand text-white">공구 대행 등록</button>',
    test: T_NEW,
    why:
      '2026-09-29 대표 확정 — 목록에 버튼을 두지 않고 **행 전체가 그 동작**이다. ' +
      '⚠️ 다만 동작 자체가 사라지면 안 된다(모달 참조를 함께 검사한다). ' +
      '🩸 첫 판 주입은 `hint="공구 대행 등록"` 를 넣었는데 시험이 `>공구 대행 등록<`(엘리먼트 본문)을 ' +
      '보므로 **초록이 떴다** — 주입이 실제 결함을 안 만든 것이다. 러너가 그걸 잡아 버튼 엘리먼트로 교체했다.',
  },
  {
    name: '유어샵 — 마퀴를 되살린다 (순수 검정 띠가 첫인상을 먹는다)',
    file: HEADER,
    find: '  return (\n    <header className="bg-surface">',
    replace: '  return (\n    <header className="bg-surface">\n      <div className="animate-marquee">{curator.headline}</div>',
    test: T_TOP,
    why:
      '대표 *"배고프다 뭐먹지?는 아예 빼기"*. 라이브 실측에서 그 띠가 **순수 검정 `#000000`** 이었다 — ' +
      '우리 다크 바탕은 `#11141C` 라 팔레트 밖 값이고, 같은 문구가 세 번 반복해 흐르는 모양이었다. ' +
      '이 항목은 **재조준된 가드**가 실제로 일하는지 본다(종전엔 "PC 에서 안 흐르는가" 를 지켰다).',
  },
  {
    name: '유어샵 — 표시는 없는데 편집 칸만 되살린다 (조용한 부재)',
    file: MANAGE,
    find: "type Field = 'name' | 'bio' | 'handle' | 'sns' | null",
    replace: "type Field = 'name' | 'bio' | 'handle' | 'sns' | null\nconst _revived = '흐르는 문구'",
    test: T_TOP,
    why:
      '표시 자리를 지우고 편집만 남기면 주인이 **아무도 못 보는 값**을 계속 입력한다. 에러도 안 나고 ' +
      '빌드도 통과해서 아무도 모른다 — 이 레포가 반복해 당한 "실패가 아니라 조용한 부재" 클래스다.',
  },
]
