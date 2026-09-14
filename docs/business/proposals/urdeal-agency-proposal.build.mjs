// 유어딜 대행사 제휴 제안서 (.pptx) 생성기 — v5 (2026-09-13): v4(09-07 대표 참고 PDF 반영)를 공통 모듈 deck-common.mjs 로 이행 + 실측 갱신
// 사실 출처: docs/business/proposals/three-decks-plan-2026-09.md §0 · docs/design/store-operator-model.md §7 ·
//            seller-stores.routes.ts(국세청 진위확인·카카오맵·채널) · auto-settlement.ts(사용분 주간 정산) ·
//            라이브 실측 2026-09-13 (활성 이용권 337 · 평균가 식사 32,411 / 숙박 155,824 · 실제 매장 1 · 인플루언서 DB 201,471)
// 재생성: cd /tmp/deck && npm i pptxgenjs sharp react react-dom react-icons  (node_modules 심링크는 README 참조)
//         SHOTS_DIR=<캡처 폴더> node urdeal-agency-proposal.build.mjs out.pptx
import fs from 'node:fs';
import path from 'node:path';
import { createDeck, C, FONT, W, H, M, FACTS, __dirname } from './deck-common.mjs';

const OUT = process.argv[2] || path.join(__dirname, 'urdeal-agency-proposal.pptx');
const SHOTS_DIR = process.env.SHOTS_DIR || path.join(__dirname, 'shots');

(async () => {
  const d = await createDeck({
    title: '유어딜 대행사 제휴 제안서', footer: '유어딜 대행사 제휴 제안', shotsDir: SHOTS_DIR,
    shotKeys: ['home', 'detail', 'use', 'shop', 'seller-stores', 'seller-influencers', 'seller-operating', 'seller-operators'],
  });
  const { pres, ic, T, chrome, title, lead, card, iconCircle, numBadge, hr, label, phone, kv } = d;

  // ───────── 01 표지 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    label(s, '대행사 제휴 제안, 2026년 9월', M, 1.55, 6, { color: C.brand });
    s.addText([
      { text: '매장을 소개해 주시면,', options: { breakLine: true } },
      { text: '유어딜은 ', options: {} },
      { text: '5%만', options: { color: C.brand } },
      { text: ' 받습니다.', options: {} },
    ], { x: M, y: 1.95, w: 7.6, h: 1.9, fontFace: FONT, fontSize: 40, bold: true, color: C.darkText, isTextBox: true, margin: 0, valign: 'top', lineSpacingMultiple: 1.14, charSpacing: -1 });
    T(s, '나머지 95%는 매장 몫입니다. 그 안에서 매장과 직접 거래하십시오. 귀사의 보수를 유어딜이 정하지 않고, 상한도 두지 않습니다.', {
      x: M, y: 3.85, w: 6.8, h: 0.8, fontSize: 13, color: C.darkMuted, lineSpacingMultiple: 1.5, valign: 'top',
    });
    hr(s, M, 4.72, 7.4, { dark: true });
    const stats = [['5%', '중개 경유 매장의\n유어딜 수수료'], ['95%', '매장 몫.\n귀사와의 거래 재원'], ['0원', '입점비, 월정액,\n광고비']];
    stats.forEach(([n, l], i) => {
      const x = M + i * 2.5;
      T(s, n, { x, y: 4.88, w: 2.3, h: 0.65, fontSize: 30, bold: true, color: i === 2 ? C.brand : C.darkText, charSpacing: -1 });
      T(s, l, { x, y: 5.55, w: 2.3, h: 0.6, fontSize: 10.5, color: C.darkMuted, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    T(s, '유어딜은 손님이 미리 결제하고 매장에 찾아오는 이용권을 팝니다. 식당, 뷰티샵, 숙소가 팔고 있습니다. 매장을 모으고 대신 운영해 주실 파트너를 찾습니다.', { x: M, y: 6.2, w: 7.4, h: 0.5, fontSize: 10.5, color: C.darkMuted, lineSpacingMultiple: 1.4, valign: 'top' });
    phone(s, 'home', 9.3, 0.95, 5.95, { dark: true });
    s.addNotes('표지. 5% / 95% / 0원. 2026-09-04 대표 확정. 오른쪽은 urdeal.kr 홈(모바일) 라이브 캡처.');
  }

  // ───────── 02 한 장 요약 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '바쁘실 테니, 한 장으로 먼저 정리했습니다.');
    const cells = [
      ['FiMapPin', '무엇을 파나', '동네 식당, 카페, 미용, 숙박, 액티비티의 이용권. 손님이 온라인에서 할인가로 미리 사고 매장에 와서 QR로 씁니다. 배송도 재고도 없습니다.'],
      ['FiUsers', '대행사는 무엇을 하나', '매장을 찾아 유어딜에 올리고(10분), 이용권을 만들고(3분), 인플루언서를 붙이고, 매장에 성과를 보고합니다. 돈을 걷거나 나누는 일은 없습니다.'],
      ['FiPercent', '누가 얼마를 내나', '매장이 팔린 금액의 5%를 유어딜에 냅니다(직접 입점은 10%). 나머지 95% 안에서 매장이 인플루언서 소개비(딜마다 정한 %)와 대행사 보수(계약)를 냅니다. 대행사가 유어딜에 내는 돈은 0입니다.'],
      ['FiCreditCard', '유어딜은 무엇을 하나', '결제(토스), 이용권 발급, QR 확인 앱, 주간 정산, 원천징수, 환불 응대, 홈 지도 노출과 검색 유입. 인플루언서 DB와 제안 발송까지.'],
    ];
    const cw = (W - 2 * M - 0.4) / 2;
    cells.forEach(([i, h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.4), y = 2.2 + row * 2.2;
      iconCircle(s, i, x, y, 0.46);
      T(s, h, { x: x + 0.65, y: y + 0.06, w: cw - 0.7, h: 0.35, fontSize: 16, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x, y: y + 0.65, w: cw - 0.3, h: 1.2, fontSize: 11.5, color: C.inkSoft, lineSpacingMultiple: 1.5, valign: 'top' });
      if (row === 0) hr(s, x, y + 1.95, cw - 0.3);
    });
    T(s, '숫자 근거와 절차는 다음 장부터 순서대로. 마지막 장에 8주 파일럿 조건이 있습니다.', { x: M, y: 6.55, w: W - 2 * M, h: 0.3, fontSize: 10.5, color: C.gray });
    s.addNotes('요약. 사업계획서 C-2 + store-operator-model §7.');
  }

  // ───────── 03 이용권 (라이브 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '메뉴 하나가 곧 상품입니다.\n이용권은 이렇게 생겼습니다.', { w: 6.6 });
    lead(s, '손님이 보는 실제 화면입니다. 정가와 할인가가 함께 보이고, 토스로 결제하면 이용권이 바로 발급됩니다. 유효기간, 할인율, 마감 수량은 전부 매장이 정하고, 안 쓴 이용권은 100% 자동 환불됩니다.', { w: 6.3, y: 2.35, h: 1.1 });
    const facts = [['32,411원', '식사 이용권 평균가 (241개)'], ['155,824원', '숙박 이용권 평균가. 식사의 4.8배'], ['0', '재고, 배송, 반품']];
    let y = 3.75;
    facts.forEach(([n, l], i) => {
      T(s, n, { x: M, y, w: 2.9, h: 0.7, fontSize: 32, bold: true, color: i === 2 ? C.brand : C.ink, charSpacing: -1 });
      T(s, l, { x: M + 2.95, y: y + 0.22, w: 3.4, h: 0.4, fontSize: 12, color: C.inkSoft });
      hr(s, M, y + 0.82, 5.8);
      y += 0.92;
    });
    T(s, '2026년 9월 13일 urdeal.kr 활성 이용권 337개의 카탈로그 평균가. 실거래 평균이 아니라 가격대 참고치입니다.', { x: M, y: 6.55, w: 6.3, h: 0.3, fontSize: 9.5, color: C.gray });
    const pw3 = phone(s, 'detail', 7.6, 1.1, 4.95, { caption: '이용권 상세' });
    phone(s, 'use', 7.6 + pw3 + 0.3, 1.1, 4.95, { caption: '사용 방법과 환불 안내' });
    s.addNotes('평균가는 2026-09-07 공개 API 실측(meal 242건 avg 32,339 / stay 51건 avg 155,824). 캡처는 scripts/capture-proposal-shots.mjs (detail/use).');
  }

  // ───────── 04 돈의 흐름 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님이 낸 돈은 어디로 갈까요? 유어딜 몫은 5%에서 끝납니다.');
    lead(s, '구조가 단순해서 흐릴 것이 없습니다. 카드 결제 수수료까지 같은 그림에 적었습니다.', { y: 2.0, h: 0.4 });
    const bw = 2.2, gap = 0.5, by = 2.6, bh = 0.78;
    const nodes = [['손님', '이용권 결제', C.surface], ['카드사', '결제 처리', C.surface], ['유어딜', '5%', C.ink], ['매장', '나머지 95%', C.tint]];
    nodes.forEach(([h, sub, fill], i) => {
      const x = M + i * (bw + gap);
      const dk = fill === C.ink;
      card(s, x, by, bw, bh, { fill });
      T(s, h, { x, y: by + 0.1, w: bw, h: 0.32, fontSize: 14, bold: true, color: dk ? C.darkText : (i === 3 ? C.brand : C.ink), align: 'center', charSpacing: -0.3 });
      T(s, sub, { x, y: by + 0.42, w: bw, h: 0.26, fontSize: 10, color: dk ? C.brand : C.inkSoft, align: 'center', bold: dk });
      if (i < 3) s.addImage({ data: ic.FiArrowGray, x: x + bw + 0.13, y: by + bh / 2 - 0.12, w: 0.24, h: 0.24 });
    });
    // 아래로 갈라지는 것들
    const drop = (i, big, small) => {
      const x = M + i * (bw + gap);
      s.addShape(pres.shapes.LINE, { x: x + bw / 2, y: by + bh, w: 0, h: 0.32, line: { color: C.gray, width: 0.75, endArrowType: 'triangle' } });
      T(s, big, { x, y: by + bh + 0.38, w: bw, h: 0.34, fontSize: 15, bold: true, color: C.ink, align: 'center', charSpacing: -0.5 });
      T(s, small, { x: x - 0.15, y: by + bh + 0.72, w: bw + 0.3, h: 0.5, fontSize: 9.5, color: C.inkSoft, align: 'center', lineSpacingMultiple: 1.35, valign: 'top' });
    };
    drop(1, '약 2.75%', '카드 결제 수수료.\n유어딜이 자기 5% 안에서 냅니다.\n카드사 정책에 따라 바뀔 수 있습니다');
    drop(2, '5%', '중개 경유 매장\n(직접 입점은 10%)');
    {
      const x = M + 3 * (bw + gap);
      s.addShape(pres.shapes.LINE, { x: x + bw / 2, y: by + bh, w: 0, h: 0.32, line: { color: C.gray, width: 0.75, endArrowType: 'triangle' } });
      const cy = by + bh + 0.36, cw = W - M - x, ch = 1.62;
      card(s, x, cy, cw, ch, { fill: C.tint });
      T(s, '귀사의 보수', { x: x + 0.25, y: cy + 0.14, w: cw - 0.5, h: 0.3, fontSize: 13, bold: true, color: C.brand, charSpacing: -0.3 });
      T(s, '매장과 직접 정하는 금액. 유어딜은 이 거래의 당사자가 아니고, 상한도 두지 않습니다.', { x: x + 0.25, y: cy + 0.44, w: cw - 0.5, h: 0.5, fontSize: 9.5, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
      T(s, '인플루언서 소개비', { x: x + 0.25, y: cy + 0.95, w: cw - 0.5, h: 0.28, fontSize: 11.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, '매장이 딜마다 정하는 %. 귀속과 지급은 유어딜이 자동 처리합니다.', { x: x + 0.25, y: cy + 1.22, w: cw - 0.5, h: 0.4, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    }
    // 흔한 오해 / 실제
    const cy2 = 5.38, cw2 = (8.3 - 0.3) / 2, ch2 = 1.1;
    [['흔한 오해', '"직접 입점 10%와 중개 5%의 차액 5%가 대행사 몫이다."', C.surface],
     ['실제', '차액은 유어딜이 덜 받는 것입니다. 매장에 여유를 남겨 귀사가 그 안에서 거래하시라는 뜻입니다. 귀사의 단가는 유어딜이 아니라 귀사와 매장이 정합니다.', C.surface]].forEach(([h, p, f], i) => {
      const x = M + i * (cw2 + 0.3);
      card(s, x, cy2, cw2, ch2, { fill: f });
      T(s, h, { x: x + 0.25, y: cy2 + 0.14, w: cw2 - 0.5, h: 0.28, fontSize: 11.5, bold: true, color: i ? C.brand : C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.25, y: cy2 + 0.44, w: cw2 - 0.5, h: 0.68, fontSize: 9.5, color: C.inkSoft, lineSpacingMultiple: 1.35, valign: 'top' });
    });
    T(s, '유어딜 정산은 매장 계좌로만 갑니다. 귀사 보수는 매장이 귀사에게 직접 지급하고, 유어딜 장부에는 그 지급이 한 줄도 등장하지 않습니다.', { x: M, y: 6.56, w: W - 2 * M, h: 0.26, fontSize: 10.5, color: C.ink, bold: true });
    s.addNotes('2026-09-04 대표 확정: "중개사가 5% 내에서 가져가는 게 아니라 나머지 95%에서 매장이랑 거래". PG 2.75% 는 commission-budget.ts 실측 상수(플랫폼 부담). 정산은 used 이용권만 주간(auto-settlement.ts).');
  }

  // ───────── 05 매장 1곳 단위 경제 + 규모별 계산 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '매장 한 곳이 귀사에게 얼마가 되는지, 가정까지 함께 적었습니다.', { size: 25 });
    card(s, M, 2.15, 5.6, 4.65);
    const x = M + 0.35, w = 4.9;
    label(s, '매장 한 곳, 한 달 (바꿔서 다시 계산하셔도 됩니다)', x, 2.35, w);
    const yEnd = kv(s, [
      ['식사 이용권 평균가 (라이브 실측)', '32,411원', 0], ['매장당 월 판매 (하루 1건 가정)', '30건', 0], ['매장 월 거래액', '972,330원', 0, true],
      ['유어딜 5%', '48,617원', 0], ['매장 몫 95%', '923,714원', 0, true],
      ['   인플루언서 소개비 (매장 제안 10% 가정)', '97,233원', 1], ['   귀사 보수 (3% 예시)', '29,170원', 2], ['   매장 순수취', '797,311원', 1],
    ], x, 2.7, w, { rowH: 0.41 });
    T(s, '3%는 유어딜이 정한 값이 아니라 계산을 보여 드리려고 넣은 값입니다. 2%로도, 5%로도, 매장별로 다르게도 하실 수 있습니다.', { x, y: yEnd + 0.1, w, h: 0.6, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    // 규모별 표
    const tx = 6.65, tw = W - M - tx;
    label(s, '매장 수를 늘리면 (같은 가정)', tx, 2.2, tw);
    const hdr = ['운영 매장', '월 거래', '거래액', '매장 몫 95%', '귀사 3% 가정'];
    const body = [
      ['10곳', '300건', '972만원', '924만원', '29만원'],
      ['30곳', '900건', '2,917만원', '2,771만원', '88만원'],
      ['100곳', '3,000건', '9,723만원', '9,237만원', '292만원'],
      ['300곳', '9,000건', '2억 9,170만원', '2억 7,711만원', '875만원'],
    ];
    const colW = [1.0, 1.0, 1.45, 1.45, tw - 4.9];
    const colX = colW.map((_, i) => tx + colW.slice(0, i).reduce((a, b) => a + b, 0));
    hdr.forEach((h, i) => T(s, h, { x: colX[i], y: 2.5, w: colW[i], h: 0.26, fontSize: 9.5, bold: true, color: C.gray, align: i === 0 ? 'left' : 'right' }));
    hr(s, tx, 2.8, tw);
    body.forEach((r, ri) => {
      const y = 2.86 + ri * 0.46, hi = ri === 2;
      if (hi) s.addShape(pres.shapes.RECTANGLE, { x: tx - 0.1, y: y - 0.04, w: tw + 0.2, h: 0.46, fill: { color: C.tint }, line: { color: C.tint, width: 0 } });
      r.forEach((t, i) => T(s, t, { x: colX[i], y, w: colW[i], h: 0.38, fontSize: 11, bold: hi || i === 4, color: i === 4 ? C.brand : C.ink, align: i === 0 ? 'left' : 'right', valign: 'middle' }));
      hr(s, tx, y + 0.42, tw);
    });
    card(s, tx, 5.05, tw, 1.75, { fill: C.tint });
    T(s, '객단가가 가장 큰 변수입니다', { x: tx + 0.3, y: 5.22, w: tw - 0.6, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '숙박 이용권의 평균가는 155,824원으로 식사의 4.8배입니다. 같은 품을 들여 매장을 붙인다면 숙소와 뷰티 쪽이 식당보다 훨씬 큽니다. 위 표의 모든 숫자가 그만큼 곱해집니다.', { x: tx + 0.3, y: 5.55, w: tw - 0.6, h: 1.15, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    s.addNotes('평균가 32,339 / 155,824 는 2026-09-07 활성 이용권 카탈로그 평균(실거래 평균 아님). 하루 1건은 가정. 보수율은 매장과 귀사의 계약이며 유어딜이 정하지 않는다.');
  }

  // ───────── 06 사장님 셈법 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님이 "네" 하시는 이유도 숫자에 있습니다. 광고비를 먼저 내지 않으니까요.', { size: 25 });
    card(s, M, 2.15, 5.9, 4.65);
    const x = M + 0.35, w = 5.2;
    label(s, '이용권 한 장이 팔렸을 때 (파스타 2인 세트 예시)', x, 2.35, w);
    const yEnd = kv(s, [
      ['정가', '32,000원', 0], ['이용권 판매가 (22% 할인)', '25,000원', 0, true],
      ['유어딜 5%', '1,250원', 0], ['인플루언서 소개비 10% (매장 제안 예시)', '2,500원', 0], ['귀사 보수 3% (계약 예시)', '750원', 0, true],
      ['매장에 들어오는 돈', '20,500원', 2], ['재료비 35% 가정', '11,200원', 0, true], ['매장 이익', '9,300원', 2],
    ], x, 2.7, w, { rowH: 0.41 });
    T(s, '광고 없이 온 새 손님 한 명당 9,300원이 남습니다. 안 팔리면 0원이고, 세 항목 전부 팔린 뒤에만 나갑니다.', { x, y: yEnd + 0.12, w, h: 0.6, fontSize: 11, color: C.ink, lineSpacingMultiple: 1.4, valign: 'top' });
    const pts = [
      ['FiXCircle', '선지출 광고비 0', '배너, 검색 광고, 체험단처럼 미리 내는 돈이 없습니다. 팔린 만큼만 나갑니다.'],
      ['FiTag', '할인율과 유효기간은 사장님이', '남는 메뉴만 올리고, 할인율도 마감 수량도 직접 정합니다. 손해 보는 구조를 만들 수 없습니다.'],
      ['FiClock', '정산은 손님이 쓴 뒤 매주', '손님이 매장에서 QR을 찍은 이용권만 주간 정산으로 매장 계좌에 들어옵니다. 안 쓴 이용권은 손님에게 자동 환불됩니다.'],
      ['FiSmartphone', '사장님이 하는 일은 하나', '손님 QR을 폰으로 찍거나 확인 PIN을 눌러 주는 것. 등록과 운영은 대행사가 합니다.'],
    ];
    let py = 2.2;
    pts.forEach(([i, h, p]) => {
      iconCircle(s, i, 7.05, py, 0.44);
      T(s, h, { x: 7.7, y: py, w: W - M - 7.7, h: 0.32, fontSize: 13.5, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: 7.7, y: py + 0.36, w: W - M - 7.7, h: 0.75, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
      py += 1.18;
    });
    s.addNotes('재료비 35% 는 가정. 정산 규칙은 auto-settlement.ts. 사용 처리는 매장 QR 스캔 또는 확인 PIN.');
  }

  // ───────── 07 어떤 매장을 데려올지 (+ 유어샵 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '이 여섯 가지만 맞으면 됩니다.\n대부분 그 자리에서 진행됩니다.', { w: 7.5, size: 26 });
    const checks = [
      ['사업자등록이 있다', '사업자번호, 대표자명, 개업일로 국세청 진위확인을 합니다. 없으면 올릴 수 없습니다.'],
      ['카카오맵에 매장이 있다', '등록할 때 카카오맵 장소를 연결합니다. 없으면 사장님이 먼저 등록해야 합니다(무료, 하루 이틀).'],
      ['손님이 방문해서 쓰는 업종이다', '식당, 카페, 미용, 네일, 숙박, 키즈카페, 스튜디오, 클래스. 택배 상품만 파는 곳은 대상이 아닙니다.'],
      ['15~30% 할인해도 남는 대표 메뉴가 있다', '이용권은 할인가로 팝니다. 마진이 얇은 메뉴만 있는 곳은 사장님이 곧 후회합니다.'],
      ['사진이 3장 이상 있다', '이용권 카드의 절반은 사진입니다. 없으면 방문할 때 폰으로 찍어 오세요.'],
      ['사장님이나 직원이 폰으로 QR을 찍을 수 있다', '사용 처리는 매장 폰 한 대로 끝납니다. POS 연동이 필요 없습니다.'],
    ];
    const cw = (9.0 - 0.4) / 2;
    checks.forEach(([h, p], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (cw + 0.4), y = 2.4 + row * 1.35;
      s.addImage({ data: ic.FiCheck, x, y: y + 0.03, w: 0.26, h: 0.26 });
      T(s, h, { x: x + 0.38, y, w: cw - 0.4, h: 0.32, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: x + 0.38, y: y + 0.36, w: cw - 0.45, h: 0.85, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    card(s, M, 6.35, 9.0, 0.55, { fill: C.tint });
    T(s, '먼저 갈 곳: 배달앱이나 예약앱에 광고비를 쓰고 있는 매장. "그 돈을 팔린 뒤에만 내는 걸로 바꾸자"가 통합니다.', { x: M + 0.25, y: 6.35, w: 8.5, h: 0.55, fontSize: 10.5, color: C.ink, valign: 'middle' });
    phone(s, 'shop', 10.2, 1.1, 5.0, { caption: '올라간 매장 페이지 (유어샵)' });
    s.addNotes('등록 필수 필드는 seller-stores.routes.ts. 오른쪽은 /u/jiwon1228 라이브 캡처(대표 계정).');
  }

  // ───────── 08 매장 등록 10분 (+ 매장 관리 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님 앞에서 10분이면 됩니다.\n서류 없이, 담당자 폰으로 끝납니다.', { w: 8.8, size: 26 });
    const steps = [
      ['FiSearch', '카카오맵에서 매장 찾기', '/seller/stores 에서 매장 이름을 검색해 장소를 연결합니다. 주소와 좌표가 자동으로 들어옵니다.', '1분'],
      ['FiShield', '국세청 진위확인', '사업자번호, 대표자명, 개업일을 넣으면 국세청 조회로 즉시 확인됩니다. 사업자등록증 사진만 보면 됩니다.', '2분'],
      ['FiLayers', '"누가 운영하나요"에서 중개 선택', '"중개·대행사에요"를 고르면 그 매장은 5%가 적용됩니다. 등록은 귀사 계정으로 해도 되지만, 정산 계좌는 사장님이 소유자가 된 뒤에만 넣을 수 있습니다(17장). 확인 PIN도 여기서.', '1분'],
      ['FiCamera', '이용권 만들기', '사진, 정가, 판매가, 유효기간, 마감 수량. 대표 메뉴 두세 개면 충분합니다. 사진은 그 자리에서 찍어도 됩니다.', '3분씩'],
      ['FiSmartphone', '사장님께 사용법', '손님이 QR을 보여 주면 매장 폰으로 찍거나, 손님 화면에 매장 PIN을 눌러 주면 끝. 이것만 설명하면 됩니다.', '3분'],
    ];
    let y = 2.35;
    steps.forEach(([i, h, p, t], k) => {
      T(s, t, { x: M, y: y + 0.03, w: 0.9, h: 0.36, fontSize: 17, bold: true, color: C.brand, charSpacing: -0.6 });
      iconCircle(s, i, M + 0.95, y + 0.02, 0.4);
      T(s, h, { x: M + 1.5, y: y + 0.03, w: 6.4, h: 0.3, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 1.5, y: y + 0.36, w: 6.7, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.36, valign: 'top' });
      if (k < 4) hr(s, M, y + 0.84, 8.4);
      y += 0.88;
    });
    phone(s, 'seller-stores', 10.0, 1.15, 5.15, { caption: '매장 관리 화면 (예시 데이터)' });
    s.addNotes('시간은 현장 추정. 필드는 seller-stores.routes.ts 실재. 오른쪽은 /seller/stores 실제 UI 를 예시 데이터로 렌더한 캡처(프로덕션 무접촉).');
  }

  // ───────── 09 사장님 대본 (+ 상세 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '사장님께 드릴 말씀 네 마디와, 거절에 대한 답 다섯 가지를 준비했습니다.', { size: 25 });
    card(s, M, 2.15, 4.5, 4.7, { fill: C.ink });
    label(s, '5분 대본', M + 0.3, 2.35, 3, { color: C.brand });
    const lines = [
      ['열기', '"사장님, 배달앱 말고 손님이 가게에 직접 오게 하는 건데요. 미리 내는 돈은 없고 팔린 만큼만 5% 나갑니다."'],
      ['보여주기', '"이 메뉴를 이용권으로 올리면 이렇게 보입니다." (오른쪽 화면을 폰으로 보여 준다)'],
      ['정하기', '"어떤 메뉴를 몇 % 할인해서 올릴까요? 유효기간은요?" 사장님이 정하게 한다.'],
      ['끝내기', '"사업자등록증만 보여 주시면 지금 10분 안에 올라갑니다. 손님 오면 QR만 찍어 주세요."'],
    ];
    let y = 2.72;
    lines.forEach(([k, v]) => {
      T(s, k, { x: M + 0.3, y, w: 0.85, h: 0.3, fontSize: 10.5, bold: true, color: C.darkMuted });
      T(s, v, { x: M + 1.15, y, w: 3.05, h: 0.95, fontSize: 10.5, color: C.darkText, lineSpacingMultiple: 1.4, valign: 'top' });
      y += 1.0;
    });
    phone(s, 'detail', 5.6, 2.15, 4.7);
    const obj = [
      ['"할인하면 손해 아니에요?"', '남는 메뉴만, 사장님이 정한 할인율로만 올립니다. 안 팔리면 0원이고, 팔리면 새 손님입니다.'],
      ['"배달앱이랑 뭐가 달라요?"', '배달이 없고 손님이 가게에 옵니다. 수수료는 5%이고, 가게 페이지가 사장님 것으로 남습니다. 병행해도 됩니다.'],
      ['"정산은 언제 들어와요?"', '손님이 매장에서 쓴 이용권만 매주 정산돼 매장 계좌로 들어옵니다. 안 쓴 건 손님에게 자동 환불이라 분쟁이 없습니다.'],
      ['"귀찮은 일 있어요?"', '손님 QR을 폰으로 찍는 것 하나입니다. 등록, 이용권 관리, 인플루언서 섭외는 제가 합니다.'],
      ['"계약서 써야 해요?"', '유어딜과는 가입뿐입니다. 저와의 운영 위임은 권한 한 줄이고, 마음에 안 들면 오늘이라도 사장님이 빼시면 됩니다.'],
    ];
    const ox = 8.2, ow = W - M - ox;
    let oy = 2.15;
    obj.forEach(([q, a]) => {
      T(s, q, { x: ox, y: oy, w: ow, h: 0.28, fontSize: 12, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, a, { x: ox, y: oy + 0.3, w: ow, h: 0.6, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
      oy += 0.95;
    });
    s.addNotes('대본의 사실 주장은 앞 장들과 동일 출처. 가운데는 이용권 상세 라이브 캡처.');
  }

  // ───────── 10 인플루언서 붙이기 (+ 소개 파트너 찾기 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '섭외부터 정산까지,\n인플루언서 일은 화면 안에서 끝납니다.', { w: 6.8 });
    const steps = [
      ['DB에서 고른다', '/seller/influencers 에서 플랫폼과 팔로워 구간으로 거릅니다. 매장 동네에서 활동하는 채널을 우선합니다.'],
      ['제안을 접수한다', '매장 소개와 조건을 적어 접수하면 유어딜이 발송합니다. 연락처는 대행사에게도 공개되지 않습니다.'],
      ['딜을 맺는다', '/seller/influencer-deals 에서 커미션 %를 제안합니다. 매장이 정한 값이고 매장 부담입니다. 콘텐츠 게시 확인 뒤 발효되는 조건부도 됩니다.'],
      ['귀속은 자동', '수락 즉시 전용 링크가 나오고 그 링크로 들어온 주문이 자동 연결됩니다. 쿠폰 코드를 확인할 일이 없습니다.'],
      ['지급도 자동', '환불 가능 기간 7일이 지나면 확정되고, 원천징수를 계산해 유어딜이 지급합니다. 대행사가 돈을 옮기지 않습니다.'],
    ];
    let y = 2.35;
    steps.forEach(([h, p], i) => {
      numBadge(s, i + 1, M, y + 0.02, 0.36);
      T(s, h, { x: M + 0.55, y: y + 0.03, w: 6.0, h: 0.3, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.55, y: y + 0.36, w: 6.1, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.36, valign: 'top' });
      if (i < 4) hr(s, M, y + 0.84, 6.65);
      y += 0.88;
    });
    // 오른쪽: 인플루언서 풀 실제 관리 화면(연락처 블러) + 숫자
    const sx = 7.6, sw = W - M - sx;
    const shotPath = path.join(SHOTS_DIR, 'admin-influencer-pool-table.jpg');
    let ny = 1.25;
    if (fs.existsSync(shotPath)) {
      const ih = sw * (1120 / 2524);
      card(s, sx - 0.08, ny - 0.08, sw + 0.16, ih + 0.16);
      s.addImage({ data: 'image/jpeg;base64,' + fs.readFileSync(shotPath).toString('base64'), x: sx, y: ny, w: sw, h: ih });
      T(s, '유어딜 인플루언서 풀 (실제 화면, 연락처는 가렸습니다)', { x: sx, y: ny + ih + 0.18, w: sw, h: 0.26, fontSize: 9.5, color: C.inkSoft, align: 'center' });
      ny = ny + ih + 0.62;
    }
    label(s, '인플루언서 DB (' + FACTS.liveMeasuredAt + ' 실측)', sx, ny, sw);
    kv(s, [['전체', FACTS.influencerDb, 2], ['연락 가능', FACTS.influencerReachable, 2, true], ['네이버 블로그', FACTS.influencerNaverBlog, 0], ['유튜브', FACTS.influencerYoutube, 0], ['네이버 카페', '9,939명', 0]], sx, ny + 0.3, sw, { rowH: 0.36 });
    T(s, '인스타그램과 틱톡은 필터에 있으나 DB의 대부분은 네이버 블로그와 유튜브입니다.', { x: sx, y: ny + 2.15, w: sw, h: 0.45, fontSize: 8.5, color: C.gray, lineSpacingMultiple: 1.35, valign: 'top' });
    s.addNotes('숫자는 /api/admin/ads/influencer-pool/stats 2026-09-13 실측. 오른쪽은 /admin/influencer-pool 데스크톱 캡처(capture-admin-shots.mjs — 이메일·IG·TT 블러).');
  }

  // ───────── 11 주간 루틴 + 화면 3장 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '담당자 한 분의 일주일입니다.\n쓰는 화면은 여섯 장뿐입니다.', { w: 5.4 });
    const days = [
      ['월·화', '매장 방문 4곳', '체크리스트로 고른 매장을 방문해 등록합니다. 하루 2곳이면 충분합니다.'],
      ['수', '이용권 손보기', '사진 교체, 마감 수량, 할인율 조정. 잘 팔리는 메뉴는 수량을 늘립니다.'],
      ['목', '인플루언서 제안 5건', 'DB에서 매장 동네 채널을 골라 제안을 접수하고, 들어온 신청에 답합니다.'],
      ['금', '매장에 보고', '운영 매장 요약의 매장별 매출과 주문을 사장님께 보내고, 계약대로 청구합니다.'],
    ];
    let y = 2.35;
    days.forEach(([d, h, p], i) => {
      T(s, d, { x: M, y: y + 0.03, w: 0.8, h: 0.3, fontSize: 11, bold: true, color: C.brand, charSpacing: 0.5 });
      T(s, h, { x: M + 0.85, y: y + 0.02, w: 4.4, h: 0.3, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: M + 0.85, y: y + 0.34, w: 4.5, h: 0.5, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.36, valign: 'top' });
      if (i < 3) hr(s, M, y + 0.82, 5.3);
      y += 0.86;
    });
    label(s, '쓰는 화면 여섯 장 (전부 셀러 대시보드, 별도 프로그램 없음)', M, 5.85, 5.4);
    const tools = [['매장 관리', '/seller/stores'], ['운영 권한', '/seller/operators'], ['인플루언서 탐색', '/seller/influencers'], ['소개 협업', '/seller/influencer-deals'], ['소개비 내역', '/seller/promo-spend'], ['운영 매장 요약', '/seller/operating']];
    tools.forEach(([h, r], k) => {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * 2.75, ty = 6.15 + row * 0.25;
      T(s, h, { x, y: ty, w: 1.15, h: 0.24, fontSize: 9.5, bold: true, color: C.ink });
      T(s, r, { x: x + 1.15, y: ty + 0.01, w: 1.6, h: 0.22, fontSize: 8.5, color: C.brand, fontFace: 'Courier New' });
    });
    const ph = 4.05;
    const pw11 = ph * ((780 + 44) / (1688 + 44));
    const gap = 0.22, x0 = W - M - (3 * pw11 + 2 * gap);
    [['seller-stores', '매장 관리'], ['seller-operating', '운영 매장 요약'], ['seller-operators', '운영자 관리']].forEach(([k, cap], i) => {
      phone(s, k, x0 + i * (pw11 + gap), 2.0, ph, { caption: cap });
    });
    T(s, '예시 데이터로 렌더한 실제 화면', { x: x0, y: 6.55, w: 3 * pw11 + 2 * gap, h: 0.25, fontSize: 9, color: C.gray, align: 'center' });
    s.addNotes('라우트 6개는 2026-09-07 main 실재. 요일 배분은 권장 루틴. 오른쪽 3장은 실제 UI + 예시 데이터 캡처.');
  }

  // ───────── 12 사장님을 설득할 재료 = 권한 표 (+ 운영자 관리 화면) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '"왜 남에게 계정을 맡기죠?" 계약서가 아니라 시스템이 답합니다.', { w: 9, size: 25 });
    lead(s, '영업에서 가장 어려운 질문은 "왜 남에게 우리 가게 계정을 맡기느냐"입니다. 운영자(귀사)가 무엇을 할 수 있고 무엇이 막혀 있는지 화면으로 보여 드리면 됩니다.', { y: 1.95, w: 8.7, h: 0.7 });
    const rows = [
      ['상품 등록과 가격 설정', true, '매장 대신 이용권을 만들고 운영합니다'],
      ['주문과 예약 관리', true, '일상 운영 전부'],
      ['소개 파트너에게 제안', true, '인플루언서 DB 검색과 딜 제안까지 매장 대신 합니다'],
      ['정산계좌 등록과 변경', false, '주인만. 사장님이 소유자가 되기 전엔 계좌가 비어 정산이 나가지 않습니다'],
      ['사업자정보 열람과 수정', false, '등록번호 끝 4자리, 대표자명 첫 글자만. 주소와 연락처는 안 보입니다'],
      ['매장 탈퇴', false, '주인만 할 수 있습니다'],
      ['운영 권한 회수', null, '주인이 언제든. 올려 둔 이용권, 주문, 리뷰는 매장에 남습니다'],
    ];
    const tx = M, tw = 8.7, ty = 2.8, rh = 0.38;
    T(s, '운영자(귀사)가', { x: tx, y: ty, w: 2.6, h: 0.26, fontSize: 9.5, bold: true, color: C.gray });
    T(s, '내용', { x: tx + 3.55, y: ty, w: 3, h: 0.26, fontSize: 9.5, bold: true, color: C.gray });
    hr(s, tx, ty + 0.3, tw);
    rows.forEach(([k, ok, v], i) => {
      const y = ty + 0.38 + i * rh;
      T(s, k, { x: tx, y, w: 2.6, h: rh - 0.06, fontSize: 11.5, bold: ok === false, color: C.ink, valign: 'middle' });
      const pill = ok === true ? ['가능', 'DDF3E6', '1E7A46'] : ok === false ? ['차단', 'FCE4E4', 'B42323'] : ['주인만', C.brandSoft, C.brand];
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx + 2.7, y: y + 0.07, w: 0.7, h: rh - 0.2, rectRadius: 0.12, fill: { color: pill[1] }, line: { color: pill[1], width: 0 } });
      T(s, pill[0], { x: tx + 2.7, y: y + 0.07, w: 0.7, h: rh - 0.2, fontSize: 9.5, bold: true, color: pill[2], align: 'center', valign: 'middle' });
      T(s, v, { x: tx + 3.55, y, w: tw - 3.55, h: rh - 0.06, fontSize: 10.5, color: C.inkSoft, valign: 'middle' });
      hr(s, tx, y + rh - 0.03, tw);
    });
    card(s, M, 5.92, tw, 0.88, { fill: C.tint });
    T(s, '즉 매장의 돈이 다른 곳으로 갈 수 있는 경로가 시스템에 없습니다. 사장님께 "제가 통장을 못 건드립니다"라고 말씀하시고 화면으로 보여 주시면 됩니다. 이 문장 하나가 계약서 열 장보다 잘 통합니다.', { x: M + 0.3, y: 5.92, w: tw - 0.6, h: 0.88, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.36, valign: 'middle' });
    phone(s, 'seller-operators', 10.05, 1.15, 5.15, { caption: '운영자 관리 (예시 데이터)' });
    s.addNotes('store-operator-model.md §7.7 (마스킹: 계좌 ****1234 · 등록번호 끝 4자리 · 대표자명 첫 글자 · 주소/연락처 null · 계좌 변경/사업자정보 수정/탈퇴 403). 오른쪽은 /seller/operators 실제 UI 를 예시 데이터로 렌더한 캡처.');
  }

  // ───────── 13 유어딜이 대행사에게 해 주는 것 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '시작하실 때 유어딜이 곁에서 해 드리는 여섯 가지입니다.');
    const items = [
      ['FiUserCheck', '첫 매장 세 곳은 같이 갑니다', '첫 등록 세 건은 유어딜 담당자가 현장이나 통화로 동행합니다. 한 번 같이 하면 그다음은 혼자 됩니다.'],
      ['FiFileText', '사장님용 소개서 (PDF 9장)', '수수료, 정산, QR 사용법, 자주 묻는 질문까지 담긴 사장님용 소개서를 드립니다. 대행사 이름을 넣어 드립니다.'],
      ['FiUsers', '인플루언서 DB와 발송 대행', '20만 명 DB 탐색과 제안 발송을 유어딜이 합니다. 연락처를 모으거나 DM을 돌릴 필요가 없습니다.'],
      ['FiCreditCard', '결제, 정산, 환불, 세금', '토스 결제, 주간 정산, 미사용 환불, 원천징수를 유어딜이 처리합니다. 손님 CS도 유어딜로 옵니다.'],
      ['FiMapPin', '손님 유입', '홈 지도에 동네 기준으로 노출되고, 매장 페이지는 카톡 미리보기 카드와 네이버, 구글 검색에 잡힙니다. 6개 언어를 지원합니다.'],
      ['FiTrendingUp', '주간 실적 공유', '파일럿 기간에는 매주 매장별 판매와 사용 숫자를 유어딜이 먼저 보내 드립니다. 매장 보고서에 그대로 쓰시면 됩니다.'],
    ];
    const cw = (W - 2 * M - 0.8) / 3;
    items.forEach(([i, h, p], k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const x = M + col * (cw + 0.4), y = 2.25 + row * 2.25;
      iconCircle(s, i, x, y, 0.46);
      T(s, h, { x, y: y + 0.62, w: cw, h: 0.35, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x, y: y + 1.0, w: cw - 0.1, h: 1.1, fontSize: 11, color: C.inkSoft, lineSpacingMultiple: 1.45, valign: 'top' });
      if (row === 0) hr(s, x, y + 2.05, cw - 0.1);
    });
    s.addNotes('동행·안내장·주간 실적 공유는 파일럿 제안의 유어딜 측 약속. 나머지 셋은 현행 기능.');
  }

  // ───────── 14 한 가지는 미리 말씀드립니다 (운영자별 매출 귀속) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '한 가지는 미리 말씀드립니다.', { w: 8.6 });
    lead(s, '운영 대행을 맡기 전에 아셔야 하는 경계입니다. 감추지 않겠습니다.', { y: 1.95, w: 8.4, h: 0.4 });
    const lx = M, lw = 8.5;
    card(s, lx, 2.6, lw, 1.75);
    T(s, '운영자별 매출 귀속은 추적하지 않습니다', { x: lx + 0.35, y: 2.8, w: lw - 0.7, h: 0.3, fontSize: 13, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '화면의 숫자는 그 매장의 총액이고, 화면 자체가 그 사실을 문장으로 밝힙니다. "제가 만든 매출입니다"라고 쓸 수 있는 숫자는 드리지 않습니다. 방어 가능한 근거는 운영 시작 이후 구간뿐이고, 확정된 주문만 셉니다. 매장과 보수를 정하실 때 이 기준으로 정하시면 나중에 다툴 일이 없습니다.',
      { x: lx + 0.35, y: 3.15, w: lw - 0.7, h: 1.1, fontSize: 10.5, color: C.inkSoft, lineSpacingMultiple: 1.42, valign: 'top' });
    card(s, lx, 4.55, lw, 1.45, { fill: C.tint });
    T(s, '수수료 구조와 권한 설계는 코드로 확정되어 라이브에 있습니다', { x: lx + 0.35, y: 4.72, w: lw - 0.7, h: 0.3, fontSize: 12.5, bold: true, color: C.ink, charSpacing: -0.3 });
    T(s, '5%와 95%의 경계, 정산계좌 차단, 운영 요약 화면은 만들겠다는 약속이 아니라 지금 작동하는 기능입니다. 바뀔 수 있는 것은 요율 수치이고, 어드민 조정값이라 파트너와 합의 없이 움직이지 않습니다.',
      { x: lx + 0.35, y: 5.05, w: lw - 0.7, h: 0.9, fontSize: 10.5, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
    s.addShape(pres.shapes.LINE, { x: lx, y: 6.24, w: 0, h: 0.5, line: { color: C.brand, width: 2 } });
    T(s, '"중개사가 5% 내에서 가져가는 게 아니라, 나머지 95%에서 매장이랑 거래를 하는 거지. 5%는 중개사일 때 유어딜의 수수료인 거고."', { x: lx + 0.25, y: 6.2, w: lw - 0.25, h: 0.4, fontSize: 10.5, italic: true, color: C.ink, lineSpacingMultiple: 1.35, valign: 'top' });
    T(s, '유어딜 대표, 2026년 9월 4일 확정', { x: lx + 0.25, y: 6.55, w: lw, h: 0.22, fontSize: 9, color: C.gray });
    phone(s, 'seller-operating', 10.05, 1.15, 5.15, { caption: '운영 매장 요약. 화면이 그 경계를 직접 말합니다' });
    s.addNotes('09-14: "초기입니다(337 중 실제 1)" 블록 제거(대표 — 사장님 덱과 같은 판단). 귀속 미추적은 SellerOperatingSummaryPage 헤더 주석 그대로. 오른쪽은 /seller/operating 실제 UI + 예시 데이터.');
  }

  // ───────── 15 8주 파일럿 제안 ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '먼저 한두 곳만 해 보시죠. 8주에 열 곳이면 구조가 맞는지 판정이 납니다.', { size: 25 });
    card(s, M, 2.15, 4.0, 4.65, { fill: C.ink });
    label(s, '8주 목표', M + 0.35, 2.35, 3, { color: C.brand });
    const goals = [['10곳', '등록 매장'], ['30개', '판매 중 이용권 (매장당 3개)'], ['20건', '인플루언서 제안 접수'], ['1회', '매장별 실적 보고와 청구']];
    let gy = 2.75;
    goals.forEach(([n, l]) => {
      T(s, n, { x: M + 0.35, y: gy, w: 1.5, h: 0.6, fontSize: 28, bold: true, color: C.darkText, charSpacing: -1 });
      T(s, l, { x: M + 1.75, y: gy + 0.13, w: 2.1, h: 0.4, fontSize: 11, color: C.darkMuted, valign: 'middle' });
      gy += 0.92;
    });
    T(s, '먼저 한두 곳으로 시작해 한 달 정산이 실제로 도는 것을 보신 뒤 규모를 정하시길 권합니다. 숫자는 제안이고, 담당자 한 명 주 2일 기준입니다.', { x: M + 0.35, y: 6.15, w: 3.4, h: 0.6, fontSize: 9.5, color: C.darkMuted, lineSpacingMultiple: 1.35, valign: 'top' });
    const cx = M + 4.35, cw = (W - M - cx - 0.35) / 2;
    const cols = [
      ['대행사가 준비할 것', false, ['담당자 1명과 카카오 계정 (셀러 계정은 사업자 인증으로 10분)', '후보 매장 리스트 10~20곳 (7장 체크리스트 기준)', '매장과 맺을 보수 조건 초안 (매출 % 또는 월 정액. 유어딜은 관여하지 않습니다)', '첫 방문 일정 2주치']],
      ['유어딜이 준비할 것', true, ['첫 3매장 등록 동행 (현장 또는 통화)', '대행사 이름이 들어간 사장님용 안내 한 장', '인플루언서 제안 발송, 결제, 정산, 환불, CS 전부', '매주 매장별 판매와 사용 숫자 공유. 8주 뒤 함께 판정']],
    ];
    cols.forEach(([h, filled, items], ci) => {
      const x = cx + ci * (cw + 0.35);
      label(s, h, x, 2.3, cw);
      let py = 2.75;
      items.forEach((t, i) => {
        numBadge(s, i + 1, x, py, 0.36, { filled });
        T(s, t, { x: x + 0.5, y: py - 0.02, w: cw - 0.55, h: 0.85, fontSize: 11.5, color: C.ink, lineSpacingMultiple: 1.42, valign: 'top' });
        py += 0.98;
      });
    });
    s.addNotes('파일럿 조건은 이 문서의 제안. 유어딜은 대행사 보수 조건에 관여하지 않는다.');
  }

  // ───────── 16 손님 경험 (라이브 화면 4장) ─────────
  {
    const s = pres.addSlide();
    chrome(s);
    title(s, '손님은 화면 네 장이면 끝납니다. 그래서 매장이 올리면 팔립니다.', { size: 25 });
    const steps = [
      ['home', '발견', '홈에서 내 동네 기준으로 이용권이 뜹니다. 카톡 카드와 네이버, 구글 검색에도 잡힙니다.'],
      ['detail', '결제', '정가와 할인가를 함께 보고 토스로 결제합니다. 앱 설치나 가입 강요 구간이 없습니다.'],
      ['use', '사용', '매장에서 QR을 보여 주거나 매장 PIN을 입력합니다. 매장은 폰 한 대로 확인합니다.'],
      ['shop', '다시 찾기', '매장 페이지(유어샵)가 남습니다. 안 쓴 이용권은 100% 자동 환불이라 응대가 매장이나 대행사로 오지 않습니다.'],
    ];
    const ph = 3.4, pw = ph * ((780 + 44) / (1688 + 44));
    const colW = (W - 2 * M) / 4;
    steps.forEach(([key, h, p], k) => {
      const cx0 = M + k * colW;
      phone(s, key, cx0 + (colW - pw) / 2, 2.15, ph);
      T(s, h, { x: cx0, y: 5.7, w: colW - 0.2, h: 0.32, fontSize: 14, bold: true, color: C.ink, charSpacing: -0.3 });
      T(s, p, { x: cx0, y: 6.02, w: colW - 0.3, h: 0.75, fontSize: 10, color: C.inkSoft, lineSpacingMultiple: 1.38, valign: 'top' });
    });
    s.addNotes('4장 전부 2026-09-07 urdeal.kr 모바일 라이브 캡처(home/detail/use/shop). 지갑 화면은 로그인이 필요해 제외.');
  }

  // ───────── 17 FAQ + 시작하는 방법 + 연락처 ─────────
  {
    const s = pres.addSlide();
    chrome(s, { dark: true });
    title(s, '남은 질문에 답하고, 시작하는 방법을 남깁니다.', { dark: true });
    const faqs = [
      ['수수료가 두 번 나가나요?', '아닙니다. 유어딜이 떼는 것은 중개 매장 5% 하나뿐입니다. 귀사 보수는 매장이 귀사에게 직접 지급하고(세금계산서도 귀사와 매장 사이), 유어딜 정산서에 나오지 않습니다.'],
      ['사장님이 직접 계정을 만들면 우리 관계는요?', '계정 양도가 아니라 권한 변경입니다. 상품, 주문, 리뷰, 정산 이력은 매장에 그대로 남고, 귀사는 운영자로 계속 일할 수 있습니다.'],
      ['대행사가 유어딜에 내는 돈이 있나요?', '없습니다. 가입비, 월 이용료, 매장당 등록비 전부 없습니다. 매장에서 팔린 만큼만 유어딜 수수료가 나갑니다.'],
      ['매장 정산은 언제 되나요?', '손님이 매장에서 실제로 사용한 이용권만 주간 정산으로 매장 계좌에 들어옵니다. 안 쓴 이용권은 손님에게 자동 환불됩니다.'],
    ];
    const cw = 5.6;
    faqs.forEach(([q, a], i) => {
      const y = 2.15 + i * 1.15;
      T(s, q, { x: M, y, w: cw, h: 0.3, fontSize: 12.5, bold: true, color: C.darkText, charSpacing: -0.3 });
      T(s, a, { x: M, y: y + 0.33, w: cw, h: 0.75, fontSize: 10.5, color: C.darkMuted, lineSpacingMultiple: 1.42, valign: 'top' });
    });
    const px = M + cw + 0.55, py = 2.0, pw = W - M - px, ph = 4.55;
    card(s, px, py, pw, ph, { fill: C.darkSurface });
    label(s, '시작하는 방법', px + 0.35, py + 0.22, 3, { color: C.brand });
    const steps = [
      ['셀러 계정을 만드십시오', '별도의 대행사 가입 절차가 없습니다. 귀사도 매장과 같은 셀러 대시보드를 씁니다.'],
      ['매장을 중개로 등록하고, 운영비는 매장과 합의하십시오', '"누가 운영하나요"에서 중개를 고르면 5%. 귀사 보수는 95% 안에서 매장과 정하고, 매장이 귀사에게 직접 지급합니다.'],
      ['사장님을 소유자로 세우십시오', '사장님이 본인 카카오로 urdeal.kr/store/find 에서 등록증을 올리면 유어딜이 확인해 소유자로 지정합니다. 그 전엔 정산 계좌가 없어 정산이 나가지 않습니다.'],
    ];
    let sy = py + 0.6;
    steps.forEach(([h, p], i) => {
      numBadge(s, i + 1, px + 0.35, sy, 0.34);
      T(s, h, { x: px + 0.85, y: sy, w: pw - 1.2, h: 0.3, fontSize: 12, bold: true, color: C.darkText, charSpacing: -0.3 });
      T(s, p, { x: px + 0.85, y: sy + 0.31, w: pw - 1.2, h: 0.66, fontSize: 9.8, color: C.darkMuted, lineSpacingMultiple: 1.3, valign: 'top' });
      sy += 0.99;
    });
    hr(s, px + 0.35, py + 3.56, pw - 0.7, { dark: true });
    T(s, '후보 매장 몇 곳의 이름과 동네만 보내 주세요. 하루 안에 확인해 첫 방문 일정을 잡습니다.', { x: px + 0.35, y: py + 3.6, w: pw - 0.7, h: 0.26, fontSize: 9.5, color: C.darkText });
    const contact = [['FiMessageW', FACTS.kakaoChannel + '  카카오톡 채널'], ['FiMailW', FACTS.contactEmail], ['FiGlobeW', 'urdeal.kr'], ['FiFileTextW', '리스터코퍼레이션, 사업자등록번호 479-09-02930']];
    contact.forEach(([i, t], k) => {
      s.addImage({ data: ic[i], x: px + 0.35, y: py + 3.9 + k * 0.18, w: 0.15, h: 0.15 });
      T(s, t, { x: px + 0.62, y: py + 3.84 + k * 0.18, w: pw - 1.0, h: 0.27, fontSize: k === 3 ? 8.5 : 10.5, bold: k < 3, color: C.darkText, valign: 'middle' });
    });
    T(s, '이 문서의 요율(직접 10%, 중개 5%)과 권한 범위는 2026년 9월 13일 라이브 설정값입니다. 요율은 어드민 조정값이고, 평균가와 매장 수는 같은 날 실측입니다.', { x: M, y: 6.62, w: W - 2 * M, h: 0.24, fontSize: 8.5, color: C.darkMuted });
    s.addNotes('FAQ 출처: 사업계획서 C-3, 셀러 가이드, auto-settlement.ts. 채널 변경은 POST /api/seller/stores/:id/channel (소유자만) + 어드민.');
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT, '(17 slides)');
})().catch((e) => { console.error(e); process.exit(1); });
