// 유어딜 매장 사장님 소개서 상세판 (.pptx) 생성기 — 16장 (2026-09-14). 본판은 urdeal-store-owner-deck.build.mjs (8장, 대표 최종 구성안 v2)
// 대표 지시(09-14): 표지는 "우리동네 이용권, 유어딜" · 뒤에 사장님이 유어딜을 이용하는 방법을 모아서 · 기대 매출과 순수익을 정확히.
// 원칙: 실측 성과 수치("매출 O% 증가")는 쓰지 않는다. 기대 수익은 가정을 전부 라벨로 붙인 계산표로만 보여 준다.
// 기획: docs/business/proposals/three-decks-plan-2026-09.md §2 · 사실 SSOT: 같은 문서 §0 + docs/design/actor-benefit-map.md
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons  (node_modules 심링크는 README 참조)
//         SHOTS_DIR=<캡처 폴더> node urdeal-store-owner-deck.build.mjs out.pptx
import path from 'node:path';
import { createDeck, C, W, H, M, FACTS, __dirname, wordmark } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-store-owner-deck-detail.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');

// ── 기대 매출·순수익 계산 (덱에 찍히는 숫자는 전부 여기서 나온다. 손으로 옮겨 적지 않는다) ──
const CALC = (() => {
  const listPrice = 25000, sale = 16500, feePct = 0.10, costRate = 0.35; // 실제 상품 2888 · 원가율은 가정
  const cost = Math.round(listPrice * costRate), fee = Math.round(sale * feePct), dep = sale - fee, net = dep - cost;
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const scen = [[1, 30], [3, 90], [5, 150]].map(([perDay, n]) => ({ perDay, n, rev: sale * n, fee: fee * n, dep: dep * n, cost: cost * n, net: net * n }));
  const cats = [['식사', 32411], ['뷰티', 45253], ['숙박', 155824]].map(([k, p]) => ({ k, p, rev: p * 30, dep: p * 30 - Math.round(p * 30 * feePct) }));
  return { listPrice, sale, cost, fee, dep, net, discount: listPrice - sale, scen, cats, won };
})();

(async () => {
  const d = await createDeck({
    title: '우리동네 이용권, 유어딜 — 매장 사장님 소개서', footer: '유어딜 매장 사장님 소개', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'detail', 'use', 'store-new', 'store-new-channel', 'seller-stores', 'seller-settlements', 'seller-scan', 'seller-influencers', 'seller-operators'],
  });
  const { pres, ic, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv, table } = d;
  const won = CALC.won;

  // ───────── 01 표지: 우리동네 이용권, 유어딜 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '우리동네 이용권,', { x: M, y: 1.7, w: 8, h: 1.0, fontSize: 44, bold: true, color: C.darkMuted, charSpacing: -1.5, valign: 'top' });
    { const wm = await wordmark(C.darkText); const h = 1.35; s.addImage({ data: wm.data, x: M - 0.05, y: 2.8, w: h * wm.ratio, h }); }
    T(s, '동네 식당, 카페, 뷰티, 숙박의 이용권을 손님이 온라인에서 미리 사고, 가게에 와서 QR 로 씁니다. 사장님은 팔린 만큼만 수수료를 냅니다.',
      { x: M, y: 4.75, w: 7.2, h: 0.9, fontSize: 13.5, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    T(s, 'urdeal.kr', { x: M, y: 5.85, w: 4, h: 0.4, fontSize: 14, bold: true, color: C.darkText, charSpacing: -0.3 });
    phone(s, 'home', 9.3, 1.1, 5.7, { dark: true });
    s.addNotes('표지. 대표 지시(09-14): "팔린 만큼만 냅니다"가 아니라 "우리동네 이용권, 유어딜". 오른쪽은 urdeal.kr 홈 라이브 캡처.');
  }

  // ───────── 02 서비스 소개: 팔린 만큼만 냅니다 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '팔린 만큼만 냅니다.', { size: 34 });
    T(s, '유어딜은 가게 이용권을 온라인에서 미리 파는 곳입니다. "한우 런치 2인", "커트+클리닉". 사장님이 정한 메뉴를 사장님이 정한 할인가로 올리면, 손님이 먼저 결제하고 이용권을 들고 가게로 옵니다.',
      { x: M, y: 2.2, w: 7.6, h: 1.0, fontSize: 13, color: C.inkSoft, lineSpacingMultiple: 1.5, valign: 'top' });
    T(s, '광고를 파는 게 아니라 사장님의 상품을 팝니다. 그래서 미리 내는 돈이 없고, 팔린 이용권에만 수수료를 냅니다.',
      { x: M, y: 3.25, w: 7.6, h: 0.7, fontSize: 13, bold: true, color: C.ink, lineSpacingMultiple: 1.5, valign: 'top' });
    hr(s, M, 4.15, 7.6);
    const stats = [[FACTS.feeDirect, '수수료 전부.\n안 팔리면 0원'], ['0원', '가입비, 월비,\n선불 광고비'], ['90%', '팔린 금액 중\n사장님 몫']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.55;
      T(s, n, { x, y: 4.45, w: 2.4, h: 0.8, fontSize: 40, bold: true, color: i === 2 ? C.brand : C.ink, charSpacing: -1.4 });
      T(s, l, { x, y: 5.3, w: 2.4, h: 0.6, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    T(s, '배달도 배송도 없습니다. 손님은 가게에 직접 옵니다.', { x: M, y: 6.2, w: 7.6, h: 0.3, fontSize: 11, bold: true, color: C.ink });
    phone(s, 'detail', 9.4, 1.05, 5.35, { caption: '이용권 상세 (라이브 화면)' });
    s.addNotes('10%: 직접 등록 기준(fee-resolver.ts, 09-07 대표 확정. 대행사 경유는 5% — 사장님 덱에서는 10% 하나로). 0원: 가입비·월비·광고비 없음.');
  }

  // ───────── 03 기존 방식의 한계 (비교표) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '지금까지 가게 홍보는 순서가 거꾸로였습니다.');
    lead(s, '돈이 먼저 나가고, 손님은 나중에 옵니다. 온다는 보장도 없이.', { y: 2.0, h: 0.4 });
    const tx = M, tw = W - 2 * M;
    const colW = [2.55, 3.2, 2.85, tw - 2.55 - 3.2 - 2.85];
    const colX = colW.map((_, i) => tx + colW.slice(0, i).reduce((a, b) => a + b, 0));
    const hdr = ['', '돈이 나가는 시점', '오는 사람', '효과 확인'];
    const ty = 2.62;
    hdr.forEach((h, i) => T(s, h, { x: colX[i], y: ty, w: colW[i] - 0.2, h: 0.26, fontSize: 9.5, bold: true, color: C.gray, charSpacing: 0.8 }));
    hr(s, tx, ty + 0.32, tw);
    const rows = [
      ['체험단·블로그 마케팅', '대행비 선지불 + 무료 식사 제공', '공짜로 먹으러 온 체험단', '후기 몇 개. 손님이 됐는지는 모름'],
      ['배달앱·검색 광고', '매달 광고비 선지불', '클릭한 사람 (방문 보장 없음)', '클릭 수. 매출 연결은 모름'],
      ['전단·현수막', '제작비 선지불', '알 수 없음', '알 수 없음'],
      ['유어딜', '팔린 뒤에만 수수료', '결제까지 마친 손님', '몇 장 팔리고 몇 명 왔는지 전부 숫자로'],
    ];
    const rh = 0.66;
    rows.forEach((r, ri) => {
      const y = ty + 0.4 + ri * rh, hi = ri === rows.length - 1;
      if (hi) s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx - 0.15, y: y - 0.04, w: tw + 0.3, h: rh, rectRadius: 0.1, fill: { color: C.tint }, line: { color: C.tint, width: 0 } });
      r.forEach((t, i) => T(s, t, { x: colX[i], y, w: colW[i] - 0.2, h: rh - 0.08, fontSize: i === 0 ? 12.5 : 11, bold: i === 0 || hi, color: hi ? (i === 0 ? C.brand : C.ink) : (i === 0 ? C.ink : C.inkSoft), valign: 'middle', lineSpacingMultiple: 1.25 }));
      if (!hi) hr(s, tx, y + rh - 0.04, tw);
    });
    const ly = ty + 0.4 + rows.length * rh + 0.35;
    card(s, M, ly, tw, 0.95);
    T(s, [
      { text: '체험단은 밥을 공짜로 드리고 후기를 받습니다. ', options: { color: C.inkSoft } },
      { text: '유어딜은 손님이 돈을 내고 옵니다. 후기는 그 다음에 따라옵니다.', options: { bold: true, color: C.ink } },
    ], { x: M + 0.35, y: ly, w: tw - 0.7, h: 0.95, fontSize: 12.5, valign: 'middle', lineSpacingMultiple: 1.4 });
    s.addNotes('이 문서의 심장. 체험단·광고를 깎아내리지 않고 "돈이 나가는 시점"과 "측정 가능성"만 비교한다. 성과 수치는 실측 전이라 전부 배제.');
  }

  // ───────── 04 차별점: 홍보비가 아니라 매출 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '홍보비가 아니라 매출입니다.');
    card(s, M, 2.15, 5.9, 4.65);
    const x = M + 0.35, w = 5.2;
    label(s, '지금 유어딜에서 팔리고 있는 실제 상품 (치즈돈가스 2인 세트)', x, 2.35, w);
    const yEnd = kv(s, [
      ['정가', won(CALC.listPrice), 0], ['이용권 판매가 (할인율은 사장님이 정함)', won(CALC.sale), 0, true],
      ['유어딜 수수료 10%', '−' + won(CALC.fee), 0], ['카드 수수료', '0원 (유어딜 부담)', 0, true],
      ['사장님 계좌에 들어오는 돈', won(CALC.dep), 2],
    ], x, 2.7, w, { rowH: 0.46 });
    T(s, '체험단 한 팀에 나가는 무료 식사값이면, 유어딜에선 돈 내는 손님이 옵니다. 그 손님이 몇 명인지, 언제 왔는지, 얼마를 썼는지가 매장 관리 화면에 그대로 남습니다. "효과가 있었나?"를 감으로 판단할 필요가 없습니다.',
      { x, y: yEnd + 0.2, w, h: 1.4, fontSize: 11, color: C.ink, lineSpacingMultiple: 1.45, valign: 'top' });
    const pts = [
      ['FiCreditCard', '결제가 먼저', '이용권은 후기 약속이 아니라 매출입니다. 손님이 결제를 마친 뒤에 가게에 옵니다.'],
      ['FiCheckCircle', '노쇼 손실 0', '손님이 실제로 쓴 것만 정산 대상입니다. 예약이 아니라서 재료를 미리 준비할 일도 없습니다.'],
      ['FiTag', '손해 보는 구조를 만들 수 없음', '할인율, 수량, 유효기간 전부 사장님이 정합니다. 남는 메뉴만, 남는 만큼만 올리면 됩니다.'],
    ];
    let py = 2.3;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.5);
      T(s, h, { x: 7.75, y: py, w: W - M - 7.75, h: 0.36, fontSize: 15, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.75, y: py + 0.42, w: W - M - 7.75, h: 0.8, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      py += 1.5;
    });
    s.addNotes('상품 2888(홍대돈까스, 라이브 유일의 실제 매장 이용권) 09-13 실측: 정가 25,000 / 판매가 16,500. 카드 수수료(현재 약 2.75%, 변동 가능)는 유어딜 부담.');
  }

  // ───────── 05 기대 매출과 순수익 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '기대 매출과 순수익. 가정은 전부 적어 두었으니 사장님 숫자로 바꿔 보세요.', { size: 24 });
    // 왼쪽: 한 장의 셈
    const cx = M, cw = 4.55;
    card(s, cx, 2.1, cw, 4.7);
    label(s, '이용권 한 장 (실제 상품 기준)', cx + 0.3, 2.28, cw - 0.6);
    const yEnd = kv(s, [
      ['정가', won(CALC.listPrice), 0], ['판매가 (34% 할인)', won(CALC.sale), 0, true],
      ['유어딜 10%', '−' + won(CALC.fee), 0], ['계좌 입금', won(CALC.dep), 1, true],
      ['재료비 (정가의 35% 가정)', '−' + won(CALC.cost), 0], ['한 장에 남는 돈', won(CALC.net), 2],
    ], cx + 0.3, 2.6, cw - 0.6, { rowH: 0.41 });
    T(s, '할인분 ' + won(CALC.discount) + '은 손님을 오게 하는 값입니다. 정가에 오던 손님이 이용권으로 갈아타면 그만큼 덜 받으니, 한가한 시간대와 남는 메뉴에 거는 것이 답입니다.',
      { x: cx + 0.3, y: yEnd + 0.15, w: cw - 0.6, h: 1.3, fontSize: 10, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
    // 오른쪽 위: 월 시나리오
    const tx = 5.65, tw = W - M - tx;
    label(s, '한 달에 몇 장 팔리느냐에 따라 (같은 이용권)', tx, 2.1, tw);
    const y2 = table(s, {
      x: tx, y: 2.4, colW: [1.25, 1.2, 1.05, 1.25, 1.1, tw - 5.85],
      hdr: ['하루 판매', '월 매출', '유어딜 10%', '계좌 입금', '재료비', '월 순수익'],
      body: CALC.scen.map((r) => [`${r.perDay}장 (월 ${r.n}장)`, won(r.rev), won(r.fee), won(r.dep), won(r.cost), won(r.net)]),
      hiRow: 1, rowH: 0.42, fontSize: 10.5, brandCol: 5,
    });
    // 오른쪽 아래: 카테고리별 평균가
    label(s, '업종별 평균 판매가로 보면 (' + FACTS.liveMeasuredAt + ' 판매 중인 이용권 평균, 월 30장 가정)', tx, y2 + 0.28, tw);
    table(s, {
      x: tx, y: y2 + 0.56, colW: [1.25, 1.8, 1.9, tw - 4.95],
      hdr: ['업종', '평균 판매가', '월 매출 (30장)', '계좌 입금 (90%)'],
      body: CALC.cats.map((r) => [r.k, won(r.p), won(r.rev), won(r.dep)]),
      rowH: 0.4, fontSize: 10.5, brandCol: 3,
    });
    T(s, '재료비율과 판매 장수는 가정입니다. 이용권 손님이 추가로 주문하는 음료나 사이드는 계산에 넣지 않았습니다.', { x: tx, y: 6.45, w: tw, h: 0.3, fontSize: 9.5, color: C.gray });
    s.addNotes(`계산 SSOT는 이 파일 CALC. 장당: 16,500 − 1,650 = 14,850 입금, 재료비 8,750(정가 25,000×35% 가정) → 6,100. 월 30/90/150장 = ${CALC.scen.map((r) => r.net.toLocaleString()).join(' / ')}원. 업종 평균가는 09-13 공개 API 실측(활성 이용권 카탈로그 평균, 실거래 평균 아님). 할인분은 정직하게 "덜 받는 값"으로 적었다.`);
  }

  // ───────── 06 손님은 어디서 보고 오나 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '올려두면 네 곳에 뜹니다. 알리는 건 저희 일입니다.');
    const cw = 5.55;
    card(s, M, 2.15, cw, 4.6);
    label(s, '자동 노출', M + 0.3, 2.35, cw - 0.6);
    const auto = [['FiHome', '유어딜 홈 인기 이용권과 카테고리'], ['FiMapPin', '지도에서 "내 주변 이용권"'], ['FiSearch', '검색과 카카오톡 공유 카드'], ['FiVideo', '영상 콘텐츠 아래 구매 버튼']];
    let ay = 2.8;
    auto.forEach(([i, t]) => {
      iconCircle(s, i, M + 0.3, ay, 0.5);
      T(s, t, { x: M + 1.0, y: ay + 0.02, w: cw - 1.3, h: 0.46, fontSize: 13, bold: true, color: C.ink, valign: 'middle', charSpacing: -0.3 });
      ay += 0.78;
    });
    hr(s, M + 0.3, 5.95, cw - 0.6);
    T(s, '사장님이 콘텐츠를 만들 필요가 없습니다. 등록만 하면 노출은 유어딜이 맡습니다.', { x: M + 0.3, y: 6.05, w: cw - 0.6, h: 0.6, fontSize: 11, bold: true, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    const x2 = M + cw + 0.35, w2 = 3.45;
    card(s, x2, 2.15, w2, 2.15);
    iconCircle(s, 'FiUsers', x2 + 0.3, 2.4, 0.46);
    T(s, '소개해 주는 사람들', { x: x2 + 0.9, y: 2.45, w: w2 - 1.1, h: 0.34, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '동네 맛집, 뷰티 콘텐츠를 만드는 사람들이 이용권을 소개하면, 그 링크로 팔린 것에만 소개비가 나가는 구조도 있습니다. 이것도 팔린 뒤에만입니다.', { x: x2 + 0.3, y: 2.95, w: w2 - 0.6, h: 1.25, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    card(s, x2, 4.55, w2, 2.2);
    iconCircle(s, 'FiStar', x2 + 0.3, 4.8, 0.46);
    T(s, '후기는 유어딜이 모읍니다', { x: x2 + 0.9, y: 4.85, w: w2 - 1.1, h: 0.34, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '첫 후기를 남긴 손님에게는 유어딜이 포인트를 드립니다. 사장님 부담 없이 후기가 쌓이고, 다음 손님이 그 후기를 봅니다.', { x: x2 + 0.3, y: 5.35, w: w2 - 0.6, h: 1.25, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    phone(s, 'home', 10.4, 1.05, 5.35, { caption: '유어딜 홈 (라이브 화면)' });
    s.addNotes('노출 4곳: 홈 섹션/지도(/map)/검색·카톡 OG/유어쇼츠(/videos). 소개비: 매장 제안 %, 매장 부담 — %·풀 규모 숫자는 넣지 않는다(대표). 리뷰 보너스 1,000딜 유어딜 부담 — "포인트"로만.');
  }

  // ───────── 07 걱정되는 것들 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님들이 꼭 물어보시는 것.');
    const faq = [
      ['손님이 안 오면요? (노쇼)', '쓴 이용권만 정산하니까 손실이 없습니다. 예약이 아니라서 재료를 미리 준비할 필요도 없습니다.'],
      ['환불해 달라고 하면요?', '환불은 유어딜과 토스가 처리합니다. 사장님은 그 사이에 서지 않습니다. 이미 쓴 이용권은 환불되지 않습니다.'],
      ['유효기간 지난 건요?', '안 쓴 이용권은 유어딜이 손님에게 100% 환불합니다. 사장님 계좌는 건드리지 않습니다.'],
      ['한 장으로 두 번 쓰려고 하면요?', 'QR 은 한 번 찍히면 끝입니다. 같은 코드가 두 번 통과하지 않습니다. 확인코드는 매장에서만 알려 줍니다.'],
      ['배달앱, 네이버예약이랑 같이 써도 되나요?', '됩니다. 독점 요구 없고 계약 기간도 없습니다. 이용권 손님은 가게에 직접 오므로 배달 주문과 겹치지 않습니다.'],
      ['너무 많이 팔리면요?', '수량에 상한을 두면 그만큼만 팔립니다. 손님이 오는 날 쓰는 것이라 한 날에 몰리지도 않습니다.'],
    ];
    const cw = 4.0, ch = 1.32;
    faq.forEach(([q, a], i) => {
      const x = M + (i % 2) * (cw + 0.25), y = 2.15 + Math.floor(i / 2) * (ch + 0.18);
      card(s, x, y, cw, ch);
      T(s, q, { x: x + 0.28, y: y + 0.17, w: cw - 0.56, h: 0.3, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, a, { x: x + 0.28, y: y + 0.5, w: cw - 0.56, h: 0.78, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    phone(s, 'use', 9.7, 1.05, 5.35, { caption: '손님이 보는 사용 안내와 환불 조건 (라이브 화면)' });
    s.addNotes('만료 자동 환불: auto-settlement.ts handleExpiredVoucherRefunds (100%). QR CAS: group-buy-voucher.routes.ts. 독점·계약기간 없음(코드 제약 0). 수량 상한은 상품 필드.');
  }

  // ───────── 08 이용 안내: 사장님이 하는 일 전체 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    label(s, '여기서부터 이용 안내', M, 1.0, 4, { color: C.brand });
    title(s, '사장님이 하는 일은 이게 전부입니다. 한 장에 모았습니다.', { y: 1.3 });
    lead(s, '처음 한 번 하는 일 둘, 매일 하는 일 하나, 매주 확인하는 일 하나. 나머지는 선택입니다.', { y: 2.2, h: 0.4 });
    const steps = [
      ['처음 한 번', '매장 등록', '카카오 로그인 뒤 질문 네 개. 사업자등록증 사진 한 장. 승인은 사람이 확인합니다.', '10분', '9장'],
      ['처음 한 번', '첫 이용권 만들기', '메뉴 이름, 정가, 판매가, 수량, 유효기간. 사진은 폰으로 그 자리에서.', '5분', '10장'],
      ['자동', '노출과 결제', '홈, 지도, 검색, 카톡 카드에 뜨고 손님이 토스로 결제합니다. 사장님이 할 일 없음.', '0분', '6장'],
      ['매일', '손님 사용 처리', '손님이 오면 매장 폰으로 QR 한 번. 어려우면 확인코드 6자리.', '10초', '11장'],
      ['매주', '정산 확인', '손님이 쓴 이용권만 매주 모아 등록 계좌로. 관리 화면에서 확인만.', '5분', '12장'],
      ['선택', '손님 더 부르기와 위임', '소개 파트너에게 제안, 후기 답글, 바쁘면 운영 위임.', '', '13·14장'],
    ];
    const bw = 1.85, gap = 0.16, by = 2.95;
    steps.forEach(([when, h, p, t, ref], i) => {
      const x = M + i * (bw + gap);
      const hi = when === '자동';
      card(s, x, by, bw, 3.6, { fill: hi ? C.tint : C.surface });
      numBadge(s, i + 1, x + 0.22, by + 0.22, 0.36);
      T(s, when, { x: x + 0.68, y: by + 0.24, w: bw - 0.8, h: 0.32, fontSize: 9.5, bold: true, color: hi ? C.brand : C.gray, charSpacing: 0.8, valign: 'middle' });
      T(s, h, { x: x + 0.22, y: by + 0.72, w: bw - 0.44, h: 0.62, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3, lineSpacingMultiple: 1.2, valign: 'top' });
      T(s, p, { x: x + 0.22, y: by + 1.36, w: bw - 0.44, h: 1.45, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      if (t) T(s, t, { x: x + 0.22, y: by + 2.85, w: bw - 0.44, h: 0.3, fontSize: 15, bold: true, color: hi ? C.brand : C.ink, charSpacing: -0.5 });
      T(s, ref, { x: x + 0.22, y: by + 3.2, w: bw - 0.44, h: 0.26, fontSize: 9, color: C.gray });
    });
    s.addNotes('이용 안내 목차. 시간은 현장 추정. 다음 장부터 각 단계를 화면과 함께.');
  }

  // ───────── 09 등록: 10분이면 끝납니다 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '등록. 시작할 때 여쭤보는 건 네 가지뿐입니다.');
    lead(s, '10분이면 끝납니다. 포스 연동도, 단말기도, 직원 교육도 필요 없습니다.', { y: 2.0, h: 0.4, w: 6.0 });
    const steps = [
      ['urdeal.kr 에서 카카오 로그인', '별도 가입이 없습니다.'],
      ['카카오맵에서 내 가게 찾기', '검색하면 주소와 전화번호가 자동으로 채워집니다.'],
      ['담당자 전화번호', '승인 안내, 사용 문의, 정산 확인 때 연락드릴 번호입니다.'],
      ['사업자등록증 사진 한 장', '유어딜이 직접 확인하고 승인 문자를 드립니다. 사업자번호는 나중에 넣어도 됩니다.'],
    ];
    let y = 2.75;
    steps.forEach(([h, p], i) => {
      numBadge(s, i + 1, M, y + 0.02, 0.38);
      T(s, h, { x: M + 0.55, y, w: 5.4, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.55, y: y + 0.34, w: 5.4, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 0.8;
    });
    card(s, M, y + 0.05, 5.95, 0.9, { fill: C.tint });
    T(s, '"이 매장, 누가 운영하나요?" 에서 "내 가게에요" 를 고르면 수수료 10% 입니다. 누가 먼저 내 매장을 올려 뒀다면 urdeal.kr/store/find 에서 내 가게를 찾아 소유자 신청을 하면 됩니다.',
      { x: M + 0.3, y: y + 0.05, w: 5.35, h: 0.9, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'middle' });
    const ph = 4.55;
    const pw = phone(s, 'store-new', 7.15, 1.95, ph, { caption: '2단계: 카카오맵에서 내 가게 찾기' });
    phone(s, 'store-new-channel', 7.15 + pw + 0.55, 1.95, ph, { caption: '"누가 운영하나요" 화면' });
    s.addNotes('StoreRegisterModal.tsx 4단계. 승인은 사람(seller-stores.routes.ts 자동 승인 없음). 채널 선택이 수수료(직접 10% / 중개 5%)를 정함. 대리 등록 매장의 사장님 입구는 /store/find.');
  }

  // ───────── 10 첫 이용권 만들기 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '첫 이용권. 다섯 칸만 채우면 그날부터 팔립니다.');
    const fx = M, fw = 4.6;
    card(s, fx, 2.15, fw, 4.6);
    label(s, '채우는 것', fx + 0.3, 2.33, fw - 0.6);
    const fields = [['메뉴 이름', '"치즈돈가스 2인 세트" 처럼 손님이 아는 이름 그대로'], ['정가', '평소 받는 값. 손님에게 취소선으로 함께 보입니다'], ['판매가', '사장님이 정한 할인가. 이 값의 10%가 수수료입니다'], ['수량', '하루에 받을 수 있는 만큼. 다 팔리면 자동으로 닫힙니다'], ['유효기간', '안 정하면 무기한. 지나면 안 쓴 것은 유어딜이 환불']];
    let fy = 2.7;
    fields.forEach(([k, v], i) => {
      numBadge(s, i + 1, fx + 0.3, fy, 0.32, { filled: false });
      T(s, k, { x: fx + 0.75, y: fy - 0.03, w: fw - 1.0, h: 0.32, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3, valign: 'middle' });
      T(s, v, { x: fx + 0.75, y: fy + 0.3, w: fw - 1.0, h: 0.42, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
      fy += 0.78;
    });
    const tx = fx + fw + 0.35, tw = 4.4;
    label(s, '잘 팔리는 이용권을 만드는 요령', tx, 2.15, tw);
    const tips = [
      ['FiClock', '한가한 시간대, 남는 메뉴부터', '점심 피크에 이미 꽉 차는 메뉴보다, 비는 시간과 여유 있는 메뉴에 거는 것이 남습니다.'],
      ['FiLayers', '세트로 묶으면 한 장의 값이 커집니다', '"2인 세트", "커트+클리닉" 처럼 묶으면 손님도 고르기 쉽고 한 장당 입금도 커집니다.'],
      ['FiPercent', '할인은 손님이 정가와 비교해 바로 느끼는 만큼', '정가가 함께 보이므로 할인이 없으면 잘 팔리지 않습니다. 얼마로 할지는 사장님 숫자로 정하세요.'],
      ['FiCamera', '사진은 폰으로 그 자리에서', '음식이든 시술 결과든 실제 사진이 스톡 사진보다 잘 팔립니다. 밝은 곳에서 한 장이면 됩니다.'],
    ];
    let ty = 2.5;
    tips.forEach(([i, h, p]) => {
      iconCircle(s, i, tx, ty, 0.42);
      T(s, h, { x: tx + 0.6, y: ty - 0.02, w: tw - 0.6, h: 0.3, fontSize: 11.5, bold: true, color: C.ink, charSpacing: -0.3, valign: 'middle' });
      T(s, p, { x: tx + 0.6, y: ty + 0.3, w: tw - 0.6, h: 0.62, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.36, valign: 'top' });
      ty += 1.05;
    });
    phone(s, 'detail', 10.4, 1.05, 5.35, { caption: '손님이 보는 결과 (라이브 화면)' });
    s.addNotes('필드: products(name, price, group_buy 판매가, stock/quantity, expires). 유효기간 미설정=무기한(actor-benefit-map). 요령은 판매 원칙이지 성과 약속이 아니다.');
  }

  // ───────── 11 손님 사용 처리 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 오면 QR 한 번. 매일 하는 일은 이것뿐입니다.');
    const cw = (8.6 - 0.3) / 2, cy = 2.15, ch = 2.45;
    [['FiSmartphone', '방법 1. 매장 폰으로 손님 QR 찍기', '손님이 이용권 화면을 내밀면 매장 폰의 스캔 화면으로 찍습니다. 찍히는 순간 사용 완료가 되고, 같은 QR 은 다시 통과하지 않습니다. 직원 누구나 할 수 있습니다.'],
     ['FiLock', '방법 2. 손님이 매장 확인코드 입력', '스캔이 어려우면 손님 폰의 이용권 화면에 매장 확인코드 6자리를 눌러 줍니다. 코드는 매장에서만 알려 주므로 집에서 미리 쓸 수 없습니다. 코드는 관리 화면에서 언제든 재발급됩니다.']].forEach(([i, h, p], k) => {
      const x = M + k * (cw + 0.3);
      card(s, x, cy, cw, ch);
      iconCircle(s, i, x + 0.3, cy + 0.3, 0.46);
      T(s, h, { x: x + 0.3, y: cy + 0.9, w: cw - 0.6, h: 0.36, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.3, y: cy + 1.28, w: cw - 0.6, h: 1.1, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    card(s, M, 4.85, 8.6, 1.9, { fill: C.tint });
    T(s, '사용 조건도 사장님이 정합니다', { x: M + 0.3, y: 5.0, w: 8.0, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '"평일만", "점심시간 제외", "1인 1매", "방문 전 예약 필수" 처럼 매장 사정에 맞는 조건을 체크하면 손님의 이용권 화면에 그대로 표시됩니다. 조건에 안 맞게 온 손님은 사용 처리를 안 하면 됩니다. 이용권은 그대로 살아 있습니다.',
      { x: M + 0.3, y: 5.35, w: 8.0, h: 1.3, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
    phone(s, 'seller-scan', 9.7, 1.05, 5.35, { caption: '매장 QR 사용 처리 화면 (예시 데이터)' });
    s.addNotes('사용 처리: group-buy-voucher.routes.ts /:code/use-by-seller(직원 QR, CAS) · /:code/use(확인코드). 사용 조건: redemption-settings(usage_conditions). 확인코드 재발급 가능.');
  }

  // ───────── 12 매장 관리 화면과 정산 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '정산. 손님이 쓴 뒤 매주 들어옵니다.');
    lead(s, '결제됐다고 바로가 아니라, 손님이 가게에서 실제로 쓴 이용권만 정산 대상이 됩니다. 그래서 노쇼가 손실이 되지 않습니다.', { y: 2.0, h: 0.6, w: 8.6 });
    const steps = [
      ['손님이 매장에서 사용', 'QR 스캔 또는 확인코드 입력. 이 순간 정산 대상이 됩니다.'],
      ['매주 월요일 집계', '지난주 사용분을 모아 정산 내역을 만듭니다. 관리 화면에 바로 보입니다.'],
      ['유어딜이 확인', '금액이 맞는지 사람이 확인합니다. 최소 정산 금액은 ' + FACTS.minPayout + '이고, 못 미치면 다음 주로 이월됩니다.'],
      ['등록한 계좌로 입금', '수수료를 뺀 금액이 그대로 들어옵니다. 별도 정산 수수료는 없습니다.'],
    ];
    const bw = 1.95, gap = 0.28, by = 3.0;
    steps.forEach(([h, p], i) => {
      const x = M + i * (bw + gap);
      numBadge(s, i + 1, x, by, 0.4);
      T(s, h, { x, y: by + 0.55, w: bw, h: 0.6, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3, lineSpacingMultiple: 1.2, valign: 'top' });
      T(s, p, { x, y: by + 1.15, w: bw, h: 1.3, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.02, y: by + 0.08, w: 0.24, h: 0.24 });
    });
    card(s, M, 5.55, 8.6, 1.2, { fill: C.tint });
    T(s, '관리 화면에서 늘 보이는 것', { x: M + 0.3, y: 5.68, w: 8.0, h: 0.3, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '오늘 팔린 것, 사용된 것, 입금 예정 금액, 입금된 내역. 그리고 정산 계좌는 사장님 본인만 바꿀 수 있습니다. 운영을 누구에게 맡겨도.', { x: M + 0.3, y: 6.0, w: 8.0, h: 0.7, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'seller-settlements', 10.0, 1.05, 5.35, { caption: '정산 화면 (예시 데이터)' });
    s.addNotes('payouts-generate.ts: 매주 월요일 cron, 최소 10,000원(이월), 승인·송금은 사람. 계좌 변경 owner 전용 + PIN(seller-profile.routes.ts).');
  }

  // ───────── 13 손님 더 부르기 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님을 더 부르는 두 가지. 하나는 사장님이 고르고, 하나는 자동입니다.', { w: 9.3, size: 25 });
    const cw = 5.6;
    card(s, M, 2.2, cw, 4.55);
    label(s, '사장님이 고르는 것', M + 0.3, 2.4, cw - 0.6);
    T(s, '소개해 줄 사람에게 소개비 %를 정해 제안합니다', { x: M + 0.3, y: 2.7, w: cw - 0.6, h: 0.6, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.4, lineSpacingMultiple: 1.2, valign: 'top' });
    T(s, '동네 맛집, 뷰티, 여행 콘텐츠를 만드는 사람들을 관리 화면에서 찾아 "이 이용권 팔아 주면 몇 %" 를 적어 제안합니다. 그 사람이 수락하면 전용 링크가 생기고, 그 링크로 팔린 건에만 소개비가 나갑니다.',
      { x: M + 0.3, y: 3.35, w: cw - 0.6, h: 1.55, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
    kv(s, [['소개비 %', '사장님이 정함', 1], ['재원', '사장님 몫 90% 안에서', 0], ['안 팔리면', '0원', 2]], M + 0.3, 5.0, cw - 0.6, { rowH: 0.42 });
    T(s, '제안하지 않으면 아무것도 나가지 않습니다.', { x: M + 0.3, y: 6.3, w: cw - 0.6, h: 0.3, fontSize: 10.5, bold: true, color: C.ink });
    const x2 = M + cw + 0.35, cw2 = 3.25;
    card(s, x2, 2.2, cw2, 4.55);
    label(s, '자동으로 되는 것', x2 + 0.3, 2.4, cw2 - 0.6);
    T(s, '후기가 쌓이고, 답글은 사장님이', { x: x2 + 0.3, y: 2.7, w: cw2 - 0.6, h: 0.6, fontSize: 14.5, bold: true, color: C.ink, charSpacing: -0.4, lineSpacingMultiple: 1.2, valign: 'top' });
    T(s, '첫 후기를 남긴 손님에게 유어딜이 포인트를 드립니다. 사장님 부담 없이 후기가 쌓이고, 답글을 달면 다음 손님이 그 대화를 봅니다.', { x: x2 + 0.3, y: 3.35, w: cw2 - 0.6, h: 1.4, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    hr(s, x2 + 0.3, 4.9, cw2 - 0.6);
    T(s, '이용권을 바꾸고 싶으면 가격, 수량, 유효기간을 언제든 고칩니다. 잠시 쉬고 싶으면 판매를 멈추면 됩니다. 계약 기간이 없습니다.', { x: x2 + 0.3, y: 5.05, w: cw2 - 0.6, h: 1.55, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
    phone(s, 'seller-influencers', 10.0, 1.05, 5.35, { caption: '소개 파트너 찾기 (예시 데이터)' });
    s.addNotes('딜 소개비: 매장 제안 %·매장 부담·상한 없음(Q2-1). DB 규모 숫자는 대표 지시로 넣지 않는다. 리뷰 보너스 1,000딜 유어딜 부담 — "포인트"로만.');
  }

  // ───────── 14 바쁘면 맡기세요 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '바쁘면 맡기셔도 됩니다. 단, 통장은 아무도 못 건드립니다.');
    lead(s, '대행사나 직원에게 운영을 맡길 수 있습니다. 매장 관리 화면에서 그 사람의 유어딜 계정을 추가하면 끝이고, 언제든 회수할 수 있습니다.', { y: 2.0, h: 0.6, w: 8.4 });
    const tx = M, tw = 7.6;
    const rows = [
      ['이용권 등록과 가격, 수량 변경', '가능'], ['주문 확인과 손님 QR 사용 처리', '가능'], ['소개 파트너에게 제안', '가능'], ['운영 시작 이후 매출 보기', '가능'],
      ['정산 계좌 변경', '차단'], ['사업자 정보 수정', '차단'], ['다른 운영자 추가와 회수', '차단'], ['매장 탈퇴', '차단'],
    ];
    label(s, '맡긴 사람이 할 수 있는 일 / 없는 일', tx, 2.8, tw);
    hr(s, tx, 3.1, tw);
    rows.forEach(([k, v], i) => {
      const y = 3.16 + i * 0.37;
      const ok = v === '가능';
      T(s, k, { x: tx, y, w: tw - 1.2, h: 0.34, fontSize: 11, color: C.ink, valign: 'middle' });
      s.addImage({ data: ok ? ic.FiCheck : ic.FiXCircle, x: tx + tw - 1.1, y: y + 0.07, w: 0.2, h: 0.2 });
      T(s, v, { x: tx + tw - 0.85, y, w: 0.85, h: 0.34, fontSize: 11, bold: true, color: ok ? C.brand : C.ink, valign: 'middle' });
      hr(s, tx, y + 0.34, tw);
    });
    T(s, '맡긴 사람에게는 계좌 끝 4자리와 등록번호 끝 4자리, 대표자명 첫 글자만 보입니다. 회수하면 그 사람이 등록한 이용권과 주문 기록은 매장에 그대로 남습니다. 대행사를 통해 등록한 매장의 수수료는 ' + FACTS.feeBrokered + '입니다.',
      { x: tx, y: 6.2, w: tw, h: 0.6, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'seller-operators', 9.7, 1.05, 5.35, { caption: '운영자 관리 (예시 데이터)' });
    s.addNotes('seller-operators.ts · store-operator-model.md §7.7: 계좌 변경·사업자정보·탈퇴·운영자 관리 403, 마스킹, 정산 내역은 합류 이후분만. 중개 경유 5%.');
  }

  // ───────── 15 자주 묻는 것 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '남은 질문들.');
    const faq = [
      ['할인율에 최소가 있나요?', '없습니다. 할인율, 수량, 유효기간 전부 사장님이 정합니다. 다만 손님이 정가와 나란히 보므로 할인이 없으면 잘 팔리지 않습니다.'],
      ['간이과세자도 되나요?', '사업자등록증이 있으면 됩니다. 과세 유형은 등록 조건이 아닙니다. 사업자번호는 나중에 넣어도 됩니다.'],
      ['세금계산서는요?', '수수료에 대한 세금계산서는 유어딜이 초안을 만들어 보내고 사장님은 확인만 하는 방식을 준비하고 있습니다. 시행 전까지는 담당자가 안내합니다.'],
      ['승인은 얼마나 걸리나요?', '사람이 등록증을 직접 확인하므로 즉시는 아닙니다. 확인이 끝나면 등록한 담당자 번호로 알려 드리고, 확인이 더 필요하면 전화드립니다.'],
      ['이용권 손님이 다른 것도 시키면요?', '그건 평소처럼 매장에서 결제받으면 됩니다. 유어딜은 이용권에 적힌 것만 정산하고, 추가 주문에는 수수료가 없습니다.'],
      ['그만두고 싶으면요?', '판매를 멈추면 끝입니다. 계약 기간도 위약금도 없습니다. 이미 팔린 이용권은 유효기간까지 받아 주시면 됩니다.'],
    ];
    const cw = 4.0, ch = 1.32;
    faq.forEach(([q, a], i) => {
      const x = M + (i % 2) * (cw + 0.25), y = 2.15 + Math.floor(i / 2) * (ch + 0.18);
      card(s, x, y, cw, ch);
      T(s, q, { x: x + 0.28, y: y + 0.17, w: cw - 0.56, h: 0.3, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, a, { x: x + 0.28, y: y + 0.5, w: cw - 0.56, h: 0.78, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    phone(s, 'seller-stores', 9.7, 1.05, 5.35, { caption: '매장 관리 화면 (예시 데이터)' });
    s.addNotes('할인율 하한 없음. 과세 유형은 등록 조건 아님. 세금계산서: tax-invoice-gateway.ts 역발행 초안(연동 활성 여부 운영 확인). 승인은 사람. 추가 주문 수수료 0(이용권 금액만 정산). 계약기간·위약금 없음(코드 제약 0).');
  }

  // ───────── 16 시작하기 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '일단 메뉴 하나만 올려보세요.');
    const x = M, w = 7.6;
    card(s, x, 2.15, w, 1.7, { fill: C.tint });
    T(s, '가입비도 없고, 계약 기간도 없고, 안 팔리면 나가는 돈도 없습니다. 제일 자신 있는 메뉴 하나로 시작해서, 맞는다 싶으면 늘리고 아니면 내리면 됩니다. 시작이 어려우시면 카카오톡으로 "등록 도와주세요" 한 마디만 남겨 주세요. 사람이 답합니다.',
      { x: x + 0.3, y: 2.15, w: w - 0.6, h: 1.7, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.5, valign: 'middle' });
    label(s, '시작하는 방법', x, 4.2, w);
    const steps = [['카카오 로그인', 'urdeal.kr 에서 카카오로 로그인합니다. 별도 가입이 없습니다.'], ['매장 등록 (10분)', 'urdeal.kr/store/new 에서 질문 네 개에 답합니다.'], ['첫 이용권 올리기', '승인 문자를 받으면 메뉴 하나를 올립니다. 그날부터 팔립니다.']];
    steps.forEach(([h, p], i) => {
      const y = 4.55 + i * 0.68;
      numBadge(s, i + 1, x, y, 0.36);
      T(s, h, { x: x + 0.5, y: y - 0.02, w: 2.6, h: 0.4, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', charSpacing: -0.3 });
      T(s, p, { x: x + 3.1, y: y - 0.02, w: w - 3.1, h: 0.4, fontSize: 10.5, color: C.inkSoft, valign: 'middle' });
    });
    const cx = 9.0, cw = W - M - cx, cy = 2.15, ch = 4.4;
    card(s, cx, cy, cw, ch, { fill: C.ink });
    T(s, '문의', { x: cx + 0.35, y: cy + 0.3, w: cw - 0.7, h: 0.3, fontSize: 11, bold: true, color: C.darkMuted, charSpacing: 1.2 });
    const contacts = [['FiGlobeW', 'urdeal.kr/store/new', '매장 등록'], ['FiMessageW', FACTS.kakaoChannel, '카카오톡 채널 상담'], ['FiMailW', FACTS.contactEmail, '이메일']];
    let ky = cy + 0.8;
    contacts.forEach(([i, v, l]) => {
      s.addImage({ data: ic[i], x: cx + 0.35, y: ky + 0.04, w: 0.26, h: 0.26 });
      T(s, v, { x: cx + 0.75, y: ky, w: cw - 1.1, h: 0.34, fontSize: 13, bold: true, color: C.darkText, charSpacing: -0.3 });
      T(s, l, { x: cx + 0.75, y: ky + 0.34, w: cw - 1.1, h: 0.26, fontSize: 9.5, color: C.darkMuted });
      ky += 0.85;
    });
    T(s, FACTS.biz, { x: cx + 0.35, y: cy + ch - 0.55, w: cw - 0.7, h: 0.3, fontSize: 9, color: C.darkMuted });
    s.addNotes('정직 고지(수치 없이): 09-13 실측 활성 337 중 실제 매장 1. 연락처는 대표 지정값. 상인회장용 발췌: 1·2·3·4·5·7·16장.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(16 slides)');
})();
