// 유어딜 매장 사장님 소개서 (.pptx) 생성기 — v4 (2026-09-14): 대표 최종 구성안 v2, 8장.
// 헤드라인 여덟 개가 전부 다른 화법(공감·질문·평서·약속·무심·안심·배려·권유). 성과 수치("매출 O% 증가")는 쓰지 않는다.
// 상세판(16장, 이용 안내 8장 포함)은 urdeal-store-owner-deck-detail.build.mjs.
// 기획: docs/business/proposals/three-decks-plan-2026-09.md §2 · 사실 SSOT: 같은 문서 §0 + docs/design/actor-benefit-map.md
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons  (node_modules 심링크는 README 참조)
//         SHOTS_DIR=<캡처 폴더> node urdeal-store-owner-deck.build.mjs out.pptx
import path from 'node:path';
import { createDeck, C, W, H, M, FACTS, __dirname } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-store-owner-deck.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');

// ── 실계산 (덱에 찍히는 숫자는 전부 여기서 나온다) ──
const CALC = (() => {
  const listPrice = 25000, sale = 16500, feePct = 0.10, costRate = 0.35; // 실제 상품 2888 · 원가율은 가정
  const cost = Math.round(listPrice * costRate), fee = Math.round(sale * feePct), dep = sale - fee, net = dep - cost;
  const won = (n) => n.toLocaleString('ko-KR') + '원';
  const scen = [[1, 30], [3, 90], [5, 150]].map(([perDay, n]) => ({ perDay, n, dep: dep * n, net: net * n }));
  return { listPrice, sale, cost, fee, dep, net, scen, won };
})();

(async () => {
  const d = await createDeck({
    title: '유어딜 매장 사장님 소개서', footer: '유어딜 매장 사장님 소개', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'use', 'store-new', 'store-new-channel', 'seller-settlements'],
  });
  const { pres, ic, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv, table } = d;
  const won = CALC.won;

  // ───────── 01 표지: 체험단에 지친 사장님을 정조준 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '체험단,\n할 만큼 해보셨잖아요.', { x: M, y: 1.3, w: 8.0, h: 1.9, fontSize: 42, bold: true, color: C.darkText, lineSpacingMultiple: 1.1, charSpacing: -1.4, valign: 'top' });
    T(s, '공짜로 먹고 가는 사람 말고, 계산하고 가는 손님을 만드는 방법입니다.', { x: M, y: 3.25, w: 7.6, h: 0.45, fontSize: 15, bold: true, color: C.brand, charSpacing: -0.3 });
    T(s, '후기 몇 개 받자고 무료 식사를 내드리는 것도, 대행비를 먼저 보내는 것도 이제 그만할 때가 됐습니다. 유어딜은 가게 이용권을 온라인에서 미리 파는 곳입니다. 손님이 먼저 결제하고, 이용권을 들고 가게로 옵니다. 사장님이 내는 건 팔린 이용권의 수수료 10%, 그게 전부입니다.',
      { x: M, y: 3.8, w: 7.5, h: 1.3, fontSize: 12.5, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    const stats = [['0원', '미리 내는 돈'], [FACTS.feeDirect, '팔린 뒤에만 내는 수수료'], ['90%', '사장님 몫']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.45;
      T(s, n, { x, y: 5.25, w: 2.3, h: 0.7, fontSize: 36, bold: true, color: C.darkText, charSpacing: -1.2 });
      T(s, l, { x, y: 5.95, w: 2.3, h: 0.4, fontSize: 10.5, color: C.darkMuted, valign: 'top' });
    });
    phone(s, 'home', 9.3, 1.1, 5.7, { dark: true });
    s.addNotes('표지. 대표 최종 구성안 v2. 대안 헤드라인: "체험단에 지치신 사장님들께." / "공짜 손님, 이제 그만 받으셔도 됩니다." 10%: 직접 등록 기준(fee-resolver.ts). 오른쪽은 urdeal.kr 홈 라이브 캡처.');
  }

  // ───────── 02 기존 방식의 한계 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '광고비 쓰고, 효과 봤는지는 아셨어요?');
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
    s.addNotes('이 문서의 심장. "돈이 나가는 시점"과 "측정 가능성"만 비교한다. 성과 수치는 실측 전이라 전부 배제.');
  }

  // ───────── 03 차별점 + 실계산 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '여기는 손님이 돈을 내고 옵니다.');
    lead(s, '체험단 한 팀에 나가는 무료 식사값이면, 유어딜에선 돈 내는 손님이 옵니다. 그 손님이 몇 명인지, 언제 왔는지, 얼마를 썼는지가 매장 관리 화면에 그대로 남습니다. "효과가 있었나?"를 감으로 판단할 필요가 없습니다.', { y: 1.95, h: 0.75 });
    card(s, M, 2.85, 5.9, 3.95);
    const x = M + 0.35, w = 5.2;
    label(s, '지금 유어딜에서 팔리고 있는 실제 상품 (치즈돈가스 2인 세트)', x, 3.02, w);
    const yEnd = kv(s, [
      ['정가', won(CALC.listPrice), 0], ['이용권 판매가 (할인율은 사장님이 정함)', won(CALC.sale), 0, true],
      ['유어딜 수수료 10%', '−' + won(CALC.fee), 0], ['카드 수수료', '0원 (유어딜 부담)', 0, true],
      ['사장님 계좌에 들어오는 돈', won(CALC.dep), 2],
    ], x, 3.35, w, { rowH: 0.36 });
    table(s, {
      x, y: yEnd + 0.1, colW: [1.7, 1.75, w - 3.45],
      hdr: ['하루 판매 (월 장수)', '계좌 입금', '순수익 (재료비 35% 가정)'],
      body: CALC.scen.map((r) => [`${r.perDay}장 (월 ${r.n}장)`, won(r.dep), won(r.net)]),
      rowH: 0.32, fontSize: 10, brandCol: 2,
    });
    const pts = [
      ['FiCreditCard', '결제가 먼저', '이용권은 후기 약속이 아니라 매출입니다. 손님이 결제를 마친 뒤에 가게에 옵니다.'],
      ['FiCheckCircle', '노쇼 손실 0', '손님이 실제로 쓴 것만 정산 대상입니다. 예약이 아니라서 재료를 미리 준비할 일도 없습니다.'],
      ['FiTag', '손해 보는 구조를 만들 수 없음', '할인율, 수량, 유효기간 전부 사장님이 정합니다. 남는 메뉴만, 남는 만큼만 올리면 됩니다.'],
    ];
    let py = 2.95;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.5);
      T(s, h, { x: 7.75, y: py, w: W - M - 7.75, h: 0.36, fontSize: 15, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.75, y: py + 0.42, w: W - M - 7.75, h: 0.8, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      py += 1.3;
    });
    s.addNotes(`상품 2888 실측: 정가 25,000 / 판매가 16,500. 장당 입금 14,850, 재료비 8,750(정가×35% 가정) → 6,100. 월 30/90/150장 순수익 ${CALC.scen.map((r) => r.net.toLocaleString()).join(' / ')}원. 카드 수수료(현재 약 2.75%, 변동 가능)는 유어딜 부담.`);
  }

  // ───────── 04 노출 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이용권을 올리시면, 파는 건 저희가 열심히 합니다.');
    lead(s, '등록만 하면 네 곳에 자동으로 뜹니다. 사장님이 콘텐츠를 만들 필요가 없습니다.', { y: 2.0, h: 0.4, w: 8.6 });
    const cw = 5.55;
    card(s, M, 2.6, cw, 4.15);
    label(s, '자동 노출', M + 0.3, 2.8, cw - 0.6);
    const auto = [['FiHome', '유어딜 홈 인기 목록과 카테고리'], ['FiMapPin', '지도의 내 주변 이용권'], ['FiSearch', '검색과 카카오톡 공유 카드'], ['FiVideo', '영상 아래 구매 버튼']];
    let ay = 3.2;
    auto.forEach(([i, t]) => {
      iconCircle(s, i, M + 0.3, ay, 0.5);
      T(s, t, { x: M + 1.0, y: ay + 0.02, w: cw - 1.3, h: 0.46, fontSize: 13, bold: true, color: C.ink, valign: 'middle', charSpacing: -0.3 });
      ay += 0.8;
    });
    const x2 = M + cw + 0.35, w2 = 3.45;
    card(s, x2, 2.6, w2, 1.95);
    iconCircle(s, 'FiUsers', x2 + 0.3, 2.85, 0.46);
    T(s, '소개해 주는 사람들', { x: x2 + 0.9, y: 2.9, w: w2 - 1.1, h: 0.34, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '동네 맛집, 뷰티 콘텐츠를 만드는 크리에이터들이 이용권을 소개하기도 합니다. 이때도 나가는 건 팔린 것에 대한 소개비뿐, 미리 주는 돈은 없습니다.', { x: x2 + 0.3, y: 3.4, w: w2 - 0.6, h: 1.1, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    card(s, x2, 4.8, w2, 1.95);
    iconCircle(s, 'FiStar', x2 + 0.3, 5.05, 0.46);
    T(s, '후기는 유어딜이 모읍니다', { x: x2 + 0.9, y: 5.1, w: w2 - 1.1, h: 0.34, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '첫 후기를 남긴 손님에게는 유어딜이 포인트를 드립니다. 사장님 부담 없이 후기가 쌓입니다.', { x: x2 + 0.3, y: 5.6, w: w2 - 0.6, h: 1.1, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    phone(s, 'home', 10.4, 1.05, 5.35, { caption: '유어딜 홈 (라이브 화면)' });
    s.addNotes('노출 4곳: 홈 섹션/지도(/map)/검색·카톡 OG/유어쇼츠(/videos). 소개비: 매장 제안 %, 매장 부담 — %·풀 규모 숫자는 넣지 않는다. 리뷰 보너스 1,000딜 유어딜 부담 — "포인트"로만.');
  }

  // ───────── 05 FAQ ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '자주 묻는 질문');
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
    s.addNotes('만료 자동 환불: auto-settlement.ts (100%). QR CAS: group-buy-voucher.routes.ts. 독점·계약기간 없음. 수량 상한은 상품 필드.');
  }

  // ───────── 06 등록: 간편함 + 끝까지 돕는다 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '등록은 10분. 막히면 저희가 대신 해드립니다.');
    lead(s, '이게 전부입니다. 포스 연동도, 단말기도, 직원 교육도 필요 없습니다.', { y: 2.0, h: 0.4, w: 6.0 });
    const steps = [
      ['urdeal.kr 에서 카카오 로그인', '별도 가입이 없습니다.'],
      ['카카오맵에서 내 가게 찾기', '주소와 전화번호가 자동으로 채워집니다.'],
      ['사업자등록증 사진 한 장', '유어딜이 직접 확인하고 승인 문자를 드립니다. 그날부터 판매가 시작됩니다.'],
    ];
    let y = 2.7;
    steps.forEach(([h, p], i) => {
      numBadge(s, i + 1, M, y + 0.02, 0.38);
      T(s, h, { x: M + 0.55, y, w: 5.4, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.55, y: y + 0.34, w: 5.4, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 0.82;
    });
    card(s, M, y + 0.1, 5.95, 1.55, { fill: C.tint });
    T(s, '폰이 익숙하지 않으셔도 괜찮습니다', { x: M + 0.3, y: y + 0.25, w: 5.35, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '카카오톡 채널로 말씀 주시면 등록부터 첫 이용권 올리는 것까지 전화로 같이 하거나, 저희가 대신 만들어 드립니다. 승인이 나면 문자로 알려드리고, 그날부터 판매가 시작됩니다.', { x: M + 0.3, y: y + 0.58, w: 5.35, h: 1.0, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    const ph = 4.55;
    const pw = phone(s, 'store-new', 7.15, 1.95, ph, { caption: '카카오맵에서 내 가게 찾기' });
    phone(s, 'store-new-channel', 7.15 + pw + 0.55, 1.95, ph, { caption: '"누가 운영하나요" 화면' });
    s.addNotes('StoreRegisterModal.tsx 마법사. 승인은 사람(seller-stores.routes.ts 자동 승인 없음). "대신 만들어 드립니다"는 대표 운영 약속(코드 아님). 누가 먼저 올려 둔 매장의 사장님 입구는 /store/find (상세판 9장).');
  }

  // ───────── 07 운영·정산: 장사만 하세요 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님은 장사만 하세요. 나머지는 알아서 돌아갑니다.', { w: 8.8 });
    label(s, '운영', M, 2.15, 4);
    iconCircle(s, 'FiSmartphone', M, 2.5, 0.46);
    T(s, '손님이 오면 폰으로 QR 한 번 찍기', { x: M + 0.65, y: 2.5, w: 7.3, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '사장님이 하실 일은 이게 전부입니다. 스캔이 어려우면 매장 확인코드 6자리를 알려 주면 손님이 직접 입력합니다.', { x: M + 0.65, y: 2.85, w: 7.3, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
    label(s, '정산', M, 3.55, 4);
    T(s, '손님이 실제로 쓴 이용권만 모아 매주 등록 계좌로 들어옵니다. 얼마 팔렸고, 얼마 들어올지는 매장 화면에 항상 떠 있어서 궁금해서 전화하실 일이 없습니다. 별도 정산 수수료도 없습니다.',
      { x: M, y: 3.9, w: 8.0, h: 0.9, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.5, valign: 'top' });
    label(s, '바꾸고 싶을 때', M, 4.95, 4);
    T(s, '가격, 수량, 유효기간은 언제든 바꾸고, 바쁘면 판매를 잠시 멈추면 됩니다. 계약 기간이 없으니 그만두는 것도 사장님 마음입니다.',
      { x: M, y: 5.3, w: 8.0, h: 0.7, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.5, valign: 'top' });
    card(s, M, 6.0, 8.0, 0.75, { fill: C.tint });
    T(s, [
      { text: '정산 계좌는 사장님 본인만 바꿀 수 있습니다. ', options: { bold: true, color: C.ink } },
      { text: '운영을 누구에게 맡겨도.', options: { color: C.inkSoft } },
    ], { x: M + 0.3, y: 6.0, w: 7.4, h: 0.75, fontSize: 12, valign: 'middle' });
    phone(s, 'seller-settlements', 10.0, 1.05, 5.35, { caption: '정산 화면 (예시 데이터)' });
    s.addNotes('사용 처리: group-buy-voucher.routes.ts. payouts-generate.ts: 매주 월요일, 최소 10,000원(이월), 승인·송금은 사람. 계좌 변경 owner 전용.');
  }

  // ───────── 08 마무리: 부담 없는 시작 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '일단 메뉴 하나만 올려보세요.');
    const x = M, w = 7.6;
    card(s, x, 2.15, w, 1.95, { fill: C.tint });
    T(s, '가입비도 없고, 계약 기간도 없고, 안 팔리면 나가는 돈도 없습니다. 제일 자신 있는 메뉴 하나로 시작해서, 맞는다 싶으면 늘리고 아니면 내리면 됩니다. 그만두실 때 위약금도, 눈치 볼 사람도 없습니다.',
      { x: x + 0.3, y: 2.25, w: w - 0.6, h: 1.1, fontSize: 12, color: C.ink, lineSpacingMultiple: 1.5, valign: 'top' });
    T(s, '시작이 어려우시면 카카오톡으로 "등록 도와주세요" 한 마디만 남겨 주세요. 사람이 답합니다.', { x: x + 0.3, y: 3.4, w: w - 0.6, h: 0.6, fontSize: 12, bold: true, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    label(s, '시작하는 방법', x, 4.4, w);
    const steps = [['카카오 로그인', 'urdeal.kr 에서 카카오로 로그인합니다. 별도 가입이 없습니다.'], ['매장 등록 (10분)', 'urdeal.kr/store/new 에서 내 가게를 찾고 등록증 사진을 올립니다.'], ['첫 이용권 올리기', '승인 문자를 받으면 메뉴 하나를 올립니다. 그날부터 팔립니다.']];
    steps.forEach(([h, p], i) => {
      const y = 4.75 + i * 0.66;
      numBadge(s, i + 1, x, y, 0.36);
      T(s, h, { x: x + 0.5, y: y - 0.02, w: 2.6, h: 0.4, fontSize: 12.5, bold: true, color: C.ink, valign: 'middle', charSpacing: -0.3 });
      T(s, p, { x: x + 3.1, y: y - 0.02, w: w - 3.1, h: 0.4, fontSize: 10.5, color: C.inkSoft, valign: 'middle' });
    });
    const cx = 9.0, cw = W - M - cx, cy = 2.15, ch = 4.4;
    card(s, cx, cy, cw, ch, { fill: C.ink });
    T(s, '문의', { x: cx + 0.35, y: cy + 0.3, w: cw - 0.7, h: 0.3, fontSize: 11, bold: true, color: C.darkMuted, charSpacing: 1.2 });
    const contacts = [['FiGlobeW', 'urdeal.kr/store/new', '매장 등록'], ['FiMessageW', FACTS.kakaoChannel, '카카오톡 채널 상담. "등록 도와주세요"'], ['FiMailW', FACTS.contactEmail, '이메일']];
    let ky = cy + 0.8;
    contacts.forEach(([i, v, l]) => {
      s.addImage({ data: ic[i], x: cx + 0.35, y: ky + 0.04, w: 0.26, h: 0.26 });
      T(s, v, { x: cx + 0.75, y: ky, w: cw - 1.1, h: 0.34, fontSize: 13, bold: true, color: C.darkText, charSpacing: -0.3 });
      T(s, l, { x: cx + 0.75, y: ky + 0.34, w: cw - 1.1, h: 0.26, fontSize: 9.5, color: C.darkMuted });
      ky += 0.85;
    });
    T(s, FACTS.biz, { x: cx + 0.35, y: cy + ch - 0.55, w: cw - 0.7, h: 0.3, fontSize: 9, color: C.darkMuted });
    s.addNotes('대안 헤드라인: "잘 맞는지 한 달만 해보셔도 됩니다." / "부담 없이 시작하고, 부담 없이 그만두세요." 연락처는 대표 지정값.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(8 slides)');
})();
