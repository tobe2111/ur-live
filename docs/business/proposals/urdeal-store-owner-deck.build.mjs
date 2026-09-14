// 유어딜 매장 사장님 소개서 (.pptx) 생성기 — v2 (2026-09-14): 대표 8장 구성안 (설득 5장 → 이용 안내 3장)
// 원칙: 실측 성과 수치("매출 O% 증가")는 쓰지 않는다. "돈이 언제 나가는가, 측정이 되는가" 구조 비교로 설득한다.
// 기획: docs/business/proposals/three-decks-plan-2026-09.md §2 · 사실 SSOT: 같은 문서 §0 + docs/design/actor-benefit-map.md
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons  (node_modules 심링크는 README 참조)
//         SHOTS_DIR=<캡처 폴더> node urdeal-store-owner-deck.build.mjs out.pptx
import path from 'node:path';
import { createDeck, C, W, H, M, FACTS, __dirname } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-store-owner-deck.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');

(async () => {
  const d = await createDeck({
    title: '유어딜 매장 사장님 소개서', footer: '유어딜 매장 사장님 소개', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'detail', 'store-new', 'store-new-channel', 'seller-settlements', 'seller-scan'],
  });
  const { pres, ic, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv } = d;

  // ───────── 01 표지: 서비스 소개 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    T(s, '매장 사장님 소개 · ' + FACTS.liveMeasuredAt, { x: M, y: 0.98, w: 6, h: 0.25, fontSize: 10, color: C.darkMuted, charSpacing: 0.5 });
    T(s, '팔린 만큼만\n냅니다.', { x: M, y: 1.35, w: 7.4, h: 1.9, fontSize: 50, bold: true, color: C.darkText, lineSpacingMultiple: 1.05, charSpacing: -1.5, valign: 'top' });
    T(s, '유어딜은 가게 이용권을 온라인에서 미리 파는 곳입니다. "한우 런치 2인", "커트+클리닉". 사장님이 정한 메뉴를 사장님이 정한 할인가로 올리면, 손님이 먼저 결제하고 이용권을 들고 가게로 옵니다.',
      { x: M, y: 3.35, w: 7.2, h: 0.95, fontSize: 13, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top' });
    T(s, '광고를 파는 게 아니라 사장님의 상품을 팝니다. 그래서 미리 내는 돈이 없고, 팔린 이용권에만 수수료를 냅니다.',
      { x: M, y: 4.32, w: 7.2, h: 0.6, fontSize: 13, bold: true, color: C.darkText, lineSpacingMultiple: 1.5, valign: 'top' });
    const stats = [[FACTS.feeDirect, '수수료 전부.\n안 팔리면 0원'], ['0원', '가입비, 월비,\n선불 광고비'], ['90%', '팔린 금액 중\n사장님 몫']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.45;
      T(s, n, { x, y: 5.1, w: 2.3, h: 0.7, fontSize: 36, bold: true, color: C.darkText, charSpacing: -1.2 });
      T(s, l, { x, y: 5.82, w: 2.3, h: 0.6, fontSize: 10, color: C.darkMuted, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    phone(s, 'home', 9.3, 1.1, 5.7, { dark: true });
    s.addNotes('10%: 직접 등록 기준(fee-resolver.ts, 09-07 대표 확정. 대행사 경유는 5% — 사장님 덱에서는 단순화해 10% 하나만). 0원: 가입비·월비·광고비 없음. 90%: 사장님 몫. 오른쪽은 urdeal.kr 홈 라이브 캡처.');
  }

  // ───────── 02 기존 방식의 한계 (비교표) ─────────
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
    s.addNotes('이 문서의 심장. 체험단·광고를 깎아내리지 않고 "돈이 나가는 시점"과 "측정 가능성"만 비교한다(사실 비교라 반박 여지 없음). 성과 수치는 실측 전이라 전부 배제.');
  }

  // ───────── 03 차별점: 결과가 숫자로 남습니다 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '홍보비가 아니라 매출입니다.');
    card(s, M, 2.15, 5.9, 4.65);
    const x = M + 0.35, w = 5.2;
    label(s, '지금 유어딜에서 팔리고 있는 실제 상품 (치즈돈가스 2인 세트)', x, 2.35, w);
    const yEnd = kv(s, [
      ['정가', '25,000원', 0], ['이용권 판매가 (할인율은 사장님이 정함)', '16,500원', 0, true],
      ['유어딜 수수료 10%', '−1,650원', 0], ['카드 수수료', '0원 (유어딜 부담)', 0, true],
      ['사장님 계좌에 들어오는 돈', '14,850원', 2],
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
    s.addNotes('상품 2888(홍대돈까스, 라이브 유일의 실제 매장 이용권) 09-13 실측: 정가 25,000 / 판매가 16,500. 카드 수수료(현재 약 2.75%, 변동 가능)는 유어딜 부담. 정산은 used 만(payouts-generate.ts).');
  }

  // ───────── 04 손님은 어디서 보고 오나 ─────────
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
    phone(s, 'detail', 10.4, 1.05, 5.35, { caption: '이용권 상세 (라이브 화면)' });
    s.addNotes('노출 4곳: 홈 섹션/지도(/map)/검색·카톡 OG/유어쇼츠(/videos). 소개비: 매장 제안 %, 매장 부담 — 대표 지시로 %·풀 규모 숫자는 넣지 않는다. 리뷰 보너스 1,000딜 유어딜 부담(review-bonus-funding.ts) — 문서엔 "포인트"로만.');
  }

  // ───────── 05 걱정되는 것들 ─────────
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
    phone(s, 'seller-scan', 9.7, 1.05, 5.35, { caption: '매장 QR 사용 처리 화면 (예시 데이터)' });
    s.addNotes('만료 자동 환불: auto-settlement.ts handleExpiredVoucherRefunds (100%). QR CAS: group-buy-voucher.routes.ts. 확인코드는 매장만(RedeemHowTo.tsx). 독점·계약기간 없음(코드 제약 0). 수량 상한은 상품 필드.');
  }

  // ───────── 06 등록: 10분이면 끝납니다 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '시작할 때 여쭤보는 건 네 가지뿐입니다.');
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
    T(s, '승인되면 메뉴 이름, 정가, 판매가, 수량, 유효기간을 넣는 순간 판매가 시작됩니다. 누가 먼저 내 매장을 올려 뒀다면 urdeal.kr/store/find 에서 내 가게를 찾아 소유자 신청을 하면 됩니다.',
      { x: M + 0.3, y: y + 0.05, w: 5.35, h: 0.9, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'middle' });
    const ph = 4.55;
    const pw = phone(s, 'store-new', 7.15, 1.95, ph, { caption: '2단계: 카카오맵에서 내 가게 찾기' });
    phone(s, 'store-new-channel', 7.15 + pw + 0.55, 1.95, ph, { caption: '"누가 운영하나요" 화면' });
    s.addNotes('StoreRegisterModal.tsx 4단계(09-07 마법사). 승인은 사람(seller-stores.routes.ts 자동 승인 없음). 사업자번호 선택. 대리 등록 매장의 사장님 입구는 /store/find (StoreOwnerClaimPage).');
  }

  // ───────── 07 운영과 정산: 일주일에 10분 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '운영과 정산. 다 합쳐 일주일에 10분입니다.', { w: 8.6 });
    label(s, '운영', M, 2.15, 4);
    const ops = [
      ['FiSmartphone', '손님이 오면 폰으로 QR 한 번 찍기', '스캔이 어려우면 매장 확인코드 6자리를 알려 주면 손님이 직접 입력합니다.'],
      ['FiRefreshCcw', '가격, 수량, 유효기간은 언제든 수정', '쉬고 싶으면 판매를 멈추면 됩니다. 계약 기간이 없습니다.'],
    ];
    let y = 2.5;
    ops.forEach(([i, h, p]) => {
      iconCircle(s, i, M, y, 0.46);
      T(s, h, { x: M + 0.65, y, w: 7.3, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.65, y: y + 0.35, w: 7.3, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 0.95;
    });
    label(s, '정산', M, y + 0.1, 4);
    T(s, '결제됐다고 바로가 아니라, 손님이 가게에서 실제로 쓴 이용권만 매주 모아 등록 계좌로 입금됩니다. 수수료를 뗀 금액 그대로, 별도 정산 수수료 없이. 오늘 팔린 것, 사용된 것, 입금 예정 금액은 매장 관리 화면에 항상 떠 있습니다.',
      { x: M, y: y + 0.45, w: 8.0, h: 1.1, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.5, valign: 'top' });
    card(s, M, 5.75, 8.0, 0.95, { fill: C.tint });
    T(s, [
      { text: '정산 계좌는 사장님 본인만 바꿀 수 있습니다. ', options: { bold: true, color: C.ink } },
      { text: '운영을 누구에게 맡겨도.', options: { color: C.inkSoft } },
    ], { x: M + 0.3, y: 5.75, w: 7.4, h: 0.95, fontSize: 12, valign: 'middle' });
    phone(s, 'seller-settlements', 10.0, 1.05, 5.35, { caption: '정산 화면 (예시 데이터)' });
    s.addNotes('사용 처리: group-buy-voucher.routes.ts /:code/use-by-seller(직원 QR) · /:code/use(확인코드). payouts-generate.ts: 매주 월요일, 최소 10,000원(못 미치면 이월), 승인·송금은 사람. 계좌 변경 owner 전용(seller-profile.routes.ts).');
  }

  // ───────── 08 시작하기 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '지금 시작하면 그 동네의 첫 매장입니다.');
    const x = M, w = 7.6;
    card(s, x, 2.15, w, 1.7, { fill: C.tint });
    T(s, '유어딜은 이제 시작하는 서비스입니다. 등록 매장 수를 부풀려 말하지 않겠습니다. 대신 조건을 먼저 공개합니다. 수수료 10%, 미리 내는 돈 0원, 매주 정산. 지금 들어오시는 매장이 그 동네, 그 업종의 첫 자리를 가져갑니다.',
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
    s.addNotes('정직 고지(수치 없이): 09-13 실측 활성 337 중 실제 매장 1. 연락처는 대표 지정값. 상인회장에게는 1·2·3·5·8장 다섯 장만 추려도 완결.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(8 slides)');
})();
