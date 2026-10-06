// 유어딜 상인회 서비스 소개서 (.pptx) 생성기 — v1 (2026-10-06, 대표 지시 "매장을 운영하는 상인회원들을 대상으로도
//   우리 서비스를 소개해야해. 소개서 만들어줘. 서비스 소개서야. 입점도 요청하면서.").
//
// 🎟️ 어느 레일인가: **유어딜 소비자 이용권**(직접 입점 10% / 중개 5%). 도매몰·공구 서비스(운영자 몰)·유어애즈가 아니다.
//   머니 경로 접촉 없음(문서 생성기만). 롤백: 이 파일과 산출물 삭제.
//
// 📣 사장님 덱과 무엇이 다른가 — 같은 레일이지만 **읽는 자리가 다르다.**
//   사장님 덱(urdeal-store-owner-deck)은 한 가게를 1:1 로 설득한다. 이 덱은 **상인회 설명회 자리**에서
//   회장·사무국·회원 매장이 함께 본다. 그래서 세 가지가 더 들어간다:
//     ① 상인회가 써 온 공동 사업(전단·축제·쿠폰)과의 비교 — 개별 가게 광고가 아니라 **회비로 모아 쓴 돈**과 비교해야 한다
//     ② 사무국이 대신 등록·운영하는 길(중개 5% + 매장 몫 안의 상인회 몫)
//     ③ **입점 요청**(마지막 장) — 설명회 자리 1회 · 희망 매장 명단 · 회원 안내 1회
//   반대로 사장님 덱의 기대수익 시나리오(상세판 5장)는 안 넣는다. 단체 자리에서 수익 표를 띄우면 약속으로 읽힌다.
//
// 🔢 숫자는 전부 deck-common FACTS(2026-10-06 라이브 실측) + 이 파일 상단 상수에서 나온다. 손으로 옮겨 적지 않는다.
// 성과 수치("매출 O% 증가")·트래픽 보장·수익 사례는 쓰지 않는다(three-decks-plan §0-4).
// 기획·사실 SSOT: docs/business/proposals/three-decks-plan-2026-09.md §0 · docs/design/store-operator-model.md §7
//   · docs/design/actor-benefit-map.md · src/worker/utils/broker-share.ts
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons  (node_modules 심링크는 README 참조)
//         SHOTS_DIR=<캡처 폴더> node urdeal-merchant-association-deck.build.mjs out.pptx
import path from 'node:path';
import { createDeck, C, W, H, M, FACTS, __dirname } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-merchant-association-deck.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');

// 10,000원 한 장 기준 돈 흐름 (슬라이드 06 이 이 값만 쓴다)
const UNIT = (() => {
  const gross = 10000, feePct = 0.10;
  const fee = Math.round(gross * feePct);
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  return { gross, fee, net: gross - fee, won };
})();

(async () => {
  const d = await createDeck({
    title: '유어딜 상인회 서비스 소개서', footer: '유어딜 상인회 소개', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'detail', 'use', 'shop', 'seller-scan', 'seller-settlements', 'store-new', 'store-new-channel', 'seller-stores'],
    icons: ['FiEdit3', 'FiAward', 'FiGrid'],
  });
  const { pres, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv, table, cover, chip,
    screen, customerSteps, honesty, qa3, section, setSection, takeaway, personas, procedureColumns } = d;
  const won = UNIT.won;

  // ───────── 00 로고 표지 ─────────
  {
    const s = pres.addSlide();
    cover(s, {
      deckName: '상인회 서비스 소개서',
      sub: '상권 회원 매장에 드리는 서비스 소개와 입점 요청입니다.\n미리 내는 돈 없이, 팔린 뒤에만 수수료 ' + FACTS.feeDirect + '.',
      date: '2026년 10월',
    });
  }

  // ───────── 01 표지 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '상권에 손님을 부르는 일,\n이번에는 돈을 먼저 쓰지 않으셔도 됩니다.', { x: M, y: 1.25, w: 8.4, h: 1.9, fontSize: 36, bold: true, color: C.darkText, lineSpacingMultiple: 1.12, charSpacing: -1.4, valign: 'top' });
    T(s, '회원 매장이 미리 내는 돈은 0원입니다. 손님이 먼저 결제하고 가게로 옵니다.', { x: M, y: 3.25, w: 7.8, h: 0.45, fontSize: 15, bold: true, color: C.brand, charSpacing: -0.3 });
    T(s, '공동 전단, 상권 축제, 배달앱 쿠폰. 지금까지는 상인회가 비용을 먼저 모아 쓰고, 효과는 끝난 뒤에 짐작했습니다. 유어딜은 우리 가게 이용권을 온라인에서 할인가로 미리 파는 곳입니다. 손님이 결제를 마치고 그 표를 들고 가게에 옵니다. 사장님이 내는 것은 팔린 이용권의 수수료 ' + FACTS.feeDirect + ', 그것이 전부입니다.',
      { x: M, y: 3.8, w: 7.6, h: 1.35, fontSize: 12.5, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    const stats = [['0원', '회원 매장이 미리 내는 돈'], [FACTS.feeDirect, '팔린 뒤에만 내는 수수료'], [FACTS.feeBrokered, '상인회가 대신 운영하면']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.55;
      T(s, n, { x, y: 5.3, w: 2.4, h: 0.7, fontSize: 36, bold: true, color: C.darkText, charSpacing: -1.2 });
      T(s, l, { x, y: 6.0, w: 2.4, h: 0.4, fontSize: 10.5, color: C.darkMuted, valign: 'top' });
    });
    phone(s, 'home', 9.5, 1.1, 5.7, { dark: true });
    s.addNotes('표지. 10% = 직접 입점 / 5% = 중개(사무국이 대신 등록·운영) — fee-resolver.ts, platform_fee_pct_direct·brokered 라이브 실측 2026-10-06. 오른쪽은 urdeal.kr 홈 라이브 캡처(홈이 지도다).');
  }

  // ───────── PART 1 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, {
      n: 1, name: '왜 상인회와 함께하는가',
      sub: '상권이 지금까지 써 온 방식과 무엇이 다른지 먼저 말씀드립니다. 숫자와 조건을 앞에 놓고 시작하겠습니다.',
      items: ['지금까지의 방식과 다른 점', '유어딜이 하는 일', '손님이 겪는 네 단계'],
    });
  }

  // ───────── 02 지금까지의 방식 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '지금까지는 상인회가 돈을 먼저 모아 썼습니다.');
    lead(s, '효과를 확인할 방법이 없으면 다음 해에도 같은 결정을 반복하게 됩니다.', { y: 2.0, h: 0.4 });
    const tx = M, tw = W - 2 * M;
    const colW = [2.6, 2.75, 2.6, 2.5, tw - 2.6 - 2.75 - 2.6 - 2.5];
    const colX = colW.map((_, i) => tx + colW.slice(0, i).reduce((a, b) => a + b, 0));
    const hdr = ['', '돈이 나가는 시점', '오는 사람', '혜택이 닿는 범위', '효과 확인'];
    const ty = 2.62;
    hdr.forEach((h, i) => T(s, h, { x: colX[i], y: ty, w: colW[i] - 0.18, h: 0.26, fontSize: 9.5, bold: true, color: C.gray, charSpacing: 0.8 }));
    hr(s, tx, ty + 0.32, tw);
    const rows = [
      ['공동 전단·현수막', '제작비 선지불 (회비)', '알 수 없음', '전단에 실린 몇 집', '알 수 없음'],
      ['상권 축제·행사', '행사비 선지불', '그날 지나간 사람', '부스를 낸 집', '당일 체감뿐'],
      ['배달앱 쿠폰·광고', '매달 광고비 선지불', '클릭한 사람', '따로 가입한 집', '클릭 수'],
      ['체험단·블로그', '대행비 선지불에 무료 식사', '공짜로 먹으러 온 체험단', '섭외된 집', '후기 몇 개'],
      ['유어딜', '팔린 뒤에만 수수료', '결제까지 마친 손님', '등록한 모든 회원 매장', '몇 장 팔렸고 몇 명 왔는지'],
    ];
    const rh = 0.58;
    rows.forEach((r, ri) => {
      const y = ty + 0.4 + ri * rh, hi = ri === rows.length - 1;
      if (hi) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx - 0.15, y: y - 0.04, w: tw + 0.3, h: rh, rectRadius: 0.1, fill: { color: C.tint }, line: { color: C.tint, width: 0 } });
      r.forEach((t, i) => T(s, t, { x: colX[i], y, w: colW[i] - 0.18, h: rh - 0.06, fontSize: i === 0 ? 12 : 10.5, bold: i === 0 || hi, color: hi ? (i === 0 ? C.brand : C.ink) : (i === 0 ? C.ink : C.inkSoft), valign: 'middle', lineSpacingMultiple: 1.25 }));
      if (!hi) hr(s, tx, y + rh - 0.04, tw);
    });
    takeaway(s, [
      { text: '지금까지는 상인회가 먼저 돈을 냈습니다. ', options: { color: C.inkSoft } },
      { text: '유어딜은 손님이 먼저 냅니다. 안 팔리면 아무도 아무것도 내지 않습니다.', options: { bold: true, color: C.ink } },
    ], { y: ty + 0.4 + rows.length * rh + 0.28, h: 0.6 });
    s.addNotes('이 덱의 심장. 개별 가게 광고가 아니라 "회비로 모아 쓴 공동 사업" 과 비교한다. 비교 축은 돈이 나가는 시점·오는 사람·혜택 범위·측정 가능성 넷뿐이고 성과 수치는 전부 배제했다.');
  }

  // ───────── 03 유어딜은 무엇인가 (손님 흐름) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '배달앱이 아닙니다. 우리 가게로 오게 하는 표를 미리 파는 곳입니다.', { size: 25 });
    lead(s, '온라인에서 할인가로 사고, 그 표를 들고 가게에 와서 씁니다. 배달도 택배도 반품도 없습니다.', { y: 1.88, h: 0.32 });
    customerSteps(s, { y: 2.95, h: 3.4 });
    s.addNotes('네 장 전부 urdeal.kr 라이브 캡처. 이용권은 즉시판매 단일가(공동구매로 모이는 구조가 아니다 — groupbuy-instant-sale.md). 사용은 QR 또는 확인코드.');
  }

  // ───────── PART 2 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, {
      n: 2, name: '매장이 내는 것과 받는 것',
      sub: '수수료 하나뿐입니다. 가입비도 월 이용료도 광고비도 없습니다. 숨은 비용이 있는지 한 장에 모아 보여 드립니다.',
      items: ['이용권 한 장의 돈 흐름', '지금 팔리는 실제 이용권으로 계산', '설명회에서 가장 많이 나오는 질문', '사장님이 하는 일', '정산'],
    });
  }

  // ───────── 04 돈 흐름 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, won(UNIT.gross) + '짜리 이용권 한 장이 팔리면 이렇게 됩니다.');
    const cx = M, cw = 5.4;
    card(s, cx, 2.15, cw, 2.55);
    label(s, '한 장이 팔릴 때', cx + 0.32, 2.33, cw - 0.64);
    kv(s, [
      ['손님이 결제한 금액', won(UNIT.gross), 0, true],
      ['유어딜 수수료 ' + FACTS.feeDirect, '−' + won(UNIT.fee), 0],
      ['카드 수수료', '0원 (유어딜이 냅니다)', 0, true],
      ['사장님 계좌에', won(UNIT.net), 2],
    ], cx + 0.32, 2.68, cw - 0.64, { rowH: 0.46 });
    T(s, FACTS.pgNote, { x: cx, y: 4.88, w: cw, h: 0.6, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    const tx = 6.55, tw = W - M - tx;
    label(s, '숨은 비용이 있는지 한 줄씩', tx, 2.15, tw);
    table(s, {
      x: tx, y: 2.5, colW: [2.5, 1.55, tw - 4.05],
      hdr: ['항목', '흔한 오해', '실제'],
      body: [
        ['가입비', '있겠지', '0원'],
        ['월 이용료', '있겠지', '0원'],
        ['상위 노출비', '내야 뜨겠지', '0원. 파는 자리는 돈으로 사지 않습니다'],
        ['카드 수수료', '떼겠지', '0원. 유어딜이 자기 몫에서 냅니다'],
        ['정산 수수료', '송금할 때 떼겠지', '0원'],
        ['한 장도 안 팔린 달', '기본료는 내겠지', '0원'],
      ],
      rowH: 0.47, fontSize: 10.5, brandCol: 2, leftAlign: true,
    });
    takeaway(s, [
      { text: '수수료는 팔린 뒤에만, 한 번만 나갑니다. ', options: { bold: true, color: C.ink } },
      { text: '상인회 회비처럼 미리 모아 두는 돈이 없습니다.', options: { color: C.inkSoft } },
    ], { y: 6.2, h: 0.55 });
    s.addNotes('10% 는 직접 입점 기준(platform_fee_pct_direct=10, fee_channel_rates_enabled=true · 2026-10-06 라이브 실측). 카드 수수료는 유어딜 몫 안에서 부담(commission-budget.ts pg_reserve). 정산 수수료 0: payouts-generate.ts 가 net 그대로 보낸다.');
  }

  // ───────── 05 실계산 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '지금 팔리고 있는 실제 이용권으로 계산해 보면.');
    card(s, M, 2.15, 5.9, 3.6);
    const x = M + 0.35, w = 5.2;
    label(s, '라이브에 올라 있는 실제 매장 이용권 (' + FACTS.sampleName + ')', x, 2.35, w);
    const yEnd = kv(s, [
      ['정가', FACTS.sampleOrig, 0],
      ['이용권 판매가 (할인율은 사장님이 정합니다)', FACTS.samplePrice, 0, true],
      ['유어딜 ' + FACTS.feeDirect, FACTS.sampleFee, 0],
      ['카드 수수료', '0원 (유어딜이 냅니다)', 0, true],
      ['사장님 계좌에', FACTS.sampleNet, 2],
    ], x, 2.7, w, { rowH: 0.44 });
    T(s, '할인한 만큼은 손님을 오게 하는 값입니다. 그래서 한가한 시간대와 남는 메뉴에 거는 것이 맞습니다. 점심 줄이 서는 시간을 굳이 할인하실 이유가 없습니다.',
      { x, y: yEnd + 0.12, w, h: 0.85, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
    const pts = [
      ['FiCreditCard', '결제가 먼저입니다', '이용권은 후기 약속이 아니라 매출입니다. 손님이 오기 전에 돈이 들어옵니다.'],
      ['FiCheckCircle', '안 온 손님은 정산되지 않습니다', '정산 대상은 손님이 실제로 쓴 표뿐입니다. 쓰지 않고 기간이 지나면 손님에게 전액 환불되고, 그 처리는 유어딜이 합니다.'],
      ['FiTag', '손해 보는 구조를 만들 수 없습니다', '할인율, 수량, 유효기간, 쓸 수 있는 시간대를 전부 사장님이 정합니다. 수량이 차면 자동으로 멈춥니다.'],
    ];
    let py = 2.15;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.5);
      T(s, h, { x: 7.75, y: py, w: W - M - 7.75, h: 0.36, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.75, y: py + 0.42, w: W - M - 7.75, h: 0.85, fontSize: 10.8, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      py += 1.38;
    });
    takeaway(s, [
      { text: '체험단 한 팀에 나가는 무료 식사값이면, ', options: { color: C.inkSoft } },
      { text: '유어딜에서는 돈을 낸 손님이 옵니다.', options: { bold: true, color: C.ink } },
    ], { y: 6.26, h: 0.44 });
    s.addNotes('상품 2915(홍대돈까스) 2026-10-06 D1 실측: 정가 14,500 / 판매가 7,500 → 수수료 750 → 입금 6,750. 값은 deck-common FACTS.sample* 하나에서 온다. 사용분만 정산: platform_settings.payout_requires_voucher_use=true(실측). 만료 미사용분 100% 환불: auto-settlement.ts handleExpiredVoucherRefunds.');
  }

  // ───────── 06 걱정되는 것 (페르소나) ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    title(s, '설명회에서 가장 많이 나오는 질문 넷입니다.', { dark: true });
    lead(s, '사장님들이 하신 말씀을 그대로 적었습니다.', { y: 1.9, dark: true, h: 0.4 });
    personas(s, [
      ['FiSmartphone', '기계를 바꿔야 하나', '"POS 새로 들이는 건 못 합니다."', ['POS 연동이 없습니다. 손님 폰의 코드를 확인하면 끝입니다', '사장님 폰이나 태블릿 하나로 됩니다']],
      ['FiClock', '바쁜 시간에 몰리면', '"점심에는 줄을 서는데 더 못 받아요."', ['쓸 수 있는 시간대를 사장님이 정할 수 있습니다', '수량도 정합니다. 다 팔리면 자동으로 멈춥니다']],
      ['FiUsers', '단골까지 깎아 주나', '"원래 오던 손님을 깎아 주면 손해죠."', ['이용권은 유어딜에서 찾아온 새 손님이 들고 옵니다', '단골 할인은 가게에서 하시던 대로 따로 두시면 됩니다']],
      ['FiXCircle', '사 놓고 안 오면', '"안 오는 사람 돈은 어떻게 됩니까."', ['기간이 지나면 손님에게 전액 환불됩니다. 유어딜이 처리합니다', '그래서 안 온 손님 돈은 가게 몫이 아닙니다. 쓴 표만 정산됩니다']],
    ], { y: 2.25, rowH: 0.92, gap: 0.11 });
    takeaway(s, [
      { text: '유어딜이 유리하게 숨겨 둔 조건은 ', options: { color: C.darkMuted } },
      { text: '이 네 가지 안에 없습니다. 네 번째가 특히 그렇습니다.', options: { bold: true, color: C.darkText } },
    ], { y: 6.34, h: 0.44, dark: true, size: 11.5 });
    s.addNotes('09-15 참고 덱 "이런 브랜드에게 추천합니다" 장치. 네 번째(미사용분 환불)는 가게에 불리한 사실이고 그래서 먼저 말한다. 시간대 제한: 이용권 메뉴·사용 조건 필드. 수량 자동 마감: group_buy_max.');
  }

  // ───────── 07 사장님이 하는 일 ─────────
  setSection('회원 매장이 내는 것과 받는 것');
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님이 하실 일은 둘입니다.');
    lead(s, '손님이 오면 코드를 확인하는 것, 그리고 가끔 수량을 손보는 것.', { y: 1.95, h: 0.4 });
    const lw = 6.6;
    const blocks = [
      ['FiSmartphone', '손님이 오면', '폰으로 손님의 QR 을 찍거나, 손님이 보여 주는 확인코드를 눌러 처리합니다. 한 번 쓴 표는 다시 쓸 수 없습니다. 영수증을 따로 쓰실 일도 없습니다.'],
      ['FiEdit3', '가끔 손볼 때', '가격, 수량, 유효기간, 쓸 수 있는 시간대는 언제든 바꿉니다. 재료가 떨어졌으면 판매를 잠시 멈추면 됩니다. 계약 기간이 없으니 그만두는 것도 사장님 마음입니다.'],
      ['FiBarChart2', '궁금할 때', '몇 장 팔렸고 몇 명이 왔고 얼마가 들어올지가 매장 화면에 늘 떠 있습니다.'],
    ];
    let by = 2.4;
    blocks.forEach(([i, h, p]) => {
      iconCircle(s, i, M, by, 0.5);
      T(s, h, { x: M + 0.7, y: by, w: lw - 0.7, h: 0.34, fontSize: 15, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.7, y: by + 0.4, w: lw - 0.7, h: 0.8, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      by += 1.3;
    });
    takeaway(s, [
      { text: '손님을 찾아오게 하는 일, 결제, 환불, 취소는 ', options: { color: C.inkSoft } },
      { text: '전부 유어딜이 합니다.', options: { bold: true, color: C.ink } },
    ], { y: 6.3, w: lw, h: 0.44, size: 11.5 });
    phone(s, 'seller-scan', 9.6, 1.15, 5.3, { caption: '사용 처리 화면 (예시 데이터)' });
    s.addNotes('사용 처리: group-buy-voucher.routes.ts(QR + store_code 확인코드, 1회 소각). 오른쪽은 /seller/scan 실제 UI 를 예시 데이터로 렌더한 캡처. 인출선은 쓰지 않았다 — 이 캡처의 좌표를 실측하지 않았고, 안 맞는 인출선은 없는 것보다 나쁘다.');
  }

  // ───────── 08 정산 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '돈은 언제, 어떻게 들어오나요.');
    const lw = 6.9;
    const rows = [
      ['무엇이 정산되나', '손님이 실제로 쓴 이용권만 모읍니다. 팔렸지만 아직 안 쓴 표는 들어 있지 않습니다.'],
      ['언제', '주 단위로 집계해서 등록해 두신 계좌로 들어옵니다. 신청하실 것이 없습니다.'],
      ['최소 금액', '한 주에 모인 금액이 ' + FACTS.minPayout + ' 이 안 되면 다음 주로 넘어가 합산됩니다.'],
      ['떼는 것', '수수료 ' + FACTS.feeDirect + ' 외에 정산 수수료는 없습니다. 집계된 금액이 그대로 들어옵니다.'],
      ['계좌', '정산 계좌는 사장님 본인만 등록하고 바꿉니다. 운영을 누구에게 맡기셔도 그렇습니다.'],
    ];
    let y = 2.2;
    rows.forEach(([k, v], i) => {
      label(s, k, M, y, lw);
      T(s, v, { x: M, y: y + 0.3, w: lw, h: 0.6, fontSize: 11, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
      y += 0.88;
      if (i < rows.length - 1) hr(s, M, y - 0.12, lw);
    });
    takeaway(s, [
      { text: '상인회가 대신 운영해도 손님이 낸 돈은 ', options: { color: C.inkSoft } },
      { text: '매장 계좌로만 갑니다.', options: { bold: true, color: C.ink } },
    ], { y: 6.5, w: lw, h: 0.55, size: 11.5 });
    phone(s, 'seller-settlements', 9.9, 1.15, 5.3, { caption: '정산 화면 (예시 데이터)' });
    s.addNotes('payouts-generate.ts: 주간 집계, 최소 1만원 이월, 승인·송금은 사람이 한다. 사용분만: platform_settings.payout_requires_voucher_use=true(2026-10-06 실측). 계좌 변경 owner 전용: store-operator-model §9.');
  }

  // ───────── PART 3 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, {
      n: 3, name: '상권이 함께 들어오면',
      sub: '한 집만 들어오셔도 됩니다. 다만 같이 들어오시면 손님이 보는 화면에서 우리 상권이 같이 채워집니다.',
      items: ['손님이 보는 자리', '온누리상품권 가맹 표시', '소개할 사람을 찾는 일'],
    });
  }

  // ───────── 09 손님이 보는 자리 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '한 집만 들어오셔도 되지만, 같이 들어오면 지도가 채워집니다.', { size: 25 });
    lead(s, '유어딜의 첫 화면은 지도입니다. 손님은 자기 위치 주변에 있는 이용권부터 봅니다.', { y: 1.95, h: 0.4 });
    const lw = 6.5;
    const blocks = [
      ['FiMapPin', '지도에서 같이 보입니다', '등록한 매장은 홈 지도에 핀으로 뜹니다. 회원 매장이 여럿 들어오면 그 골목에 핀이 모여 손님 눈에 상권으로 보입니다.'],
      ['FiGrid', '도시별 페이지', '도시 단위 페이지가 있어서 그 지역 이용권이 한곳에 모입니다. 검색에서도 그 주소로 찾아옵니다.'],
      ['FiAward', '온누리상품권 가맹 표시', '가맹 매장이면 상세 화면에 표시가 붙습니다. 사업자정보에서 한 번 체크하시면 됩니다.'],
    ];
    let by = 2.35;
    blocks.forEach(([i, h, p]) => {
      iconCircle(s, i, M, by, 0.5);
      T(s, h, { x: M + 0.7, y: by, w: lw - 0.7, h: 0.34, fontSize: 15, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.7, y: by + 0.4, w: lw - 0.7, h: 0.78, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      by += 1.22;
    });
    card(s, M, 5.95, lw, 0.88, { fill: C.tint });
    T(s, '아직 없는 것도 말씀드립니다', { x: M + 0.3, y: 6.08, w: lw - 0.6, h: 0.26, fontSize: 11, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '상권 하나만 묶어 보여 주는 전용 페이지는 아직 없습니다. 지금은 지도와 도시별 페이지에 각 매장이 뜹니다.', { x: M + 0.3, y: 6.35, w: lw - 0.6, h: 0.42, fontSize: 10, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
    phone(s, 'detail', 9.55, 1.15, 5.3, { caption: '이용권 상세 화면 (라이브)' });
    s.addNotes('홈이 지도: HomeRoute → RestaurantMapPage(모바일). 도시별 페이지: REGION_PAGES_ENABLED=true, /region/*. 온누리 뱃지: seller_meta.onnuri_merchant=1 → 상세 enrich(detail-meta-enrich.ts). ⚠️ 상권 단위 묶음 페이지는 없다 — 그 사실을 슬라이드가 직접 말한다. 노출·트래픽은 약속하지 않는다.');
  }

  // ───────── 10 소개할 사람 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '소개할 사람을 상인회가 찾아다니지 않아도 됩니다.', { w: 8.6 });
    lead(s, '동네 글을 쓰는 분들의 연락처를 유어딜이 모아 두고 관리합니다. 사장님은 소개비 몇 퍼센트를 낼지만 정하시면 됩니다.', { y: 1.9, w: 8.4, h: 0.5 });
    const stats = [[FACTS.influencerDb, '모아 둔 사람'], [FACTS.influencerReachable, '연락처가 붙은 사람'], [FACTS.influencerNaverBlog, '네이버 블로그'], [FACTS.influencerYoutube, '유튜브']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.2;
      T(s, n, { x, y: 2.6, w: 2.1, h: 0.5, fontSize: 21, bold: true, color: C.ink, charSpacing: -0.8 });
      T(s, l, { x, y: 3.1, w: 2.1, h: 0.3, fontSize: 10, color: C.gray, valign: 'top' });
    });
    T(s, FACTS.influencerAsOf + ' 실측입니다. 이 숫자는 모아 둔 연락처 수이고, 글을 써 주겠다고 약속한 사람 수가 아닙니다.', { x: M, y: 3.5, w: 8.4, h: 0.4, fontSize: 10, color: C.gray, lineSpacingMultiple: 1.35, valign: 'top' });
    hr(s, M, 4.05, 8.4);
    qa3(s, M, 4.2, 7.3, '소개비는 어떻게 정합니까', [
      '사장님이 정합니다. 유어딜이 정한 고정 요율이 없습니다. 판매가의 몇 퍼센트로 제안하시면 됩니다.',
      '그 소개비는 매장 몫 안에서 나갑니다. 유어딜 수수료가 올라가는 것이 아닙니다.',
      '소개한 링크로 팔린 건에만 붙습니다. 글만 쓰고 안 팔리면 나가는 돈이 없습니다.',
    ], { rowH: 0.52 });
    // 2026-10-06 재캡처. 집계 막대 캡처(admin-influencer-pool-stats.jpg)는 09-14 것이라 위 숫자와 어긋나서 쓰지 않는다.
    await screen(s, path.join(SHOTS_DIR, 'admin-pool-rows.jpg'), 8.3, 4.15, 4.28, { caption: '유어딜 내부 관리 화면. 이메일은 가렸습니다' });
    takeaway(s, [
      { text: '먼저 돈을 주고 글을 받는 방식이 아닙니다. ', options: { color: C.inkSoft } },
      { text: '팔린 뒤에, 팔린 만큼만 나갑니다.', options: { bold: true, color: C.ink } },
    ], { y: 6.2, h: 0.5 });
    s.addNotes('숫자: /api/admin/ads/influencer-pool/stats 2026-10-06 실측(total 282,818 · with_contact 61,512 · naver_blog 247,565 · youtube 19,571). 소개비는 매장이 정하고 매장 몫에서 나간다(broker-share.ts 머리말 · actor-benefit-map Q2-1). 캡처는 연락처를 가린 상태.');
  }

  // ───────── PART 4 구분 장 ─────────
  {
    const s = pres.addSlide();
    section(s, {
      n: 4, name: '시작하는 방법과 요청',
      sub: '폰이 익숙하지 않은 사장님도 시작하실 수 있게 길을 셋으로 나눠 두었습니다. 마지막 장에 상인회에 드리는 요청이 있습니다.',
      items: ['세 가지 길과 수수료', '등록 절차', '상인회에 드리는 세 가지 요청'],
    });
  }

  // ───────── 11 세 가지 길 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '길은 셋입니다. 어느 길이든 손님이 낸 돈은 매장 계좌로만 갑니다.', { size: 25 });
    lead(s, '사장님이 직접 하시면 수수료 ' + FACTS.feeDirect + ', 상인회가 대신 등록하고 운영하면 ' + FACTS.feeBrokered + ' 입니다.', { y: 1.98, h: 0.4 });
    procedureColumns(s, [
      {
        title: '사장님이 직접 (수수료 ' + FACTS.feeDirect + ')', hi: true,
        steps: ['urdeal.kr 에서 카카오로 로그인', '지도에서 내 가게 찾기', '사업자등록증 사진 한 장', '승인 문자 받고 첫 이용권 올리기', '손님 오면 코드 확인', '매주 정산 확인'],
        note: '10분이면 끝납니다. 막히면 카카오톡 채널에 "등록 도와주세요"',
      },
      {
        title: '유어딜이 대신 (수수료 ' + FACTS.feeDirect + ')',
        steps: ['카카오톡 채널에 "등록 도와주세요"', '전화로 메뉴, 가격, 사진을 받습니다', '유어딜이 매장과 첫 이용권을 만듭니다', '사장님은 등록증 사진과 승인 확인만', '손님 오면 코드 확인', '매주 정산 확인'],
        note: '폰이 익숙하지 않으셔도 됩니다. 사람이 대신 합니다',
      },
      {
        title: '상인회가 중개 (수수료 ' + FACTS.feeBrokered + ')',
        steps: ['사무국이 매장을 "중개" 로 등록', '등록할 때 상인회 몫 퍼센트를 함께 정합니다', '사장님은 본인 카카오로 소유자 확인', '정산 계좌는 사장님만 등록', '이용권 운영은 사무국이 대신', '손님 오면 코드 확인'],
        note: '사무국은 계좌를 못 건드립니다. 권한은 사장님이 언제든 회수',
      },
    ], { y: 2.55, h: 4.15 });
    s.addNotes('직접 10% / 중개 5%: fee-resolver.ts, platform_fee_pct_direct·brokered(2026-10-06 실측 켜짐). 소유자 지정·계좌 owner 전용: store-operator-model §7·§9. "유어딜이 대신 만들어 드립니다" 는 대표 운영 약속. 상인회 몫의 구조는 다음 장이 숫자로 말한다.');
  }

  // ───────── 12 상인회 몫 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '상인회가 대신 운영하실 때의 몫은 이렇게 정합니다.');
    lead(s, '수수료가 두 번 나가지 않습니다. 유어딜이 떼는 것은 중개 매장 ' + FACTS.feeBrokered + ' 하나뿐입니다.', { y: 1.95, h: 0.4 });
    const bw = (W - 2 * M - 0.5) / 3;
    const boxes = [
      ['유어딜', FACTS.feeBrokered, '중개로 등록된 매장의 수수료입니다. 직접 등록하시면 ' + FACTS.feeDirect + ' 이고, 사무국이 대신 운영하시면 여기까지 내려갑니다.'],
      ['매장', '나머지', '손님이 낸 돈에서 유어딜 몫을 뺀 전부가 매장 몫입니다. 아래 두 가지는 이 안에서 나갑니다.'],
      ['상인회', '등록 때 정한 %', '매장 몫 안에서 나갑니다. 상한은 ' + FACTS.brokerShareMax + ' 이고, 소개비 상한과 합쳐 ' + FACTS.brokerTermsSumMax + ' 를 넘길 수 없습니다. 매장에 남는 것이 있어야 하기 때문입니다.'],
    ];
    boxes.forEach(([k, v, p], i) => {
      const x = M + i * (bw + 0.25);
      const hi = i === 2;
      card(s, x, 2.45, bw, 2.3, { fill: hi ? C.tint : C.surface });
      label(s, k, x + 0.28, 2.63, bw - 0.56);
      T(s, v, { x: x + 0.28, y: 2.92, w: bw - 0.56, h: 0.52, fontSize: 25, bold: true, color: hi ? C.brand : C.ink, charSpacing: -1.0 });
      T(s, p, { x: x + 0.28, y: 3.52, w: bw - 0.56, h: 1.15, fontSize: 10.3, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    qa3(s, M, 4.95, 8.6, '상인회 몫은 어떻게 받습니까', [
      '매장에 청구하지 않습니다. 팔린 만큼 유어딜이 계산해서 상인회 계좌로 직접 보냅니다.',
      '세금 원천징수도 유어딜이 계산해서 처리합니다. 지급 내역은 화면에 남습니다.',
      '퍼센트를 0 으로 두시면 유어딜을 거치지 않습니다. 그때는 상인회와 매장이 알아서 정하시면 됩니다.',
    ], { rowH: 0.48 });
    card(s, 9.55, 4.95, W - M - 9.55, 1.72, { fill: C.tint });
    T(s, '아직 흐른 적이 없습니다', { x: 9.8, y: 5.09, w: W - M - 9.8 - 0.2, h: 0.26, fontSize: 11, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '이 송금 기능은 켜져 있지만 ' + FACTS.liveMeasuredAt + ' 기준으로 실제 적립된 건이 아직 0건입니다. 첫 상권이 들어오면 함께 확인하면서 시작하겠습니다.', { x: 9.8, y: 5.37, w: W - M - 9.8 - 0.2, h: 1.15, fontSize: 9.8, color: C.ink, lineSpacingMultiple: 1.38, valign: 'top' });
    s.addNotes('구조: broker-share.ts — 재원은 매장 몫(debit seller:{id}), 유어딜 5% 불변. 상한 BROKER_SHARE_PCT_MAX=50 · BROKER_TERMS_SUM_MAX=90. 적립 레일은 인플루언서와 같다(influencer_attributions source=broker_share → 성숙·원천징수·지급센터 그대로). 🔴 2026-10-06 라이브 실측: 게이트 broker_share_enabled=true 인데 influencer_attributions 가 0행 — 아직 한 건도 적립된 적이 없다. 그 사실을 슬라이드가 직접 말한다. ⚠️ 대행사 덱 §14 는 아직 "켜기 전" 이라고 적혀 있다(게이트 플립 전 승인본) — 대표 확인 필요.');
  }

  // ───────── 13 등록 절차 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '등록은 10분, 승인은 사람이 확인합니다.');
    lead(s, '자동 승인이 아닙니다. 사업자등록증과 가게를 사람이 보고 승인합니다.', { y: 1.95, h: 0.4 });
    const ph = 3.9, pw = ph * ((780 + 44) / (1688 + 44));
    phone(s, 'store-new', M, 2.4, ph, { caption: '가게 찾기' });
    phone(s, 'store-new-channel', M + pw + 0.45, 2.4, ph, { caption: '누가 운영하나요' });
    const rx = M + 2 * pw + 1.0, rw = W - M - rx;
    const yq = qa3(s, rx, 2.45, rw, '무엇이 필요합니까', [
      '사업자등록증 사진 한 장. 대표자 이름과 등록번호가 보이면 됩니다.',
      '가게 전화번호와 주소. 지도에서 가게를 찾아 고르시면 주소는 자동으로 들어갑니다.',
      '정산받을 계좌. 사장님 본인 계좌여야 합니다.',
      '이용권으로 팔 메뉴 하나와 가격. 하나만 있어도 시작됩니다.',
    ], { rowH: 0.56 });
    qa3(s, rx, yq + 0.3, rw, '승인까지 얼마나 걸립니까', [
      '서류가 맞으면 영업일 기준 하루 안에 봅니다. 승인되면 문자로 알려드립니다.',
      '반려되면 무엇이 안 맞는지 적어 보냅니다. 다시 올리시면 됩니다.',
    ], { rowH: 0.56 });
    s.addNotes('필드는 seller-stores.routes.ts 실재(채널·국세청 확인·등록증·소유자 코드). 자동 승인은 없다(three-decks-plan §0-4 "약속 금지"). 승인 소요는 현장 운영 기준이고 코드가 보장하는 값이 아니다. 캡처 둘은 /store/new 실제 UI 를 예시 데이터로 렌더한 것.');
  }

  // ───────── 14 입점 요청 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '상인회에 세 가지를 부탁드립니다.');
    lead(s, '회원 매장을 설득하는 일은 유어딜이 하겠습니다. 자리만 만들어 주시면 됩니다.', { y: 1.95, h: 0.4 });
    const bw = (W - 2 * M - 0.5) / 3;
    const asks = [
      ['설명회 자리 한 번', '사무국 회의실에서 30분이면 됩니다. 유어딜이 찾아갑니다. 회원분들이 묻고 싶은 것을 그 자리에서 답하겠습니다.'],
      ['희망 매장 명단', '가게 이름, 업종, 대표 메뉴, 연락처만 주시면 됩니다. 등록은 유어딜이 전화로 대신 하겠습니다.'],
      ['회원 안내 한 번', '단톡방이나 게시판에 안내문 한 장. 안내문은 유어딜이 상권 이름을 넣어 만들어 드립니다.'],
    ];
    asks.forEach(([h, p], i) => {
      const x = M + i * (bw + 0.25);
      card(s, x, 2.4, bw, 2.0);
      numBadge(s, i + 1, x + 0.28, 2.58, 0.4);
      T(s, h, { x: x + 0.28, y: 3.06, w: bw - 0.56, h: 0.34, fontSize: 15, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.28, y: 3.45, w: bw - 0.56, h: 0.85, fontSize: 10.3, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    label(s, '유어딜이 드리는 것', M, 4.62, W - 2 * M);
    const gives = [
      ['FiUserCheck', '등록 대행', '전화로 받아 적어 대신 등록합니다'],
      ['FiCamera', '사진과 메뉴 정리', '사진이 없으면 찍어 드립니다'],
      ['FiBarChart2', '사무국 화면', '회원 매장 판매를 한 화면에서'],
      ['FiPercent', '수수료 ' + FACTS.feeBrokered, '사무국이 대신 운영하시는 경우'],
    ];
    gives.forEach(([i, h, p], k) => {
      const x = M + k * ((W - 2 * M) / 4);
      iconCircle(s, i, x, 4.96, 0.44);
      T(s, h, { x: x + 0.6, y: 4.96, w: (W - 2 * M) / 4 - 0.7, h: 0.28, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.6, y: 5.25, w: (W - 2 * M) / 4 - 0.7, h: 0.5, fontSize: 9.8, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    honesty(s, {
      y: 5.88, h: 0.96,
      text: '유어딜은 초기 서비스입니다. ' + FACTS.liveMeasuredAt + ' 기준 판매 중인 이용권 ' + FACTS.activeVouchers + '건 가운데 실제 매장이 올린 것은 ' + FACTS.realStores + '건이고, 나머지는 시범 운영을 위한 예시입니다. 손님 수를 약속하는 대신 조건을 숫자로 먼저 공개합니다. 먼저 들어오시는 매장이 그 지역과 업종의 첫 자리를 가져갑니다.',
    });
    s.addNotes('입점 요청 장. 요청 셋은 상인회가 할 수 있는 최소 행동으로 잡았다(설득은 우리가 한다). 숫자는 FACTS(2026-10-06 실측): 활성 이용권 359건 중 실제 매장 1건(그 밖에 내부 테스트 1건). 노출·트래픽은 약속하지 않고 "첫 자리" 라는 순서만 말한다.');
  }

  // ───────── 15 마무리 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '상권에 손님이 오는지는\n숫자로 보여 드리겠습니다.', { x: M, y: 1.5, w: 8.6, h: 1.6, fontSize: 34, bold: true, color: C.darkText, lineSpacingMultiple: 1.12, charSpacing: -1.2, valign: 'top' });
    T(s, '몇 장 팔렸고 몇 명이 왔는지가 매장 화면에 그대로 남습니다. 올해 쓴 돈이 효과가 있었는지 짐작하지 않으셔도 됩니다.',
      { x: M, y: 3.3, w: 7.8, h: 0.8, fontSize: 13, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    hr(s, M, 4.3, 7.8, { dark: true });
    const contacts = [
      ['FiMessageCircle', '카카오톡 채널', FACTS.kakaoChannel, '"상인회 설명회 문의" 라고 보내 주세요'],
      ['FiMailW', '이메일', FACTS.contactEmail, '상권 이름과 회원 매장 수를 적어 주세요'],
      ['FiGlobeW', '서비스', FACTS.site, '손님이 보는 화면을 먼저 보셔도 됩니다'],
    ];
    let cy = 4.6;
    contacts.forEach(([, k, v, p]) => {
      T(s, k, { x: M, y: cy, w: 2.1, h: 0.3, fontSize: 10.5, color: C.darkMuted, valign: 'middle' });
      T(s, v, { x: M + 2.2, y: cy, w: 3.4, h: 0.3, fontSize: 13, bold: true, color: C.darkText, valign: 'middle', charSpacing: -0.3 });
      T(s, p, { x: M + 5.8, y: cy, w: 4.2, h: 0.3, fontSize: 10, color: C.darkMuted, valign: 'middle' });
      cy += 0.52;
    });
    T(s, FACTS.biz, { x: M, y: H - 0.85, w: 8, h: 0.25, fontSize: 9, color: C.darkMuted });
    phone(s, 'shop', 10.3, 1.3, 4.9, { dark: true });
    s.addNotes('마무리. 약속하는 것은 "숫자를 보여 준다" 하나뿐이다. 연락처는 FACTS. 오른쪽은 유어샵 라이브 캡처.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(20 slides)');
})();
